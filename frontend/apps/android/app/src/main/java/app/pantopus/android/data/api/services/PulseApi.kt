package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.pulse.PulsePostStatusResponse
import retrofit2.http.POST
import retrofit2.http.Path

/** Pulse's own routes (`/api/pulse/…`, contract section 2; PB's `backend/routes/pulse.js`). */
interface PulseApi {
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
