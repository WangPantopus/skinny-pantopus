//
//  MomentsComposerModel+Posting.swift
//  Pantopus
//
//  The Post tap. The Moment is made while the sheet is still up, so what can
//  stop it shows where the person can act; then the sheet closes and only the
//  file goes up in the background (`MomentsUploader`). A video longer than
//  one Moment's (contract v3.11) is posted as its parts: a Moment for each,
//  made in order under one `series`, so a ring plays them in order; the
//  caption goes on the first. Their files then go up in that order.
//

import Foundation

/// One Moment's files being made ready: its outbox folder, and what's in it once the export is done.
struct MomentsPreparedPart {
    let folderId: String
    var media: MomentPreparedMedia?
}

extension MomentsComposerModel {
    /// Posts. True when the composer can close.
    func post() async -> Bool {
        guard canPost, let draft else { return false }
        isPosting = true
        defer { (isPosting, isSending) = (false, false) }
        error = nil
        // Retake while Post only waits (for the fix, or for the file below) cancels it: no Moment is made.
        let preparing = preparation
        // No location: nothing to locate (connections only, no pin).
        var located: MomentLocationBody? = .noLocation
        if !noLocationOn { located = await pinLocation() }
        guard stillOn(preparing) else { return false }
        guard let pinAt = located else {
            error = "Turn on location to post a Moment."
            return false
        }
        let trimmedCaption = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        let kind = draft.kind
        guard kind != .text else {
            beginSending()
            return await postText(location: pinAt)
        }
        // A photo or video is made ready first: a Moment is never made for a file that can't be sent.
        let ready = await (preparation?.value ?? []).compactMap { part in part.media.map { (part.folderId, $0) } }
        // Retake as the wait ended has dropped the files already: stop before a Moment is made for them.
        guard stillOn(preparing) else { return false }
        guard !ready.isEmpty else {
            // A video whose marks or placement couldn't be put on it never posts without them; say so again.
            let marked = kind == .video && (!marking.marks.isEmpty || marking.placement != nil)
            if error == nil { error = marked ? MomentsMediaExport.marksFailed : "Couldn't get that ready to post. Try another one." }
            return false
        }
        beginSending()
        // A long video's parts share one id, named after the first part's folder: a second tap sends the same.
        let seriesId = ready.count > 1 ? ready[0].0.lowercased() : nil
        // The Live mark, decided once for every part: a tap that carries on follows what the server kept on the first.
        let marks = made.first.map(MomentLiveFields.init(following:)) ?? liveFields(sending: pinAt)
        for (index, part) in ready.enumerated() where index >= made.count {
            var body = createBody(
                kind: kind,
                location: pinAt,
                // The outbox folder's id names this part of this Post tap: a retry returns the same Moment.
                requestId: part.0.lowercased(),
                caption: index == 0 ? trimmedCaption : "",
                marks: marks
            )
            body.series = seriesId.map { MomentSeriesDTO(id: $0, index: index + 1, count: ready.count) }
            // The Studio's step deck (CONTRACT 7g): one step per Moment, never a video posted in parts; nil otherwise.
            body.deck = seriesId == nil ? takeDeckStep() : nil
            body.loop = seriesId == nil ? takeLoop() : nil
            do {
                try await made.append(MomentsAPI.send(createEndpoint(body, part: index), as: MomentEnvelope.self).moment)
            } catch let failure as MomentsFailure {
                refused(failure)
                return false
            } catch {
                self.error = MomentsFailure.offline.message
                return false
            }
        }
        saveChoices()
        preparation = nil
        MomentsUploader.shared.upload(parts: zip(made, ready).map { moment, part in
            MomentsUploadPart(moment: moment, media: part.1, folderId: part.0)
        })
        // The Studio's sound (CONTRACT 7e) goes up once its Moment is made; nothing without one.
        uploadStudioSounds(to: made.first)
        made = []
        return true
    }

    /// The draft Post was tapped on is still on the sheet: Retake drops its export (a new pick replaces it).
    private func stillOn(_ preparing: Task<[MomentsPreparedPart]?, Never>?) -> Bool {
        draft != nil && preparation == preparing
    }

    /// The request that makes the Moment goes out: from here to the end of this Post, Retake does nothing
    /// (`retake()`), so the files stay; a "Discard this Moment?" asked while Post waited closes.
    private func beginSending() {
        isSending = true
        marking.asksRetake = false
    }

    private func postText(location: MomentLocationBody) async -> Bool {
        let body = createBody(kind: .text, location: location, requestId: textRequestId.lowercased(), caption: "")
        do {
            let created = try await MomentsAPI.send(createEndpoint(body, part: 0), as: MomentEnvelope.self).moment
            saveChoices()
            MomentsUploader.shared.wentLive(created)
            return true
        } catch let failure as MomentsFailure {
            refused(failure)
        } catch {
            self.error = MomentsFailure.offline.message
        }
        return false
    }

