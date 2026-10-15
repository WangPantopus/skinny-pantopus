//
//  PulseComposerPosting.swift
//  Pantopus
//
//  Posting from the one-box composer (Pulse S8, contract §2.5): one
//  Pulse-mode `POST /api/posts` per draft (a retry sends the same
//  `clientRequestId`), "I'm 18 or older" when the server asks for it
//  (§2.10), the limits in plain words with when they reset in the phone's
//  zone (§5), then the photos.
//

import Foundation

extension PulseComposerModel {
    /// Sends the post. True once it exists (photos may still have failed;
    /// `message` says so).
    func post() async -> Bool {
        guard canPost else { return false }
        if check?.needs?.adultAttestation == true {
            asksAdultConfirmation = true
            return false
        }
        guard NetworkMonitor.shared.isOnline else {
            message = "You're offline. Your draft is saved; post it when you're back online."
            return false
        }
        message = nil
        setPhase(.posting)
        let outcome = await send()
        switch outcome {
        case let .posted(postId, label):
            let photosFailed = await uploadPhotos(postId: postId)
            finishPosting(postId: postId, label: label)
            if photosFailed { message = "Posted. The photos couldn't be added." }
            PulsePostsRefresh.notifyPostsDidChange()
            return true
        case let .refused(code, sentence, body):
            setPhase(.editing)
            handleRefusal(code: code, sentence: sentence, body: body)
            return false
        case .failed:
            setPhase(.editing)
            message = "Couldn't post. Your draft is saved. Try again."
            return false
        }
    }

    /// "I'm 18 or older": stored once, then the post goes as written.
    func confirmAdult() async {
        asksAdultConfirmation = false
        do {
            let response = try await api.requestDataResponse(PulseEndpoints.adultAttestation(), includingForbidden: true)
            if response.response.statusCode == 403 {
                message = Self.body(response.data).sentence ?? "Posting in Pulse is for people 18 and older."
                return
            }
        } catch {
            message = "Couldn't save that. Try again."
            return
        }
        _ = await post()
    }

    // MARK: - Private

    private enum Outcome {
        case posted(postId: String, label: String?)
        case refused(code: String?, sentence: String?, body: [String: Any])
        case failed
    }

    private func send() async -> Outcome {
        do {
            let response = try await api.requestDataResponse(PulseEndpoints.createPulsePost(request()), includingForbidden: true)
            if response.response.statusCode == 403 {
                let body = Self.body(response.data)
                return .refused(code: body.code, sentence: body.sentence, body: body.json)
            }
            guard let created = try? JSONDecoder().decode(PulsePostCreateResponse.self, from: response.data),
                  let postId = created.postId, !postId.isEmpty else { return .failed }
            return .posted(postId: postId, label: created.pulse?.author?.label)
        } catch let APIError.clientError(_, raw) {
            let body = Self.body(Data((raw ?? "").utf8))
            return .refused(code: body.code, sentence: body.sentence ?? APIError.friendlyClientMessage(raw), body: body.json)
        } catch {
            return .failed
        }
    }

    private func request() -> PulsePostCreateRequest {
        let iso = ISO8601DateFormatter()
        let place = draft.placeName.trimmingCharacters(in: .whitespacesAndNewlines)
        let headsUp = draft.kind == .headsUp
        return PulsePostCreateRequest(
            clientRequestId: draft.clientRequestId,
            content: trimmedText,
            postType: draft.kind.rawValue,
            readScope: readScope,
            areaId: area?.id,
            topic: draft.topic,
            locationName: place.isEmpty ? nil : place,
            claimMode: draft.kind == .offer ? draft.claimMode : nil,
            expiresAt: headsUp ? draft.headsUpEnds.map { iso.string(from: $0) } : nil,
            safetyAlertKind: headsUp ? draft.headsUpKind : nil,
            eventDate: draft.kind == .event ? draft.eventStarts.map { iso.string(from: $0) } : nil,
            eventEndDate: nil,
            lostFoundType: draft.kind == .lostFound ? draft.lostFound : nil
        )
    }

    private func handleRefusal(code: String?, sentence: String?, body: [String: Any]) {
        switch code {
        case "ADULT_ATTESTATION_REQUIRED":
            adultSentence = sentence ?? adultSentence
            asksAdultConfirmation = true
        case "VISITOR_ASK_ONLY":
            draft.kind = .ask
            message = sentence
        case "DAILY_LIMIT_REACHED", "SHARE_WEEKLY_CAP":
            message = Self.limitSentence(code: code, body: body) ?? sentence
        default:
            message = sentence ?? "Couldn't post. Your draft is saved. Try again."
        }
    }

    /// The server's sentence for the limit, with when it resets in the
    /// phone's zone ("You can post again after Wed 4pm.").
    static func limitSentence(code: String?, body: [String: Any], timeZone: TimeZone = .current) -> String? {
        let scope = code == "SHARE_WEEKLY_CAP" ? "share" : body["scope"] as? String
        let rule: String? = switch scope {
        case "visitor_ask": "Visitors can ask one question a day here."
        case "new_here": "Until your address is verified you can start two posts a day."
        case "share": "You can share twice a week."
        default: nil
        }
        guard let rule, let resets = PulsePageWords.parseDate(body["resets_at"] as? String) else { return nil }
        return "\(rule) You can post again after \(PulsePostStatus.endsFormat(resets, timeZone: timeZone))."
    }

    /// Photos go up once the post exists. True when they couldn't.
    private func uploadPhotos(postId: String) async -> Bool {
        guard !photos.isEmpty else { return false }
        let files = photos.enumerated().map { index, photo in photo.asMultipartFile(index: index) }
        do {
            _ = try await uploader.uploadPostMedia(postId: postId, files: files)
            return false
        } catch {
            return true
        }
    }

    /// A refusal's body: its `code`, its sentence and the rest (`resets_at`).
    private struct Refusal {
        let json: [String: Any]
        var code: String? {
            json["code"] as? String
        }

        var sentence: String? {
            (json["error"] as? String).flatMap { APIError.isMachineCode($0) ? nil : $0 }
        }
    }

    private static func body(_ data: Data) -> Refusal {
        Refusal(json: (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:])
    }
}
