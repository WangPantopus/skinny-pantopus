@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Phase 5 — gig detail & lifecycle DTOs: counter-offers, instant accept,
 * worker acknowledgement, no-show, moderation reports, and the owner
 * cancellation fee preview.
 */

/** Body for `POST /api/gigs/:gigId/bids/:bidId/counter` (`backend/routes/gigs.js:5097`). */
@JsonClass(generateAdapter = true)
data class CounterBidBody(
    val amount: Double,
    val message: String? = null,
)

/**
 * Envelope shared by the bid lifecycle mutations: counter (`{ bid }`),
 * counter accept / decline (`{ bid }`), and reject (`{ message }`).
 */
@JsonClass(generateAdapter = true)
data class GigBidMutationResponse(
    val bid: GigBidDto? = null,
    val message: String? = null,
)

/**
 * Response from `POST /api/gigs/:gigId/instant-accept`
 * (`backend/routes/gigsV2.js:64`). Paid gigs initialise the poster's
 * payment up-front; `payment.clientSecret` is present when the backend
 * wants a PaymentSheet pass before work can start.
 */
@JsonClass(generateAdapter = true)
data class GigInstantAcceptResponse(
    val message: String? = null,
    val gig: GigDto? = null,
    val paymentRequired: Boolean? = null,
    val requiresPaymentSetup: Boolean? = null,
    val isSetupIntent: Boolean? = null,
    val payment: GigBidAcceptResponse.PaymentPayload? = null,
    val publishableKey: String? = null,
    val ephemeralKey: String? = null,
    val customer: String? = null,
) {
    fun sheetParams(): PaymentIntentSheetParamsDto =
        PaymentIntentSheetParamsDto(
            clientSecret = payment?.clientSecret,
            paymentIntentId = payment?.paymentIntentId,
            customer = customer,
            ephemeralKey = ephemeralKey,
            publishableKey = publishableKey,
            isSetupIntent = isSetupIntent,
        )
}

/**
 * Body for `POST /api/gigs/:gigId/worker-ack`
 * (`backend/routes/gigs.js:5838`). `status` is `starting_now` or
 * `running_late`; `eta_minutes` (1..480) only applies to the latter.
 */
@JsonClass(generateAdapter = true)
data class WorkerAckBody(
    val status: String,
    @Json(name = "eta_minutes") val etaMinutes: Int? = null,
    val note: String? = null,
)

/** Response from the worker-ack endpoint. */
@JsonClass(generateAdapter = true)
data class WorkerAckResponse(
    val success: Boolean? = null,
    @Json(name = "worker_ack_status") val workerAckStatus: String? = null,
    val message: String? = null,
)

/**
 * Response from `GET /api/gigs/:gigId/no-show-check`
 * (`backend/routes/gigs.js:7720`). Gate for the "Report no-show"
 * affordance; the extra fields explain the verdict.
 */
@JsonClass(generateAdapter = true)
data class NoShowCheckResponse(
    @Json(name = "can_report") val canReport: Boolean? = null,
    val reason: String? = null,
    @Json(name = "expected_start") val expectedStart: String? = null,
    @Json(name = "can_report_after") val canReportAfter: String? = null,
    @Json(name = "minutes_overdue") val minutesOverdue: Int? = null,
    @Json(name = "hours_since_accept") val hoursSinceAccept: Int? = null,
)

/**
 * Body for `POST /api/gigs/:gigId/report-no-show`
 * (`backend/routes/gigs.js:7572`). Cancels the gig with a no-show
 * incident; `evidence_urls` are optional uploaded proof links.
 */
@JsonClass(generateAdapter = true)
data class ReportNoShowBody(
    val description: String? = null,
    @Json(name = "evidence_urls") val evidenceUrls: List<String>? = null,
)

/** Response from the report-no-show endpoint (`{ message, gig }`). */
@JsonClass(generateAdapter = true)
data class ReportNoShowResponse(
    val message: String? = null,
    val gig: GigDto? = null,
)

/**
 * Body for `POST /api/gigs/:gigId/report` (`backend/routes/gigs.js:3110`).
 * `reason` must be one of the [GigReportReason] wire values; `details`
 * is free text up to 1000 chars.
 */
@JsonClass(generateAdapter = true)
data class ReportGigBody(
    val reason: String,
    val details: String? = null,
)

/** Response from the gig report endpoint. */
@JsonClass(generateAdapter = true)
data class ReportGigResponse(
    val message: String? = null,
)

/** Allowed `reason` values for `reportGigSchema` (`backend/routes/gigs.js:690`). */
enum class GigReportReason(val wireValue: String, val label: String) {
    Spam("spam", "Spam or scam"),
    Harassment("harassment", "Harassment"),
    Inappropriate("inappropriate", "Inappropriate content"),
    Misinformation("misinformation", "Misinformation"),
    Safety("safety", "Safety concern"),
    Other("other", "Something else"),
}

/**
 * Envelope from `GET /api/gigs/:gigId/payment`
 * (`backend/routes/gigs.js:8440`). `payment == null` when no payment is
 * linked to the gig; `stateInfo` is the display descriptor for
 * `payment.payment_status` (`backend/stripe/paymentStateMachine.js:189`).
 */
@JsonClass(generateAdapter = true)
data class GigPaymentResponse(
    val payment: GigPaymentDto? = null,
    val stateInfo: GigPaymentStateInfo? = null,
)

