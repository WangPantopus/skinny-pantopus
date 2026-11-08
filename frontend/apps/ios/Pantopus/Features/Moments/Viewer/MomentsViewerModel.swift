//
//  MomentsViewerModel.swift
//  Pantopus
//
//  Watching Moments (boards V1–V5): the rings in the order the map gave
//  them, one Moment at a time. A photo shows for about six seconds, a text
//  card a little longer when it's long, a video for its length. Holding,
//  typing a reply, the menus and Seen by pause it. Each Moment is counted
//  once, when it shows; the map turns it grey at once.
//

import AVFoundation
import Foundation
import Observation
import UIKit

@Observable
@MainActor
final class MomentsViewerModel {
    enum Load: Equatable {
        case loading
        case ready
        /// Ended or no longer visible: a line, then the next one.
        case gone(String)
        case failed(String)
    }

    /// A sentence over the viewer for a moment, with one optional action ("Undo").
    struct Toast: Equatable {
        let id = UUID()
        let text: String
        var action: String?
    }

    private(set) var rings: [MomentRingDTO]
    private(set) var ringIndex: Int
    private(set) var momentIndex: Int
    private(set) var moment: MomentDTO?
    private(set) var load: Load = .loading
    private(set) var image: UIImage?
    /// How far the Moment showing has played, 0 to 1.
    private(set) var progress: Double = 0
    private(set) var myReaction: String?
    private(set) var toast: Toast?
    private(set) var viewers: MomentViewersResponse?
    private(set) var isSaving = false
    /// The viewer is done: the view dismisses.
    private(set) var isClosed = false
    var muted = false {
        didSet { video.isMuted = muted }
    }

    /// Pauses: a finger held down, a reply being typed or the reactions open, a menu or Seen by.
    var holding = false {
        didSet { applyPause() }
    }

    var replying = false {
        didSet { applyPause() }
    }

    var covered = false {
        didSet { applyPause() }
    }

    let video = MomentsVideoController()
    let cache = MomentsViewerCache()
    let newOnly: Bool
    @ObservationIgnored private var counted: Set<String> = []
    @ObservationIgnored private var clock: Task<Void, Never>?
    @ObservationIgnored private var loading: Task<Void, Never>?
    @ObservationIgnored private var toastAction: (@MainActor () -> Void)?
    @ObservationIgnored private let onWatched: @MainActor (Set<String>) -> Void
    private static let photoSeconds = 6.0

    init(request: MomentsWatchRequest, onWatched: @escaping @MainActor (Set<String>) -> Void) {
        rings = request.rings
        newOnly = request.newOnly
        ringIndex = min(max(request.start, 0), max(request.rings.count - 1, 0))
        momentIndex = 0
        self.onWatched = onWatched
        momentIndex = startIndex(in: ringIndex)
        video.onProgress = { [weak self] fraction in self?.progress = fraction }
        video.onEnd = { [weak self] in self?.next() }
    }

    // MARK: - What shows

    var ring: MomentRingDTO? {
        rings.indices.contains(ringIndex) ? rings[ringIndex] : nil
    }

    var brief: MomentBriefDTO? {
        guard let ring, ring.moments.indices.contains(momentIndex) else { return nil }
        return ring.moments[momentIndex]
    }

    var isMine: Bool {
        ring?.mine ?? false
    }

    var isPaused: Bool {
        holding || replying || covered || load != .ready
    }

