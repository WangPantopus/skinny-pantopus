package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigQuestionDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionMutationResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionUpvoteResponse
import app.pantopus.android.data.api.models.gigs.GigStartReminderResponse
import app.pantopus.android.data.api.models.gigs.RebookableGigsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigExtrasApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [GigExtrasApi] — Q&A engagement actions, the
 * poster's worker reminder, and the rebookable-helpers rail. View-models
 * own the optimistic state; this layer only marshals the calls.
 */
@Singleton
class GigExtrasRepository
    @Inject
    constructor(
        private val api: GigExtrasApi,
    ) {
        /** `POST /api/gigs/:gigId/questions/:questionId/upvote`. */
        suspend fun upvoteQuestion(
            gigId: String,
            questionId: String,
        ): NetworkResult<GigQuestionUpvoteResponse> = safeApiCall { api.upvoteQuestion(gigId, questionId) }

        /** `POST /api/gigs/:gigId/questions/:questionId/pin` — poster only. */
        suspend fun pinQuestion(
            gigId: String,
            questionId: String,
        ): NetworkResult<GigQuestionMutationResponse> = safeApiCall { api.pinQuestion(gigId, questionId) }

        /** `DELETE /api/gigs/:gigId/questions/:questionId` — asker or poster. */
        suspend fun deleteQuestion(
            gigId: String,
            questionId: String,
        ): NetworkResult<GigQuestionDeleteResponse> = safeApiCall { api.deleteQuestion(gigId, questionId) }

        /** `POST /api/gigs/:gigId/remind-worker` — 15-minute server cooldown. */
        suspend fun remindWorker(gigId: String): NetworkResult<GigStartReminderResponse> = safeApiCall { api.remindWorker(gigId) }

        /** `GET /api/gigs/rebookable` — completed tasks the poster can rebook. */
        suspend fun rebookable(): NetworkResult<RebookableGigsResponse> = safeApiCall { api.rebookable() }
    }
