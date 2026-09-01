package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.InviteMemberRequest
import app.pantopus.android.data.api.models.homes.InviteMemberResponse
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.RemoveMemberResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Home members endpoints from `backend/routes/home.js` +
 * `backend/routes/homeIam.js`. Kept separate from [HomesApi] so the
 * Members feature owns its own service surface; both share the same
 * Retrofit instance via `di/NetworkModule.kt`.
 */
interface HomeMembersApi {
    /**
     * `GET /api/homes/:id/occupants` — route `backend/routes/home.js:3705`.
     * Returns the active occupants + pending invites in one payload.
     */
    @GET("api/homes/{id}/occupants")
    suspend fun listOccupants(
        @Path("id") homeId: String,
    ): OccupantsResponse

    /**
     * `POST /api/homes/:id/invite` — route `backend/routes/home.js:5662`.
     */
    @POST("api/homes/{id}/invite")
    suspend fun invite(
        @Path("id") homeId: String,
        @Body body: InviteMemberRequest,
    ): InviteMemberResponse

    /**
     * `DELETE /api/homes/:id/members/:userId` — route
     * `backend/routes/homeIam.js:512`. Used both for admin-initiated
     * removals and self-leaves.
     */
    @DELETE("api/homes/{id}/members/{userId}")
    suspend fun removeMember(
        @Path("id") homeId: String,
        @Path("userId") userId: String,
    ): RemoveMemberResponse
}