    /// "Vancouver Community Library · 2h ago · 22h left".
    var meta: String {
        guard let ring else { return "" }
        let created = moment?.createdAtDate ?? brief.flatMap { MomentTime.parse($0.createdAt) }
        let ends = moment?.expiresAtDate ?? brief?.expiresAtDate
        let place = moment?.placeLabel ?? ring.placeLabel
        return [place, MomentTime.ago(created), MomentTime.left(ends)].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // MARK: - Playing

    /// The viewer appeared: load and play the first one.
    func start() {
        show()
    }

    func stop() {
        clock?.cancel()
        loading?.cancel()
        video.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func close() {
        stop()
        isClosed = true
    }

    /// Tap right.
    func next() {
        guard let ring else { return close() }
        if let index = nextIndex(in: ring, after: momentIndex) {
            momentIndex = index
            show()
        } else {
            nextRing()
        }
    }

    /// Tap left: the one before, else the start of this one.
    func previous() {
        if momentIndex > 0 {
            momentIndex -= 1
        } else if ringIndex > 0 {
            ringIndex -= 1
            momentIndex = 0
        }
        show()
    }

    /// Swipe left: the next ring nearby.
    func nextRing() {
        guard ringIndex + 1 < rings.count else { return close() }
        ringIndex += 1
        momentIndex = startIndex(in: ringIndex)
        show()
    }

    /// Swipe right: the ring before.
    func previousRing() {
        guard ringIndex > 0 else { return }
        ringIndex -= 1
        momentIndex = startIndex(in: ringIndex)
        show()
    }

    /// Tries the one showing again after a failure.
    func retry() {
        show()
    }

    private func show() {
        clock?.cancel()
        loading?.cancel()
        video.stop()
        progress = 0
        image = nil
        guard let brief else { return close() }
        moment = cache.cached(brief.id)
        myReaction = moment?.myReaction
        viewers = nil
        load = .loading
        let id = brief.id
        loading = Task { [weak self] in await self?.prepare(id) }
    }

    /// Reads the Moment (its signed media link), then shows its picture, video or card.
    private func prepare(_ id: String) async {
        do {
            let detail = try await cache.detail(id)
            guard brief?.id == id, !Task.isCancelled else { return }
            moment = detail
            myReaction = detail.myReaction
            try await present(detail)
            prefetchNext()
        } catch is CancellationError {
            return
        } catch {
            guard brief?.id == id else { return }
            fail(id, error as? MomentsFailure)
        }
    }

    private func present(_ detail: MomentDTO) async throws {
        switch detail.kind {
        case .text:
            ready(detail.id)
        case .photo:
            image = try await cache.picture(for: detail)
            guard brief?.id == detail.id, !Task.isCancelled else { return }
            ready(detail.id)
        case .video:
            guard let url = detail.media else { throw MomentsFailure.notFound }
            if !muted { try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback) }
            video.isMuted = muted
            video.onReady = { [weak self] in
                guard let self, brief?.id == detail.id else { return }
                ready(detail.id)
            }
            video.load(url)
        }
    }

    private func fail(_ id: String, _ failure: MomentsFailure?) {
        switch failure {
        case .ended:
            load = .gone("This Moment has ended.")
            skipSoon(id)
        case .notFound, .unavailable:
            load = .gone("This Moment isn't available.")
            skipSoon(id)
        case let failure?:
            load = .failed(failure.message)
        case nil:
            load = .failed("Couldn't load this Moment.")
        }
    }

    private func ready(_ id: String) {
        load = .ready
        count(id)
        applyPause()
    }

    private func skipSoon(_ id: String) {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.2))
            guard let self, brief?.id == id else { return }
            next()
        }
    }

    /// Paused or playing, as the pauses say.
    private func applyPause() {
        clock?.cancel()
        guard load == .ready, let moment else { return }
        if moment.kind == .video {
            if isPaused { video.pause() } else { video.play() }
            return
        }
        guard !isPaused else { return }
        let seconds = duration(of: moment)
        clock = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(50))
                guard let self, !Task.isCancelled else { return }
                progress = min(1, progress + 0.05 / seconds)
                if progress >= 1 {
                    next()
                    return
                }
            }
        }
    }

    /// About six seconds; a long text card a little longer (up to ten).
    private func duration(of moment: MomentDTO) -> Double {
        guard moment.kind == .text, let text = moment.text else { return Self.photoSeconds }
        return min(10, max(Self.photoSeconds, Double(text.count) / 18))
    }

    // MARK: - Counting and watching

    private func count(_ id: String) {
        guard !counted.contains(id) else { return }
        counted.insert(id)
        for ringIndex in rings.indices {
            if let index = rings[ringIndex].moments.firstIndex(where: { $0.id == id }) {
                rings[ringIndex].moments[index].seen = true
            }
        }
        // Grey on the map at once; the server keeps it watched.
        onWatched([id])
        guard !isMine else { return }
        Task { try? await MomentsAPI.send(MomentsEndpoints.view(id: id)) }
    }

    private func startIndex(in index: Int) -> Int {
        guard rings.indices.contains(index) else { return 0 }
        return rings[index].moments.firstIndex { !$0.seen } ?? 0
    }

    /// The next to play in a ring: the next one, or with Play all the next not watched.
    private func nextIndex(in ring: MomentRingDTO, after index: Int) -> Int? {
        let rest = ring.moments.indices.filter { $0 > index }
        return newOnly ? rest.first { !ring.moments[$0].seen } : rest.first
    }

    /// The next Moment's details and picture, so the next tap shows it at once.
    private func prefetchNext() {
        guard let ring else { return }
        if let index = nextIndex(in: ring, after: momentIndex) {
            cache.prefetch(ring.moments[index].id)
        } else if rings.indices.contains(ringIndex + 1), let first = rings[ringIndex + 1].moments.indices.first {
            let start = startIndex(in: ringIndex + 1)
            cache.prefetch(rings[ringIndex + 1].moments[rings[ringIndex + 1].moments.indices.contains(start) ? start : first].id)
        }
    }

    // MARK: - Toasts

    func show(_ toast: Toast, action: (@MainActor () -> Void)? = nil) {
        self.toast = toast
        toastAction = action
        let id = toast.id
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(toast.action == nil ? 2.5 : 4))
            if self?.toast?.id == id { self?.toast = nil }
        }
    }

    func runToastAction() {
        toastAction?()
        toastAction = nil
        toast = nil
    }
}

