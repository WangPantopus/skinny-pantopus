//
//  MomentsStudioPostKind+Posting.swift
//  Pantopus
//
//  Post, for a picture or words made into one of today's Pulse posts ("+ Ask / Kind", CONTRACT 6d). It is today's
//  request, `POST /api/posts` with the body today's composer sends (`PostCreateRequest`), plus one optional field only
//  the Studio sends, `studio`: where the stamps sit, the phone's height for an elevation stamp, "Also show in Explore",
//  and what decides whether "now" stamps (weather, sunset) may be kept: the photo's own time for a library pick, or the
//  camera's shot with a fresh fix. The server fills every stamp's value. Then the photo, marks drawn in, goes up as
//  today's post photo (`POST /api/upload/post-media/:id`), as today's composer sends it.
//
//  Sent while the switch is off for the author, the post is refused with `403 PULSE_REINVENTED_OFF` and nothing is
//  posted: the switch is read again, and off, today's composer takes the draft (`MomentsComposerChoice`).
//

import Foundation

/// `POST /api/posts` from the Studio: today's body with `studio` added beside its keys.
struct StudioPostBody: Encodable {
    let base: PostCreateRequest
    let studio: StudioPostFields

    private enum Key: String, CodingKey {
        case studio
    }

    func encode(to encoder: any Encoder) throws {
        try base.encode(to: encoder)
        var container = encoder.container(keyedBy: Key.self)
        try container.encode(studio, forKey: .studio)
    }
}

/// The `studio` field (CONTRACT 6d). Keys left nil are left out.
struct StudioPostFields: Encodable {
    let stamps: [MomentStampPlacement]
    let elevation: MomentAltitudeBody?
    let explore: Bool?
    let takenAt: String?
    let takenHere: Bool?
    let fix: StudioPostFix?
    var eyesOn: Bool? // Phase 3's Eyes on (CONTRACT 8f): an Ask about a picked place; set by `TogetherStudio`, else left out.

    private enum CodingKeys: String, CodingKey {
        case stamps, elevation, explore, fix
        case takenAt = "taken_at"
        case takenHere = "taken_here"
        case eyesOn = "eyes_on"
    }
}

/// The phone's fix, for the server's check that the camera's shot was taken here just now; used for that only.
struct StudioPostFix: Encodable {
    let latitude: Double
    let longitude: Double
    let fixAt: String

    private enum CodingKeys: String, CodingKey {
        case latitude, longitude
        case fixAt = "fix_at"
    }
}

enum StudioPostEndpoints {
    /// `POST /api/posts` with the Studio's `studio` field (CONTRACT 6d). Route `backend/routes/posts.js` (create).
    static func create(_ body: StudioPostBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts", body: body)
    }
}

