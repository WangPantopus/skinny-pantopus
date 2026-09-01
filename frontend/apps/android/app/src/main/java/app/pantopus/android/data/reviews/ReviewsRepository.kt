package app.pantopus.android.data.reviews

import app.pantopus.android.data.api.models.reviews.CreateReviewBody
import app.pantopus.android.data.api.models.reviews.CreateReviewResponse
import app.pantopus.android.data.api.models.reviews.MyPendingReviewsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ReviewsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [ReviewsApi]. P3.4 Leave Review uses this to
 * post a review on a completed gig.
 */
@Singleton
class ReviewsRepository
    @Inject
    constructor(
        private val api: ReviewsApi,
    ) {
        suspend fun create(body: CreateReviewBody): NetworkResult<CreateReviewResponse> = safeApiCall { api.create(body) }

        /** `GET /api/reviews/my-pending` — gigs awaiting the caller's review. */
        suspend fun myPending(): NetworkResult<MyPendingReviewsResponse> = safeApiCall { api.myPending() }
    }
