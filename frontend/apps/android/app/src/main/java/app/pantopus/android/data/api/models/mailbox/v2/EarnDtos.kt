@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.JsonClass

/**
 * Earn DTOs for `GET /api/mailbox/v2/earn/balance`
 * (`backend/routes/mailboxV2.js:831`). The handler sums the user's
 * `EarnTransaction` rows into `{ balance: { total, available, pending } }`
 * (raw numbers, not formatted strings).
 *
 * The Earn dashboard's other surfaces (weekly goal, earnings ledger,
 * payout method, auto-cash-out, tax docs) land with the Stripe Connect
 * integration in Phase 3 and have no source on this endpoint.
 */

/** Envelope for `GET /api/mailbox/v2/earn/balance`. */
@JsonClass(generateAdapter = true)
data class EarnBalanceResponse(
    val balance: EarnBalanceDto = EarnBalanceDto(),
)

/** Cleared / pending payout sums (dollars). */
@JsonClass(generateAdapter = true)
data class EarnBalanceDto(
    val total: Double = 0.0,
    val available: Double = 0.0,
    val pending: Double = 0.0,
)
