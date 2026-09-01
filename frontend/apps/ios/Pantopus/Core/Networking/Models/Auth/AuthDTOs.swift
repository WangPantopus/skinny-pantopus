//
//  AuthDTOs.swift
//  Pantopus
//
//  DTOs for the auth endpoints on `backend/routes/users.js`. See inline
//  route citations for response-shape provenance.
//

// swiftlint:disable file_length

import Foundation

/// `POST /api/users/login` — see `backend/routes/users.js:1603`.
public struct LoginRequest: Encodable, Sendable {
    /// Account email.
    public let email: String
    /// Plain-text password; transported over TLS only.
    public let password: String
    /// Device descriptor for bind-at-issue (CONTRACT "Existing routes").
    /// Optional so old servers / the cookie transport ignore it.
    public let device: DeviceDescriptor?

    public init(email: String, password: String, device: DeviceDescriptor? = nil) {
        self.email = email
        self.password = password
        self.device = device
    }
}

/// `session` object on login / oauth / refresh responses —
/// `{ id, context: "interactive" | "restored" }`.
public struct SessionInfo: Decodable, Sendable, Hashable {
    public let id: String?
    public let context: String?

    public init(id: String?, context: String?) {
        self.id = id
        self.context = context
    }
}

/// `device` object on login / oauth responses once the server bound the
/// session to this device key: `{ id, deviceId, isNew, trustLevel }`.
/// `null` when the client sent no descriptor.
public struct BoundDeviceInfo: Decodable, Sendable, Hashable {
    public let id: String?
    public let deviceId: String?
    public let isNew: Bool?
    public let trustLevel: String?
}

/// Login response body. Tokens are omitted when the server is in
/// cookie-transport mode (header: `x-token-transport: cookie`).
///
/// Route: `backend/routes/users.js:829`. `sessionId` / `session` / `device`
/// are additive (CONTRACT "Existing routes — additive changes").
public struct LoginResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let accessToken: String?
    public let refreshToken: String?
    /// Seconds until the access token expires.
    public let expiresIn: Int?
    /// Absolute expiry as a Unix epoch in seconds.
    public let expiresAt: Int?
    public let user: AuthenticatedUser
    public let sessionId: String?
    public let session: SessionInfo?
    public let device: BoundDeviceInfo?

    private enum CodingKeys: String, CodingKey {
        case message
        case accessToken
        case refreshToken
        case expiresIn
        case expiresAt
        case user
        case sessionId
        case session
        case device
    }
}

/// `GET /api/users/oauth/:provider` response — see
/// `backend/routes/users.js:4006`.
public struct OAuthURLResponse: Decodable, Sendable, Hashable {
    public let url: URL
}

/// `POST /api/users/oauth/callback` request — see
/// `backend/routes/users.js:4186`.
public struct OAuthCodeExchangeRequest: Encodable, Sendable, Hashable {
    public let code: String
    public let device: DeviceDescriptor?

    public init(code: String, device: DeviceDescriptor? = nil) {
        self.code = code
        self.device = device
    }
}

/// `POST /api/users/oauth/token` request — legacy fragment-token path.
/// Route: `backend/routes/users.js:4083`.
public struct OAuthTokenExchangeRequest: Encodable, Sendable, Hashable {
    public let accessToken: String
    public let refreshToken: String
    public let device: DeviceDescriptor?

    public init(accessToken: String, refreshToken: String, device: DeviceDescriptor? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.device = device
    }
}

/// `POST /api/users/oauth/native` request — native Sign in with Apple /
/// Google id-token exchange (CONTRACT "Existing routes"; route
/// `backend/routes/users.js` `/oauth/native`). The iOS UI for it is
/// Phase 3; the DTO ships now so the contract is exercised end-to-end.
public struct OAuthNativeRequest: Encodable, Sendable, Hashable {
    public let provider: String
    public let idToken: String
    public let nonce: String?
    public let accessToken: String?
    public let device: DeviceDescriptor?

    public init(provider: OAuthProvider, idToken: String, nonce: String?, accessToken: String?, device: DeviceDescriptor?) {
        self.provider = provider.rawValue
        self.idToken = idToken
        self.nonce = nonce
        self.accessToken = accessToken
        self.device = device
    }
}

