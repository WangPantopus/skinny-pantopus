package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.auth.AuthMessageResponse
import app.pantopus.android.data.api.models.auth.ForgotPasswordRequest
import app.pantopus.android.data.api.models.auth.LoginRequest
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.OAuthCodeExchangeRequest
import app.pantopus.android.data.api.models.auth.OAuthTokenExchangeRequest
import app.pantopus.android.data.api.models.auth.OAuthUrlResponse
import app.pantopus.android.data.api.models.auth.RefreshRequest
import app.pantopus.android.data.api.models.auth.RefreshResponse
import app.pantopus.android.data.api.models.auth.RegisterRequest
import app.pantopus.android.data.api.models.auth.RegisterResponse
import app.pantopus.android.data.api.models.auth.ResendVerificationRequest
import app.pantopus.android.data.api.models.auth.ResetPasswordRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailRequest
import app.pantopus.android.data.api.models.auth.VerifyEmailResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Auth routes from `backend/routes/users.js`. */
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
    ): LoginResponse

    /** `POST /api/users/oauth/token` — route `backend/routes/users.js:3792`. */
    @POST("api/users/oauth/token")
    suspend fun exchangeOAuthToken(
        @Body body: OAuthTokenExchangeRequest,
    ): LoginResponse

    /** `POST /api/users/login` — route `backend/routes/users.js:1492`. */
    @POST("api/users/login")
    suspend fun login(
        @Body body: LoginRequest,
    ): LoginResponse

    /** `POST /api/users/register` — route `backend/routes/users.js:1177`. */
    @POST("api/users/register")
    suspend fun register(
        @Body body: RegisterRequest,
    ): RegisterResponse

    /** `POST /api/users/refresh` — route `backend/routes/users.js:1910`. */
    @POST("api/users/refresh")
    suspend fun refresh(
        @Body body: RefreshRequest,
    ): RefreshResponse

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
}
