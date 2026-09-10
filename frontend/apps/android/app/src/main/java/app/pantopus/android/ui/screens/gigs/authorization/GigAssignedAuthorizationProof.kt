@file:Suppress("PackageNaming", "ReturnCount")

package app.pantopus.android.ui.screens.gigs.authorization

import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationDto
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import java.time.Instant
import kotlin.math.abs

internal data class AssignedAuthorizationTarget(
    val gigId: String,
    val paymentId: String,
    val payer: String,
    val payee: String,
    val amount: Int,
)

/** Strict client projection of the server's receipt contract; no local authorization state transitions. */
internal object GigAssignedAuthorizationProof {
    private const val MINIMUM_CENTS = 50
    private const val CENT_TOLERANCE = 0.001
    private val paymentStates = setOf("ready_to_authorize", "authorize_pending", "authorization_failed", "authorized", "canceled")
    private val sdkStates = setOf("requires_action", "requires_confirmation", "requires_payment_method")
    private val providerStates = sdkStates + setOf(null, "processing", "requires_capture", "canceled")
    private val recoveryStates = setOf("ready", "action_required", "pending", "needs_review")

    fun target(
        gig: GigDto,
        payment: GigPaymentDto,
        actor: String?,
    ): AssignedAuthorizationTarget? {
        if (!assignedViewer(gig, actor)) return null
        val paymentId = payment.id?.takeIf(String::isNotBlank) ?: return null
        val payer = gig.userId?.takeIf(String::isNotBlank) ?: return null
        val payee = gig.acceptedBy?.takeIf(String::isNotBlank) ?: return null
        val amount = payment.amountTotal ?: return null
        if (!samePayment(gig, payment) || !sameAmount(gig.price, amount)) return null
        return AssignedAuthorizationTarget(gig.id, paymentId, payer, payee, amount)
    }

    private fun assignedViewer(
        gig: GigDto,
        actor: String?,
    ): Boolean = !actor.isNullOrBlank() && actor != gig.acceptedBy && gig.status == "assigned"

    private fun samePayment(
        gig: GigDto,
        payment: GigPaymentDto,
    ): Boolean {
        val identity = payment.id == gig.paymentId && payment.gigId == gig.id
        val owners = payment.payerId == gig.userId && payment.payeeId == gig.acceptedBy
        val terms = payment.currency?.lowercase() == "usd" && payment.paymentStatus in paymentStates
        return identity && owners && terms
    }

    private fun sameAmount(
        price: Double?,
        amount: Int,
    ): Boolean {
        if (price == null || !price.isFinite() || amount < MINIMUM_CENTS) return false
        return abs(price * 100 - amount) < CENT_TOLERANCE
    }

    fun validate(
        target: AssignedAuthorizationTarget,
        receipt: GigAssignedAuthorizationDto,
        actor: String?,
        openingScope: String?,
    ): String {
        check(receipt.gigId == target.gigId && receipt.paymentId == target.paymentId && receipt.actorId == actor)
        check(receipt.payerId == target.payer && receipt.payeeId == target.payee)
        check(receipt.amountCents == target.amount && receipt.currency == "usd")
        val fingerprint = receipt.sessionScope
        check(fingerprint != null && fingerprint.matches(Regex("[a-f0-9]{64}")))
        check(openingScope == null || openingScope == fingerprint)
        check(!receipt.authorizationAttemptId.isNullOrBlank() && receipt.authorizationReady != null)
        check(receipt.canRetry != null && receipt.cancellationPending != null)
        check(receipt.alreadyAuthorized == receipt.authorizationReady && receipt.recoveryState in recoveryStates)
        check(receipt.paymentStatus in paymentStates && receipt.providerStatus in providerStates)
        check(receipt.providerStatus == null || !receipt.paymentIntentId.isNullOrBlank())
        validateState(receipt)
        return fingerprint
    }

    private fun validateState(receipt: GigAssignedAuthorizationDto) {
        val ready = receipt.authorizationReady == true
        val confirmed =
            receipt.paymentStatus == "authorized" && receipt.providerStatus == "requires_capture" &&
                receipt.cancellationPending == false
        check(ready == confirmed && (receipt.recoveryState == "ready") == ready)
        if (receipt.authorizationAvailableAt != null) {
            Instant.parse(receipt.authorizationAvailableAt)
            checkWaiting(receipt)
        }
        if (receipt.cancellationPending == true) checkWaiting(receipt)
        if (receipt.recoveryState == "action_required") {
            check(!ready && receipt.providerStatus in sdkStates)
            check(receipt.canRetry == true && !receipt.clientSecret.isNullOrBlank())
        }
    }

    private fun checkWaiting(receipt: GigAssignedAuthorizationDto) {
        check(receipt.authorizationReady == false && receipt.canRetry == false && receipt.recoveryState == "pending")
    }
}
