@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Bidder thumbnail surfaced on the My tasks V2 row's bidder stack.
 * Initials + tone are derived server-side (gigs.js) so iOS / Android /
 * web all render identical avatars.
 */
@JsonClass(generateAdapter = true)
data class TopBidderDto(
    val id: String,
    val initials: String,
    val color: String,
)

/**
 * One row from `GET /api/gigs/my-gigs`. Mirrors the GIG_LIST projection
 * plus the my-gigs handler's enrichment (bid_count, top_bid_amount,
 * top_bidders) and the boost fields landed alongside this screen.
 */
@JsonClass(generateAdapter = true)
data class MyGigDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val price: Double? = null,
    val category: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    val deadline: String? = null,
    @Json(name = "is_urgent") val isUrgent: Boolean? = null,
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "accepted_by") val acceptedBy: String? = null,
    @Json(name = "accepted_at") val acceptedAt: String? = null,
    @Json(name = "scheduled_start") val scheduledStart: String? = null,
    @Json(name = "pay_type") val payType: String? = null,
    @Json(name = "bid_count") val bidCount: Int? = null,
    @Json(name = "top_bid_amount") val topBidAmount: Double? = null,
    @Json(name = "top_bidders") val topBidders: List<TopBidderDto>? = null,
    @Json(name = "boosted_at") val boostedAt: String? = null,
    @Json(name = "boost_expires_at") val boostExpiresAt: String? = null,
    // T6.0b additions — Magic Task archetype tile + overline + engagement-mode badge.
    /** `source_flow`. When `magic`, the row renders the Magic Task gradient tile + overline. */
    @Json(name = "source_flow") val sourceFlow: String? = null,
    /** `task_archetype` enum. Drives the overline label + tile icon mapping. */
    @Json(name = "task_archetype") val taskArchetype: String? = null,
    /**
     * `task_format` enum (`in_person`, `drop_off`, `remote`, `hybrid`).
     * Drives the engagement-mode badge that sits after the status chip.
     * Per T6 Q13 this is the design's `engagement_mode` concept renamed
     * to avoid colliding with the backend's offer-acceptance enum.
     */
    @Json(name = "task_format") val taskFormat: String? = null,
)

/** Envelope from `GET /api/gigs/my-gigs`. */
@JsonClass(generateAdapter = true)
data class MyGigsResponse(
    val gigs: List<MyGigDto>,
    val total: Int? = null,
)

/** Envelope from `POST /api/gigs/:gigId/boost`. */
@JsonClass(generateAdapter = true)
data class BoostGigResponse(
    @Json(name = "boost_expires_at") val boostExpiresAt: String? = null,
)

/** Envelope from `POST /api/gigs/:gigId/complete` and `/cancel`. */
@JsonClass(generateAdapter = true)
data class CompleteGigResponse(
    val gig: MyGigDto? = null,
    val message: String? = null,
)

/**
 * Cancellation reasons the backend whitelists for the poster on
 * `POST /api/gigs/:gigId/cancel`.
 */
enum class CancelGigReason(val wireValue: String, val label: String) {
    ChangedPlans("changed_plans", "Changed plans"),
    FoundSomeoneElse("found_someone_else", "Found someone else"),
    TooExpensive("too_expensive", "Too expensive"),
    Emergency("emergency", "Emergency"),
    Other("other", "Other reason"),
}

/** Body for `POST /api/gigs/:gigId/cancel`. */
@JsonClass(generateAdapter = true)
data class CancelGigBody(
    val reason: String? = null,
)
