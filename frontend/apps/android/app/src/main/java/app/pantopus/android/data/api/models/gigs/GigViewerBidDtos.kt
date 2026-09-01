package app.pantopus.android.data.api.models.gigs

import app.pantopus.android.data.api.models.offers.BidDto
import com.squareup.moshi.JsonClass

/**
 * Envelope from `GET /api/gigs/:id/my-bid` — route
 * `backend/routes/gigs.js:7905`. `bid` is null when the signed-in viewer has
 * not bid on this gig.
 *
 * The row decodes into the existing
 * [app.pantopus.android.data.api.models.offers.BidDto] — the same shape My
 * Bids already renders — so gig detail and My Bids agree field-for-field on
 * status and counter state.
 */
@JsonClass(generateAdapter = true)
data class GigMyBidResponse(
    val bid: BidDto? = null,
)

/**
 * Lifecycle buckets for the viewer's own bid, shared by the view-model
 * gates. Mirrors iOS `ViewerBidStatus`.
 */
object ViewerBidStatus {
    /**
     * Statuses in which the bid is still live on the gig. Anything else
     * (`withdrawn`, `rejected`, `expired`) leaves the detail screen on its
     * normal "Place bid" path so the viewer can bid again.
     */
    val ACTIVE = setOf("pending", "countered", "accepted")

    /**
     * Statuses the backend still lets the bidder edit or withdraw
     * (`backend/routes/gigs.js:4166` and `backend/routes/gigs.js:5440`).
     */
    val MUTABLE = setOf("pending", "countered")
}
