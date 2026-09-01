//
//  SchedulingError.swift
//  Pantopus
//
//  Typed error surface for Calendarly. `APIClient` throws the app-wide
//  `APIError`; scheduling screens map it through `SchedulingError.from(_:)` to
//  get first-class handling of the booking-specific failure shapes:
//
//    • 409 conflict  → `{ error:'SLOT_TAKEN'|'SLOT_UNAVAILABLE'|'SLOT_FULL',
//                         message, alternatives:[{start,end,startLocal}] }`
//                      — surface the nearest open times, never a dead end.
//    • 400 validation→ `{ error:'Validation failed', details:[{field,message,code}] }`
//    • 501 (connect) → `{ error:'NOT_AVAILABLE', message }` — "coming soon".
//
//  `SchedulingStatus` models the first-class RESPONSE states
//  (paused/secret/unavailable/expired) that public surfaces render honestly —
//  these are NOT errors.
//

import Foundation

/// First-class states a public booking surface can be in. These are decoded
/// from a 200/`status` field — they are NOT errors and must be rendered
/// honestly (a paused page is friendly, not a failure screen).
public enum SchedulingStatus: String, Sendable, Hashable, CaseIterable, Decodable {
    case active
    case paused
    case secret
    case unavailable
    case expired
    /// Forward-compatible fallback for an unrecognised server value.
    case unknown

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = SchedulingStatus(rawValue: raw) ?? .unknown
    }
}

/// One nearest-open-time the backend offers when the requested slot is gone.
/// Shape: `{ start, end, startLocal }` (camelCase in the JSON).
public struct SchedulingSlotAlternative: Decodable, Sendable, Hashable {
    /// ISO-8601 UTC.
    public let start: String
    /// ISO-8601 UTC.
    public let end: String
    /// Local ISO rendered in the requested tz (may be absent).
    public let startLocal: String?

    public init(start: String, end: String, startLocal: String? = nil) {
        self.start = start
        self.end = end
        self.startLocal = startLocal
    }
}

/// One field-level validation failure from a `400 { error:'Validation failed',
/// details:[...] }` envelope.
public struct SchedulingValidationDetail: Decodable, Sendable, Hashable {
    public let field: String?
    public let message: String?
    public let code: String?

    public init(field: String? = nil, message: String? = nil, code: String? = nil) {
        self.field = field
        self.message = message
        self.code = code
    }
}

/// The typed failure surface for scheduling calls.
public enum SchedulingError: Error, Sendable, Equatable {
    /// 409 with nearest-open-time `alternatives` (SLOT_TAKEN / SLOT_UNAVAILABLE
    /// / SLOT_FULL / SLOT_CONFLICT). Present the alternatives — never a dead end.
    case slotConflict(code: String, message: String?, alternatives: [SchedulingSlotAlternative])
    /// 409 that is not a slot conflict (e.g. PAGE_PAUSED, LINK_USED,
    /// CANNOT_DELETE_DEFAULT, HAS_UPCOMING_BOOKINGS, ALREADY_*).
    case conflict(code: String, message: String?)
    /// 400 validation failure with per-field `details`.
    case validation(message: String?, details: [SchedulingValidationDetail])
    /// 404 — resource / page / token not found or expired. Carries the body's
    /// machine `error` code when one was supplied.
    case notFound(code: String?, message: String?)
    /// 403 — authenticated but not permitted. Carries the body's machine
    /// `error` code when one was supplied.
    case forbidden(code: String?, message: String?)
    /// 401 — token missing / expired.
    case unauthorized
    /// 501 — a deferred feature (e.g. connected-calendar connect). Render
    /// "coming soon".
    case notImplemented(message: String?)
    /// 5xx (other than 501) after retries. Carries the body's machine `error`
    /// code when one was supplied.
    case server(status: Int, code: String?, message: String?)
    /// Network-layer failure (offline / timeout).
    case transport
    /// Response decoded into an unexpected shape.
    case decoding
    /// Anything else, with the server code/message if we have one. Coded
    /// non-409 bodies (e.g. `BUSINESS_ONLY`, `BAD_RANGE`, `INVALID_ASSIGNEE`,
    /// `SLOT_NOT_OFFERED`) land here — the code stays machine-readable via
    /// `code` instead of being folded into the message only.
    case unknown(code: String?, message: String?)

    /// Back-compat factories for call sites that predate the `code` associated
    /// value — construct the case with a nil machine code.
    public static func notFound(message: String?) -> SchedulingError {
        .notFound(code: nil, message: message)
    }

    public static func forbidden(message: String?) -> SchedulingError {
        .forbidden(code: nil, message: message)
    }

    public static func unknown(message: String?) -> SchedulingError {
        .unknown(code: nil, message: message)
    }

