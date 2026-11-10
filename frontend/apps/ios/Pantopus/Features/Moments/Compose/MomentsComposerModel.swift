//
//  MomentsComposerModel.swift
//  Pantopus
//
//  Posting a Moment (boards P1–P4). The camera opens first and shows where
//  the Moment will pin before anything is taken: where the phone is now (a
//  fix at most five minutes old). A photo or video from the library, taken in
//  the last 24 hours, pins where it was taken. The Post sheet then shows the
//  pin, the place others will read, "Show the area instead", how long, who
//  sees it and the caption; at your own home it says so first. A photo or
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
    private(set) var previewSettled = false
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
    var placeKey: String?
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

    static let textLimit = 200
    static let captionLimit = 100
    static let backgrounds = ["teal", "sky", "green", "amber", "rose", "slate"]

    /// The fix the camera and text card pin at.
    @ObservationIgnored private var fix: (coordinate: UserCoordinate, at: Date)?
    /// Where and when a library photo or video was taken.
    @ObservationIgnored private var capture: MediaCaptureLocation?
    @ObservationIgnored private var preparation: Task<(String, MomentPreparedMedia)?, Never>?
    /// One id per text card sent to the Post sheet: tapping Post again after a lost answer returns the same Moment.
    @ObservationIgnored private var textRequestId = UUID().uuidString
    private let location: any LocationProviding
    private let defaults: UserDefaults

    init(location: any LocationProviding = DeviceLocationProvider.shared, defaults: UserDefaults = .standard) {
        self.location = location
        self.defaults = defaults
    }

    // MARK: - Opening

    var gate: Gate {
        switch locating {
        case .locating: .locating
        case .unavailable: .needsLocation
        case .located: asksAdult ? .needsAdult : (previewSettled ? .open : .locating)
        }
    }

    /// Finds where the Moment will pin and what that place reads as, then asks
    /// the 18+ question once. Where location hasn't been allowed yet, the
    /// card asks first (`allowLocation`).
    func start() async {
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

    /// The place chip: "Esther Short Park", "Your home" at home (as the Post sheet says; others read the
    /// town), or why there's no pin yet.
    var placeChip: String {
        switch locating {
        case .locating: "Finding where you are…"
        case .unavailable: "Location is off"
        case .located:
            if place?.atHome == true { "Your home" } else { place?.placeLabel.isEmpty == false ? place?.placeLabel ?? "" : "Near you" }
        }
    }

    // MARK: - What's posted

    func use(photo: UIImage) {
        capture = nil
        draft = .photo(photo)
        prepare { folder in try MomentsMediaExport.photo(photo, into: folder) }
    }

    func use(video url: URL) async {
        capture = nil
        await useVideo(url)
    }

    /// A photo or video from the last 24 hours: it pins where it was taken, when the file says.
    func use(asset: PHAsset) async {
        error = nil
        let taken = asset.creationDate ?? Date()
        guard Date().timeIntervalSince(taken) <= 24 * 3600 else {
            error = MomentsFailure.captureTooOld.message
            return
        }
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

    /// What the place row says: the place (the picked name, when one was picked), the town for an area, or
    /// "Your home".
    var placeLine: String {
        if showArea { return place?.areaLabel ?? place?.placeLabel ?? "This area" }
        if place?.atHome == true { return "Your home" }
        if let picked = pickedPlace { return picked.label }
        return place?.placeLabel.isEmpty == false ? place?.placeLabel ?? "" : "Near you"
    }

    /// The names to pick from: more than one fits the exact pin, and neither the area nor the home hides it.
    var placeChoices: [MomentPlaceChoiceDTO] {
        guard let place, place.places.count > 1, !showArea, !place.atHome else { return [] }
        return place.places
    }

    /// The name the person picked, while it can still be picked.
    var pickedPlace: MomentPlaceChoiceDTO? {
        guard let placeKey else { return nil }
        return placeChoices.first { $0.key == placeKey }
    }

    /// The row with the check: the picked one, else the automatic one (the first).
    var selectedPlaceKey: String? {
        pickedPlace?.key ?? placeChoices.first?.key
    }

    var showsHomeNotice: Bool {
        place?.atHome == true && !showArea
    }

    /// The pin the sheet's map shows.
    var pin: CLLocationCoordinate2D? {
        if let capture { return CLLocationCoordinate2D(latitude: capture.latitude, longitude: capture.longitude) }
        return fix.map { CLLocationCoordinate2D(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude) }
    }

    var canPost: Bool {
        !isPosting && pin != nil && draft != nil && !asksAdult
    }

    var postLabel: String {
        "Post · shows for \(hours == 1 ? "1 hour" : "\(hours) hours")"
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
        guard let pinAt = await pinLocation() else {
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
        let body = MomentCreateBody(
            kind: kind,
            hours: hours,
            audience: audience,
            showArea: showArea,
            caption: kind == .text || trimmedCaption.isEmpty ? nil : trimmedCaption,
            text: kind == .text ? text.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            background: kind == .text ? background : nil,
            location: pinAt,
            // The outbox folder's id (or the text card's) names this Post tap: a retry returns the same Moment.
            clientRequestId: (prepared?.0 ?? textRequestId).lowercased(),
            // Only a name other than the automatic one is sent; the server checks it against the pin itself.
            placeKey: pickedPlace.flatMap { $0.key == placeChoices.first?.key ? nil : $0.key }
        )
        let created: MomentDTO
        do {
            created = try await MomentsAPI.send(MomentsEndpoints.create(body), as: MomentEnvelope.self).moment
        } catch let failure as MomentsFailure {
            if failure == .adultConfirmRequired { asksAdult = true } else { error = failure.message }
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

    // MARK: - The last choices

    /// The sheet opens with the last "How long" and "Who sees it" (kept on the
    /// phone, per account). "Show the area instead" always starts off.
    private func restoreChoices() {
        guard let account = Self.account else { return }
        let savedHours = defaults.integer(forKey: Self.hoursKey(account))
        if [1, 6, 24, 48].contains(savedHours) { hours = savedHours }
        if let saved = defaults.string(forKey: Self.audienceKey(account)).flatMap(MomentAudience.init(rawValue:)) { audience = saved }
    }

    private func saveChoices() {
        guard let account = Self.account else { return }
        defaults.set(hours, forKey: Self.hoursKey(account))
        defaults.set(audience.rawValue, forKey: Self.audienceKey(account))
    }

    private static var account: String? {
        guard case let .signedIn(user) = AuthManager.shared.state else { return nil }
        return user.id
    }

    private static func hoursKey(_ account: String) -> String {
        "pantopus.moments.lastHours.\(account)"
    }

    private static func audienceKey(_ account: String) -> String {
        "pantopus.moments.lastAudience.\(account)"
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
        }
        guard let fix, Date().timeIntervalSince(fix.at) <= 290 else { return nil }
        return MomentLocationBody(source: .gps, latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude, at: fix.at)
    }

    /// The composer closed without posting: nothing is left behind.
    func abandon() {
        preparation?.cancel()
        discardPrepared()
    }
}
