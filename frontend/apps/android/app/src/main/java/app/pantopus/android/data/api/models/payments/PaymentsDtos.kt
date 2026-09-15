package app.pantopus.android.data.api.models.payments

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Stripe payment-methods surface (`backend/routes/pays.js`,
 * mounted at `/api/payments`). Phase 3 (3A) wires the Settings → Payments
 * methods card. Connect / payout / checkout DTOs land with 3B/3C/3D.
 */

// GET /api/payments/methods — backend/routes/pays.js:701
@JsonClass(generateAdapter = true)
data class PaymentMethodsResponse(
    val paymentMethods: List<PaymentMethodDto> = emptyList(),
)

/**
 * One row from the `PaymentMethod` table. Columns are snake_case; a card
 * row carries `card_*`, a bank row carries `bank_*`.
 */
@JsonClass(generateAdapter = true)
data class PaymentMethodDto(
    val id: String,
    @Json(name = "payment_method_type") val paymentMethodType: String? = null,
    @Json(name = "card_brand") val cardBrand: String? = null,
    @Json(name = "card_last4") val cardLast4: String? = null,
    @Json(name = "card_exp_month") val cardExpMonth: Int? = null,
    @Json(name = "card_exp_year") val cardExpYear: Int? = null,
    @Json(name = "bank_name") val bankName: String? = null,
    @Json(name = "bank_last4") val bankLast4: String? = null,
    @Json(name = "bank_account_type") val bankAccountType: String? = null,
    @Json(name = "is_default") val isDefault: Boolean = false,
)

/**
 * POST /api/payments/payment-sheet-add-card — backend/routes/pays.js:1412.
 * SetupIntent params for the mobile PaymentSheet "add a card" flow. Keys
 * are already camelCase server-side.
 */
@JsonClass(generateAdapter = true)
data class AddCardSheetParamsDto(
    val setupIntent: String,
    val setupIntentId: String,
    val setupStatus: String,
    val ephemeralKey: String,
    val customer: String,
    val publishableKey: String? = null,
)

/** Omit the ID only for a new setup; retries recover that exact owned setup. */
@JsonClass(generateAdapter = true)
data class AddCardSheetRequest(val setupIntentId: String? = null)

/** Owned SetupIntent identifier, retained when saved-card reconciliation needs retry. */
@JsonClass(generateAdapter = true)
data class ConfirmAddCardRequest(val setupIntentId: String)

/** Durable saved-card receipt from POST payment-sheet-add-card/confirm. */
@JsonClass(generateAdapter = true)
data class ConfirmAddCardResponse(
    val confirmed: Boolean,
    val paymentMethod: PaymentMethodDto,
)

/** Generic `{ message }` ack returned by set-default / remove. */
@JsonClass(generateAdapter = true)
data class PaymentMethodAckResponse(
    val message: String? = null,
)

/**
 * Body for `POST /api/payments/intent` (Block 3B checkout). The server
 * computes the payee and amount from the referenced order.
 */
@JsonClass(generateAdapter = true)
data class CreatePaymentIntentRequest(
    val gigId: String? = null,
    val listingId: String? = null,
    val offerId: String? = null,
    val description: String? = null,
)

/**
 * Response from `POST /api/payments/intent` — the params the mobile
 * PaymentSheet needs to present a charge. `customer` + `ephemeralKey` are
 * best-effort (the sheet still works card-only without them). The shape is a
 * superset of the gig bid-accept payment payload so the same checkout flow can
 * present either. Keys are camelCase server-side.
 */
@JsonClass(generateAdapter = true)
data class PaymentIntentSheetParamsDto(
    val clientSecret: String? = null,
    val paymentIntentId: String? = null,
    val customer: String? = null,
    val ephemeralKey: String? = null,
    val publishableKey: String? = null,
    val isSetupIntent: Boolean? = null,
)

/** Nonsecret terms are frozen before the original command is sent. */
@JsonClass(generateAdapter = true)
data class TipTerms(
    val gigId: String,
    val payerId: String,
    val payeeId: String?,
    val ownerConfirmedAt: String?,
)

