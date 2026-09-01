package app.pantopus.android.data.api.models.auth

import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi

/**
 * Persistent-login / trusted-device wire types. Every shape below is pinned
 * by `docs/persistent-login/CONTRACT.md` (which wins over the design doc);
 * field names are camelCase on the wire, so no `@Json` renames are needed.
 */

/**
 * `device` object sent on `/api/users/login`, `/oauth/callback`,
 * `/oauth/token`, `/oauth/native`, `/api/auth/resume` and
 * `/api/auth/devices/register`. CONTRACT §"Device descriptor".
 *
 * `attestation` is reserved (`{type, ...}`) — the server stores it, but
 * `attestation_level` stays `none` in v1, so we always send `null`.
 */
@JsonClass(generateAdapter = true)
data class DeviceDescriptorDto(
    val deviceId: String,
    val platform: String = "android",
    val installId: String,
    val name: String?,
    val model: String?,
    val osVersion: String?,
    val appVersion: String?,
    val hasOsLock: Boolean,
    /** `strongbox | tee | software`. */
    val keyBacking: String,
    val attestation: Map<String, Any?>? = null,
)

/** `session: { id, context }` on login-shaped and refresh responses. */
@JsonClass(generateAdapter = true)
data class SessionInfoDto(
    val id: String?,
    /** `interactive` | `restored` | `oauth`. */
    val context: String?,
)

/** `device: { id, deviceId, isNew, trustLevel }` on login-shaped responses. */
@JsonClass(generateAdapter = true)
data class BoundDeviceDto(
    val id: String?,
    val deviceId: String?,
    val isNew: Boolean? = null,
    /** `trusted | unverified | suspect`. */
    val trustLevel: String? = null,
    val trustedAt: String? = null,
)

/**
 * `POST /api/users/logout` body. `scope=local` (this device) needs no
 * bearer; row side effects (revoke session, clear binding, delete push
 * tokens, revoke grants) happen only when proof is present — a valid
 * bearer bound to [deviceId] OR [refreshToken] + a `DPoP` proof with `rth`.
 * `others` / `global` require a bearer plus `X-Step-Up`.
 */
@JsonClass(generateAdapter = true)
data class LogoutRequest(
    /** `local` | `others` | `global`. */
    val scope: String,
    val deviceId: String? = null,
    val refreshToken: String? = null,
)

/** `POST /api/users/logout` response `{ success, revoked? }`. */
@JsonClass(generateAdapter = true)
data class LogoutResponse(
    val success: Boolean?,
    val revoked: Int? = null,
)

/**
 * `POST /api/users/reauthenticate` response — password re-check that now
 * also mints a wildcard (`purpose: "generic"`) step-up token.
 */
@JsonClass(generateAdapter = true)
data class ReauthenticateRequest(
    val password: String,
)

@JsonClass(generateAdapter = true)
data class ReauthenticateResponse(
    val verified: Boolean?,
    val stepUpToken: String? = null,
    val expiresAt: String? = null,
    val purpose: String? = null,
)

/** `POST /api/auth/challenge` — `{ purpose: "step_up" | "resume" | "attestation" }`. */
@JsonClass(generateAdapter = true)
data class ChallengeRequest(
    val purpose: String,
)

/** `{ challengeId, challenge (b64url 32 B), expiresAt }`. */
@JsonClass(generateAdapter = true)
data class ChallengeResponse(
    val challengeId: String,
    val challenge: String,
    val expiresAt: String?,
)

/**
 * `POST /api/auth/devices/register` — metadata + push-token linkage. Never
 * creates a binding (the DPoP thumbprint must equal the session's bound
 * key; unbound sessions get 409 `DEVICE_NOT_BOUND`). Idempotent.
 */
@JsonClass(generateAdapter = true)
data class RegisterDeviceRequest(
    val device: DeviceDescriptorDto,
    val pushToken: String? = null,
    /** `fcm` | `apns`. */
    val pushProvider: String? = null,
)

/** `{ device, resumeGrant? }` — the grant is Android-only. */
@JsonClass(generateAdapter = true)
data class RegisterDeviceResponse(
    val device: BoundDeviceDto?,
    val resumeGrant: String? = null,
)

/** `POST /api/auth/resume` — `{ grant, device }` + required `DPoP`. */
@JsonClass(generateAdapter = true)
data class ResumeRequest(
    val grant: String,
    val device: DeviceDescriptorDto,
)

/** One row of `GET /api/auth/devices`.devices. */
@JsonClass(generateAdapter = true)
data class AuthDeviceDto(
    val id: String,
    val deviceId: String?,
    val platform: String?,
    val name: String?,
    val model: String?,
    val osVersion: String?,
    val appVersion: String?,
    val isCurrent: Boolean? = null,
    val trustLevel: String?,
    val trustedAt: String?,
    val lastSeenAt: String?,
    val lastIp: String? = null,
    val createdAt: String?,
)

/** One row of `GET /api/auth/devices`.sessions (web + native). */
@JsonClass(generateAdapter = true)
data class AuthSessionDto(
    val id: String,
    val platform: String?,
    val userAgent: String?,
    val isCurrent: Boolean? = null,
    val lastSeenAt: String?,
    val issuedAt: String?,
)

