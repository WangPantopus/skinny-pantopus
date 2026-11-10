//
//  MomentsUploader.swift
//  Pantopus
//
//  Posting a Moment keeps going after the Post sheet closes (board P5). The
//  Moment itself is made while the sheet is still up (so "20 today" or "no
//  connection" shows where the person can act); then its file goes up here
//  with retries on a weak connection, and your ring on the map shows the
//  progress ("Posting · 65%") until the Moment is live. Each one waits in its
//  own outbox folder, so an upload the app was closed in the middle of picks
//  up at the next launch (the server takes the same file again as a no-op).
//  The files go once it's done.
//

import Foundation
import Logging
import Observation
import UIKit

/// A Moment on its way to the map.
struct MomentPosting: Identifiable, Equatable {
    enum Phase: Equatable {
        case uploading
        /// The file is in; the picture check is running.
        case checking
        /// Live: the ring stays where it is until the map has read the real one.
        case live
        /// Stopped; Retry tries again.
        case failed(String)
    }

    let id: String
    let kind: MomentKind
    var momentId: String?
    var latitude: Double
    var longitude: Double
    var progress: Double
    var phase: Phase
    /// How long it shows for, for "Your Moment is live. It shows for 24 hours."
    var hours = 24
}

/// What a waiting upload needs after a relaunch.
private struct MomentOutboxManifest: Codable {
    let id: String
    let account: String
    let momentId: String
    let latitude: Double
    let longitude: Double
    let media: MomentPreparedMedia
    var hours: Int?
}

@Observable
@MainActor
final class MomentsUploader {
    static let shared = MomentsUploader()

    private(set) var postings: [MomentPosting] = []
    /// Bumped each time a Moment goes live or ends up held: the map reads its rings again.
    private(set) var finished = 0
    /// A sentence for the map after a Moment couldn't post or waits for review; the map clears it once shown.
    var notice: String?
    /// "Your Moment is live. It shows for 24 hours.": the map shows it for a few seconds, then clears it.
    var liveNote: String?

