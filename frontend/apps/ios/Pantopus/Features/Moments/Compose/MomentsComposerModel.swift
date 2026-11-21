//
//  MomentsComposerModel.swift
//  Pantopus
//
//  Posting a Moment (boards P1–P4). The camera opens first and shows where
//  the Moment will pin before anything is taken: where the phone is now (a
//  fix at most five minutes old). A photo or video from the library, from any
//  time (founder, 2026-11-11), pins where it was taken; one taken more than a
//  day ago says when ("Taken Oct 3"). The Post sheet then shows the pin, the
//  place others will read (a venue near the pin can be picked, as on Pulse),
//  "Show the area instead", how long, who sees it and the caption; at your own
//  home it says so first. A photo or
//  video is made ready while the sheet is open, and the upload carries on
//  after it closes (`MomentsUploader`).
//

import CoreLocation
import Foundation
import Observation
import Photos
import UIKit

@Observable
@MainActor
final class MomentsComposerModel {
    enum Mode: String, CaseIterable {
        case library, camera, text
    }

    enum Draft: Equatable {
        case photo(UIImage)
        case video(URL)
        case text
    }

    enum Locating: Equatable {
        case locating
        case located
        /// Location is off for Pantopus, or no fix came.
        case unavailable
    }

    /// What stands before the camera: where you are first, then the 18+
    /// question. Nothing can be taken, picked or written until both are settled.
    enum Gate: Equatable {
        case locating
        case needsLocation
        case needsAdult
        case open
    }

    var mode: Mode = .camera
    /// A new picture (or none) starts with no marks: several picked together never carry one's marks to the next.
    private(set) var draft: Draft? {
        didSet { marking.clear() }
    }

    private(set) var locating: Locating = .locating
    private(set) var place: MomentPlacePreviewDTO?
    /// The server has said what this spot reads as and whether the 18+ answer is on file (or couldn't be reached).
    var previewSettled = false
    /// Location was asked for here and didn't come: the card offers Settings.
    private(set) var locationRefused = false
    /// The 18+ question before the first Moment, and its answer when it's no.
    var asksAdult = false
    var ageRefused = false
    /// The text card (P2).
    var text = "" {
        didSet { if text.count > Self.textLimit { text = String(text.prefix(Self.textLimit)) } }
    }

    var background = "teal"
    /// The place name picked on the Post sheet (a key from the preview's `places`); nil: the automatic one.
    var placeKey: String? {
        didSet { if placeKey != nil { venue = nil } }
    }

    /// A venue picked in the place picker (the Pulse composer's, around the pin): the Moment pins at it under its name.
    var venue: MomentVenue?
    /// "Don't show where" (founder 2026-11-11): no pin, not on the map, connections only.
    var noLocation = false
    /// Whether the person has a connection (place-preview's `has_connections`); nil until known.
    var hasConnections: Bool?
    /// "Post with no location" on the location card: posting goes on with location off.
    var choseNoLocation = false
    /// "Show elevation" (board H1, `+Height`): the Moment says how high above sea level it was made.
    var showHeight = false
    /// The Sky (`+Sky`, while the preview answers `sky: true`): "Pin it at a place" is on; off, the Moment is where
    /// it was taken.
    var pinsAtPlace = false
    /// The Sky's "Share later": the choice picked (`1h`, `3h`, `tonight`); nil posts now.
    var shareLaterKey: String?
    /// When the album photo or video was taken (any time); nil for the camera, a text card, or a file that never said.
    private(set) var takenAt: Date?
    /// The rest of what was picked together in the library, in the order picked (`+Several`): each takes the sheet
    /// when the one before it has posted. And how many were picked together.
    var waiting: [PHAsset] = []
    var pickedTogether = 0
    // The Post sheet (P3).
    var showArea = false
    var hours = 24
    var audience: MomentAudience = .nearby
    var caption = "" {
        didSet { if caption.count > Self.captionLimit { caption = String(caption.prefix(Self.captionLimit)) } }
    }

    private(set) var preparing = false
    var error: String?
    var isPosting = false
    /// From the request that makes the Moment until that Post ends: Retake can't drop the draft then (`+Posting`).
    var isSending = false
    /// The place names' sheet over the Post sheet, kept here so a fold on the iPhone Duo leaves it as it was.
    var picksPlace = false
    /// The place picker (search and the venues around the pin) over the Post sheet, kept here for the same reason.
    var findsPlace = false
    /// The camera, held here so a fold on the iPhone Duo (which builds the camera screen again) keeps a recording going.
    let camera = MomentsCameraModel()
    /// Text and Draw on the photo (`+Marks`): its marks and the editor, held here so a fold keeps them.
    let marking = MomentsMarking()
    /// The camera's shot, for the Live mark and the weather (`+Live`).
    let live = MomentsLiveShot()

