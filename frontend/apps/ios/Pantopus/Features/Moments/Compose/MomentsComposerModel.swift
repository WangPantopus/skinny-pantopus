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
    private(set) var draft: Draft?
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
    private(set) var venue: MomentVenue?
    /// "Don't show where" (founder 2026-11-11): no pin, not on the map, connections only.
    var noLocation = false
    /// Whether the person has a connection (place-preview's `has_connections`); nil until known.
    var hasConnections: Bool?
    /// "Post with no location" on the location card: posting goes on with location off.
    var choseNoLocation = false
    /// "Show height" (board H1, `+Height`): the Moment says how high above sea level it was made.
    var showHeight = false
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
    private(set) var isPosting = false
    /// The place names' sheet over the Post sheet, kept here so a fold on the iPhone Duo leaves it as it was.
    var picksPlace = false
    /// The place picker (search and the venues around the pin) over the Post sheet, kept here for the same reason.
    var findsPlace = false
    /// The camera, held here so a fold on the iPhone Duo (which builds the camera screen again) keeps a recording going.
    let camera = MomentsCameraModel()

    static let textLimit = 200
    static let captionLimit = 100
    static let backgrounds = ["teal", "sky", "green", "amber", "rose", "slate"]

    /// The fix the camera and text card pin at.
    @ObservationIgnored private var fix: (coordinate: UserCoordinate, at: Date)?
    /// Where and when a library photo or video was taken.
    @ObservationIgnored private(set) var capture: MediaCaptureLocation?
    /// How high the fix, and the library photo or video, say it was (`+Height`).
    @ObservationIgnored var fixHeight: HeightReading?
    @ObservationIgnored var captureHeight: HeightReading?
    @ObservationIgnored private var preparation: Task<(String, MomentPreparedMedia)?, Never>?
    /// One id per text card sent to the Post sheet: tapping Post again after a lost answer returns the same Moment.
    @ObservationIgnored private var textRequestId = UUID().uuidString
    /// `start` runs once: a fold can show the composer again, and the place and choices must stay as they are.
    @ObservationIgnored private var started = false
    private let location: any LocationProviding
    let defaults: UserDefaults

    init(location: any LocationProviding = DeviceLocationProvider.shared, defaults: UserDefaults = .standard) {
        self.location = location
        self.defaults = defaults
        camera.onPhoto = { [weak self] image in self?.use(photo: image) }
        camera.onVideo = { [weak self] url in
            Task { await self?.use(video: url) }
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
        restoreChoices()
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
        prepare { folder in try MomentsMediaExport.photo(photo, into: folder) }
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
        captureHeight = asset.location.flatMap(HeightReading.init)
        var point = asset.location.map {
            MediaCaptureLocation(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude, capturedAt: taken)
        }
        switch asset.mediaType {
        case .video:
            guard asset.duration <= MomentsMediaExport.maxVideoSeconds + MomentsMediaExport.videoSecondsTolerance else {
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
        default:
            guard let image = await MomentsLibraryLoader.image(for: asset) else {
                error = "Couldn't open that photo."
                return
            }
            capture = point
            draft = .photo(image)
            prepare { folder in try MomentsMediaExport.photo(image, into: folder) }
        }
        if let point { await preview(latitude: point.latitude, longitude: point.longitude) }
    }

    private func useVideo(_ url: URL) async {
        let seconds = await MomentsMediaExport.duration(of: url)
        guard seconds <= MomentsMediaExport.maxVideoSeconds + MomentsMediaExport.videoSecondsTolerance else {
            error = MomentsFailure.mediaTooLong.message
            return
        }
        draft = .video(url)
        prepare { folder in try await MomentsMediaExport.video(at: url, into: folder) }
    }

    /// P2's Next: the text card goes to the Post sheet.
    func finishText() {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        textRequestId = UUID().uuidString
        takenAt = nil
        draft = .text
    }

    /// Retake (P3) or Edit (P4): back to the camera, or to the text.
    func retake() {
        preparation?.cancel()
        if case .text = draft {} else { discardPrepared() }
        draft = nil
        error = nil
        if capture != nil, let fix { Task { await preview(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude) } }
        capture = nil
        takenAt = nil
        waiting = []
        pickedTogether = 0
    }

    /// The one on the sheet has posted: the next of the ones picked together takes the sheet, with its own place and
    /// words and the same "How long" and "Who sees it". False when none is left: the composer closes.
    func moveOn() async -> Bool {
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

    /// Exports in the background while the Post sheet is open.
    private func prepare(_ work: @escaping @MainActor (URL) async throws -> MomentPreparedMedia) {
        discardPrepared()
        preparing = true
        preparation = Task { [weak self] in
            defer { self?.preparing = false }
            do {
                let folder = try MomentsUploader.newFolder()
                let media = try await work(folder.url)
                return (folder.id, media)
            } catch let failure as MomentsFailure {
                self?.error = failure.message
                return nil
            } catch {
                self?.error = "Couldn't get that ready to post. Try another one."
                return nil
            }
        }
    }

    private func discardPrepared() {
        guard let preparation else { return }
        self.preparation = nil
        Task {
            if let prepared = await preparation.value { MomentsUploader.discardFolder(prepared.0) }
        }
    }

    // MARK: - The Post sheet

    /// Where the photo was taken, or the fix: what the place picker looks around and what's sent as the location.
    var basePin: CLLocationCoordinate2D? {
        if let capture { return CLLocationCoordinate2D(latitude: capture.latitude, longitude: capture.longitude) }
        return fix.map { CLLocationCoordinate2D(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude) }
    }

    /// A place picked in the place picker: a venue near the pin names the Moment and moves its pin there (the server
    /// finds it again by its id). Only venues are offered (see the sheet's filter).
    func pickVenue(_ tag: PostPlaceTag) {
        guard let id = tag.placeId, id.hasPrefix("osm:"), let basePin else { return }
        placeKey = nil
        venue = MomentVenue(placeId: id, name: tag.name, latitude: tag.latitude, longitude: tag.longitude, around: basePin)
        findsPlace = false
    }

    /// "Remove location" in the place picker: back to the name the spot gets by itself.
    func clearVenue() {
        venue = nil
        findsPlace = false
    }
}

// MARK: - Posting

extension MomentsComposerModel {
    /// Posts. The Moment is made here, while the sheet is still up, so what
    /// can stop it ("20 Moments today", an old location, no connection) shows
    /// where the person can act; then the sheet closes and only the file goes
    /// up in the background. True when the composer can close.
    func post() async -> Bool {
        guard canPost, let draft else { return false }
        isPosting = true
        defer { isPosting = false }
        error = nil
        // No location: nothing to locate (connections only, no pin).
        var located: MomentLocationBody? = .noLocation
        if !noLocationOn { located = await pinLocation() }
        guard let pinAt = located else {
            error = "Turn on location to post a Moment."
            return false
        }
        let trimmedCaption = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        let kind: MomentKind = switch draft {
        case .photo: .photo
        case .video: .video
        case .text: .text
        }
        // A photo or video is made ready first: a Moment is never made for a file that can't be sent.
        var prepared: (String, MomentPreparedMedia)?
        if kind != .text {
            guard let ready = await preparation?.value else {
                if error == nil { error = "Couldn't get that ready to post. Try another one." }
                return false
            }
            prepared = ready
        }
        let body = createBody(
            kind: kind,
            location: pinAt,
            // The outbox folder's id (or the text card's) names this Post tap: a retry returns the same Moment.
            requestId: (prepared?.0 ?? textRequestId).lowercased(),
            caption: trimmedCaption
        )
        let created: MomentDTO
        do {
            created = try await MomentsAPI.send(MomentsEndpoints.create(body), as: MomentEnvelope.self).moment
        } catch let failure as MomentsFailure {
            refused(failure)
            return false
        } catch {
            self.error = MomentsFailure.offline.message
            return false
        }
        saveChoices()
        if let prepared {
            preparation = nil
            MomentsUploader.shared.upload(created, media: prepared.1, folderId: prepared.0)
        } else {
            MomentsUploader.shared.wentLive(created)
        }
        return true
    }

    /// What the server said no to, where the person can act on it.
    private func refused(_ failure: MomentsFailure) {
        if failure == .placeNotNearby { venue = nil }
        if failure == .noConnections {
            hasConnections = false
            noLocation = false
        }
        if failure == .adultConfirmRequired { asksAdult = true } else { error = failure.message }
    }

    /// The create request for what's on the Post sheet.
    private func createBody(kind: MomentKind, location: MomentLocationBody, requestId: String, caption: String) -> MomentCreateBody {
        MomentCreateBody(
            kind: kind,
            hours: hours,
            // No location goes only to connections ("Everyone nearby" needs a place).
            audience: noLocationOn ? .connections : audience,
            showArea: showArea && !noLocationOn,
            caption: kind == .text || caption.isEmpty ? nil : caption,
            text: kind == .text ? text.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            background: kind == .text ? background : nil,
            location: location,
            clientRequestId: requestId,
            // Only a name other than the automatic one is sent; the server checks it against the pin itself.
            placeKey: pickedVenue == nil && !noLocationOn ? pickedPlace.flatMap { $0.key == placeChoices.first?.key ? nil : $0.key } : nil,
            // An album item pinned where you are says when it was taken (a capture pin carries its own).
            takenAt: kind != .text && capture == nil ? takenAt.map(MomentTime.string) : nil,
            venueId: noLocationOn ? nil : pickedVenue?.placeId,
            altitude: shownHeight
        )
    }

    /// The pin: where a library item was taken, else a fix at most four and a half minutes old.
    private func pinLocation() async -> MomentLocationBody? {
        if let capture {
            return MomentLocationBody(
                source: .capture, latitude: capture.latitude, longitude: capture.longitude, at: capture.capturedAt ?? Date()
            )
        }
        if fix == nil || Date().timeIntervalSince(fix?.at ?? .distantPast) > 270,
           let fresh = await location.requestCurrent(timeoutSeconds: 6) {
            fix = (fresh, Date())
            fixHeight = location.cachedHeight()
        }
        guard let fix, Date().timeIntervalSince(fix.at) <= 290 else { return nil }
        return MomentLocationBody(source: .gps, latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude, at: fix.at)
    }

    /// The composer closed without posting: nothing is left behind.
    func abandon() {
        camera.stop(discarding: true)
        preparation?.cancel()
        discardPrepared()
    }
}
