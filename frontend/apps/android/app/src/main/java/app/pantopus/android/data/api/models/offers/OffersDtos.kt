package app.pantopus.android.data.api.models.offers

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/gigs/my-bids` envelope — route `backend/routes/gigs.js:1253`.
 *
 * Sent perspective. Includes the bid's counter / expiry fields so the
 * client can derive the design's `countered` / `expiring` chips.
 */
@JsonClass(generateAdapter = true)
data class MyBidsResponse(
    val bids: List<BidDto> = emptyList(),
    val total: Int? = null,
)

/**
 * `GET /api/gigs/received-offers` envelope — route
 * `backend/routes/gigs.js:1469`.
 *
 * Received perspective. Inlines the bidder's identity card so the row
 * subtitle can render "From {bidder name}".
 */
@JsonClass(generateAdapter = true)
data class ReceivedOffersResponse(
    val offers: List<BidDto> = emptyList(),
    val total: Int? = null,
)

/**
 * One bid as returned by both endpoints. The Sent endpoint omits
 * `bidder`; the Received endpoint omits `expires_at` / `counter_*`. Both
 * are nullable here so the same DTO works for either tab.
 */
@JsonClass(generateAdapter = true)
data class BidDto(
    val id: String,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "bid_amount") val bidAmount: Double? = null,
    val message: String? = null,
    @Json(name = "proposed_time") val proposedTime: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "counter_amount") val counterAmount: Double? = null,
    @Json(name = "counter_status") val counterStatus: String? = null,
    @Json(name = "countered_at") val counteredAt: String? = null,
    @Json(name = "withdrawn_at") val withdrawnAt: String? = null,
    @Json(name = "withdrawal_reason") val withdrawalReason: String? = null,
    val gig: BidGigDto? = null,
    val bidder: BidderUserDto? = null,
    // P3 backend-prep fields (see docs/mobile/pantopus-t5-notes.md §1.10).
    // Optional decoders for the competition signals the buildout plan
    // promised. While the backend prep PR is still pending these come
    // back as `null`, the row mapper falls back to the neutral
    // "Pending" chip. When the backend ships `shortlisted`,
    // `your_rank`, and `top_price`, the row mapper starts emitting
    // "Shortlisted" / "Top bid" / "Outbid" chips automatically — no
    // further code change.
    val shortlisted: Boolean? = null,
    @Json(name = "your_rank") val yourRank: Int? = null,
    @Json(name = "top_price") val topPrice: Double? = null,
)

/** Inlined gig summary on each bid. */
@JsonClass(generateAdapter = true)
data class BidGigDto(
    val id: String,
    val title: String? = null,
    val description: String? = null,
    val price: Double? = null,
    val category: String? = null,
    val status: String? = null,
    @Json(name = "user_id") val userId: String? = null,
)

/** Inlined bidder identity on Received rows. */
@JsonClass(generateAdapter = true)
data class BidderUserDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    val city: String? = null,
    val state: String? = null,
)

/**
 * Body for `PUT /api/gigs/:gigId/bids/:bidId` — update an active bid.
 * Backend accepts either `bidAmount` or `amount`; we send the canonical
 * snake_case key.
 */
@JsonClass(generateAdapter = true)
data class UpdateBidBody(
    @Json(name = "bid_amount") val bidAmount: Double,
    val message: String? = null,
    @Json(name = "proposed_time") val proposedTime: String? = null,
)

/**
 * Body for `DELETE /api/gigs/:gigId/bids/:bidId`. Reason is optional;
 * the backend whitelist accepts a small set of strings (see
 * [WithdrawBidReason]).
 */
@JsonClass(generateAdapter = true)
data class WithdrawBidBody(
    val reason: String? = null,
)

/** Response body for the withdraw endpoint. */
@JsonClass(generateAdapter = true)
data class WithdrawBidResponse(
    val message: String? = null,
    @Json(name = "rebid_available_at") val rebidAvailableAt: String? = null,
)

/**
 * Reasons the backend whitelists for the withdraw endpoint. Anything
 * else maps to `null` on the server side; we keep this enum to drive
 * the picker in the sheet.
 */
enum class WithdrawBidReason(val wireValue: String, val label: String) {
    ScheduleConflict("schedule_conflict", "Schedule conflict"),
    Underpriced("underpriced", "Underpriced my bid"),
    Mistake("mistake", "Made a mistake"),
    Other("other", "Other reason"),
}
