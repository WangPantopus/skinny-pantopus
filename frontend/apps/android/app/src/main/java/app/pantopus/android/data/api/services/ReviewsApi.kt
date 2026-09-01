package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.profile.GigReviewsResponse
import app.pantopus.android.data.api.models.reviews.CreateReviewBody
import app.pantopus.android.data.api.models.reviews.CreateReviewResponse
import app.pantopus.android.data.api.models.reviews.MyPendingReviewsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Reviews endpoints from `backend/routes/reviews.js`. Mounted at
 * `/api/reviews` (see `backend/app.js`). Used by P3.4 Leave Review.
 */
interface ReviewsApi {
    /**
     * `POST /api/reviews` — create a review for a completed gig. Route
     * `backend/routes/reviews.js:35`. Backend rejects with 400 / 403 /
     * 409 when the caller isn't authorised or has already reviewed
     * this gig.
     */
    @POST("api/reviews")
    suspend fun create(
        @Body body: CreateReviewBody,
    ): CreateReviewResponse

    /**
     * `GET /api/reviews/my-pending` — completed gigs the caller still
     * owes a review on. Route `backend/routes/reviews.js:333`. Phase 5
     * uses this to gate "Leave a review" vs "Reviewed" on gig detail.
     */
    @GET("api/reviews/my-pending")
    suspend fun myPending(): MyPendingReviewsResponse

    /**
     * `GET /api/reviews/user/{userId}` — gig reviews *received* by a
     * user, with the server-computed `average_rating`, `total` and
     * per-role `counts` plus a `received_as` discriminator on each row.
     * Route `backend/routes/reviews.js:149`; the handler clamps `limit`
     * to 50. Public — no `verifyToken`.
     */
    @GET("api/reviews/user/{userId}")
    suspend fun userReviews(
        @Path("userId") userId: String,
        @Query("limit") limit: Int = 50,
    ): GigReviewsResponse
}
