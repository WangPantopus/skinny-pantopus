package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.auth.AuthMessageResponse
import app.pantopus.android.data.api.models.auth.ChallengeRequest
import app.pantopus.android.data.api.models.auth.ChallengeResponse
import app.pantopus.android.data.api.models.auth.DevicesResponse
import app.pantopus.android.data.api.models.auth.ForgotPasswordRequest
import app.pantopus.android.data.api.models.auth.LoginRequest
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.LogoutRequest
import app.pantopus.android.data.api.models.auth.LogoutResponse
import app.pantopus.android.data.api.models.auth.OAuthCodeExchangeRequest
import app.pantopus.android.data.api.models.auth.OAuthNativeRequest
import app.pantopus.android.data.api.models.auth.OAuthTokenExchangeRequest
import app.pantopus.android.data.api.models.auth.OAuthUrlResponse
import app.pantopus.android.data.api.models.auth.OkResponse
import app.pantopus.android.data.api.models.auth.ReauthenticateRequest
import app.pantopus.android.data.api.models.auth.ReauthenticateResponse
import app.pantopus.android.data.api.models.auth.RefreshRequest
import app.pantopus.android.data.api.models.auth.RefreshResponse
import app.pantopus.android.data.api.models.auth.RegisterDeviceRequest
import app.pantopus.android.data.api.models.auth.RegisterDeviceResponse
import app.pantopus.android.data.api.models.auth.RegisterRequest
import app.pantopus.android.data.api.models.auth.RegisterResponse
import app.pantopus.android.data.api.models.auth.ResendVerificationRequest
import app.pantopus.android.data.api.models.auth.ResetPasswordRequest
import app.pantopus.android.data.api.models.auth.ResumeRequest
import app.pantopus.android.data.api.models.auth.RevokedCountResponse
import app.pantopus.android.data.api.models.auth.SecurityEventsResponse
import app.pantopus.android.data.api.models.auth.SecurityPrefsDto
import app.pantopus.android.data.api.models.auth.StepUpKeyEnrolRequest
import app.pantopus.android.data.api.models.auth.StepUpRequest
import app.pantopus.android.data.api.models.auth.StepUpResponse
import app.pantopus.android.data.api.models.auth.VerifyEmailRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Auth routes from `backend/routes/users.js` plus the persistent-login /
 * trusted-device router `backend/routes/authDevices.js` (mounted at
 * `/api/auth`). Wire shapes: `docs/persistent-login/CONTRACT.md`.
 *
 * Header conventions (all optional params — Retrofit omits a `null` header):
 *  - `DPoP` — ES256 `dpop+jwt` proof from `DPoPProofBuilder`. Required on
 *    `/api/auth/resume`; sent on login / oauth / refresh / logout /
 *    devices/register / step-up-key so the server can bind + verify.
 *  - `X-Step-Up` — opaque step-up token for destructive routes.
 *  - `Authorization` — only passed explicitly on the dedicated
 *    `@Named("authRefresh")` client (which has no `AuthInterceptor`).
 */
@Suppress("TooManyFunctions")
interface AuthApi {
    /**
     * `GET /api/users/oauth/:provider` — route `backend/routes/users.js:3715`.
     *
     * [redirectTo] must carry the per-attempt `app_nonce`; build it with
     * `OAuthSessionStore.redirectUri(nonce)` so the callback can be verified.
     */
    @GET("api/users/oauth/{provider}")
    suspend fun oauthUrl(
        @Path("provider") provider: String,
        @Query("redirectTo") redirectTo: String,
    ): OAuthUrlResponse

    /** `POST /api/users/oauth/callback` — route `backend/routes/users.js:3862`. */
    @POST("api/users/oauth/callback")
    suspend fun exchangeOAuthCode(
        @Body body: OAuthCodeExchangeRequest,
        @Header("DPoP") dpop: String? = null,
    ): LoginResponse

    /** `POST /api/users/oauth/token` — route `backend/routes/users.js:3792`. */
    @POST("api/users/oauth/token")
    suspend fun exchangeOAuthToken(
        @Body body: OAuthTokenExchangeRequest,
        @Header("DPoP") dpop: String? = null,
    ): LoginResponse

    /**
     * `POST /api/users/oauth/native` — native id-token sign-in (Sign in with
     * Google via Credential Manager / Sign in with Apple). Route
     * `backend/routes/users.js` (persistent-login hook; CONTRACT).
     */
    @POST("api/users/oauth/native")
    suspend fun oauthNative(
        @Body body: OAuthNativeRequest,
        @Header("DPoP") dpop: String? = null,
    ): LoginResponse

    /** `POST /api/users/login` — route `backend/routes/users.js:1492`. */
    @POST("api/users/login")
    suspend fun login(
        @Body body: LoginRequest,
        @Header("DPoP") dpop: String? = null,
    ): LoginResponse

    /** `POST /api/users/register` — route `backend/routes/users.js:1177`. */
    @POST("api/users/register")
    suspend fun register(
        @Body body: RegisterRequest,
    ): RegisterResponse

    /**
     * `POST /api/users/refresh` — route `backend/routes/users.js:1910`.
     * The `DPoP` proof MUST carry `rth = b64url(sha256(refreshToken))`.
     */
    @POST("api/users/refresh")
    suspend fun refresh(
        @Body body: RefreshRequest,
        @Header("DPoP") dpop: String? = null,
    ): RefreshResponse

