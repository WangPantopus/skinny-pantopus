package app.pantopus.android.data.api.models.mailbox

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the gig/ad earnings endpoints in `backend/routes/mailbox.js`.
 * These back the Earn dashboard's balance + recent-earnings list. The
 * weekly-goal target, payout method, auto-cash-out, and 1099 tax docs
 * have no source here (the last three are Stripe Connect — Phase 3), so
 * the Earn screen hides those slots rather than faking them.
 */

/** `GET /api/mailbox/earnings/summary` — route `backend/routes/mailbox.js:2899`. */
@JsonClass(generateAdapter = true)
data class EarningsSummaryResponse(
    val pendingEarnings: Double = 0.0,
    val totalEarned: Double = 0.0,
    val currency: String? = null,
)

/** One ad-view payout row — `GET /api/mailbox/earnings/history` (route `:2935`). */
@JsonClass(generateAdapter = true)
data class EarningEntryDto(
    val id: String,
    val type: String? = null,
    val subject: String? = null,
    @Json(name = "sender_business_name") val senderBusinessName: String? = null,
    @Json(name = "payout_amount") val payoutAmount: Double? = null,
    @Json(name = "payout_status") val payoutStatus: String? = null,
    @Json(name = "viewed_at") val viewedAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** Envelope for `GET /api/mailbox/earnings/history` — `{ earnings }`. */
@JsonClass(generateAdapter = true)
data class EarningsHistoryResponse(
    val earnings: List<EarningEntryDto> = emptyList(),
)
