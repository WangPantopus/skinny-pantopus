package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.settings.AuthMethodsResponse
import app.pantopus.android.data.api.models.settings.PasswordUpdateBody
import app.pantopus.android.data.api.models.settings.ResendVerificationBody
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.ProfileUpdateRequest
import app.pantopus.android.data.api.models.users.ProfileUpdateResponse
import app.pantopus.android.data.api.models.users.UpdateSkillsRequest
import app.pantopus.android.data.api.models.users.UpdateSkillsResponse
import app.pantopus.android.data.api.models.users.UserSearchResponse
import app.pantopus.android.data.api.models.users.UserStatsDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** User profile routes from `backend/routes/users.js`. */
interface UsersApi {
    /** `GET /api/users/profile` — route `backend/routes/users.js:1962`. */
    @GET("api/users/profile")
    suspend fun profile(): ProfileResponse

    /** `PATCH /api/users/profile` — route `backend/routes/users.js:2052`. */
    @PATCH("api/users/profile")
    suspend fun updateProfile(
        @Body body: ProfileUpdateRequest,
    ): ProfileUpdateResponse

    /** `PUT /api/users/skills` — replace the caller's whole skill list.
     *  Route `backend/routes/users.js:2246`; the handler trims, dedupes,
     *  caps each entry at 100 chars and the list at 50, then echoes the
     *  cleaned array. Mirrors iOS `ProfileTabsEndpoints.updateSkills`. */
    @PUT("api/users/skills")
    suspend fun updateSkills(
        @Body body: UpdateSkillsRequest,
    ): UpdateSkillsResponse

    /** `GET /api/users/id/:id` — route `backend/routes/users.js:2041`. */
    @GET("api/users/id/{id}")
    suspend fun publicProfile(
        @Path("id") id: String,
    ): PublicProfileDto

    /** `GET /api/users/:id/stats` — route `backend/routes/users.js:2787`. */
    @GET("api/users/{id}/stats")
    suspend fun stats(
        @Path("id") id: String,
    ): UserStatsDto

    /** `GET /api/users/auth-methods` — route `backend/routes/users.js:1739`. */
    @GET("api/users/auth-methods")
    suspend fun authMethods(): AuthMethodsResponse

    /** `POST /api/users/password` — route `backend/routes/users.js:1771`.
     *  Rate-limited by `reauthLimiter`. */
    @POST("api/users/password")
    suspend fun updatePassword(
        @Body body: PasswordUpdateBody,
    )

    /** `POST /api/users/resend-verification` — route
     *  `backend/routes/users.js:3049`. Rate-limited by
     *  `resendVerificationLimiter`. */
    @POST("api/users/resend-verification")
    suspend fun resendVerification(
        @Body body: ResendVerificationBody,
    )

    /** `GET /api/users/search?q=…&type=…&limit=…` — verified-user
     *  directory search. Route `backend/routes/users.js:2367`. Backend
     *  rejects `q` under 2 characters with a 400, so callers must gate
     *  on `query.length >= 2`. */
    @GET("api/users/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20,
        @Query("type") type: String = "all",
    ): UserSearchResponse
}