/** One row of `GET /api/auth/devices`.events / `GET /api/auth/security-events`. */
@JsonClass(generateAdapter = true)
data class SecurityEventDto(
    val id: Any?,
    val type: String,
    val createdAt: String?,
    val deviceId: String? = null,
    val meta: Map<String, Any?>? = null,
)

/** `GET /api/auth/devices` envelope. */
@JsonClass(generateAdapter = true)
data class DevicesResponse(
    val devices: List<AuthDeviceDto> = emptyList(),
    val sessions: List<AuthSessionDto> = emptyList(),
    val events: List<SecurityEventDto> = emptyList(),
)

/** `GET /api/auth/security-events?limit=` envelope. */
@JsonClass(generateAdapter = true)
data class SecurityEventsResponse(
    val events: List<SecurityEventDto> = emptyList(),
)

/** `{ ok: true }` envelope shared by revoke-device / revoke-all / step-up-key. */
@JsonClass(generateAdapter = true)
data class OkResponse(
    val ok: Boolean?,
)

/** `POST /api/auth/sessions/revoke-others` → `{ revoked: n }`. */
@JsonClass(generateAdapter = true)
data class RevokedCountResponse(
    val revoked: Int?,
)

/**
 * `POST /api/auth/step-up` body — either `{ purpose, method: "password",
 * password }` or `{ purpose, method: "device_key", challengeId, signature }`.
 * `signature` is the ES256 (raw `r||s`, base64url) signature over the raw
 * challenge bytes made by the biometry-bound step-up key.
 */
@JsonClass(generateAdapter = true)
data class StepUpRequest(
    val purpose: String,
    /** `password` | `device_key`. */
    val method: String,
    val password: String? = null,
    val challengeId: String? = null,
    val signature: String? = null,
)

/** `{ stepUpToken, expiresAt, purpose }`. */
@JsonClass(generateAdapter = true)
data class StepUpResponse(
    val stepUpToken: String,
    val expiresAt: String?,
    val purpose: String?,
)

/**
 * `POST /api/auth/step-up-key` — enrols the biometry-bound step-up public
 * key on the *current* device row (bearer + DPoP, interactive session only).
 */
@JsonClass(generateAdapter = true)
data class StepUpKeyEnrolRequest(
    val publicKeyJwk: Map<String, String>,
    /** `strongbox | tee | software`. */
    val keyBacking: String,
)

/** `GET / PATCH /api/auth/security-prefs`. */
@JsonClass(generateAdapter = true)
data class SecurityPrefsDto(
    val allowRestoreGrants: Boolean? = null,
    val newDeviceEmail: Boolean? = null,
)

/**
 * 403 `STEP_UP_REQUIRED` body: `{ error, code, purpose, methods }`.
 * [methods] is a subset of `["password", "device_key"]`.
 */
@JsonClass(generateAdapter = true)
data class StepUpRequiredBody(
    val error: String?,
    val code: String?,
    val purpose: String?,
    val methods: List<String>? = null,
)

/**
 * Error codes the clients must distinguish (CONTRACT §"Error envelope").
 * Kept as string constants (not an enum) so an unknown code from a newer
 * backend still round-trips through [AuthErrorBody.code].
 */
object AuthErrorCodes {
    const val TOKEN_REUSE = "TOKEN_REUSE"
    const val DEVICE_MISMATCH = "DEVICE_MISMATCH"
    const val DEVICE_REVOKED = "DEVICE_REVOKED"
    const val SESSION_REVOKED = "SESSION_REVOKED"
    const val SESSION_EXPIRED_INACTIVE = "SESSION_EXPIRED_INACTIVE"
    const val DPOP_REQUIRED = "DPOP_REQUIRED"
    const val DPOP_INVALID = "DPOP_INVALID"
    const val DPOP_REPLAY = "DPOP_REPLAY"
    const val RESUME_GRANT_INVALID = "RESUME_GRANT_INVALID"
    const val UNAUTHORIZED = "UNAUTHORIZED"
    const val STEP_UP_REQUIRED = "STEP_UP_REQUIRED"
    const val DEVICE_NOT_BOUND = "DEVICE_NOT_BOUND"

    /**
     * Codes that mean "wipe tokens, keep the display hint, show *You were
     * signed out for security*" — CONTRACT §"Error envelope".
     */
    val SECURITY_SIGN_OUT: Set<String> =
        setOf(
            TOKEN_REUSE,
            DEVICE_MISMATCH,
            DEVICE_REVOKED,
            SESSION_REVOKED,
            SESSION_EXPIRED_INACTIVE,
            DPOP_REQUIRED,
        )
}

/**
 * Tolerant parser for the `{ error, code }` envelope on 4xx bodies. Never
 * throws — a non-JSON / empty body yields `null` for every field.
 */
object AuthErrorBodyParser {
    private val adapter by lazy { Moshi.Builder().build().adapter(AuthErrorBody::class.java).lenient() }
    private val stepUpAdapter by lazy { Moshi.Builder().build().adapter(StepUpRequiredBody::class.java).lenient() }

    fun parse(body: String?): AuthErrorBody? {
        if (body.isNullOrBlank()) return null
        return runCatching { adapter.fromJson(body) }.getOrNull()
    }

    /** Just the `code` field, or `null`. */
    fun code(body: String?): String? = parse(body)?.code

    fun parseStepUp(body: String?): StepUpRequiredBody? {
        if (body.isNullOrBlank()) return null
        return runCatching { stepUpAdapter.fromJson(body) }.getOrNull()
    }
}
