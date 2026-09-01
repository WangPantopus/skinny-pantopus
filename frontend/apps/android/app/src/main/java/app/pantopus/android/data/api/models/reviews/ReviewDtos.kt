package app.pantopus.android.data.api.models.reviews

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/reviews` — route `backend/routes/reviews.js:35`.
 *
 * Backend constraints: gig must be `completed`, reviewer must be the
 * gig owner or the accepted worker, and only one review per gig per
 * reviewer is allowed. `rating` is `1..5`.
 */
@JsonClass(generateAdapter = true)
data class CreateReviewBody(
    @Json(name = "gig_id") val gigId: String,
    @Json(name = "reviewee_id") val revieweeId: String,
    val rating: Int,
    val comment: String? = null,
)

/**
 * Response envelope for `POST /api/reviews`. The backend wraps the new
 * row inside `{ review: {...} }`, but the screen only needs to know
 * the call succeeded — so this DTO carries the minimum shape.
 */
@JsonClass(generateAdapter = true)
data class CreateReviewResponse(
    val id: String? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    val rating: Int? = null,
)

/**
 * One entry from `GET /api/reviews/my-pending` — a completed gig the
 * caller participated in but hasn't reviewed yet. Route
 * `backend/routes/reviews.js:333`.
 */
@JsonClass(generateAdapter = true)
data class PendingReviewDto(
    @Json(name = "gig_id") val gigId: String,
    @Json(name = "gig_title") val gigTitle: String? = null,
    @Json(name = "reviewee_id") val revieweeId: String? = null,
    /** `owner` (reviewing the worker) or `worker` (reviewing the poster). */
    val role: String? = null,
    @Json(name = "reviewee_name") val revieweeName: String? = null,
)

/** Envelope from `GET /api/reviews/my-pending`. */
@JsonClass(generateAdapter = true)
data class MyPendingReviewsResponse(
    val pending: List<PendingReviewDto> = emptyList(),
)