    /// Map the app-wide `APIError` to a scheduling-typed error, re-decoding the
    /// 4xx/5xx body for `alternatives` / `details` / status code.
    ///
    /// - Parameters:
    ///   - apiError: the error thrown by `APIClient`.
    ///   - data: optional raw body. `APIError.clientError` already carries the
    ///     body string; pass `data` when you captured it separately (e.g. via
    ///     `requestData`) for 403/404 whose body `APIError` does not retain.
    public static func from(_ apiError: APIError, data: Data? = nil) -> SchedulingError {
        switch apiError {
        case .unauthorized:
            return .unauthorized
        case .forbidden:
            let parsed = decodeBody(data)
            return .forbidden(code: parsed?.error, message: parsed?.message)
        case .notFound:
            let parsed = decodeBody(data)
            return .notFound(code: parsed?.error, message: parsed?.message)
        case let .clientError(status, message):
            let bodyData = message.map { Data($0.utf8) } ?? data
            return classify(status: status, body: decodeBody(bodyData))
        case let .server(status, body):
            let parsed = decodeBody(Data(body.utf8))
            if status == 501 { return .notImplemented(message: parsed?.message) }
            return .server(status: status, code: parsed?.error, message: parsed?.message)
        case .transport:
            return .transport
        case .decoding:
            return .decoding
        case .invalidURL, .invalidResponse, .retriesExhausted:
            return .unknown(message: apiError.errorDescription)
        }
    }

    // MARK: - Convenience projections

    /// Nearest open times when this is a slot conflict; empty otherwise.
    public var alternatives: [SchedulingSlotAlternative] {
        if case let .slotConflict(_, _, alternatives) = self { return alternatives }
        return []
    }

    /// Per-field validation details when this is a validation error.
    public var validationDetails: [SchedulingValidationDetail] {
        if case let .validation(_, details) = self { return details }
        return []
    }

    /// The backend `error` code when one was supplied (e.g. `SLOT_TAKEN`,
    /// `BUSINESS_ONLY`, `BAD_RANGE`, `INVALID_ASSIGNEE`) — carried on every
    /// classified case so call sites can branch on machine codes for any
    /// status class, not just 409s.
    public var code: String? {
        switch self {
        case let .slotConflict(code, _, _), let .conflict(code, _):
            code
        case let .notFound(code, _), let .forbidden(code, _),
             let .unknown(code, _), let .server(_, code, _):
            code
        default:
            nil
        }
    }

    /// A best-effort user-facing message.
    public var userMessage: String? {
        switch self {
        case let .slotConflict(_, message, _),
             let .conflict(_, message),
             let .validation(message, _),
             let .notFound(_, message),
             let .forbidden(_, message),
             let .notImplemented(message),
             let .server(_, _, message),
             let .unknown(_, message):
            message
        case .unauthorized:
            "Your session has expired. Please sign in again."
        case .transport:
            "Can't reach Pantopus. Check your connection."
        case .decoding:
            "Received an unexpected response."
        }
    }

    // MARK: - Body parsing

    private struct ParsedBody {
        let error: String?
        let message: String?
        let status: String?
        let alternatives: [SchedulingSlotAlternative]
        let details: [SchedulingValidationDetail]
    }

    private static func classify(status: Int, body: ParsedBody?) -> SchedulingError {
        let code = body?.error ?? ""
        let message = body?.message
        let alternatives = body?.alternatives ?? []
        let details = body?.details ?? []

        if status == 409 || !alternatives.isEmpty {
            let slotCodes: Set<String> = ["SLOT_TAKEN", "SLOT_UNAVAILABLE", "SLOT_FULL", "SLOT_CONFLICT"]
            if slotCodes.contains(code) || !alternatives.isEmpty {
                return .slotConflict(
                    code: code.isEmpty ? "SLOT_CONFLICT" : code,
                    message: message,
                    alternatives: alternatives
                )
            }
            return .conflict(code: code, message: message)
        }
        if !details.isEmpty || code == "Validation failed" {
            return .validation(message: message, details: details)
        }
        let machineCode = code.isEmpty ? nil : code
        if status == 404 { return .notFound(code: machineCode, message: message) }
        if status == 403 { return .forbidden(code: machineCode, message: message) }
        // Keep the code folded into the display message (legacy behavior) but
        // also carry it machine-readable so `error.code` checks stay live.
        return .unknown(code: machineCode, message: message ?? machineCode)
    }

    private static func decodeBody(_ data: Data?) -> ParsedBody? {
        guard let data, !data.isEmpty else { return nil }
        struct Raw: Decodable {
            let error: String?
            let message: String?
            let status: String?
            let alternatives: [SchedulingSlotAlternative]?
            let details: [SchedulingValidationDetail]?
        }
        guard let raw = try? JSONDecoder().decode(Raw.self, from: data) else { return nil }
        return ParsedBody(
            error: raw.error,
            message: raw.message,
            status: raw.status,
            alternatives: raw.alternatives ?? [],
            details: raw.details ?? []
        )
    }
}