/// `POST /api/users/register` request body — see `backend/routes/users.js:1288`.
///
/// `accountType` maps the iOS `AccountType` enum into the backend's
/// `'individual' | 'business'` string (see `registerSchema` at
/// `backend/routes/users.js:803-820`). `inviteCode` is serialized as
/// `invite_code` to match the snake_case key the backend extracts.
public struct RegisterRequest: Encodable, Sendable, Hashable {
    public let email: String
    public let password: String
    public let phoneNumber: String?
    public let username: String
    public let firstName: String
    public let middleName: String?
    public let lastName: String
    public let dateOfBirth: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let accountType: String
    public let inviteCode: String?

    public init(
        email: String,
        password: String,
        phoneNumber: String?,
        username: String,
        firstName: String,
        middleName: String?,
        lastName: String,
        dateOfBirth: String?,
        address: String?,
        city: String?,
        state: String?,
        zipcode: String?,
        accountType: String,
        inviteCode: String?
    ) {
        self.email = email
        self.password = password
        self.phoneNumber = phoneNumber
        self.username = username
        self.firstName = firstName
        self.middleName = middleName
        self.lastName = lastName
        self.dateOfBirth = dateOfBirth
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
        self.accountType = accountType
        self.inviteCode = inviteCode
    }

    private enum CodingKeys: String, CodingKey {
        case email, password, phoneNumber, username
        case firstName, middleName, lastName
        case dateOfBirth, address, city, state, zipcode, accountType
        case inviteCode = "invite_code"
    }
}

/// `POST /api/users/register` response body — see `backend/routes/users.js:1548`.
///
/// The backend creates the auth user, persists the profile row, then sends
/// a verification email. The returned `user` is the freshly-created profile
/// in the same shape `LoginResponse.user` carries.
public struct RegisterResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let requiresEmailVerification: Bool?
    public let user: AuthenticatedUser
}

/// `POST /api/users/refresh` — see `backend/routes/users.js:2102`.
/// `deviceId` / `sessionId` are additive (CONTRACT `/api/users/refresh`);
/// the DPoP proof with `rth` travels in the header.
public struct RefreshRequest: Encodable, Sendable {
    /// Optional: the server can also read the refresh token from the
    /// `pantopus_refresh` cookie.
    public let refreshToken: String?
    public let deviceId: String?
    public let sessionId: String?

    public init(refreshToken: String?, deviceId: String? = nil, sessionId: String? = nil) {
        self.refreshToken = refreshToken
        self.deviceId = deviceId
        self.sessionId = sessionId
    }
}

/// Refresh response body. Token fields are omitted in cookie-transport mode.
///
/// Route: `backend/routes/users.js:2102`.
public struct RefreshResponse: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let accessToken: String?
    public let refreshToken: String?
    public let expiresIn: Int?
    public let expiresAt: Int?
    public let sessionId: String?
    public let session: SessionInfo?
}

/// `POST /api/users/logout` — route `backend/routes/users.js:4708`.
/// `scope` per CONTRACT: `local` (this session; row side effects only with
/// proof — Bearer bound to `deviceId`, or `refreshToken` + DPoP `rth`),
/// `others` / `global` (Bearer + `X-Step-Up` `revoke_sessions`).
public struct LogoutRequest: Encodable, Sendable, Hashable {
    public let scope: String
    public let deviceId: String?
    public let refreshToken: String?

    public init(scope: LogoutScope, deviceId: String?, refreshToken: String?) {
        self.scope = scope.rawValue
        self.deviceId = deviceId
        self.refreshToken = refreshToken
    }
}

public enum LogoutScope: String, Sendable, Hashable {
    case local
    case others
    case global
}

/// `{ success: true, revoked?: n }`.
public struct LogoutResponse: Decodable, Sendable, Hashable {
    public let success: Bool?
    public let revoked: Int?
}

/// `POST /api/users/reauthenticate` — route `backend/routes/users.js:1772`.
public struct ReauthenticateRequest: Encodable, Sendable, Hashable {
    public let password: String

