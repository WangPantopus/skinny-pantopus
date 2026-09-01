package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.GigQuestionDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionMutationResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionUpvoteResponse
import app.pantopus.android.data.api.models.gigs.GigStartReminderResponse
import app.pantopus.android.data.api.models.gigs.RebookableGigsResponse
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * RN→native parity routes under `/api/gigs` that the app was missing:
 * the Q&A engagement actions (upvote / pin / delete), the poster's
 * "Remind worker" nudge, and the "Rebook a favorite helper" rail.
 * Kept out of the heavily-shared `GigsApi` to stay merge-quiet.
 * Mirrors iOS `GigExtrasEndpoints.swift`.
 */
interface GigExtrasApi {
    /**
     * `POST /api/gigs/:gigId/questions/:questionId/upvote` — toggle the
     * viewer's upvote on a question.
     * Route `backend/routes/gigs.js:7535`.
     */
    @POST("api/gigs/{gigId}/questions/{questionId}/upvote")
    suspend fun upvoteQuestion(
        @Path("gigId") gigId: String,
        @Path("questionId") questionId: String,
    ): GigQuestionUpvoteResponse

    /**
     * `POST /api/gigs/:gigId/questions/:questionId/pin` — poster toggles
     * the pinned flag on an answered question.
     * Route `backend/routes/gigs.js:7482`.
     */
    @POST("api/gigs/{gigId}/questions/{questionId}/pin")
    suspend fun pinQuestion(
        @Path("gigId") gigId: String,
        @Path("questionId") questionId: String,
    ): GigQuestionMutationResponse

    /**
     * `DELETE /api/gigs/:gigId/questions/:questionId` — the asker or the
     * gig poster removes a question.
     * Route `backend/routes/gigs.js:7600`.
     */
    @DELETE("api/gigs/{gigId}/questions/{questionId}")
    suspend fun deleteQuestion(
        @Path("gigId") gigId: String,
        @Path("questionId") questionId: String,
    ): GigQuestionDeleteResponse

    /**
     * `POST /api/gigs/:gigId/remind-worker` — poster nudges the assigned
     * worker who hasn't started. A 429 carries `next_allowed_at`.
     * Route `backend/routes/gigs.js:5734`.
     */
    @POST("api/gigs/{gigId}/remind-worker")
    suspend fun remindWorker(
        @Path("gigId") gigId: String,
    ): GigStartReminderResponse

    /**
     * `GET /api/gigs/rebookable` — the viewer's completed tasks from the
     * last 6 months, deduped by worker+category, newest first (max 10).
     * Route `backend/routes/gigs.js:2885`.
     */
    @GET("api/gigs/rebookable")
    suspend fun rebookable(): RebookableGigsResponse
}
