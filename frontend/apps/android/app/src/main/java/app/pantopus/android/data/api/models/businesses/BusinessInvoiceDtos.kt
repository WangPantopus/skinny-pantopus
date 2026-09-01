package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the recipient-side business-invoice routes in
 * `backend/routes/businesses.js` (mounted under `/api/businesses`). Columns
 * mirror the `BusinessInvoice` table (`database/schema.sql:5107`):
 * `line_items` jsonb plus `subtotal_cents` / `fee_cents` / `total_cents` /
 * `currency` / `status` / `due_date` / `memo` / `paid_at`. Money is only ever
 * formatted on the client — never re-derived.
 */

/**
 * `GET /api/businesses/invoices/{id}` and
 * `POST /api/businesses/invoices/{id}/confirm` both answer `{ invoice }`.
 */
@JsonClass(generateAdapter = true)
data class BusinessInvoiceResponse(
    val invoice: BusinessInvoiceDto,
)

/** `GET /api/businesses/invoices/received` — backend/routes/businesses.js:4562. */
@JsonClass(generateAdapter = true)
data class BusinessInvoicesResponse(
    val invoices: List<BusinessInvoiceDto> = emptyList(),
)

/** One `BusinessInvoice` row plus the joined billing business. */
@JsonClass(generateAdapter = true)
data class BusinessInvoiceDto(
    val id: String,
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "recipient_user_id") val recipientUserId: String? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "line_items") val lineItems: List<BusinessInvoiceLineItemDto> = emptyList(),
    /** Sum of the line items, in cents (server-computed). */
    @Json(name = "subtotal_cents") val subtotalCents: Int = 0,
    /**
     * Platform fee in cents. Deducted from the *business* payout — it is NOT
     * added to what the recipient owes (`businesses.js:4796`).
     */
    @Json(name = "fee_cents") val feeCents: Int = 0,
    /** What the recipient owes, in cents. */
    @Json(name = "total_cents") val totalCents: Int = 0,
    /** ISO-4217, lowercase server-side (`usd`). */
    val currency: String? = null,
    /** `draft | sent | viewed | paid | void | overdue`. */
    val status: String = "sent",
    @Json(name = "due_date") val dueDate: String? = null,
    val memo: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "paid_at") val paidAt: String? = null,
    val business: BusinessInvoicePartyDto? = null,
    /**
     * Joined only on the biller-side list/detail reads
     * (`recipient:recipient_user_id(…)`, `businesses.js:4863`). Null on the
     * recipient-side routes, which join [business] instead.
     */
    val recipient: BusinessInvoicePartyDto? = null,
)

/**
 * One entry of the invoice's `line_items` jsonb array (`createInvoiceSchema`,
 * `backend/routes/businesses.js:4549`).
 */
@JsonClass(generateAdapter = true)
data class BusinessInvoiceLineItemDto(
    val description: String = "",
    /** Unit price in cents. */
    @Json(name = "amount_cents") val amountCents: Int = 0,
    val quantity: Int = 1,
)

/** Joined `business:business_user_id(id, name, username, profile_picture_url)`. */
@JsonClass(generateAdapter = true)
data class BusinessInvoicePartyDto(
    val id: String? = null,
    val name: String? = null,
    val username: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
) {
    /** Best display name for the billing business. */
    val displayName: String
        get() = displayName("Business")

    /**
     * Best display name with a caller-chosen fallback — the same join is
     * reused for the *recipient* on the biller-side reads, where "Business"
     * would be the wrong word.
     */
    fun displayName(fallback: String): String =
        name?.trim()?.takeIf { it.isNotEmpty() }
            ?: username?.trim()?.takeIf { it.isNotEmpty() }
            ?: fallback
}

/**
 * Body for `POST /api/businesses/invoices/{id}/pay`. `payment_method_id` is
 * optional — omitted, Stripe's PaymentSheet collects the method.
 */
@JsonClass(generateAdapter = true)
data class PayInvoiceRequest(
    @Json(name = "payment_method_id") val paymentMethodId: String? = null,
)

/**
 * `POST /api/businesses/invoices/{id}/pay` response
 * (`backend/routes/businesses.js:4697`). Keys are snake_case here — unlike
 * `/api/payments/intent`, which answers camelCase.
 */
@JsonClass(generateAdapter = true)
data class PayInvoiceResponse(
    @Json(name = "client_secret") val clientSecret: String? = null,
    @Json(name = "payment_intent_id") val paymentIntentId: String? = null,
    @Json(name = "payment_id") val paymentId: String? = null,
    @Json(name = "amount_cents") val amountCents: Int? = null,
    @Json(name = "fee_cents") val feeCents: Int? = null,
)
