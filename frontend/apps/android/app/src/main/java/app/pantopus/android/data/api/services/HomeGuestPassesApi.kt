package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.CreateGuestPassRequest
import app.pantopus.android.data.api.models.homes.CreateGuestPassResponse
import app.pantopus.android.data.api.models.homes.GuestPassesResponse
import app.pantopus.android.data.api.models.homes.RevokeGuestPassResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Home guest-pass endpoints from `backend/routes/homeIam.js`. Kept
 * separate from [HomesApi] so the Guests feature owns its own service
 * surface; both share the same Retrofit instance via `di/NetworkModule.kt`.
 */
interface HomeGuestPassesApi {
    /**
     * `POST /api/homes/:id/guest-passes` — route
     * `backend/routes/homeIam.js:667`. Returns the raw share `token` once.
     */
    @POST("api/homes/{id}/guest-passes")
    suspend fun createGuestPass(
        @Path("id") homeId: String,
        @Body body: CreateGuestPassRequest,
    ): CreateGuestPassResponse

    /**
     * `GET /api/homes/:id/guest-passes` — route
     * `backend/routes/homeIam.js:783`. Active passes only unless
     * `include_revoked=true`.
     */
    @GET("api/homes/{id}/guest-passes")
    suspend fun listGuestPasses(
        @Path("id") homeId: String,
        @Query("include_revoked") includeRevoked: Boolean? = null,
    ): GuestPassesResponse

    /**
     * `DELETE /api/homes/:id/guest-passes/:passId` — route
     * `backend/routes/homeIam.js:860`. Revokes (soft-deletes) the pass.
     */
    @DELETE("api/homes/{id}/guest-passes/{passId}")
    suspend fun revokeGuestPass(
        @Path("id") homeId: String,
        @Path("passId") passId: String,
    ): RevokeGuestPassResponse
}