    @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]
    @ObservationIgnored private var media: [String: MomentPreparedMedia] = [:]
    @ObservationIgnored private var resumed = false
    private let logger = Logger(label: "app.pantopus.ios.MomentsUploader")
    /// Uploads get longer than the shared uploader's two minutes: a 50 MB video on a weak connection.
    private let uploader: MultipartUploader = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 90
        config.timeoutIntervalForResource = 900
        return MultipartUploader(session: URLSession(configuration: config))
    }()

    // MARK: - Posting

    /// A new outbox folder for a Moment's files.
    static func newFolder() throws -> (id: String, url: URL) {
        let id = UUID().uuidString
        let url = try outboxRoot().appendingPathComponent(id, isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return (id, url)
    }

    /// A folder made for a Moment that won't be posted (Retake, the composer closed).
    static func discardFolder(_ id: String) {
        guard let folder = try? outboxRoot().appendingPathComponent(id, isDirectory: true) else { return }
        try? FileManager.default.removeItem(at: folder)
    }

    /// A photo or video Moment was made (the Post sheet did that): its file, made in `folderId`, goes up from here.
    func upload(_ moment: MomentDTO, media prepared: MomentPreparedMedia, folderId: String) {
        let posting = MomentPosting(
            id: folderId,
            kind: moment.kind,
            momentId: moment.id,
            // With "Show the area instead" the pin is the area's point.
            latitude: moment.latitude,
            longitude: moment.longitude,
            progress: 0,
            phase: .uploading,
            hours: moment.hours
        )
        postings.insert(posting, at: 0)
        media[folderId] = prepared
        save(id: folderId, momentId: moment.id, media: prepared)
        run(folderId)
    }

    /// A text card is live the moment it's made: the map says so and reads its rings again.
    func wentLive(_ moment: MomentDTO) {
        announceLive(hours: moment.hours)
        finished += 1
    }

    /// The map has read the rings again: the posting rings that went live make way for the real ones.
    func clearLive() {
        postings.removeAll { $0.phase == .live }
    }

    /// Retry after a failure.
    func retry(_ id: String) {
        guard let index = postings.firstIndex(where: { $0.id == id }) else { return }
        postings[index].phase = .uploading
        run(id)
    }

    /// Give up on one: its files go.
    func discard(_ id: String) {
        tasks.removeValue(forKey: id)?.cancel()
        let momentId = postings.first { $0.id == id }?.momentId
        finish(id)
        // A Moment made but never uploaded would wait as "uploading" until it ends; delete it.
        if let momentId { Task { try? await MomentsAPI.send(MomentsEndpoints.delete(id: momentId)) } }
    }

    private func run(_ id: String) {
        tasks[id]?.cancel()
        tasks[id] = Task { [weak self] in
            await self?.carry(id)
        }
    }

    /// Sends the file with retries, then waits for the Moment to go live.
    private func carry(_ id: String) async {
        let background = UIApplication.shared.beginBackgroundTask(withName: "Moment upload")
        defer { UIApplication.shared.endBackgroundTask(background) }
        var attempt = 0
        while !Task.isCancelled {
            do {
                try await step(id)
                return
            } catch let failure as MomentsFailure where failure.isTransient && attempt < 8 {
                attempt += 1
                let delay = min(30.0, pow(2, Double(attempt)))
                try? await Task.sleep(for: .seconds(delay))
            } catch let failure as MomentsFailure {
                fail(id, failure)
                return
            } catch is CancellationError {
                return
            } catch {
                fail(id, .offline)
                return
            }
        }
    }

    private func step(_ id: String) async throws {
        guard let posting = postings.first(where: { $0.id == id }), let momentId = posting.momentId else { return }
        guard let prepared = media[id] ?? manifest(id)?.media else {
            finish(id)
            return
        }
        let uploaded = try await upload(id: id, momentId: momentId, media: prepared)
        await settle(id, state: uploaded.state, momentId: momentId)
    }

    private func upload(id: String, momentId: String, media: MomentPreparedMedia) async throws -> MomentDTO {
        let folder = try Self.outboxRoot().appendingPathComponent(id, isDirectory: true)
        let boundary = "PantopusBoundary-\(UUID().uuidString)"
        let body = try MomentsUploadBody.write(media: media, folder: folder, boundary: boundary)
        defer { try? FileManager.default.removeItem(at: body) }
        let (data, response): (Data, HTTPURLResponse)
        do {
            (data, response) = try await uploader.uploadMomentMedia(momentId: momentId, bodyFile: body, boundary: boundary) { fraction in
                Task { @MainActor [weak self] in
                    self?.update(id) { $0.progress = max($0.progress, fraction) }
                }
            }
        } catch let error as APIError {
            throw MomentsFailure(error)
        } catch is URLError {
            throw MomentsFailure.offline
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MomentsFailure(status: response.statusCode, body: data)
        }
        update(id) { $0.progress = 1 }
        return try JSONDecoder().decode(MomentEnvelope.self, from: data).moment
    }

    /// Live: the map says so and reads the ring. Checking: waits for the picture
    /// check (a minute at most). Held: says so.
    private func settle(_ id: String, state: MomentState, momentId: String) async {
        var state = state
        if state == .checking {
            update(id) { $0.phase = .checking }
            for _ in 0..<30 where state == .checking && !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                if let reply: MomentEnvelope = try? await MomentsAPI.send(MomentsEndpoints.moment(id: momentId)) {
                    state = reply.moment.state
                }
            }
        }
        let hours = postings.first { $0.id == id }?.hours ?? 24
        if state == .held {
            notice = "Your Moment is waiting for a quick review before it shows."
            finish(id)
        } else {
            // The posting ring stays put until the map has the real ring (`clearLive`), so nothing jumps.
            update(id) {
                $0.phase = .live
                $0.progress = 1
            }
            removeFiles(id)
            if state == .live { announceLive(hours: hours) }
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(6))
                self?.postings.removeAll { $0.id == id && $0.phase == .live }
            }
        }
        finished += 1
    }

    private func announceLive(hours: Int) {
        liveNote = "Your Moment is live. It shows for \(hours == 1 ? "1 hour" : "\(hours) hours")."
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func fail(_ id: String, _ failure: MomentsFailure) {
        logger.warning("Moment upload stopped: \(failure.message)")
        switch failure {
        case .mediaTooLong, .mediaRejected, .unavailable, .ended, .notFound:
            // Trying again won't help: say why and let it go.
            notice = failure == .ended || failure == .notFound ? "Your Moment ended before its file went up." : failure.message
            discard(id)
        default:
            update(id) { $0.phase = .failed(failure.message) }
        }
    }

    private func finish(_ id: String) {
        postings.removeAll { $0.id == id }
        removeFiles(id)
    }

    /// The upload's files and bookkeeping go; the posting ring is a separate matter.
    private func removeFiles(_ id: String) {
        media.removeValue(forKey: id)
        tasks.removeValue(forKey: id)
        if let folder = try? Self.outboxRoot().appendingPathComponent(id, isDirectory: true) {
            try? FileManager.default.removeItem(at: folder)
        }
    }

    private func update(_ id: String, _ change: (inout MomentPosting) -> Void) {
        guard let index = postings.firstIndex(where: { $0.id == id }) else { return }
        change(&postings[index])
    }

    // MARK: - After a relaunch

    /// Uploads the app was closed in the middle of, for the signed-in account, pick up again.
    func resume(account: String?) {
        guard !resumed, let account, let root = try? Self.outboxRoot() else { return }
        resumed = true
        let folders = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        for folder in folders {
            let id = folder.lastPathComponent
            let saved = manifest(id)
            guard let saved, saved.account == account else {
                // Never made on the server: nothing to finish. Another account's waits for it.
                if saved == nil { try? FileManager.default.removeItem(at: folder) }
                continue
            }
            postings.append(MomentPosting(
                id: id,
                kind: saved.media.kind,
                momentId: saved.momentId,
                latitude: saved.latitude,
                longitude: saved.longitude,
                progress: 0,
                phase: .uploading,
                hours: saved.hours ?? 24
            ))
            run(id)
        }
    }

    private func save(id: String, momentId: String, media: MomentPreparedMedia) {
        guard case let .signedIn(user) = AuthManager.shared.state,
              let posting = postings.first(where: { $0.id == id }),
              let folder = try? Self.outboxRoot().appendingPathComponent(id, isDirectory: true) else { return }
        let manifest = MomentOutboxManifest(
            id: id,
            account: user.id,
            momentId: momentId,
            latitude: posting.latitude,
            longitude: posting.longitude,
            media: media,
            hours: posting.hours
        )
        guard let data = try? JSONEncoder().encode(manifest) else { return }
        try? data.write(
            to: folder.appendingPathComponent("manifest.json"),
            options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
        )
    }

    private func manifest(_ id: String) -> MomentOutboxManifest? {
        guard let folder = try? Self.outboxRoot().appendingPathComponent(id, isDirectory: true),
              let data = try? Data(contentsOf: folder.appendingPathComponent("manifest.json")) else { return nil }
        return try? JSONDecoder().decode(MomentOutboxManifest.self, from: data)
    }

    /// Sign-out: nothing of the last account's waits.
    func reset() {
        for task in tasks.values {
            task.cancel()
        }
        tasks = [:]
        media = [:]
        postings = []
        liveNote = nil
        resumed = false
        if let root = try? Self.outboxRoot() { try? FileManager.default.removeItem(at: root) }
    }

    private static func outboxRoot() throws -> URL {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let root = support.appendingPathComponent("MomentsOutbox", isDirectory: true)
        if !FileManager.default.fileExists(atPath: root.path) {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var excluded = root
            try? excluded.setResourceValues(values)
        }
        return root
    }
}