    public init(password: String) {
        self.password = password
    }
}

/// `{ verified, stepUpToken, expiresAt, purpose:"generic" }` — reauthenticate
/// doubles as step-up method `password` with the wildcard purpose.
public struct ReauthenticateResponse: Decodable, Sendable, Hashable {
    public let verified: Bool?
    public let stepUpToken: String?
    public let expiresAt: LenientTimestamp?
    public let purpose: String?
}

/// `POST /api/users/forgot-password` — see `backend/routes/users.js:3470`.
///
/// Always returns a generic 200 response to prevent email enumeration. The
/// body is `{ message }`; client treats success as "email queued if account exists".
public struct ForgotPasswordRequest: Encodable, Sendable, Hashable {
    public let email: String

    public init(email: String) {
        self.email = email
    }
}

/// `POST /api/users/reset-password` — see `backend/routes/users.js:3520`.
///
/// `token` is the hashed recovery token from the email link (or a JWT
/// access token if reset is initiated mid-session). On 400 the backend
/// responds with `{ error: "Invalid or expired reset token" }`.
public struct ResetPasswordRequest: Encodable, Sendable, Hashable {
    public let token: String
    public let newPassword: String

    public init(token: String, newPassword: String) {
        self.token = token
        self.newPassword = newPassword
    }
}

/// `POST /api/users/verify-email` — see `backend/routes/users.js:3388`.
///
/// `tokenHash` is the hashed Supabase OTP carried by the email link;
/// `type` defaults to `"signup"` per the validation schema at
/// `backend/routes/users.js:866-871`. The `{ token, email }` shape is also
/// supported but the soft-gate flow always carries `tokenHash`.
public struct VerifyEmailRequest: Encodable, Sendable, Hashable {
    public let tokenHash: String
    public let type: String

    public init(tokenHash: String, type: String = "signup") {
        self.tokenHash = tokenHash
        self.type = type
    }
}

/// `POST /api/users/verify-email` response — see `backend/routes/users.js:3454`.
public struct VerifyEmailResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let verified: Bool?
}

/// `POST /api/users/resend-verification` — see `backend/routes/users.js:3322`.
///
/// Always returns 200 with a generic message so the absence of an account
/// can't be inferred from the response.
public struct ResendVerificationRequest: Encodable, Sendable, Hashable {
    public let email: String

    public init(email: String) {
        self.email = email
    }
}

/// Generic `{ message }` envelope used by several auth endpoints (forgot,
/// resend, reset). The exact phrasing is anti-enumeration safe; clients
/// surface "Check your inbox" rather than echoing the server text.
public struct AuthMessageResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// Decoded `{ error, code?, needsVerification?, purpose?, methods? }` body
/// returned by auth endpoints on 4xx. Used to disambiguate cases (e.g.
/// login 403 with `needsVerification: true`, 401 `code: TOKEN_REUSE`, 403
/// `code: STEP_UP_REQUIRED { purpose, methods }`).
public struct AuthErrorBody: Decodable, Sendable, Hashable {
    public let error: String?
    public let code: String?
    public let needsVerification: Bool?
    public let purpose: String?
    public let methods: [String]?

    public init(error: String?, code: String?, needsVerification: Bool? = nil, purpose: String? = nil, methods: [String]? = nil) {
        self.error = error
        self.code = code
        self.needsVerification = needsVerification
        self.purpose = purpose
        self.methods = methods
    }

    /// Best-effort decode of a raw 4xx body; nil when it is not the
    /// `{ error, code }` envelope.
    public static func decode(_ data: Data?) -> AuthErrorBody? {
        guard let data, !data.isEmpty else { return nil }
        return try? JSONDecoder().decode(AuthErrorBody.self, from: data)
    }
}

