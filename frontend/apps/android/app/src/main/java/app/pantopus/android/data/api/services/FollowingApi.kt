package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.following.FollowNotificationLevelBody
import app.pantopus.android.data.api.models.following.FollowPreferencesResponse
import app.pantopus.android.data.api.models.following.FollowingActionEcho
import app.pantopus.android.data.api.models.following.FollowingListResponse
import app.pantopus.android.data.api.models.following.FollowingMuteBody
import app.pantopus.android.data.api.models.following.FollowingMuteResponse
import app.pantopus.android.data.api.models.following.FollowingSeenResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * §1A① — "Following" (Beacons you follow). All four routes already exist on
 * the backend; this screen does not change any server behaviour.
 */
interface FollowingApi {
    /**
     * `GET /api/personas/me/following` — the signed-in user's followed
     * Beacons. `sort` is one of `activity | recent | alpha | unread`.
     * Route `backend/routes/personas.js:425`.
     */
    @GET("api/personas/me/following")
    suspend fun list(
        @Query("sort") sort: String = "activity",
        @Query("limit") limit: Int = 100,
        @Query("offset") offset: Int = 0,
    ): FollowingListResponse

    /**
     * `POST /api/personas/me/following/:personaId/seen` — zero out unread
     * for one Beacon. Idempotent; 204 when the membership is already gone
     * (hence the nullable body). Route `backend/routes/personas.js:547`.
     */
    @POST("api/personas/me/following/{personaId}/seen")
    suspend fun markSeen(
        @Path("personaId") personaId: String,
    ): FollowingSeenResponse?

    /**
     * `PATCH /api/personas/me/following/:personaId/mute` — temporary mute
     * for `days` (1…365). Route `backend/routes/personas.js:582`.
     */
    @PATCH("api/personas/me/following/{personaId}/mute")
    suspend fun mute(
        @Path("personaId") personaId: String,
        @Body body: FollowingMuteBody,
    ): FollowingMuteResponse

    /**
     * `DELETE /api/personas/:id/follow` — unfollow a Beacon (same call the
     * A21 public profile "Unfollow" uses). Paid memberships are rejected
     * with 409. Route `backend/routes/personas.js:1692`.
     */
    @DELETE("api/personas/{personaId}/follow")
    suspend fun unfollow(
        @Path("personaId") personaId: String,
    ): FollowingActionEcho

    /**
     * `PATCH /api/personas/:id/follow/preferences` — per-Beacon notification
     * level (`all | highlights | none`). Route
     * `backend/routes/personas.js:1743`.
     */
    @PATCH("api/personas/{personaId}/follow/preferences")
    suspend fun updateNotificationLevel(
        @Path("personaId") personaId: String,
        @Body body: FollowNotificationLevelBody,
    ): FollowPreferencesResponse
}
