package app.pantopus.android.data.api.models.users

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Monthly Receipt + Invite / referral progress. Shapes are the literal return
 * values of `backend/services/monthlyReceiptService.js:232` and
 * `backend/services/inviteRewardService.js:94`.
 */

// region Monthly receipt

/** `GET /api/users/me/monthly-receipt` — route `backend/routes/users.js:2921`. */
@JsonClass(generateAdapter = true)
data class MonthlyReceiptDto(
    val period: ReceiptPeriodDto,
    val earnings: ReceiptEarningsDto,
    val spending: ReceiptSpendingDto,
    val marketplace: ReceiptMarketplaceDto,
    val community: ReceiptCommunityDto,
    val reputation: ReceiptReputationDto,
    val highlight: String? = null,
)

@JsonClass(generateAdapter = true)
data class ReceiptPeriodDto(
    val year: Int = 0,
    val month: Int = 0,
    /** Pre-rendered "May 2026". */
    val label: String = "",
)

@JsonClass(generateAdapter = true)
data class ReceiptEarningsDto(
    /** Cents — never re-derive, only format. */
    @Json(name = "total_cents") val totalCents: Int = 0,
    @Json(name = "gig_count") val gigCount: Int = 0,
    @Json(name = "top_category") val topCategory: String? = null,
)

@JsonClass(generateAdapter = true)
data class ReceiptSpendingDto(
    @Json(name = "total_cents") val totalCents: Int = 0,
    @Json(name = "gig_count") val gigCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ReceiptMarketplaceDto(
    @Json(name = "listings_sold") val listingsSold: Int = 0,
    @Json(name = "listings_bought") val listingsBought: Int = 0,
    @Json(name = "free_items_claimed") val freeItemsClaimed: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ReceiptCommunityDto(
    @Json(name = "posts_created") val postsCreated: Int = 0,
    @Json(name = "connections_made") val connectionsMade: Int = 0,
    @Json(name = "neighbors_helped") val neighborsHelped: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ReceiptReputationDto(
    @Json(name = "current_rating") val currentRating: Double? = null,
    @Json(name = "reviews_received") val reviewsReceived: Int = 0,
    @Json(name = "rating_change") val ratingChange: Double? = null,
)

// endregion

// region Invite / referral progress

/** `GET /api/users/me/invite-progress` — route `backend/routes/users.js:2835`. */
@JsonClass(generateAdapter = true)
data class InviteProgressDto(
    @Json(name = "total_invited") val totalInvited: Int = 0,
    @Json(name = "total_converted") val totalConverted: Int = 0,
    @Json(name = "unlocked_features") val unlockedFeatures: List<String> = emptyList(),
    @Json(name = "next_unlock") val nextUnlock: InviteNextUnlockDto? = null,
)

@JsonClass(generateAdapter = true)
data class InviteNextUnlockDto(
    val feature: String,
    val label: String? = null,
    @Json(name = "invites_needed") val invitesNeeded: Int = 0,
    @Json(name = "invites_remaining") val invitesRemaining: Int = 0,
)

/** `GET /api/users/me/invite-code` — route `backend/routes/users.js:2850`. */
@JsonClass(generateAdapter = true)
data class InviteCodeDto(
    @Json(name = "invite_code") val inviteCode: String,
    @Json(name = "invite_url") val inviteUrl: String? = null,
)

// endregion
