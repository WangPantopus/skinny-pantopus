package app.pantopus.android.data.api.models.payments

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Original request terms, preserved through unknown results and cold recovery. */
@JsonClass(generateAdapter = true)
data class PaymentRefundAttempt(
    val requestId: String,
    val requestedAmountCents: Int? = null,
    val reason: String,
    val description: String? = null,
)

@JsonClass(generateAdapter = true)
data class PaymentRefundBody(
    val requestId: String,
    val amount: Int?,
    val reason: String,
    val description: String?,
)

@JsonClass(generateAdapter = true)
data class PaymentRefundRequestDto(
    val requestId: String,
    val paymentId: String,
    val operation: String,
    val amountCents: Int,
    val currency: String,
    val status: String,
    val canRetry: Boolean,
    val requestedAmountCents: Int? = null,
    val reason: String,
    val description: String? = null,
) {
    val attempt: PaymentRefundAttempt get() = PaymentRefundAttempt(requestId, requestedAmountCents, reason, description)
    val pending: Boolean get() = status in listOf("pending", "requires_action")
}

@JsonClass(generateAdapter = true)
data class PaymentWalletSettlementDto(
    val id: String,
    val paymentId: String,
    val status: String,
    val amountCents: Int,
    val currency: String,
    val refundBasisCents: Int,
    val createdAt: String,
)

@JsonClass(generateAdapter = true)
data class RefundPaymentSummary(
    val id: String,
    @Json(name = "payment_status") val paymentStatus: String,
    @Json(name = "amount_total") val amountTotal: Int,
    @Json(name = "refunded_amount") val refundedAmount: Int? = null,
    val currency: String,
    @Json(name = "captured_at") val capturedAt: String? = null,
    @Json(name = "payee_release_status") val payeeReleaseStatus: String? = null,
    @Json(name = "wallet_settlement") val walletSettlement: PaymentWalletSettlementDto? = null,
) {
    val remaining: Int get() = amountTotal - (refundedAmount ?: 0)
    val releasing: Boolean get() = paymentStatus == "authorized" && capturedAt == null
    val mayRequest: Boolean get() =
        paymentStatus in listOf("authorized", "captured_hold", "transfer_scheduled", "refunded_partial") &&
            payeeReleaseStatus == "held" && remaining > 0
}

@JsonClass(generateAdapter = true)
data class PaymentRefundHistoryDto(val requests: List<PaymentRefundRequestDto>, val payment: RefundPaymentSummary)

@JsonClass(generateAdapter = true)
data class PaymentRefundResultDto(val refundRequest: PaymentRefundRequestDto, val payment: RefundPaymentSummary)

@JsonClass(generateAdapter = true)
data class PaymentRefundConflictDto(val code: String, val refundRequest: PaymentRefundRequestDto)