    static let textLimit = 200
    static let captionLimit = 100
    static let backgrounds = ["teal", "sky", "green", "amber", "rose", "slate"]

    /// The fix the camera and text card pin at.
    @ObservationIgnored var fix: (coordinate: UserCoordinate, at: Date)?
    /// Where and when a library photo or video was taken.
    @ObservationIgnored private(set) var capture: MediaCaptureLocation?
    /// How high the fix, and the library photo or video, say it was (`+Height`).
    @ObservationIgnored var fixHeight: HeightReading?
    @ObservationIgnored var captureHeight: HeightReading?
    /// What's being made ready: one outbox folder and its files for each Moment (several for a long video's parts).
    @ObservationIgnored var preparation: Task<[MomentsPreparedPart]?, Never>?
    /// How many Moments the video on the sheet posts as (`+Parts`); 1 for anything else.
    private(set) var parts = 1
    /// The Moments a Post tap has made so far, should the tap stop half way (`+Posting`).
    @ObservationIgnored var made: [MomentDTO] = []
    /// One id per text card sent to the Post sheet: tapping Post again after a lost answer returns the same Moment.
    @ObservationIgnored var textRequestId = UUID().uuidString
    /// `start` runs once: a fold can show the composer again, and the place and choices must stay as they are.
    @ObservationIgnored private var started = false
    let location: any LocationProviding
    let defaults: UserDefaults

    init(location: any LocationProviding = DeviceLocationProvider.shared, defaults: UserDefaults = .standard) {
        self.location = location
        self.defaults = defaults
        // The camera's own photo or video is also the shot for the Live mark (`+Live`).
        camera.onPhoto = { [weak self] image in self?.tookPhoto(image) }
        camera.onVideo = { [weak self] url in
            Task { await self?.tookVideo(url) }
        }
    }

    // MARK: - Opening

    var gate: Gate {
        switch locating {
        case .locating: .locating
        case .unavailable: choseNoLocation ? (asksAdult ? .needsAdult : (previewSettled ? .open : .locating)) : .needsLocation
        case .located: asksAdult ? .needsAdult : (previewSettled ? .open : .locating)
        }
    }

    /// Finds where the Moment will pin and what that place reads as, then asks
    /// the 18+ question once. Where location hasn't been allowed yet, the
    /// card asks first (`allowLocation`).
    func start() async {
        guard !started else { return }
        started = true
        MomentsDraftFiles.sweep(keeping: draft?.video)
        restoreChoices()
        // How long a video may be now, and how large its file: asked once each time the composer opens.
        Task { await MomentsLimits.refresh() }
        guard location.canLocateWithoutAsking else {
            locating = .unavailable
            return
        }
        await locate()
    }

    /// "Allow location" on the card: the system asks; a refusal leaves Settings.
    func allowLocation() async {
        await locate()
        if locating == .unavailable { locationRefused = true }
    }

    /// Back from Settings: location may be allowed now.
    func recheckLocation() async {
        guard locating == .unavailable, location.canLocateWithoutAsking else { return }
        locationRefused = false
        await locate()
    }

    private func locate() async {
        locating = .locating
        guard let coordinate = await location.requestCurrent(timeoutSeconds: 8) else {
            locating = .unavailable
            return
        }
        fix = (coordinate, Date())
        fixHeight = location.cachedHeight()
        locating = .located
        await preview(latitude: coordinate.latitude, longitude: coordinate.longitude)
        previewSettled = true
    }

    private func preview(latitude: Double, longitude: Double) async {
        do {
            let reply: MomentPlacePreviewDTO = try await MomentsAPI.send(MomentsEndpoints.placePreview(
                latitude: latitude,
                longitude: longitude
            ))
            place = reply
            // A new spot starts where it was taken: a place is always picked for the spot on the sheet.
            pinsAtPlace = false
            if let has = reply.hasConnections { hasConnections = has }
            // A picked name stays only while it still fits the pin.
            if let placeKey, !reply.places.contains(where: { $0.key == placeKey }) { self.placeKey = nil }
            if reply.adultConfirmed == false { asksAdult = true }
        } catch let failure as MomentsFailure {
            if failure == .adultConfirmRequired { asksAdult = true }
        } catch {}
    }

