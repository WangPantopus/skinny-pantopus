//
//  SettingsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the T3.1 Settings surfaces — privacy
//  settings, notification push tokens, auth methods, password,
//  account deletion. Each helper carries a doc-comment with the
//  backend route file + line.
//

import Foundation

/// Endpoints under `/api/privacy/*`.
public enum PrivacyEndpoints {
    /// `GET /api/privacy/settings` — route
    /// `backend/routes/privacy.js:50`.
    public static let settings = Endpoint(method: .get, path: "/api/privacy/settings")

    /// `PATCH /api/privacy/settings` — partial update. Route
    /// `backend/routes/privacy.js:92`. Returns `{ message, settings }`.
    public static func updateSettings(_ body: PrivacySettingsUpdate) -> Endpoint {
        Endpoint(method: .patch, path: "/api/privacy/settings", body: body)
    }

    /// `GET /api/privacy/blocks` — list of blocked users for the
    /// "Blocked users" row. Route `backend/routes/privacy.js:154`.
    public static let blocks = Endpoint(method: .get, path: "/api/privacy/blocks")

    /// `DELETE /api/privacy/blocks/:blockId` — remove a single block by
    /// its row id (not the blocked user's id). Route
    /// `backend/routes/privacy.js:251`. Returns `{ message }`.
    public static func deleteBlock(blockId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/privacy/blocks/\(blockId)")
    }
}

/// Endpoints under `/api/notifications/*`.
public enum NotificationEndpoints {
    /// `POST /api/notifications/push-token` — register a device.
    /// Route `backend/routes/notifications.js:269`.
    public static func registerPushToken(_ body: PushTokenBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/notifications/push-token", body: body)
    }

    /// `DELETE /api/notifications/push-token` — clear the current
    /// device's token. Route `backend/routes/notifications.js:309`.
    public static let deletePushToken = Endpoint(method: .delete, path: "/api/notifications/push-token")
}

/// Endpoints under `/api/users/*` relevant to Settings.
public enum AuthMethodsEndpoints {
    /// `GET /api/users/auth-methods` — what sign-in methods are
    /// connected. Route `backend/routes/users.js:1887`.
    public static let methods = Endpoint(method: .get, path: "/api/users/auth-methods")

    /// `POST /api/users/password` — change the password (rate-limited
    /// by `reauthLimiter`). Route `backend/routes/users.js:1919`. The
    /// Joi schema accepts camelCase keys, so the body uses them too.
    public static func updatePassword(_ body: PasswordUpdateBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/users/password", body: body)
    }

    /// `POST /api/users/resend-verification` — re-send the email
    /// verification link. Route `backend/routes/users.js:3322`.
    /// Schema: `{ email: string }`.
    public static func resendVerification(_ body: ResendVerificationBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/users/resend-verification", body: body, authenticated: false)
    }

    /// `DELETE /api/users/account` — permanently delete the signed-in
    /// user and every cascading row. Route `backend/routes/users.js:4394`.
    /// Takes **no body**. `200 { message }` on success; `409 { error }`
    /// when the account still has in-progress gigs or escrowed payments
    /// (`users.js:4408 / :4422 / :4436`). Persistent login: requires
    /// `X-Step-Up` (purpose `delete_account`, or the wildcard from
    /// `/reauthenticate`) — see `deleteAccount(stepUpToken:)`.
    public static let deleteAccount = Endpoint(method: .delete, path: "/api/users/account")

    /// `DELETE /api/users/account` with the step-up token attached
    /// (`X-Step-Up`). `nil` sends the bare request — the server then
    /// answers 403 `STEP_UP_REQUIRED`, which `APIClient` tries to satisfy
    /// once through `AuthManager.stepUp` before surfacing `.forbidden`.
    public static func deleteAccount(stepUpToken: String?) -> Endpoint {
        guard let stepUpToken else { return deleteAccount }
        return Endpoint(method: .delete, path: "/api/users/account", headers: [APIClient.stepUpHeader: stepUpToken])
    }
}

// MARK: - Bodies

/// Partial-update body for `PATCH /api/privacy/settings`.
///
/// The field list is exactly `updateSettingsSchema` at
/// `backend/routes/privacy.js:28-37`. `middleware/validate.js:66` runs
/// Joi with `allowUnknown: false`, so **any key outside that schema is a
/// 400** — do not add speculative fields here. Only set the keys you
/// intend to change; each Optional encodes nothing when nil, and the Joi
/// schema requires at least one (`.min(1)`).
public struct PrivacySettingsUpdate: Encodable, Sendable {
    /// `everyone` · `mutuals` · `nobody`.
    public var searchVisibility: String?
    public var findableByName: Bool?
    public var findableByEmail: Bool?
    public var findableByPhone: Bool?
    /// `public` · `followers` · `private`.
    public var profileDefaultVisibility: String?
    public var showGigHistory: String?
    public var showNeighborhood: String?
    public var showHomeAffiliation: String?

    public init(
        searchVisibility: String? = nil,
        findableByName: Bool? = nil,
        findableByEmail: Bool? = nil,
        findableByPhone: Bool? = nil,
        profileDefaultVisibility: String? = nil,
        showGigHistory: String? = nil,
        showNeighborhood: String? = nil,
        showHomeAffiliation: String? = nil
    ) {
        self.searchVisibility = searchVisibility
        self.findableByName = findableByName
        self.findableByEmail = findableByEmail
        self.findableByPhone = findableByPhone
        self.profileDefaultVisibility = profileDefaultVisibility
        self.showGigHistory = showGigHistory
        self.showNeighborhood = showNeighborhood
        self.showHomeAffiliation = showHomeAffiliation
    }

    enum CodingKeys: String, CodingKey {
        case searchVisibility = "search_visibility"
        case findableByName = "findable_by_name"
        case findableByEmail = "findable_by_email"
        case findableByPhone = "findable_by_phone"
        case profileDefaultVisibility = "profile_default_visibility"
        case showGigHistory = "show_gig_history"
        case showNeighborhood = "show_neighborhood"
        case showHomeAffiliation = "show_home_affiliation"
    }
}

/// Body for `POST /api/notifications/push-token`.
public struct PushTokenBody: Encodable, Sendable {
    public let token: String
    public let platform: String

    public init(token: String, platform: String = "ios") {
        self.token = token
        self.platform = platform
    }
}

/// Body for `POST /api/users/password` — the backend's
/// `updatePasswordSchema` (users.js:847) accepts camelCase
/// `currentPassword` + `newPassword`. `currentPassword` is optional
/// (omit for OAuth-only accounts setting an initial password).
public struct PasswordUpdateBody: Encodable, Sendable {
    public let currentPassword: String?
    public let newPassword: String

    public init(currentPassword: String?, newPassword: String) {
        self.currentPassword = currentPassword
        self.newPassword = newPassword
    }
}

/// Body for `POST /api/users/resend-verification`.
public struct ResendVerificationBody: Encodable, Sendable {
    public let email: String

    public init(email: String) {
        self.email = email
    }
}