    /**
     * `POST /api/users/logout` — route `backend/routes/users.js:4263`.
     * Called on the dedicated refresh client, so the bearer is passed
     * explicitly. `scope=local` + `refreshToken` + `DPoP(rth)` is the proof
     * that lets the server revoke this device's session row + grants.
     */
    @POST("api/users/logout")
    suspend fun logout(
        @Body body: LogoutRequest,
        @Header("Authorization") authorization: String? = null,
        @Header("DPoP") dpop: String? = null,
        @Header("X-Step-Up") stepUp: String? = null,
    ): LogoutResponse

    /**
     * `POST /api/users/reauthenticate` — route `backend/routes/users.js:1649`.
     * Password re-check; now also returns a wildcard step-up token.
     */
    @POST("api/users/reauthenticate")
    suspend fun reauthenticate(
        @Body body: ReauthenticateRequest,
    ): ReauthenticateResponse

    /** `POST /api/users/forgot-password` — route `backend/routes/users.js:3197`. */
    @POST("api/users/forgot-password")
    suspend fun forgotPassword(
        @Body body: ForgotPasswordRequest,
    ): AuthMessageResponse

    /** `POST /api/users/reset-password` — route `backend/routes/users.js:3247`. */
    @POST("api/users/reset-password")
    suspend fun resetPassword(
        @Body body: ResetPasswordRequest,
    ): AuthMessageResponse

    /** `POST /api/users/verify-email` — route `backend/routes/users.js:3115`. */
    @POST("api/users/verify-email")
    suspend fun verifyEmail(
        @Body body: VerifyEmailRequest,
    ): VerifyEmailResponse

    /** `POST /api/users/resend-verification` — route `backend/routes/users.js:3049`. */
    @POST("api/users/resend-verification")
    suspend fun resendVerification(
        @Body body: ResendVerificationRequest,
    ): AuthMessageResponse

    // ── /api/auth — trusted devices, resume, step-up (backend/routes/authDevices.js) ──

    /** `POST /api/auth/challenge` — unauthenticated nonce (30/15 min/IP). */
    @POST("api/auth/challenge")
    suspend fun challenge(
        @Body body: ChallengeRequest,
    ): ChallengeResponse

    /**
     * `POST /api/auth/devices/register` — bearer + `DPoP` whose thumbprint
     * equals the session's bound key. Metadata + push-token linkage; the
     * Android response carries the next single-use `resumeGrant`.
     */
    @POST("api/auth/devices/register")
    suspend fun registerDevice(
        @Body body: RegisterDeviceRequest,
        @Header("DPoP") dpop: String?,
    ): RegisterDeviceResponse

    /** `GET /api/auth/devices` — devices + web sessions + recent events. */
    @GET("api/auth/devices")
    suspend fun devices(): DevicesResponse

    /** `DELETE /api/auth/devices/:id` — bearer + `X-Step-Up` (`revoke_device`). */
    @DELETE("api/auth/devices/{id}")
    suspend fun revokeDevice(
        @Path("id") id: String,
        @Header("X-Step-Up") stepUp: String,
    ): OkResponse

    /** `POST /api/auth/sessions/revoke-others` — bearer + `X-Step-Up` (`revoke_sessions`). */
    @POST("api/auth/sessions/revoke-others")
    suspend fun revokeOtherSessions(
        @Header("X-Step-Up") stepUp: String,
    ): RevokedCountResponse

    /**
     * `POST /api/auth/sessions/revoke-all` ("Lockdown") — bearer + `X-Step-Up`
     * (`revoke_sessions`). The client signs itself out afterwards.
     */
    @POST("api/auth/sessions/revoke-all")
    suspend fun revokeAllSessions(
        @Header("X-Step-Up") stepUp: String,
    ): OkResponse

    /**
     * `POST /api/auth/resume` — unauthenticated (5/15 min/IP + per grant),
     * `DPoP` REQUIRED. Redeems the Block Store grant into a `restored`
     * session. Called on the dedicated refresh client.
     */
    @POST("api/auth/resume")
    suspend fun resume(
        @Body body: ResumeRequest,
        @Header("DPoP") dpop: String,
    ): LoginResponse

    /** `POST /api/auth/step-up` — bearer (10/15 min/user). */
    @POST("api/auth/step-up")
    suspend fun stepUp(
        @Body body: StepUpRequest,
    ): StepUpResponse

    /**
     * `POST /api/auth/step-up-key` — bearer + `DPoP` (bound key); session
     * must be `interactive`. Stores the biometry-bound step-up public key.
     */
    @POST("api/auth/step-up-key")
    suspend fun enrolStepUpKey(
        @Body body: StepUpKeyEnrolRequest,
        @Header("DPoP") dpop: String?,
    ): OkResponse

    /** `GET /api/auth/security-prefs`. */
    @GET("api/auth/security-prefs")
    suspend fun securityPrefs(): SecurityPrefsDto

    /** `PATCH /api/auth/security-prefs` — bearer + `X-Step-Up` (`change_security_prefs`). */
    @PATCH("api/auth/security-prefs")
    suspend fun updateSecurityPrefs(
        @Body body: SecurityPrefsDto,
        @Header("X-Step-Up") stepUp: String,
    ): SecurityPrefsDto

    /** `GET /api/auth/security-events?limit=50`. */
    @GET("api/auth/security-events")
    suspend fun securityEvents(
        @Query("limit") limit: Int = 50,
    ): SecurityEventsResponse
}