@JsonClass(generateAdapter = true)
data class TipOriginal(
    val requestId: String,
    val paymentId: String,
    val gigId: String,
    val payerId: String,
    val payeeId: String,
    val amountCents: Int,
    val currency: String,
    val terms: TipTerms,
    val paymentMethodId: String? = null,
    val source: String? = null,
)

@JsonClass(generateAdapter = true)
data class TipPreview(
    val actorId: String,
    val sessionScope: String,
    val terms: TipTerms,
    val eligible: Boolean,
    val unavailableReason: String?,
    val activeRequestId: String?,
    val legacyPaymentId: String?,
    val minimumAmountCents: Int,
    val maximumAmountCents: Int,
    val remainingTipSlots: Int,
)

/** Check/cancel preserve the original UUID, amount, method and terms. */
@JsonClass(generateAdapter = true)
data class TipRequest(
    val requestId: String,
    val gigId: String,
    val amount: Int,
    val paymentMethodId: String?,
    val expectedActorId: String,
    val expectedSessionScope: String,
    val expectedTerms: TipTerms,
    val mode: String,
)

@JsonClass(generateAdapter = true)
data class TipReceipt(
    val requestId: String,
    val paymentId: String,
    val gigId: String,
    val payerId: String,
    val payeeId: String,
    val amountCents: Int,
    val currency: String,
    val status: String,
    val paymentIntentId: String?,
    val chargeId: String?,
    val amountChargedCents: Int,
)

/** SDK credentials are transient; this type is never retained in recovery storage. */
@JsonClass(generateAdapter = true)
data class TipCheckout(
    val paymentIntentId: String,
    val clientSecret: String,
    val customer: String,
    val ephemeralKey: String?,
    val publishableKey: String?,
) {
    fun sheetParams(): PaymentIntentSheetParamsDto =
        PaymentIntentSheetParamsDto(clientSecret, paymentIntentId, customer, ephemeralKey, publishableKey, false)

    fun sameIntent(other: TipCheckout): Boolean =
        paymentIntentId == other.paymentIntentId && customer == other.customer && clientSecret == other.clientSecret
}

@JsonClass(generateAdapter = true)
data class TipResponse(
    val actorId: String,
    val sessionScope: String,
    val request: TipOriginal,
    val status: String,
    val paymentStatus: String,
    val providerStatus: String?,
    val paymentIntentId: String?,
    val canRetry: Boolean,
    val canCancel: Boolean,
    val receipt: TipReceipt?,
    val checkout: TipCheckout? = null,
) {
    val terminal: Boolean get() = status == "succeeded" || status == "canceled"
    val changedAfterCapture: Boolean get() = paymentStatus in setOf("refund_pending", "refunded_partial", "refunded_full", "disputed")
}

/** `POST /api/payments/tip/{paymentId}/refresh-status` response. */
@JsonClass(generateAdapter = true)
data class TipRefreshStatusResponse(
    val paymentStatus: String? = null,
    val previousPaymentStatus: String? = null,
    val changed: Boolean? = null,
    val stripeStatus: String? = null,
)