/**
 * Poster/worker-visible subset of the `Payment` row. All `amount_*` /
 * `tip_amount` / `refunded_amount` fields are integer cents.
 */
@JsonClass(generateAdapter = true)
data class GigPaymentDto(
    val id: String? = null,
    @Json(name = "payment_status") val paymentStatus: String? = null,
    @Json(name = "amount_total") val amountTotal: Int? = null,
    @Json(name = "amount_subtotal") val amountSubtotal: Int? = null,
    @Json(name = "amount_platform_fee") val amountPlatformFee: Int? = null,
    @Json(name = "amount_processing_fee") val amountProcessingFee: Int? = null,
    @Json(name = "amount_to_payee") val amountToPayee: Int? = null,
    /** Sum of successful tip payments, net of tip refunds (route-computed). */
    @Json(name = "tip_amount") val tipAmount: Int? = null,
    @Json(name = "refunded_amount") val refundedAmount: Int? = null,
    val currency: String? = null,
)

/** `{ label, color, description }` from `getPaymentStateInfo`. */
@JsonClass(generateAdapter = true)
data class GigPaymentStateInfo(
    val label: String? = null,
    val color: String? = null,
    val description: String? = null,
)

/**
 * One row from `GET /api/gigs/:gigId/change-orders`
 * (`backend/routes/gigs.js:6640`). `amount_change` is dollars (positive =
 * increase, negative = decrease, applied to the gig price on approval);
 * `status` is `pending / approved / rejected / withdrawn`.
 */
@JsonClass(generateAdapter = true)
data class GigChangeOrderDto(
    val id: String,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "requested_by") val requestedBy: String? = null,
    val type: String? = null,
    val description: String? = null,
    @Json(name = "amount_change") val amountChange: Double? = null,
    @Json(name = "time_change_minutes") val timeChangeMinutes: Int? = null,
    val status: String? = null,
    @Json(name = "reviewed_by") val reviewedBy: String? = null,
    @Json(name = "reviewed_at") val reviewedAt: String? = null,
    @Json(name = "rejection_reason") val rejectionReason: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val requester: GigCreator? = null,
    val reviewer: GigCreator? = null,
) {
    val isPending: Boolean get() = status == "pending"
}

/** Envelope from `GET /api/gigs/:gigId/change-orders`. */
@JsonClass(generateAdapter = true)
data class GigChangeOrdersResponse(
    @Json(name = "change_orders") val changeOrders: List<GigChangeOrderDto> = emptyList(),
)

/** Envelope from the change-order mutations (`{ change_order }`). */
@JsonClass(generateAdapter = true)
data class GigChangeOrderMutationResponse(
    @Json(name = "change_order") val changeOrder: GigChangeOrderDto? = null,
)

/**
 * Body for `POST /api/gigs/:gigId/change-orders`
 * (`backend/routes/gigs.js:6691`). `description` must be 5..2000 chars.
 */
@JsonClass(generateAdapter = true)
data class CreateChangeOrderBody(
    val type: String,
    val description: String,
    @Json(name = "amount_change") val amountChange: Double? = null,
    @Json(name = "time_change_minutes") val timeChangeMinutes: Int? = null,
)

/** Body for `POST .../change-orders/:orderId/reject` — optional reason (≤500 chars). */
@JsonClass(generateAdapter = true)
data class RejectChangeOrderBody(
    val reason: String? = null,
)

/** Valid change-order `type` values (`backend/routes/gigs.js:6698`). */
enum class GigChangeOrderType(val wireValue: String, val label: String) {
    PriceIncrease("price_increase", "Price increase"),
    PriceDecrease("price_decrease", "Price decrease"),
    ScopeAddition("scope_addition", "Add to the scope"),
    ScopeReduction("scope_reduction", "Reduce the scope"),
    TimelineExtension("timeline_extension", "More time"),
    Other("other", "Something else"),
    ;

    companion object {
        fun fromWire(value: String?): GigChangeOrderType? = entries.firstOrNull { it.wireValue == value }
    }
}

/**
 * Response from `GET /api/gigs/:gigId/cancellation-preview`
 * (`backend/routes/gigs.js:6354`). Mirrors `computeCancellationInfo`
 * (`backend/routes/gigs.js:569`) plus the policy descriptors.
 */
@JsonClass(generateAdapter = true)
data class CancellationPreviewResponse(
    val zone: Int? = null,
    @Json(name = "zone_label") val zoneLabel: String? = null,
    val fee: Double? = null,
    @Json(name = "fee_pct") val feePct: Double? = null,
    @Json(name = "in_grace") val inGrace: Boolean? = null,
    val policy: String? = null,
    @Json(name = "policy_label") val policyLabel: String? = null,
    @Json(name = "policy_description") val policyDescription: String? = null,
    @Json(name = "can_reschedule") val canReschedule: Boolean? = null,
)

/**
 * Body for `POST /api/gigs/:gigId/reschedule`
 * (`backend/routes/gigs.js:6405`). `scheduled_start` must be a future
 * ISO date; `note` is forwarded into the worker's notification body.
 */
@JsonClass(generateAdapter = true)
data class RescheduleGigBody(
    @Json(name = "scheduled_start") val scheduledStart: String,
    val note: String? = null,
)

/** Response from the reschedule endpoint (`{ message, gig }`). */
@JsonClass(generateAdapter = true)
data class RescheduleGigResponse(
    val message: String? = null,
    val gig: GigDto? = null,
)
