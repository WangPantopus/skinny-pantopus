//
//  APIError.swift
//  Pantopus
//
//  Typed error taxonomy for the HTTP client. Feature code should switch on
//  these cases rather than inspecting status codes directly.
//

import Foundation

/// Every failure mode of the Pantopus HTTP client.
public enum APIError: Error, LocalizedError, Sendable {
    /// The request URL couldn't be constructed — usually a client bug.
    case invalidURL
    /// The server responded with a shape we can't recognise (not a
    /// `HTTPURLResponse`).
    case invalidResponse
    /// 401 Unauthorized — token missing, invalid, or expired. The client
    /// also notifies `AuthManager` before throwing this so the UI can
    /// redirect to sign-in.
    case unauthorized
    /// 403 Forbidden — authenticated but not allowed to access this resource.
    /// `message` is the server's own sentence for the refusal when the body
    /// carried one a person can read (`readableForbiddenMessage`); a
    /// `.forbidden` pattern still matches every 403.
    case forbidden(message: String? = nil)
    /// 404 Not Found.
    case notFound
    /// 4xx with server-supplied message. `status` is the exact code.
    case clientError(status: Int, message: String?)
    /// 5xx after retries are exhausted.
    case server(status: Int, body: String)
    /// Network-layer failure (offline, timeout, DNS). Carries the
    /// underlying `URLError` for diagnostics.
    case transport(underlying: URLError)
    /// Response decoded into an unexpected shape. Carries the decoder error.
    case decoding(underlying: any Error)
    /// All retries exhausted without success.
    case retriesExhausted

    public var errorDescription: String? {
        switch self {
        case .invalidURL: "Could not build request URL."
        case .invalidResponse: "Invalid response from server."
        case .unauthorized: "Your session has expired. Please sign in again."
        case let .forbidden(message): message ?? "You don't have permission to do that."
        case .notFound: "We couldn't find what you were looking for."
        case let .clientError(_, message):
            Self.friendlyClientMessage(message) ?? "Request failed."
        case .server: "Something went wrong on our side. Please try again."
        case .transport: "Can't reach Pantopus. Check your connection."
        case .decoding: "Received an unexpected response."
        case .retriesExhausted: "The server is having trouble. Please try again."
        }
    }

    /// Whether this error is worth retrying on an idempotent request.
    public var isTransient: Bool {
        switch self {
        case let .server(status, _): (500...599).contains(status) && status != 501
        case let .transport(err): Self.transientURLErrors.contains(err.code)
        default: false
        }
    }

    private static let transientURLErrors: Set<URLError.Code> = [
        .timedOut, .cannotFindHost, .cannotConnectToHost,
        .networkConnectionLost, .dnsLookupFailed, .notConnectedToInternet
    ]

    /// The backend's machine `code` from an error body, when one survives.
    ///
    /// Only `clientError` / `server` carry a body — `unauthorized`,
    /// `forbidden` and `notFound` are mapped by status alone (a 403 keeps
    /// at most its readable sentence), so a caller that needs to tell
    /// `VERIFICATION_REQUIRED` from a plain 403 must match the CASE as well
    /// as this code.
    static func code(in body: String?) -> String? {
        guard let body, let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return json["code"] as? String
    }

    /// The sentence a 403 body gives for the refusal, when it can be shown
    /// as-is: the JSON `message` or `error`, four or more words and at most
    /// 200 characters, with no machine vocabulary (`STEP_UP_REQUIRED`,
    /// `vendors.manage`). Codes and fragments ("blocked", "Access denied",
    /// "Not a participant") and non-JSON bodies keep the generic copy.
    static func readableForbiddenMessage(_ data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        for key in ["message", "error"] {
            guard let text = (json[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) else { continue }
            let words = text.split { $0.isWhitespace }
            guard words.count >= 4, text.count <= 200, !text.contains("_"),
                  text.range(of: "[A-Za-z][.][A-Za-z]", options: .regularExpression) == nil else { continue }
            return text
        }
        return nil
    }

    /// Turn a raw 4xx JSON body into a short user-facing string.
    static func friendlyClientMessage(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        guard let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return raw
        }
        if let details = json["details"] as? [[String: Any]] {
            let messages = details.compactMap { $0["message"] as? String }.filter { !$0.isEmpty }
            if let first = messages.first { return first }
        }
        if let message = json["message"] as? String, !message.isEmpty { return message }
        if let error = json["error"] as? String, !error.isEmpty { return error }
        return raw
    }
}

/// Successful / failed network result, for call sites that prefer a
/// `Result`-style API over `try/await`.
public typealias APIResult<Success> = Result<Success, APIError>
