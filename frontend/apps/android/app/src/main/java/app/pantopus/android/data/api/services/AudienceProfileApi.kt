package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.audience.AudienceFollowerStatusBody
import app.pantopus.android.data.api.models.audience.AudienceFollowerUpdateResponse
import app.pantopus.android.data.api.models.audience.AudienceListResponse
import app.pantopus.android.data.api.models.audience.AudienceMemberActionBody
import app.pantopus.android.data.api.models.audience.AudienceMemberActionResponse
import app.pantopus.android.data.api.models.audience.BroadcastHistoryResponse
import app.pantopus.android.data.api.models.audience.MembershipStatsResponse
import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaPostsResponse
import app.pantopus.android.data.api.models.audience.PersonaThreadsResponse
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.audience.PublishUpdateBody
import app.pantopus.android.data.api.models.audience.PublishUpdateResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Backs the T3.3 Public Profile management screen. Backend keeps the
 * legacy `persona` / `broadcast` / `audience` names on the wire; UI
 * strings the user sees say "Public Profile" / "Updates" / "Followers"
 * per `docs/identity-firewall-ui-ux-redesign-2026-05-06.md`.
 */
interface AudienceProfileApi {
    /** `GET /api/personas/me` — owner persona + primary broadcast channel.
     *  Route `backend/routes/personas.js:367`. */
    @GET("api/personas/me")
    suspend fun me(): PersonaMeResponse

    /** `GET /api/personas/me/audience` — fan list + counts by tier.
     *  `sort` is one of `recent / tenure / tier / alpha` (anything else
     *  falls back to `recent`); `limit` is clamped server-side to 1…200
     *  and `offset` drives the `pagination.nextOffset` cursor echoed back.
     *  Route `backend/routes/personas.js:649`. */
    @GET("api/personas/me/audience")
    suspend fun audience(
        @Query("sort") sort: String? = null,
        @Query("status") status: String? = null,
        @Query("tier_rank") tierRank: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
    ): AudienceListResponse

    /**
     * `PATCH /api/personas/:id/followers/:followId` — owner-side follower
     * record update. `followId` is the **membership id**: the handler looks
     * the row up in `PersonaMembership` by `id`
     * (`backend/routes/personas.js:964-969`), so an id taken from
     * `/me/audience` resolves here unchanged. `status` is one of
     * `pending / active / muted / blocked / removed`
     * (`ownerFollowerUpdateSchema`, `backend/routes/personas.js:108`).
     * This is the only route that can set `blocked` — the
     * `/me/audience/:membershipId` action verbs have no block.
     * Route `backend/routes/personas.js:960`.
     */
    @PATCH("api/personas/{personaId}/followers/{followId}")
    suspend fun updateFollowerStatus(
        @Path("personaId") personaId: String,
        @Path("followId") followId: String,
        @Body body: AudienceFollowerStatusBody,
    ): AudienceFollowerUpdateResponse

    /** `GET /api/personas/:handle/posts` — recent Update posts.
     *  Route `backend/routes/personas.js:1046`. */
    @GET("api/personas/{handle}/posts")
    suspend fun posts(
        @Path("handle") handle: String,
    ): PersonaPostsResponse

    /** `GET /api/personas/:handle/tiers` — tier ladder (chips).
     *  Route `backend/routes/personas.js:1111`. */
    @GET("api/personas/{handle}/tiers")
    suspend fun tiers(
        @Path("handle") handle: String,
    ): PersonaTiersResponse

    /** `GET /api/personas/:id/membership-stats` — owner-only counts by
     *  tier for analytics cells. Route `backend/routes/personas.js:1256`. */
    @GET("api/personas/{id}/membership-stats")
    suspend fun membershipStats(
        @Path("id") personaId: String,
    ): MembershipStatsResponse

    /** `GET /api/personas/:id/dms/threads` — owner inbox of fan threads.
     *  Route `backend/routes/personaDms.js:185`. */
    @GET("api/personas/{id}/dms/threads")
    suspend fun threads(
        @Path("id") personaId: String,
    ): PersonaThreadsResponse

    /** `POST /api/broadcast/channels/:channelId/messages` — publish a
     *  new Update. Route `backend/routes/broadcastChannels.js:450`. */
    @POST("api/broadcast/channels/{channelId}/messages")
    suspend fun publishUpdate(
        @Path("channelId") channelId: String,
        @Body body: PublishUpdateBody,
    ): PublishUpdateResponse

    /** `GET /api/broadcast/channels/:channelId/messages` — broadcast history,
     *  most-recent first (`limit`-only). Route
     *  `backend/routes/broadcastChannels.js:315`. */
    @GET("api/broadcast/channels/{channelId}/messages")
    suspend fun broadcastHistory(
        @Path("channelId") channelId: String,
        @Query("limit") limit: Int = 50,
    ): BroadcastHistoryResponse

    /** `PATCH /api/personas/me/audience/:membershipId` — owner-side action
     *  on one audience member (approve / decline / remove / mute / unmute).
     *  Route `backend/routes/personas.js:753`. */
    @PATCH("api/personas/me/audience/{membershipId}")
    suspend fun audienceMemberAction(
        @Path("membershipId") membershipId: String,
        @Body body: AudienceMemberActionBody,
    ): AudienceMemberActionResponse
}
