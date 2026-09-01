package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/gigs/:gigId/reopen-bidding`. The route reads an
 * optional `rollbackMode`, which only the payment-abort path sets — the
 * poster-initiated "Replace worker" flow leaves it null so the accepted
 * bid is rejected rather than restored to pending.
 * Route `backend/routes/gigs.js:4874`.
 */
@JsonClass(generateAdapter = true)
data class ReopenBiddingBody(
    val rollbackMode: String? = null,
)

/**
 * Response from `POST /api/gigs/:gigId/reopen-bidding`
 * (`backend/routes/gigs.js:5016`). The refreshed gig also rides the
 * envelope, but the detail screen refetches instead of trusting it, so
 * only the confirmation copy is modelled here.
 */
@JsonClass(generateAdapter = true)
data class ReopenBiddingResponse(
    @Json(name = "reopened_count") val reopenedCount: Int? = null,
    @Json(name = "accepted_bid_restored") val acceptedBidRestored: Boolean? = null,
    val message: String? = null,
)

/**
 * Body for `POST /api/gigs/:gigId/worker-release` — optional note the
 * server truncates to 1000 chars. Route `backend/routes/gigs.js:5954`.
 */
@JsonClass(generateAdapter = true)
data class WorkerReleaseBody(
    val note: String? = null,
)

/**
 * Response from `POST /api/gigs/:gigId/worker-release`
 * (`backend/routes/gigs.js:6083`).
 */
@JsonClass(generateAdapter = true)
data class WorkerReleaseResponse(
    val success: Boolean? = null,
    val message: String? = null,
)
