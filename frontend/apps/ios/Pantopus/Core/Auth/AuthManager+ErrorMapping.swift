//
//  AuthManager+ErrorMapping.swift
//  Pantopus
//
//  APIError → AuthError mapping for the auth flows, plus the date helper.
//  Split out of AuthManager.swift to keep that file within length limits.
//

import Foundation

extension AuthManager {
    static func mapSignInError(_ error: APIError) -> AuthError {
        switch error {
        case .unauthorized: .invalidCredentials
        // `APIClient` maps 403 to `.forbidden` before the generic `400..<500`
        // case, so the login body never reaches `mapByStatus`. The only 403 the
        // login handler emits is the unverified-email refusal
        // (`backend/routes/users.js:1526`), and `LoginView.canResendVerification`
        // reveals the resend link on any error whose copy mentions "verify" —
        // without this case it fell to `.unknown` and the link never appeared.
        case .forbidden: .serverError("Please verify your email before signing in.")
        case let .clientError(status, body): mapByStatus(status: status, body: body)
        case let .server(status, body): .serverError(extractMessage(from: body) ?? "Server error \(status).")
        case .transport: .networkError
        default: .unknown
        }
    }

    static func mapRegisterError(_ error: APIError) -> AuthError {
        switch error {
        case let .clientError(status, body):
            if status == 429 { return .rateLimited }
            let raw = body ?? ""
            if raw.range(of: "already registered", options: .caseInsensitive) != nil
                || raw.range(of: "Email already", options: .caseInsensitive) != nil {
                return .emailAlreadyExists
            }
            if raw.range(of: "password", options: .caseInsensitive) != nil {
                return .weakPassword
            }
            return .serverError(extractMessage(from: body) ?? raw)
        case let .server(status, body):
            return .serverError(extractMessage(from: body) ?? "Server error \(status).")
        case .transport: return .networkError
        default: return .unknown
        }
    }

    static func mapResetPasswordError(_ error: APIError) -> AuthError {
        switch error {
        case let .clientError(status, body):
            if status == 429 { return .rateLimited }
            let raw = body ?? ""
            if raw.range(of: "password", options: .caseInsensitive) != nil
                && raw.range(of: "Invalid or expired", options: .caseInsensitive) == nil {
                return .weakPassword
            }
            return .serverError(extractMessage(from: body) ?? raw)
        case let .server(status, body):
            return .serverError(extractMessage(from: body) ?? "Server error \(status).")
        case .transport: return .networkError
        default: return .unknown
        }
    }

    static func mapVerifyEmailError(_ error: APIError) -> AuthError {
        switch error {
        case let .clientError(status, body):
            if status == 429 { return .rateLimited }
            return .serverError(extractMessage(from: body) ?? body ?? "")
        case let .server(status, body):
            return .serverError(extractMessage(from: body) ?? "Server error \(status).")
        case .transport: return .networkError
        default: return .unknown
        }
    }

    static func mapGenericAuthError(_ error: APIError) -> AuthError {
        switch error {
        case .unauthorized: .invalidCredentials
        case let .clientError(status, body): mapByStatus(status: status, body: body)
        case let .server(status, body): .serverError(extractMessage(from: body) ?? "Server error \(status).")
        case .transport: .networkError
        default: .unknown
        }
    }

    static func mapByStatus(status: Int, body: String?) -> AuthError {
        switch status {
        case 429: .rateLimited
        case 401: .invalidCredentials
        default: .serverError(extractMessage(from: body) ?? body ?? "Request failed (\(status)).")
        }
    }

    static func extractMessage(from body: String?) -> String? {
        guard let body, let data = body.data(using: .utf8) else { return nil }
        let decoded = try? JSONDecoder().decode(AuthErrorBody.self, from: data)
        return decoded?.error
    }

    static func iso8601Date(_ date: Date) -> String {
        iso8601DateFormatter.string(from: date)
    }

    private static let iso8601DateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter
    }()
}
