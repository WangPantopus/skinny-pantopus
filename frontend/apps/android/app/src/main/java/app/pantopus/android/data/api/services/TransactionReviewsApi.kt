package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.transaction_reviews.CreateTransactionReviewBody
import app.pantopus.android.data.api.models.transaction_reviews.CreateTransactionReviewResponse
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Transaction reviews — `backend/routes/transactionReviews.js`, mounted at
 * `/api/transaction-reviews` (`backend/app.js:336`). BLOCK 2D. Distinct from
 * [ReviewsApi] (gig-only `/api/reviews`): multi-criteria ratings tied to a
 * completed marketplace transaction.
 */
interface TransactionReviewsApi {
    /**
     * `POST /api/transaction-reviews` — create a transaction review. Route
     * `backend/routes/transactionReviews.js:43`. Rejects with 400 / 403 /
     * 404 when invalid and 409 when the caller already reviewed this
     * transaction.
     */
    @POST("api/transaction-reviews")
    suspend fun create(
        @Body body: CreateTransactionReviewBody,
    ): CreateTransactionReviewResponse

    /**
     * `GET /api/transaction-reviews/user/:userId` — reviews received by a
     * user (public). Route `backend/routes/transactionReviews.js:168`.
     */
    @GET("api/transaction-reviews/user/{userId}")
    suspend fun userReviews(
        @Path("userId") userId: String,
    ): TransactionReviewsResponse
}