    /// A Post tap that stopped half way through a long video's parts, then Retake or the composer closing: the
    /// Moments it made have no files and never will.
    func dropMade() {
        let ids = made.map(\.id)
        made = []
        guard !ids.isEmpty else { return }
        Task {
            for id in ids {
                try? await MomentsAPI.send(MomentsEndpoints.delete(id: id))
            }
        }
    }

    /// What the server said no to, where the person can act on it.
    private func refused(_ failure: MomentsFailure) {
        if failure == .placeNotNearby { venue = nil }
        if failure == .noPlaceHere { return noPlaceToPin() }
        if failure == .noConnections {
            hasConnections = false
            noLocation = false
        }
        if failure == .adultConfirmRequired { asksAdult = true } else { error = failure.message }
    }

    /// The create request for what's on the Post sheet.
    private func createBody(
        kind: MomentKind,
        location: MomentLocationBody,
        requestId: String,
        caption: String,
        marks: MomentLiveFields = MomentLiveFields()
    ) -> MomentCreateBody {
        var body = MomentCreateBody(
            kind: kind,
            hours: hours,
            // No location goes only to connections ("Everyone nearby" needs a place).
            audience: noLocationOn ? .connections : audience,
            // Under the Sky a Moment at home says so too: should the server's switch go off meanwhile, it still shows
            // only its area.
            showArea: floats && !noLocationOn,
            caption: kind == .text || caption.isEmpty ? nil : caption,
            text: kind == .text ? text.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            background: kind == .text ? background : nil,
            location: location,
            clientRequestId: requestId,
            // Only a name other than the automatic one is sent; the server checks it against the pin itself.
            placeKey: pickedVenue == nil && !noLocationOn ? pickedPlace.flatMap { $0.key == placeChoices.first?.key ? nil : $0.key } : nil,
            // An album item pinned where you are says when it was taken (a capture pin carries its own).
            takenAt: kind != .text && capture == nil ? takenAt.map(MomentTime.string) : nil,
            venueId: noLocationOn || (sky != nil && !pinsHere) ? nil : pickedVenue?.placeId,
            altitude: shownHeight
        )
        // The Sky: pin at the place (the venue picked, else the one that names the spot), and "Share later".
        body.pin = pinsHere ? "place" : nil
        body.shareLater = shareLaterBody
        // The Live mark and the weather (v4.1, `+Live`): only for the camera's own shot, while it still holds.
        body.takenHere = marks.takenHere
        body.showWeather = marks.showWeather
        // The Studio's made-up name; left out otherwise, so today's Post sheet sends what it always has.
        body.postAs = postsUnderMadeUpName ? "pen_name" : nil
        // The Studio's "Guess the spot" (CONTRACT 5a), only where it may be made; left out otherwise.
        body.guess = offersGuess && studioGuess ? true : nil
        // The Studio's "Also show in Explore" (CONTRACT 6f), only where it may be; left out otherwise.
        body.explore = offersExplore && studioExplore ? true : nil
        // The Studio's playable items (CONTRACT 7b, 7g); nil, so left out, when there are none.
        body.play = studioPlay
        // The Studio's mentions in the caption (CONTRACT 7h), never under a made-up name; left out when none.
        body.mentions = studioMentions(in: caption)
        // The Studio's dots on things in the photo (CONTRACT 7c); left out when none.
        body.dots = studioDots
        // The camera's heading for live beams (CONTRACT 9h), only with the Live mark and the switch on; left out otherwise.
        body.heading = marks.takenHere == true ? studioHeading : nil
        // See the picture first (CONTRACT 10c): a composed whole, its backdrop and a whole video's place; left out otherwise.
        body.whole = studioWhole
        body.placement = studioWhole == true ? studioWholePlacement : nil
        body.backdrop = studioWhole == true ? studioBackdrop : nil
        // The Studio's stamps, and the phone's height for an elevation stamp; left out otherwise.
        if !studioStamps.isEmpty {
            body.stamps = studioStamps
            if studioStamps.contains(where: { $0.kind == .elevation }), let reading = capture != nil ? captureHeight : fixHeight {
                body.elevation = MomentAltitudeBody(meters: reading.meters, accuracyM: reading.accuracyMeters, speedMps: reading.speedMps)
            }
        }
        return body
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
        MomentsDraftFiles.drop(draft?.video)
    }
}

extension MomentsComposerModel.Draft {
    /// The video's file, for a video.
    var video: URL? {
        if case let .video(url) = self { url } else { nil }
    }

    /// What the create request calls it.
    var kind: MomentKind {
        switch self {
        case .photo: .photo
        case .video: .video
        case .text: .text
        }
    }
}
