@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.data.payments

import app.pantopus.android.data.api.models.payments.PaymentRefundAttempt
import app.pantopus.android.data.api.models.payments.PaymentRefundRequestDto
import app.pantopus.android.data.api.models.payments.PaymentWalletSettlementDto
import app.pantopus.android.data.api.models.payments.RefundPaymentSummary
import java.time.Instant
import java.util.Locale

object RefundValidation {
    val reasons =
        linkedMapOf(
            "requested_by_customer" to "Requested by me",
            "work_not_completed" to "Work not completed",
            "duplicate" to "Duplicate payment",
            "fraudulent" to "Unauthorized payment",
            "other" to "Other",
        )
    private val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")

    fun validId(value: String): Boolean = uuid.matches(value)

    fun validAttempt(value: PaymentRefundAttempt): Boolean =
        validId(value.requestId) && value.reason in reasons &&
            (value.requestedAmountCents == null || value.requestedAmountCents > 0) && (value.description?.length ?: 0) <= 500

    fun validReceipt(
        value: PaymentRefundRequestDto,
        paymentId: String,
        total: Int,
    ): Boolean =
        validAttempt(value.attempt) && value.paymentId == paymentId && value.operation in listOf("refund", "release") &&
            value.status in listOf("pending", "requires_action", "succeeded", "failed", "canceled") &&
            value.currency.equals("usd", true) && value.amountCents in 1..total &&
            (value.requestedAmountCents ?: 0) <= total

    fun validSummary(
        value: RefundPaymentSummary,
        paymentId: String,
        total: Int,
    ): Boolean {
        val matchesPayment = value.id == paymentId && value.amountTotal == total && total >= 50 && value.currency.equals("usd", true)
        if (!matchesPayment) return false
        val knownRelease =
            value.payeeReleaseStatus in
                listOf(
                    null, "held", "wallet_credited", "no_earnings", "external_transfer", "unknown",
                )
        if ((value.refundedAmount ?: 0) !in 0..total || !knownRelease) {
            return false
        }
        // Legacy exact wallet credits have no protected settlement receipt;
        // the server verifies their wallet/transaction proof before projection.
        val receipt = value.walletSettlement ?: return value.payeeReleaseStatus != "no_earnings" || value.refundedAmount == total
        return validSettlement(value, receipt)
    }

    private fun validSettlement(
        value: RefundPaymentSummary,
        receipt: PaymentWalletSettlementDto,
    ): Boolean =
        validId(receipt.id) && receipt.paymentId == value.id && receipt.currency.equals("usd", true) &&
            receipt.amountCents in 0..value.amountTotal && receipt.refundBasisCents in 0..(value.refundedAmount ?: 0) &&
            runCatching { Instant.parse(receipt.createdAt) }.isSuccess &&
            (
                (value.payeeReleaseStatus == "wallet_credited" && receipt.status == "credited" && receipt.amountCents > 0) ||
                    (value.payeeReleaseStatus == "no_earnings" && receipt.status == "no_earnings" && receipt.amountCents == 0)
            )

    fun cents(text: String): Int? {
        val value = text.trim()
        if (!Regex("^[0-9]+(\\.[0-9]{1,2})?$").matches(value)) return null
        val parts = value.split('.')
        val dollars = parts[0].toLongOrNull() ?: return null
        if (dollars > (Int.MAX_VALUE - 99L) / 100) return null
        return (dollars * 100 + parts.getOrElse(1) { "" }.padEnd(2, '0').toInt()).toInt()
    }

    fun money(cents: Int): String = String.format(Locale.US, "$%.2f", cents / 100.0)

    fun receiptMessage(receipt: PaymentRefundRequestDto): String {
        val amount = money(receipt.amountCents)
        return if (receipt.operation == "release") {
            when (receipt.status) {
                "succeeded" -> "$amount authorization hold released. No captured charge was refunded."
                "pending", "requires_action" -> "$amount authorization hold release is pending."
                else -> "The authorization hold release did not complete."
            }
        } else {
            when (receipt.status) {
                "succeeded" -> "$amount refund completed. Your bank may take additional time to show it."
                "requires_action" -> "$amount refund needs additional action. Check status or contact support."
                "pending" -> "$amount refund is pending."
                else -> "$amount refund did not complete."
            }
        }
    }

    fun releaseMessage(summary: RefundPaymentSummary): String? =
        when (summary.payeeReleaseStatus) {
            "held" -> null
            "wallet_credited" -> "Earnings have been credited to the worker's wallet. Contact support to request another refund."
            "external_transfer" -> "Earnings have been sent to the worker. Contact support to request another refund."
            "no_earnings" -> "No worker earnings remain after refunds."
            else -> "Worker payment status needs verification. Check status before requesting a refund."
        }
}
