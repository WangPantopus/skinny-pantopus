@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.transaction_reviews

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/transaction-reviews` — route
 * `backend/routes/transactionReviews.js:43`. BLOCK 2D.
 *
 * Backend constraints: the transaction must be `completed`, the reviewer
 * must be a party to it, and only one review per reviewer + offer/gig is
 * allowed (the duplicate surfaces as a `409`). `offerId` is required for
 * the `listing_sale` context; the three sub-ratings are optional.
 */
@JsonClass(generateAdapter = true)
data class CreateTransactionReviewBody(
    @Json(name = "reviewed_id") val reviewedId: String,
    val context: String,
    @Json(name = "listing_id") val listingId: String? = null,
    @Json(name = "offer_id") val offerId: String? = null,
    @Json(name = "trade_id") val tradeId: String? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    val rating: Int,
    val comment: String? = null,
    @Json(name = "communication_rating") val communicationRating: Int? = null,
    @Json(name = "accuracy_rating") val accuracyRating: Int? = null,
    @Json(name = "punctuality_rating") val punctualityRating: Int? = null,
)

/**
 * Response envelope for `POST /api/transaction-reviews`. The backend wraps
 * the new row in `{ review: {...} }`; the screen only needs to know the call
 * succeeded, so the inner review is optional.
 */
@JsonClass(generateAdapter = true)
data class CreateTransactionReviewResponse(
    val review: TransactionReviewDto? = null,
)

/**
 * Envelope from `GET /api/transaction-reviews/user/:userId` — route
 * `backend/routes/transactionReviews.js:168`. Returns the received reviews
 * plus the overall average + total; the per-criterion breakdown is computed
 * client-side from the rows.
 */
@JsonClass(generateAdapter = true)
data class TransactionReviewsResponse(
    val reviews: List<TransactionReviewDto> = emptyList(),
    @Json(name = "average_rating") val averageRating: Double = 0.0,
    val total: Int = 0,
)

/** One received transaction review with optional sub-ratings + reviewer card. */
@JsonClass(generateAdapter = true)
data class TransactionReviewDto(
    val id: String,
    @Json(name = "reviewer_id") val reviewerId: String? = null,
    @Json(name = "reviewed_id") val reviewedId: String? = null,
    val context: String? = null,
    @Json(name = "listing_id") val listingId: String? = null,
    @Json(name = "offer_id") val offerId: String? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    val rating: Int,
    val comment: String? = null,
    @Json(name = "communication_rating") val communicationRating: Int? = null,
    @Json(name = "accuracy_rating") val accuracyRating: Int? = null,
    @Json(name = "punctuality_rating") val punctualityRating: Int? = null,
    @Json(name = "is_buyer") val isBuyer: Boolean? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val reviewer: TransactionReviewerDto? = null,
)

/** Inlined reviewer card on each received review. */
@JsonClass(generateAdapter = true)
data class TransactionReviewerDto(
    val id: String,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    val username: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)
