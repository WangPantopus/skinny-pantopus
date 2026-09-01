//
//  AuthDTOs.swift
//  Pantopus
//
//  DTOs for the auth endpoints on `backend/routes/users.js`. See inline
//  route citations for response-shape provenance.
//

import Foundation

/// `POST /api/users/login` — see `backend/routes/users.js:1492`.
public struct LoginRequest: Encodable, Sendable {
    /// Account email.
    public let email: String
    /// Plain-text password; transported over TLS only.
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

/// Login response body. Tokens are omitted when the server is in
/// cookie-transport mode (header: `x-token-transport: cookie`).
///
/// Route: `backend/routes/users.js:955`.
public struct LoginResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let accessToken: String?
    public let refreshToken: String?
    /// Seconds until the access token expires.
    public let expiresIn: Int?
    /// Absolute expiry as a Unix epoch in seconds.
    public let expiresAt: Int?
    public let user: AuthenticatedUser

    private enum CodingKeys: String, CodingKey {
        case message
        case accessToken
        case refreshToken
        case expiresIn
        case expiresAt
        case user
    }
}

/// `GET /api/users/oauth/:provider` response — see
/// `backend/routes/users.js:3715`.
public struct OAuthURLResponse: Decodable, Sendable, Hashable {
    public let url: URL
}

/// `POST /api/users/oauth/callback` request — see
/// `backend/routes/users.js:3862`.
public struct OAuthCodeExchangeRequest: Encodable, Sendable, Hashable {
    public let code: String

    public init(code: String) {
        self.code = code
    }
}

/// `POST /api/users/oauth/token` request — legacy fragment-token path.
/// Route: `backend/routes/users.js:3792`.
public struct OAuthTokenExchangeRequest: Encodable, Sendable, Hashable {
    public let accessToken: String
    public let refreshToken: String

    public init(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

/// `POST /api/users/register` request body — see `backend/routes/users.js:1177`.
///
/// `accountType` maps the iOS `AccountType` enum into the backend's
/// `'individual' | 'business'` string (see `registerSchema` at
/// `backend/routes/users.js:710-725`). `inviteCode` is serialized as
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

/// `POST /api/users/register` response body — see `backend/routes/users.js:1437`.
///
/// The backend creates the auth user, persists the profile row, then sends
/// a verification email. The returned `user` is the freshly-created profile
/// in the same shape `LoginResponse.user` carries.
public struct RegisterResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let requiresEmailVerification: Bool?
    public let user: AuthenticatedUser
}

/// `POST /api/users/refresh` — see `backend/routes/users.js:1910`.
public struct RefreshRequest: Encodable, Sendable {
    /// Optional: the server can also read the refresh token from the
    /// `pantopus_refresh` cookie.
    public let refreshToken: String?

    public init(refreshToken: String?) {
        self.refreshToken = refreshToken
    }
}

/// Refresh response body. Token fields are omitted in cookie-transport mode.
///
/// Route: `backend/routes/users.js:1910`.
public struct RefreshResponse: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let accessToken: String?
    public let refreshToken: String?
    public let expiresIn: Int?
    public let expiresAt: Int?
}

/// `POST /api/users/forgot-password` — see `backend/routes/users.js:3197`.
///
/// Always returns a generic 200 response to prevent email enumeration. The
/// body is `{ message }`; client treats success as "email queued if account exists".
public struct ForgotPasswordRequest: Encodable, Sendable, Hashable {
    public let email: String

    public init(email: String) {
        self.email = email
    }
}

/// `POST /api/users/reset-password` — see `backend/routes/users.js:3247`.
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

/// `POST /api/users/verify-email` — see `backend/routes/users.js:3115`.
///
/// `tokenHash` is the hashed Supabase OTP carried by the email link;
/// `type` defaults to `"signup"` per the validation schema at
/// `backend/routes/users.js:755-760`. The `{ token, email }` shape is also
/// supported but the soft-gate flow always carries `tokenHash`.
public struct VerifyEmailRequest: Encodable, Sendable, Hashable {
    public let tokenHash: String
    public let type: String

    public init(tokenHash: String, type: String = "signup") {
        self.tokenHash = tokenHash
        self.type = type
    }
}

/// `POST /api/users/verify-email` response — see `backend/routes/users.js:3181`.
public struct VerifyEmailResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let verified: Bool?
}

/// `POST /api/users/resend-verification` — see `backend/routes/users.js:3049`.
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

/// Decoded `{ error, code?, needsVerification? }` body returned by auth
/// endpoints on 4xx. Used to disambiguate cases (e.g. login 403 with
/// `needsVerification: true`).
public struct AuthErrorBody: Decodable, Sendable, Hashable {
    public let error: String?
    public let code: String?
    public let needsVerification: Bool?
}

/// User payload embedded in `LoginResponse`. Email login returns the full
/// profile (`backend/routes/users.js:1614`); OAuth callback/token return a
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
