package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.pulse.PulseAckResponse
import app.pantopus.android.data.api.models.pulse.PulseFeedResponse
import app.pantopus.android.data.api.models.pulse.PulseNewCountResponse
import app.pantopus.android.data.api.models.pulse.PulsePostStatusResponse
import app.pantopus.android.data.api.models.pulse.PulseSeenRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** The Pulse page's routes (`/api/pulse/…`, contract section 2; PB's `backend/routes/pulse.js`). */
@Suppress("LongParameterList")
interface PulseApi {
    /**
     * `GET /api/pulse/feed` (contract 2.3): the groups of the viewer's page, or with [earlierBefore] the next older
     * items in one "EARLIER" group. [view] is `nearby` or `following`; [areaId] defaults to the viewer's town.
     */
    @GET("api/pulse/feed")
    suspend fun feed(
        @Query("view") view: String? = null,
        @Query("topic") topic: String? = null,
        @Query("area_id") areaId: String? = null,
        @Query("earlier_before") earlierBefore: String? = null,
        @Query("limit") limit: Int? = null,
    ): PulseFeedResponse

    /** The same read through the screens' store: `If-None-Match` carries the stored ETag, a 304 keeps the copy. */
    @GET("api/pulse/feed")
    suspend fun feedConditional(
        @Query("view") view: String? = null,
        @Query("topic") topic: String? = null,
        @Query("area_id") areaId: String? = null,
        @Query("limit") limit: Int? = null,
        @Header("If-None-Match") etag: String? = null,
    ): Response<PulseFeedResponse>

    /** `GET /api/pulse/feed/new` (contract 2.3): the count behind the "↑ N new conversations" pill. */
    @GET("api/pulse/feed/new")
    suspend fun newCount(
        @Query("view") view: String? = null,
        @Query("topic") topic: String? = null,
        @Query("after") after: String? = null,
    ): PulseNewCountResponse

    /** `POST /api/pulse/feed/seen` (contract 2.3): advance the last-seen marker once the end card was on screen. */
    @POST("api/pulse/feed/seen")
    suspend fun seen(
        @Body body: PulseSeenRequest,
    ): PulseAckResponse

    /**
     * `POST /api/pulse/posts/:postId/keep-open` (contract 2.12, `backend/routes/pulse.js`): the asker keeps an open Ask
     * up for 7 more days, once (`409 ALREADY_KEPT_OPEN` the second time).
     */
    @POST("api/pulse/posts/{postId}/keep-open")
    suspend fun keepOpen(
        @Path("postId") postId: String,
    ): PulsePostStatusResponse

    /**
     * `POST /api/pulse/posts/:postId/close` (contract 2.12): the asker closes an open Ask, `closed` when someone else
     * replied and `closed_unanswered` when nobody did.
     */
    @POST("api/pulse/posts/{postId}/close")
    suspend fun close(
        @Path("postId") postId: String,
    ): PulsePostStatusResponse
}
