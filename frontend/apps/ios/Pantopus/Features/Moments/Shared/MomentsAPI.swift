//
//  MomentsAPI.swift
//  Pantopus
//
//  One way to call the Moments routes that keeps the server's error codes
//  (CONTRACT "Errors"): the typed client folds a 403 into `.forbidden` and a
//  404 into `.notFound` without their bodies, and Moments must tell
//  `ADULT_CONFIRM_REQUIRED` from a plain refusal and `MOMENTS_UNAVAILABLE`
//  (the flag went off) from a Moment that's gone.
//

import Foundation

/// Why a Moments call didn't go through, with the sentence the screens show.
enum MomentsFailure: Error, Equatable {
    /// 403: the one-time 18+ confirmation first.
    case adultConfirmRequired
    /// 403: the date of birth on file is under 18.
    case ageNotEligible
    /// 422: the location fix is older than five minutes.
    case locationTooOld
    /// 422: the library photo or video is older than 24 hours.
    case captureTooOld
    /// 429: 20 Moments today.
    case dailyLimit
    /// 422: a video over 30 seconds.
    case mediaTooLong
    /// 410: the Moment has ended.
    case ended
    /// 404 `MOMENTS_UNAVAILABLE`: Moments are off for this account.
    case unavailable
    /// 404: gone, or not visible to you.
    case notFound
    /// 403: the author doesn't take replies (the Pantopus curator).
    case replyUnavailable
    /// 413, or a photo or video the server can't read.
    case mediaRejected
    /// 400: reacting to, replying to or reporting your own Moment.
    case ownMoment
    /// No connection, or the server didn't answer.
    case offline
    case other(String)

    var message: String {
        switch self {
        case .adultConfirmRequired: "Moments are for people 18 and older."
        case .ageNotEligible: "Moments are for people 18 and older."
        case .locationTooOld: "Your location is out of date. Try again where you are."
        case .captureTooOld: "Choose a photo or video from the last 24 hours."
        case .dailyLimit: "You've posted 20 Moments today. Try again tomorrow."
        case .mediaTooLong: "Videos can be up to 30 seconds."
        case .ended: "This Moment has ended."
        case .unavailable: "Moments aren't available right now."
        case .notFound: "This Moment isn't available."
        case .replyUnavailable: "This account doesn't take replies."
        case .mediaRejected: "This photo or video can't be posted. Try another one."
        case .ownMoment: "That's your own Moment."
        case .offline: "Can't reach Pantopus. Check your connection."
        case let .other(message): message
        }
    }

    /// Worth trying again by itself (a weak connection, a busy server).
    var isTransient: Bool {
        self == .offline
    }

    init(status: Int, body: Data) {
        let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        let code = json?["code"] as? String
        let error = (json?["error"] as? String) ?? (json?["message"] as? String)
        self = Self.from(status: status, code: code, error: error)
    }

    init(_ error: APIError) {
        switch error {
        case let .clientError(status, message):
            let data = Data((message ?? "").utf8)
            self.init(status: status, body: data)
        case .transport, .retriesExhausted:
            self = .offline
        case .server:
            self = .offline
        case .notFound:
            self = .notFound
        default:
            self = .other(error.errorDescription ?? "Something went wrong. Please try again.")
        }
    }

    /// The contract's error codes the screens tell apart.
    private static let codes: [String: MomentsFailure] = [
        "ADULT_CONFIRM_REQUIRED": .adultConfirmRequired,
        "AGE_NOT_ELIGIBLE": .ageNotEligible,
        "LOCATION_TOO_OLD": .locationTooOld,
        "CAPTURE_TOO_OLD": .captureTooOld,
        "MOMENTS_DAILY_LIMIT": .dailyLimit,
        "MEDIA_TOO_LONG": .mediaTooLong,
        "MOMENT_ENDED": .ended,
        "MOMENTS_UNAVAILABLE": .unavailable,
        "MOMENT_REPLY_UNAVAILABLE": .replyUnavailable,
        "MEDIA_TOO_LARGE": .mediaRejected,
        "PHOTO_UNREADABLE": .mediaRejected,
        "VIDEO_UNREADABLE": .mediaRejected,
        "MOMENT_POSTER_REQUIRED": .mediaRejected,
        "MOMENT_OWN": .ownMoment
    ]

    private static func from(status: Int, code: String?, error: String?) -> MomentsFailure {
        if let code, let known = codes[code] { return known }
        switch status {
        case 404: return .notFound
        // The server gave up waiting for the rest of a slow upload: the same as a dropped connection.
        case 408: return .offline
        case 410: return .ended
        case 413, 415: return .mediaRejected
        // The 20-a-day limit comes with its code; a bare 429 is the server's rate limit.
        case 429: return .other("That was a lot at once. Wait a minute and try again.")
        case 500...: return .offline
        default:
            // A sentence from the server reads as is; a machine word ("Forbidden") doesn't.
            if let error, error.contains(" "), error.count <= 160 { return .other(error) }
            return .other("Something went wrong. Please try again.")
        }
    }
}

@MainActor
enum MomentsAPI {
    /// Sends `endpoint` and decodes its answer, or throws a `MomentsFailure`.
    static func send<Response: Decodable>(
        _ endpoint: Endpoint,
        as _: Response.Type = Response.self,
        api: APIClient = .shared
    ) async throws -> Response {
        let response: APIClient.DataResponse
        do {
            response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
        } catch let error as APIError {
            throw MomentsFailure(error)
        }
        let status = response.response.statusCode
        guard (200..<300).contains(status) else {
            let failure = MomentsFailure(status: status, body: response.data)
            if failure == .unavailable { flagWentOff() }
            throw failure
        }
        if Response.self == EmptyResponse.self {
            // swiftlint:disable:next force_cast
            return EmptyResponse() as! Response
        }
        do {
            return try JSONDecoder().decode(Response.self, from: response.data)
        } catch {
            throw MomentsFailure.other("Something went wrong loading this. Please try again.")
        }
    }

    /// The server says Moments are off for this account: the flag is read
    /// again now, so the tab (and anything of Moments that's open) leaves at once.
    private static func flagWentOff() {
        guard case let .signedIn(user) = AuthManager.shared.state else { return }
        Task { await MomentsFlags.shared.refresh(account: user.id, force: true) }
    }

    /// Sends `endpoint` for its effect alone.
    static func send(_ endpoint: Endpoint, api: APIClient = .shared) async throws {
        _ = try await send(endpoint, as: EmptyResponse.self, api: api)
    }
}