    /// "I'm 18 or older": true when Moments can be posted.
    func confirmAdult() async -> Bool {
        do {
            try await MomentsAPI.send(MomentsEndpoints.adultConfirm)
            asksAdult = false
            return true
        } catch let failure as MomentsFailure where failure == .ageNotEligible {
            asksAdult = false
            ageRefused = true
            return false
        } catch {
            self.error = "Couldn't save that. Try again."
            return false
        }
    }

    // MARK: - What's posted

    func use(photo: UIImage) {
        capture = nil
        takenAt = nil
        draft = .photo(photo)
        prepare([{ folder in try MomentsMediaExport.photo(photo, into: folder) }])
    }

    func use(video url: URL) async {
        capture = nil
        takenAt = nil
        await useVideo(url)
    }

    /// A photo or video from the album, from any time: it pins where it was taken, when the file says; one taken
    /// more than a day ago says when on the Moment.
    func use(asset: PHAsset) async {
        error = nil
        let taken = asset.creationDate ?? Date()
        takenAt = asset.creationDate
        // Photos reads exactly 0 m for a photo or video whose file has no height: that is not a height.
        captureHeight = asset.location.flatMap { $0.altitude == 0 ? nil : HeightReading($0) }
        var point = asset.location.map {
            MediaCaptureLocation(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude, capturedAt: taken)
        }
        switch asset.mediaType {
        case .video:
            guard asset.duration <= MomentsMediaExport.longestVideoSeconds + MomentsMediaExport.videoSecondsTolerance else {
                error = MomentsFailure.mediaTooLong.message
                return
            }
            guard let url = await MomentsLibraryLoader.videoFile(for: asset) else {
                error = "Couldn't open that video."
                return
            }
            // Photos has no place for it: the file's own tag says where it was taken.
            if point == nil, let tagged = await MomentsMediaExport.location(of: url) {
                point = MediaCaptureLocation(latitude: tagged.latitude, longitude: tagged.longitude, capturedAt: taken)
            }
            capture = point
            await useVideo(url)
            // Too long to post after all: nothing will read the copy.
            if draft != .video(url) { MomentsDraftFiles.drop(url) }
        default:
            guard let image = await MomentsLibraryLoader.image(for: asset) else {
                error = "Couldn't open that photo."
                return
            }
            capture = point
            draft = .photo(image)
            prepare([{ folder in try MomentsMediaExport.photo(image, into: folder) }])
        }
        if let point { await preview(latitude: point.latitude, longitude: point.longitude) }
    }

    private func useVideo(_ url: URL) async {
        let seconds = await MomentsMediaExport.duration(of: url)
        guard seconds <= MomentsMediaExport.longestVideoSeconds + MomentsMediaExport.videoSecondsTolerance else {
            error = MomentsFailure.mediaTooLong.message
            return
        }
        draft = .video(url)
        prepareVideo(url, seconds: seconds)
    }

    /// A video longer than one Moment's is cut into equal parts, each made ready as a Moment of its own, with the
    /// marks (`overlay`) over every frame of each.
    private func prepareVideo(_ url: URL, seconds: Double, overlay: MomentsVideoEncoder.Overlay? = nil) {
        let ranges = MomentsMediaExport.parts(of: seconds)
        prepare(ranges.map { range in
            { folder in try await MomentsMediaExport.video(at: url, into: folder, part: ranges.count > 1 ? range : nil, overlay: overlay) }
        })
    }

    /// P2's Next: the text card goes to the Post sheet.
    func finishText() {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        textRequestId = UUID().uuidString
        takenAt = nil
        draft = .text
    }

    /// Retake (P3) or Edit (P4): back to the camera, or to the text. While Post only waits (for the fix, or for the
    /// file to be made ready) it cancels that Post, and no Moment is made; once the request that makes the Moment has
    /// gone out it does nothing until the Post ends, so the Moment never loses its file.
    func retake() {
        guard !isSending else { return }
        preparation?.cancel()
        if case .text = draft {} else { discardPrepared() }
        MomentsDraftFiles.drop(draft?.video)
        draft = nil
        error = nil
        if capture != nil, let fix { Task { await preview(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude) } }
        capture = nil
        takenAt = nil
        (waiting, pickedTogether) = ([], 0)
        live.clear()
    }