// MARK: - Reacting, replying, the … menu and your own

extension MomentsViewerModel {
    /// A quick reaction; the one already chosen takes it back.
    func react(_ emoji: PostReactionEmoji) async {
        guard let moment else { return }
        let choice: String? = myReaction.flatMap(PostReactionEmoji.init(wire:)) == emoji ? nil : emoji.rawValue
        let before = myReaction
        myReaction = choice
        do {
            let reply: MomentReactionResponse = try await MomentsAPI.send(MomentsEndpoints.react(id: moment.id, emoji: choice))
            myReaction = reply.myReaction
        } catch {
            myReaction = before
            show(Toast(text: (error as? MomentsFailure)?.message ?? "Couldn't react. Try again."))
        }
    }

    /// Sends the reply to Messages; true when it went.
    func reply(_ text: String) async -> Bool {
        guard let moment else { return false }
        let trimmed = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1000))
        guard !trimmed.isEmpty else { return false }
        do {
            let _: MomentReplyResponse = try await MomentsAPI.send(MomentsEndpoints.reply(id: moment.id, text: trimmed))
            show(Toast(text: "Sent to \(moment.author.shortName) in Messages"))
            return true
        } catch {
            show(Toast(text: (error as? MomentsFailure)?.message ?? "Couldn't send. Try again."))
            return false
        }
    }

    func report(reason: String) async {
        guard let moment else { return }
        do {
            try await MomentsAPI.send(MomentsEndpoints.report(id: moment.id, reason: reason))
            show(Toast(text: "Thanks for telling us. We'll take a look."))
        } catch {
            show(Toast(text: (error as? MomentsFailure)?.message ?? "Couldn't send the report. Try again."))
        }
    }

    /// Mutes the author's Moments: their rings leave, with an Undo.
    func muteAuthor(onHide: @escaping @MainActor (String) -> Void, onShow: @escaping @MainActor (String) -> Void) async {
        guard let author = ring?.author else { return }
        do {
            try await MomentsAPI.send(MomentsEndpoints.mute(authorId: author.id))
            onHide(author.id)
            show(Toast(text: "You won't see \(author.shortName)'s Moments.", action: "Undo")) {
                Task {
                    try? await MomentsAPI.send(MomentsEndpoints.unmute(authorId: author.id))
                    onShow(author.id)
                }
            }
            dropAuthor(author.id)
        } catch {
            show(Toast(text: (error as? MomentsFailure)?.message ?? "Couldn't mute. Try again."))
        }
    }

    /// Blocks the author: neither of you sees the other's Moments.
    func blockAuthor(onHide: @escaping @MainActor (String) -> Void) async {
        guard let author = ring?.author else { return }
        do {
            try await APIClient.shared.request(BlocksEndpoints.block(userId: author.id))
            onHide(author.id)
            show(Toast(text: "You blocked \(author.name)."))
            dropAuthor(author.id)
        } catch {
            show(Toast(text: "Couldn't block \(author.shortName). Try again."))
        }
    }

    /// Their rings leave the queue; the next one plays, or the viewer closes.
    private func dropAuthor(_ id: String) {
        let currentRingId = ring?.id
        let before = rings.prefix(ringIndex).filter { $0.author.id != id }.count
        rings.removeAll { $0.author.id == id }
        guard !rings.isEmpty else { return close() }
        ringIndex = min(before, rings.count - 1)
        if ring?.id != currentRingId {
            momentIndex = startIndex(in: ringIndex)
            show()
        }
    }

    func loadViewers() async {
        guard let moment, isMine else { return }
        viewers = try? await MomentsAPI.send(MomentsEndpoints.viewers(id: moment.id))
    }

    /// Deletes the Moment showing; the viewer moves on.
    func delete() async -> Bool {
        guard let moment else { return false }
        do {
            try await MomentsAPI.send(MomentsEndpoints.delete(id: moment.id))
        } catch let failure as MomentsFailure where failure != .ended && failure != .notFound {
            show(Toast(text: failure.message))
            return false
        } catch {}
        cache.forget(moment.id)
        rings[ringIndex].moments.removeAll { $0.id == moment.id }
        if rings[ringIndex].moments.isEmpty {
            rings.remove(at: ringIndex)
            guard !rings.isEmpty, ringIndex < rings.count else {
                close()
                return true
            }
            momentIndex = startIndex(in: ringIndex)
        } else {
            momentIndex = min(momentIndex, rings[ringIndex].moments.count - 1)
        }
        show()
        return true
    }

    /// Save to Photos: the picture, the video, or the text card drawn as a picture.
    func save(card: UIImage?) async {
        guard let moment, !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await MomentsSaveToPhotos.save(moment: moment, picture: moment.kind == .text ? card : image, session: cache.session)
            show(Toast(text: "Saved to Photos"))
        } catch {
            show(Toast(text: (error as? MomentsFailure)?.message ?? "Couldn't save to Photos."))
        }
    }
}
