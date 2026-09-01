package app.pantopus.android.data.api.models.auth

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `POST /api/users/login` request body. Route: `backend/routes/users.js:1492`.
 *
 * [device] is the optional device descriptor (persistent-login CONTRACT
 * §"Device descriptor"); sent together with a `DPoP` header so the server
 * can bind the issued session to this device's key at issuance.
 */
@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
    val device: DeviceDescriptorDto? = null,
)

/**
 * `POST /api/users/login` response. Tokens are omitted when the server is
 * in cookie-transport mode. Route: `backend/routes/users.js:1492`.
 *
 * Persistent-login additions (all optional, older backends omit them):
 * [sessionId], [session] (`{ id, context }`), [device] (`{ id, deviceId,
 * isNew, trustLevel }`) and — on `POST /api/auth/resume` only —
 * [resumeGrant] (the next single-use Block Store grant).
 */
@JsonClass(generateAdapter = true)
data class LoginResponse(
    val message: String?,
    val accessToken: String?,
    val refreshToken: String?,
    /** Seconds until the access token expires. */
    val expiresIn: Long?,
    /** Absolute expiry (Unix epoch, seconds). */
    val expiresAt: Long?,
    val user: AuthenticatedUser,
    val sessionId: String? = null,
    val session: SessionInfoDto? = null,
    val device: BoundDeviceDto? = null,
    val resumeGrant: String? = null,
)

/**
 * `GET /api/users/oauth/:provider` response. Route:
 * `backend/routes/users.js:3715`.
 */
@JsonClass(generateAdapter = true)
data class OAuthUrlResponse(
    val url: String,
)

/**
 * `POST /api/users/oauth/callback` request. Route:
 * `backend/routes/users.js:3862`.
 */
@JsonClass(generateAdapter = true)
data class OAuthCodeExchangeRequest(
    val code: String,
    val device: DeviceDescriptorDto? = null,
)

/**
 * `POST /api/users/oauth/token` request — legacy fragment-token path.
 * Route: `backend/routes/users.js:3792`.
 */
@JsonClass(generateAdapter = true)
data class OAuthTokenExchangeRequest(
    val accessToken: String,
    val refreshToken: String,
    val device: DeviceDescriptorDto? = null,
)

/**
 * `POST /api/users/oauth/native` request — native Sign in with Google /
 * Apple id-token exchange (persistent-login CONTRACT). Wired server-side;
 * the Credential Manager client path lands in a later phase.
 */
@JsonClass(generateAdapter = true)
data class OAuthNativeRequest(
    /** `"apple"` or `"google"`. */
    val provider: String,
    val idToken: String,
    val nonce: String? = null,
    val accessToken: String? = null,
    val device: DeviceDescriptorDto? = null,
)

/**
 * `POST /api/users/register` request body. Route:
 * `backend/routes/users.js:1177`.
 *
 * `accountType` maps the [AccountType] enum into the backend's
 * `'individual' | 'business'` string (see `registerSchema` at
 * `backend/routes/users.js:710-725`). `inviteCode` is serialized as
 * `invite_code` to match the snake_case key the backend extracts.
 */
@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val email: String,
    val password: String,
    val phoneNumber: String?,
    val username: String,
    val firstName: String,
    val middleName: String?,
    val lastName: String,
    val dateOfBirth: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipcode: String?,
    val accountType: String,
    @Json(name = "invite_code") val inviteCode: String?,
)

/**
 * `POST /api/users/register` response. Route: `backend/routes/users.js:1437`.
 */
@JsonClass(generateAdapter = true)
data class RegisterResponse(
    val message: String?,
    val requiresEmailVerification: Boolean?,
    val user: AuthenticatedUser,
)

/**
 * `POST /api/users/refresh` request. The server can also read the refresh
 * token from the `pantopus_refresh` cookie. Route:
 * `backend/routes/users.js:1910`.
 */
@JsonClass(generateAdapter = true)
data class RefreshRequest(
    val refreshToken: String?,
    /** Persistent login: lets the server resolve the bound session faster. */
    val deviceId: String? = null,
    val sessionId: String? = null,
)

/**
 * `POST /api/users/refresh` response. Route: `backend/routes/users.js:1910`.
 * [sessionId] / [session] are the persistent-login additions.
 */
@JsonClass(generateAdapter = true)
data class RefreshResponse(
    val ok: Boolean,
    val accessToken: String?,
    val refreshToken: String?,
    val expiresIn: Long?,
    val expiresAt: Long?,
    val sessionId: String? = null,
    val session: SessionInfoDto? = null,
)

/**
 * `POST /api/users/forgot-password` request. Backend always replies 200 to
 * prevent email enumeration. Route: `backend/routes/users.js:3197`.
 */
@JsonClass(generateAdapter = true)
data class ForgotPasswordRequest(
    val email: String,
)

/**
 * `POST /api/users/reset-password` request. `token` is the hashed recovery
 * token carried by the email link, or a JWT access token if reset is
 * initiated mid-session. Route: `backend/routes/users.js:3247`.
 */
@JsonClass(generateAdapter = true)
data class ResetPasswordRequest(
    val token: String,
    val newPassword: String,
)

/**
 * `POST /api/users/verify-email` request. `tokenHash` is the hashed
 * Supabase OTP carried by the verification link; `type` defaults to
 * `"signup"` per the validation schema at
 * `backend/routes/users.js:755-760`. Route: `backend/routes/users.js:3115`.
 */
@JsonClass(generateAdapter = true)
data class VerifyEmailRequest(
    val tokenHash: String,
    val type: String = "signup",
)

/**
 * `POST /api/users/verify-email` response. Route:
 * `backend/routes/users.js:3181`.
 */
@JsonClass(generateAdapter = true)
data class VerifyEmailResponse(
    val message: String?,
    val verified: Boolean?,
)

/**
 * `POST /api/users/resend-verification` request. Always 200, anti-enumeration.
 * Route: `backend/routes/users.js:3049`.
 */
@JsonClass(generateAdapter = true)
data class ResendVerificationRequest(
    val email: String,
)

/**
 * Generic `{ message }` envelope used by forgot / resend / reset endpoints.
 */
@JsonClass(generateAdapter = true)
data class AuthMessageResponse(
    val message: String?,
)

/**
 * Decoded `{ error, code?, needsVerification? }` body returned by auth
 * endpoints on 4xx. Mirrors iOS `AuthErrorBody` for parity.
 */
@JsonClass(generateAdapter = true)
data class AuthErrorBody(
    val error: String?,
    val code: String?,
    val needsVerification: Boolean?,
)

/**
 * User payload embedded in [LoginResponse]. Email login returns the full
 * profile; OAuth callback/token return a thinner subset — defaults keep
 * Moshi decoding resilient.
 */
@JsonClass(generateAdapter = true)
data class AuthenticatedUser(
    val id: String,
    val email: String,
    val username: String = "",
    val name: String = "",
    val firstName: String = "",
    val middleName: String? = null,
    val lastName: String = "",
    val phoneNumber: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    val accountType: String = "individual",
    val role: String = "user",
    val verified: Boolean = false,
    val createdAt: String = "",
)