    /// The one on the sheet has posted: the next of the ones picked together takes the sheet, with its own place and
    /// words and the same "How long" and "Who sees it". False when none is left: the composer closes.
    func moveOn() async -> Bool {
        // The one that posted: the outbox has its files now, so its library copy or recording goes.
        MomentsDraftFiles.drop(draft?.video)
        guard !waiting.isEmpty else { return false }
        isPosting = true
        defer { isPosting = false }
        let wasElsewhere = capture != nil
        (caption, venue, placeKey) = ("", nil, nil)
        while !waiting.isEmpty {
            (capture, takenAt) = (nil, nil)
            await use(asset: waiting.removeFirst())
            // One that can't be opened is passed over; the next takes its turn.
            guard error == nil else { continue }
            // It never said where it was taken, and the one before it did: the sheet is back where you are.
            if capture == nil, wasElsewhere, let here = fix?.coordinate {
                await preview(latitude: here.latitude, longitude: here.longitude)
            }
            return true
        }
        pickedTogether = 0
        return false
    }

    /// Exports in the background while the Post sheet is open: one outbox folder for each of `works`, in order.
    private func prepare(_ works: [@MainActor (URL) async throws -> MomentPreparedMedia]) {
        discardPrepared()
        preparing = true
        parts = works.count
        preparation = Task { [weak self] in
            defer { self?.preparing = false }
            var ready: [MomentsPreparedPart] = []
            do {
                for work in works {
                    let folder = try MomentsUploader.newFolder()
                    ready.append(MomentsPreparedPart(folderId: folder.id, media: nil))
                    try Task.checkCancellation()
                    ready[ready.count - 1].media = try await work(folder.url)
                }
                return ready
            } catch let failure as MomentsFailure {
                self?.error = failure.message
            } catch is CancellationError {
                // Retake, or the composer closed: nothing to say.
            } catch {
                self?.error = "Couldn't get that ready to post. Try another one."
            }
            // One part that can't be made leaves no parts: a video with a hole in it isn't posted.
            for part in ready {
                MomentsUploader.discardFolder(part.folderId)
            }
            return nil
        }
    }

    func discardPrepared() {
        dropMade()
        guard let preparation else { return }
        self.preparation = nil
        Task {
            for part in await preparation.value ?? [] {
                MomentsUploader.discardFolder(part.folderId)
            }
        }
    }

    // MARK: - The Post sheet

    /// Where the photo was taken, or the fix: what the place picker looks around and what's sent as the location.
    var basePin: CLLocationCoordinate2D? {
        if let capture { return CLLocationCoordinate2D(latitude: capture.latitude, longitude: capture.longitude) }
        return fix.map { CLLocationCoordinate2D(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude) }
    }
}

// MARK: - Text, Draw and Resize's Done

extension MomentsComposerModel {
    /// The marks editor's Done (`+Marks`): the photo, at most 2048 px, carries `marks`, and goes up as the 9:16 canvas
    /// when it's placed (Resize). The draft and its export change in one step, and the export draws them in off the
    /// main thread, so a Post tapped next waits for them.
    func use(marked base: UIImage, _ marks: MomentMarks, placement: MomentPlacement? = nil) {
        guard !isPosting, case .photo = draft else { return }
        let backdrop = marking.backdrop
        draft = .photo(base)
        marking.keep(marks, base: base, placement: placement, backdrop: backdrop)
        // Done before the colours were read: the Post screen reads them again (the export reads them for itself).
        if placement != nil, backdrop == nil { marking.sampleBackdrop(base) }
        if let placement {
            let export: @MainActor (URL) async throws -> MomentPreparedMedia = { folder in
                try await MomentPlacementDrawing.export(base, at: placement, backdrop: backdrop, marks, into: folder)
            }
            prepare([export])
        } else {
            prepare([{ folder in try await MomentMarksDrawing.export(base, marks, into: folder) }])
        }
    }

    /// The same for a video: every part is exported again with the marks over every frame; Post waits for it.
    func use(marked url: URL, video: (size: CGSize, seconds: Double), _ marks: MomentMarks) {
        guard !isPosting, case .video = draft else { return }
        draft = .video(url)
        marking.keep(marks, base: nil, video: video)
        // The export running for the video as it was is no longer wanted.
        preparation?.cancel()
        let aspect = video.size.width / max(video.size.height, 1)
        prepareVideo(url, seconds: video.seconds, overlay: MomentMarksDrawing.overlay(marks, aspect: aspect))
    }
}
