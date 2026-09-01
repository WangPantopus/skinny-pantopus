@file:Suppress("PackageNaming")

package app.pantopus.android.data.transaction_reviews

import app.pantopus.android.data.api.models.transaction_reviews.CreateTransactionReviewBody
import app.pantopus.android.data.api.models.transaction_reviews.CreateTransactionReviewResponse
import app.pantopus.android.data.api.models.transaction_reviews.TransactionReviewsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.TransactionReviewsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [TransactionReviewsApi]. BLOCK 2D — used by the
 * transaction-review sheet (create) and the received-reviews section (read).
 */
@Singleton
class TransactionReviewsRepository
    @Inject
    constructor(
        private val api: TransactionReviewsApi,
    ) {
        suspend fun create(body: CreateTransactionReviewBody): NetworkResult<CreateTransactionReviewResponse> =
            safeApiCall { api.create(body) }

        suspend fun userReviews(userId: String): NetworkResult<TransactionReviewsResponse> = safeApiCall { api.userReviews(userId) }
    }