extension MomentsComposerModel {
    /// Posts the picture or the words as the kind picked. True when the composer can close.
    func postStudioKind() async -> Bool {
        guard let kind = studioPostKind, let draft, !isPosting else { return false }
        if let blocker = studioKindBlocker {
            error = blocker.message
            return false
        }
        isPosting = true
        defer { (isPosting, isSending) = (false, false) }
        error = nil
        let placed = studioPostPlaced
        if placed { await freshenStudioFix() }
        guard !placed || pin != nil else {
            error = "Turn on location for Pantopus in Settings, or choose Friends."
            return false
        }
        var photo: Data?
        if case .photo = draft {
            photo = await studioPreparedPhoto()
            guard photo != nil else {
                error = "Couldn't get that ready to post. Try another one."
                return false
            }
        }
        isSending = true
        if studioPost.requestId == nil { studioPost.requestId = UUID().uuidString.lowercased() }
        let body = StudioPostBody(
            base: studioPostRequest(kind, placed: placed),
            studio: studioPostFields(kind, placed: placed, photo: photo != nil)
        )
        do {
            let response: PostCreateResponse = try await APIClient.shared.request(StudioPostEndpoints.create(body))
            guard let postId = response.postId, !postId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                error = "Post could not be confirmed. Try again."
                return false
            }
            if let photo, await !sendStudioPhoto(photo, postId: postId) {
                // The post is made: Post again sends the same request (its id), then the photo again.
                error = "Post saved. The photo could not be confirmed. Try again."
                return false
            }
            discardPrepared()
            marking.studio?.post = MomentsStudioPostDraft()
            PulsePostsRefresh.notifyPostsDidChange(postId: postId)
            return true
        } catch let failure as APIError {
            if case .forbidden = failure {
                // The switch may be off for this person now (CONTRACT 1): read it again.
                await PulseReinventedFlags.shared.recheck()
            }
            error = failure.errorDescription ?? "Couldn't post. Try again."
        } catch {
            self.error = "Couldn't post. Try again."
        }
        return false
    }

    /// The photo, as today's post photo. A Live Photo whose motion is kept (PHASE-5 C, CONTRACT 10b's last part) goes
    /// with its clip paired exactly as today's Pulse composer pairs one: a second file and `slots` with `liveVideoIndex`,
    /// so readers get today's `live_photo` and `media_live_urls`. Nothing new on the server.
    private func sendStudioPhoto(_ photo: Data, postId: String) async -> Bool {
        var files = [MultipartFile(fieldName: "files", filename: "studio.jpg", mimeType: "image/jpeg", data: photo)]
        var slot = ["fileIndex": 0]
        if studioKeepsMotion, PulseReinventedFlags.shared.isOn, let clip = studioMotionClip,
           let motion = try? Data(contentsOf: clip.file) {
            slot["liveVideoIndex"] = files.count
            files.append(MultipartFile(fieldName: "files", filename: "live-0.mp4", mimeType: "video/mp4", data: motion))
        }
        let media = files.count > 1 ? (try? JSONEncoder().encode([slot])).flatMap { String(bytes: $0, encoding: .utf8) } : nil
        return await (try? MultipartUploader.shared.uploadPostMedia(postId: postId, files: files, media: media)) != nil
    }

    /// Today's post body for what the Studio holds.
    private func studioPostRequest(_ kind: StudioPostKind, placed: Bool) -> PostCreateRequest {
        let post = studioPost
        let madeUp = postsUnderMadeUpName
        let gps = placed && capture == nil ? fix : nil
        let digits = post.phone.filter(\.isNumber)
        let venueName = post.venue.trimmingCharacters(in: .whitespacesAndNewlines)
        var request = PostCreateRequest(
            content: studioPostWords.trimmingCharacters(in: .whitespacesAndNewlines),
            postType: kind.rawValue,
            visibility: placed ? "neighborhood" : "connections",
            postAs: madeUp ? "pen_name" : "personal",
            latitude: placed ? pin?.latitude : nil,
            longitude: placed ? pin?.longitude : nil,
            locationName: placed ? pickedVenue?.name : nil,
            gpsTimestamp: gps.map { MomentTime.string($0.at) },
            gpsLatitude: gps?.coordinate.latitude,
            gpsLongitude: gps?.coordinate.longitude,
            // Under a made-up name: no profile (today's composer leaves these out there).
            showOnProfile: madeUp ? nil : true,
            profileVisibilityScope: madeUp ? nil : "local_context",
            eventDate: kind == .event ? post.eventStart.map(Self.wallClock) : nil,
            eventEndDate: kind == .event ? post.eventEnd.map(Self.wallClock) : nil,
            eventVenue: kind == .event && !venueName.isEmpty ? venueName : nil,
            safetyAlertKind: kind == .alert ? post.alertKind.rawValue : nil,
            lostFoundType: kind == .lostFound ? (post.found ? "found" : "lost") : nil,
            contactPref: kind == .lostFound ? post.contact : nil,
            contactPhone: kind == .lostFound && post.contact == "phone" ? digits : nil,
            audience: placed ? "nearby" : "connections",
            purpose: kind.purpose
        )
        request.clientRequestId = post.requestId
        if placed, let capture {
            let taken = PostMediaLocation(
                latitude: capture.latitude,
                longitude: capture.longitude,
                capturedAt: capture.capturedAt.map(MomentTime.string)
            )
            request.mediaLocations = [taken]
        }
        if placed, TogetherStudio.shared.asksEyesOn(model: self) == true { request.geocodePlaceId = pickedVenue?.placeId } // 8f
        return request
    }

    /// The `studio` field: the stamps on the photo, and what the server checks to keep "now" stamps.
    private func studioPostFields(_ kind: StudioPostKind, placed: Bool, photo: Bool) -> StudioPostFields {
        let stamps = photo ? studioStamps : []
        var elevation: MomentAltitudeBody?
        if stamps.contains(where: { $0.kind == .elevation }), let reading = capture != nil ? captureHeight : fixHeight {
            elevation = MomentAltitudeBody(meters: reading.meters, accuracyM: reading.accuracyMeters, speedMps: reading.speedMps)
        }
        // The camera's own shot, here, now: the Live mark's checks (`+Live`); a library pick says its own time instead.
        let shot = placed && capture == nil && takenAt == nil ? fix : nil
        var here = false
        var sentFix: StudioPostFix?
        if let shot {
            let coordinate = shot.coordinate
            let sent = MomentLocationBody(source: .gps, latitude: coordinate.latitude, longitude: coordinate.longitude, at: shot.at)
            here = liveFields(sending: sent).takenHere == true
            sentFix = StudioPostFix(latitude: coordinate.latitude, longitude: coordinate.longitude, fixAt: MomentTime.string(shot.at))
        }
        return StudioPostFields(
            stamps: stamps,
            elevation: elevation,
            explore: kind.mayGoToExplore && offersExplore && studioExplore ? true : nil,
            takenAt: takenAt.map(MomentTime.string),
            takenHere: photo && here ? true : nil,
            fix: sentFix,
            eyesOn: TogetherStudio.shared.asksEyesOn(model: self) // Phase 3 (CONTRACT 8f): nil unless chosen.
        )
    }

    /// A fix at most four and a half minutes old, as a Moment's Post takes (`+Posting`).
    private func freshenStudioFix() async {
        guard capture == nil, fix == nil || Date().timeIntervalSince(fix?.at ?? .distantPast) > 270 else { return }
        if let fresh = await location.requestCurrent(timeoutSeconds: 6) {
            fix = (fresh, Date())
            fixHeight = location.cachedHeight()
        }
    }

    /// The photo as it posts, marks drawn in: the file the composer made ready for it (`prepare`).
    private func studioPreparedPhoto() async -> Data? {
        guard let part = await preparation?.value?.first, let media = part.media,
              let support = try? FileManager.default.url(
                  for: .applicationSupportDirectory,
                  in: .userDomainMask,
                  appropriateFor: nil,
                  create: false
              )
        else { return nil }
        // The Moments outbox (`MomentsUploader`): one folder for each file made ready.
        let file = support
            .appendingPathComponent("MomentsOutbox", isDirectory: true)
            .appendingPathComponent(part.folderId, isDirectory: true)
            .appendingPathComponent(media.file)
        return try? Data(contentsOf: file)
    }

    /// An event's time as today's apps store it: the wall-clock time picked, labelled UTC.
    private static func wallClock(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:00'Z'"
        return formatter.string(from: date)
    }
}
