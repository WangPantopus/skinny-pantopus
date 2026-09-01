package app.pantopus.android.data.api

import app.pantopus.android.data.api.models.auth.LoginRequest
import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.feed.RegisterPushTokenRequest
import app.pantopus.android.data.api.models.users.ProfileResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Legacy aggregate Retrofit interface retained for existing call sites
 * (auth sign-in, push registration). New feature code should depend on
 * the smaller feature APIs in `data/api/services/` (AuthApi, UsersApi,
 * HubApi, HomesApi, MailboxApi, MailboxV2Api, PostsApi).
 */
interface ApiService {
    /** `POST /api/users/login` — route `backend/routes/users.js:955`. */
    @POST("api/users/login")
    suspend fun login(
        @Body body: LoginRequest,
    ): LoginResponse

    /** `GET /api/users/profile` — route `backend/routes/users.js:1427`. */
    @GET("api/users/profile")
    suspend fun me(): ProfileResponse

    @POST("api/notifications/register")
    suspend fun registerPushToken(
        @Body body: RegisterPushTokenRequest,
    )
}