/// Why a session ended. Built from the 401 `code` on `/refresh` (CONTRACT
/// "Error envelope"): the security codes wipe tokens, keep the display
/// hint and show "You were signed out for security. Sign in again." — never
/// a generic expiry. Published by `AuthManager.sessionEndReason`.
public enum SessionEndReason: String, Sendable, Hashable, CaseIterable {
    case tokenReuse = "TOKEN_REUSE"
    case deviceMismatch = "DEVICE_MISMATCH"
    case deviceRevoked = "DEVICE_REVOKED"
    case sessionRevoked = "SESSION_REVOKED"
    case sessionExpiredInactive = "SESSION_EXPIRED_INACTIVE"
    case dpopRequired = "DPOP_REQUIRED"
    case dpopInvalid = "DPOP_INVALID"
    case dpopReplay = "DPOP_REPLAY"
    case resumeGrantInvalid = "RESUME_GRANT_INVALID"
    /// Generic `UNAUTHORIZED` or a 401 without a recognised code — the
    /// refresh token simply expired.
    case expired = "UNAUTHORIZED"

    /// Map a wire code; unknown / missing codes read as a plain expiry.
    public init(code: String?) {
        self = code.flatMap(SessionEndReason.init(rawValue:)) ?? .expired
    }

    /// The contract's "security sign-out" set.
    public var isSecurity: Bool {
        switch self {
        case .tokenReuse, .deviceMismatch, .deviceRevoked, .sessionRevoked, .sessionExpiredInactive, .dpopRequired:
            true
        case .dpopInvalid, .dpopReplay, .resumeGrantInvalid, .expired:
            false
        }
    }

    /// Copy the auth screens show for this reason.
    public var message: String {
        isSecurity
            ? "You were signed out for security. Sign in again."
            : "Your session has expired. Please sign in again."
    }
}

/// A timestamp the backend may send as ISO-8601, Unix seconds or Unix
/// milliseconds. Decodes all three so DTOs stay stable while the wire
/// format is finalised.
public struct LenientTimestamp: Decodable, Sendable, Hashable {
    public let date: Date

    public init(date: Date) {
        self.date = date
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let seconds = try? container.decode(Double.self) {
            // Anything past year 3000 in seconds is really milliseconds.
            date = Date(timeIntervalSince1970: seconds > 32_503_680_000 ? seconds / 1000 : seconds)
            return
        }
        let raw = try container.decode(String.self)
        if let parsed = Self.fractional.date(from: raw) ?? Self.plain.date(from: raw) {
            date = parsed
            return
        }
        if let seconds = Double(raw) {
            date = Date(timeIntervalSince1970: seconds > 32_503_680_000 ? seconds / 1000 : seconds)
            return
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unrecognised timestamp \(raw)")
    }

    /// `ISO8601DateFormatter` is thread-safe in practice but not annotated
    /// `Sendable`; the formatters are configured once and only ever read.
    private nonisolated(unsafe) static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private nonisolated(unsafe) static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

/// User payload embedded in `LoginResponse`. Email login returns the full
/// profile (`backend/routes/users.js:1739`); OAuth callback/token return a
/// thinner subset (`:3844` / `:3912`). Decode tolerates missing fields.
public struct AuthenticatedUser: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let email: String
    public let username: String
    public let name: String
    public let firstName: String
    public let middleName: String?
    public let lastName: String
    public let phoneNumber: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let accountType: String
    public let role: String
    public let verified: Bool
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id, email, username, name
        case firstName
        case middleName
        case lastName
        case phoneNumber
        case address, city, state, zipcode
        case accountType
        case role, verified
        case createdAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        email = try container.decode(String.self, forKey: .email)
        username = try container.decodeIfPresent(String.self, forKey: .username) ?? ""
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? ""
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName) ?? ""
        middleName = try container.decodeIfPresent(String.self, forKey: .middleName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName) ?? ""
        phoneNumber = try container.decodeIfPresent(String.self, forKey: .phoneNumber)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        city = try container.decodeIfPresent(String.self, forKey: .city)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        zipcode = try container.decodeIfPresent(String.self, forKey: .zipcode)
        accountType = try container.decodeIfPresent(String.self, forKey: .accountType) ?? "individual"
        role = try container.decodeIfPresent(String.self, forKey: .role) ?? "user"
        verified = try container.decodeIfPresent(Bool.self, forKey: .verified) ?? false
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    }
}
