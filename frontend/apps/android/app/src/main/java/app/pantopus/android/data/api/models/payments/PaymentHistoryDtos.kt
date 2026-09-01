package app.pantopus.android.data.api.models.payments

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET /api/payments/history` (`backend/routes/pays.js:732`). The
 * handler merges `Payment` and `Payout` rows into one stream and normalises
 * the parts a client needs: `entry_type` (`payment | payout`),
 * `amount_cents`, `direction` (`debit | credit`) and `status`. Everything
 * else is the underlying row.
 */

/**
 * `transactions` is the canonical key; `payments` carries the identical array
 * under a legacy alias for older clients.
 */
@JsonClass(generateAdapter = true)
data class PaymentHistoryResponse(
    val transactions: List<PaymentHistoryEntryDto>? = null,
    val payments: List<PaymentHistoryEntryDto>? = null,
    val total: Int? = null,
    val limit: Int? = null,
    val offset: Int? = null,
) {
    /** The merged feed, preferring the canonical key. */
    val entries: List<PaymentHistoryEntryDto>
        get() = transactions ?: payments ?: emptyList()
}

/**
 * One merged history row. Payout rows carry `destination_last4`; payment rows
 * carry `payment_type`, the joined `gig` and both parties.
 */
@JsonClass(generateAdapter = true)
data class PaymentHistoryEntryDto(
    val id: String,
    /** `payment` | `payout`. */
    @Json(name = "entry_type") val entryType: String = "payment",
    /**
     * Signed-user-relative amount in cents (payer total for a debit, payee
     * share for a credit) — computed server-side at `pays.js:815`.
     */
    @Json(name = "amount_cents") val amountCents: Int = 0,
    val currency: String? = null,
    /** `debit` (money out) | `credit` (money in). */
    val direction: String? = null,
    /** `payment_status` for payments, `payout_status` for payouts. */
    val status: String? = null,
    /** `gig_payment | tip | listing_purchase | …` (payments only). */
    @Json(name = "payment_type") val paymentType: String? = null,
    val description: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "destination_last4") val destinationLast4: String? = null,
    val gig: PaymentHistoryGigDto? = null,
    val payer: PaymentHistoryPartyDto? = null,
    val payee: PaymentHistoryPartyDto? = null,
    /** Server-set convenience flag: the caller is the payer on this row. */
    @Json(name = "_isSender") val isSender: Boolean? = null,
)

/** Joined `gig:gig_id(id, title, category)`. */
@JsonClass(generateAdapter = true)
data class PaymentHistoryGigDto(
    val id: String? = null,
    val title: String? = null,
    val category: String? = null,
)

/** Joined `payer` / `payee` (`id, username, name, profile_picture_url`). */
@JsonClass(generateAdapter = true)
data class PaymentHistoryPartyDto(
    val id: String? = null,
    val name: String? = null,
    val username: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
) {
    /**
     * `null` when the join carried no usable label — callers then omit the
     * counterparty clause rather than printing a placeholder.
     */
    val displayName: String?
        get() =
            name?.trim()?.takeIf { it.isNotEmpty() }
                ?: username?.trim()?.takeIf { it.isNotEmpty() }?.let { "@$it" }
}