/** Validate API and retained originals before any SDK use, command or cleanup. */
@Suppress("TooManyFunctions") // Keep original, receipt and checkout validation together in the existing payment contract.
object TipValidation {
    const val MIN_CENTS = 50
    const val MAX_CENTS = 99_999_999
    private const val MAX_TIPS = 3
    private val uuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)
    private val sessionProof = Regex("^[a-f0-9]{64}$")
    private val captured =
        setOf(
            "captured_hold",
            "transfer_scheduled",
            "transfer_pending",
            "transferred",
            "refund_pending",
            "refunded_partial",
            "refunded_full",
            "disputed",
        )
    private val statuses = setOf("pending", "requires_action", "needs_review", "succeeded", "canceled")
    private val confirmable = setOf("requires_payment_method", "requires_confirmation", "requires_action")

    fun identifier(value: String?): Boolean = value != null && uuid.matches(value)

    fun provider(
        value: String?,
        prefix: String,
    ): Boolean = value != null && Regex("^${prefix}_[A-Za-z0-9]+$").matches(value)

    fun instant(value: String?): java.time.Instant? = value?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() }

    fun scope(
        actorId: String,
        sessionScope: String,
        actor: String,
        session: String?,
    ): Boolean = actorId == actor && sessionProof.matches(sessionScope) && (session == null || session == sessionScope)

    fun terms(
        value: TipTerms,
        gig: String,
        actor: String,
        ready: Boolean,
    ): Boolean =
        value.gigId == gig && value.payerId == actor && identifier(gig) && identifier(actor) &&
            (identifier(value.payeeId) || !ready && value.payeeId == null) &&
            (instant(value.ownerConfirmedAt) != null || !ready && value.ownerConfirmedAt == null)

    fun original(
        value: TipOriginal,
        gig: String,
        actor: String,
    ): Boolean =
        identifier(value.requestId) && value.paymentId == value.requestId && value.gigId == gig && value.payerId == actor &&
            identifier(value.payeeId) && value.payeeId != actor && value.amountCents in MIN_CENTS..MAX_CENTS && value.currency == "usd" &&
            (value.source == null || value.source == "legacy") &&
            terms(value.terms, gig, actor, value.source != "legacy") && value.terms.payeeId == value.payeeId &&
            (value.source != "legacy" || value.terms.ownerConfirmedAt == null && value.paymentMethodId == null) &&
            (value.paymentMethodId == null || provider(value.paymentMethodId, "pm"))

    fun preview(
        value: TipPreview,
        gig: String,
        actor: String,
        session: String?,
    ): Boolean =
        scope(value.actorId, value.sessionScope, actor, session) && terms(value.terms, gig, actor, value.eligible) &&
            (value.activeRequestId == null || identifier(value.activeRequestId)) &&
            (value.legacyPaymentId == null || identifier(value.legacyPaymentId)) &&
            (value.activeRequestId == null || value.legacyPaymentId == null) &&
            value.minimumAmountCents == MIN_CENTS && value.maximumAmountCents == MAX_CENTS && value.remainingTipSlots in 0..MAX_TIPS &&
            (
                !value.eligible || value.activeRequestId == null && value.legacyPaymentId == null && value.unavailableReason == null &&
                    value.remainingTipSlots > 0
            )

    fun progress(
        value: TipResponse,
        gig: String,
        actor: String,
        requestId: String,
        session: String?,
        expected: TipOriginal? = null,
    ): Boolean {
        val identityValid =
            scope(value.actorId, value.sessionScope, actor, session) && original(value.request, gig, actor) &&
                value.request.requestId == requestId && (expected == null || expected == value.request)
        val stateValid = value.status in statuses && (value.paymentIntentId == null || provider(value.paymentIntentId, "pi"))
        val legacySafe = value.request.source != "legacy" || !value.canRetry && value.checkout == null
        return identityValid && stateValid && legacySafe && receipt(value) && checkout(value)
    }

    private fun receipt(value: TipResponse): Boolean {
        if (!value.terminal) return value.receipt == null
        val receipt = value.receipt ?: return false
        val original = value.request
        val same =
            receipt.requestId == original.requestId && receipt.paymentId == original.paymentId && receipt.gigId == original.gigId &&
                receipt.payerId == original.payerId && receipt.payeeId == original.payeeId && receipt.amountCents == original.amountCents &&
                receipt.currency == "usd" && receipt.status == value.status && receipt.paymentIntentId == value.paymentIntentId
        val final =
            !value.canRetry && !value.canCancel && value.checkout == null &&
                (receipt.chargeId == null || provider(receipt.chargeId, "ch"))
        return same && final && receiptOutcome(value, receipt)
    }

    private fun receiptOutcome(
        value: TipResponse,
        receipt: TipReceipt,
    ): Boolean =
        if (value.status == "succeeded") {
            receipt.amountChargedCents == value.request.amountCents && provider(value.paymentIntentId, "pi") &&
                provider(receipt.chargeId, "ch") && value.paymentStatus in captured
        } else {
            receipt.amountChargedCents == 0 && value.paymentStatus == "canceled"
        }

    private fun checkout(value: TipResponse): Boolean {
        val checkout = value.checkout ?: return true
        return value.status in setOf("pending", "requires_action") && value.providerStatus in confirmable &&
            checkout.paymentIntentId == value.paymentIntentId && provider(checkout.paymentIntentId, "pi") &&
            checkout.clientSecret.startsWith("${checkout.paymentIntentId}_secret_") && provider(checkout.customer, "cus")
    }
}
