@file:Suppress("ComplexCondition", "MagicNumber")

package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopProgress
import app.pantopus.android.data.api.models.gigs.GigStopReceipt
import app.pantopus.android.data.api.models.gigs.GigStopRequest
import app.pantopus.android.data.api.models.gigs.GigStopTerms
import java.time.Instant

class GigStopScopeChanged : IllegalStateException("Your session or access changed. Reopen the task before continuing.")

object GigStopValidation {
    val actions = setOf("cancel", "reopen_bidding", "worker_release", "close")
    val reasons =
        listOf(
            "changed_plans",
            "found_someone_else",
            "too_expensive",
            "emergency",
            "other",
            "schedule_conflict",
            "unable_to_complete",
            "safety_concern",
        )
    private val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")

    fun id(value: String?): Boolean = value != null && uuid.matches(value)

    private fun optionalId(value: String?): Boolean = value == null || id(value)

    fun terms(
        value: GigStopTerms,
        gigId: String,
    ): Boolean =
        id(gigId) && value.gigId == gigId && id(value.ownerId) && optionalId(value.workerId) && optionalId(value.paymentId) &&
            optionalId(value.acceptedBidId) && value.amountCents >= 0 && value.policyFeeCents >= 0 && value.currency == "usd" &&
            value.gigStatus.isNotBlank() && value.policy.isNotBlank() &&
            (value.acceptedAt == null || runCatching { Instant.parse(value.acceptedAt) }.isSuccess)

    fun request(
        value: GigStopRequest,
        gigId: String,
    ): Boolean =
        id(value.requestId) && value.gigId == gigId && id(value.actorId) && value.action in actions && terms(value.terms, gigId) &&
            (value.reason == null || value.reason in reasons) &&
            (value.rollbackMode == null || (value.action == "reopen_bidding" && value.rollbackMode == "payment_setup_aborted")) &&
            value.financialAction in setOf("none", "release", "refund")

    fun scope(
        actor: String,
        session: String,
        actorId: String,
        opening: String?,
    ) {
        if (actor != actorId || !Regex("^[a-f0-9]{64}$").matches(session) || (opening != null && session != opening)) {
            throw GigStopScopeChanged()
        }
    }

    fun preview(
        value: GigStopPreview,
        gigId: String,
        actorId: String,
        action: String,
        opening: String?,
    ) {
        scope(value.actorId, value.sessionScope, actorId, opening)
        check(
            terms(value.terms, gigId) && value.action == action && optionalId(value.activeRequestId) &&
                value.financialAction in setOf("none", "release", "refund", "review") &&
                (!value.eligible || (value.financialAction != "review" && value.terms.policyFeeCents == 0)),
        ) {
            "Task action details could not be verified. Check again before continuing."
        }
    }

    fun progress(
        value: GigStopProgress,
        gigId: String,
        actorId: String,
        requestId: String,
        opening: String?,
        expected: GigStopRequest? = null,
    ) {
        scope(value.actorId, value.sessionScope, actorId, opening)
        val saved = value.request
        check(
            request(saved, gigId) && value.requestId == requestId && saved.requestId == requestId && value.action == saved.action &&
                (expected == null || saved == expected) && value.status in setOf("pending", "needs_review", "completed") &&
                value.financialStatus in setOf("none", "release_pending", "released", "refund_pending", "refunded", "needs_review") &&
                (!value.canRetry || saved.actorId == actorId),
        ) { "The task action is not confirmed. Check its original request." }
        if (value.status != "completed") {
            check(value.receipt == null) { "The task action receipt is inconsistent." }
            return
        }
        completion(value, gigId, requestId)
    }

    private fun completion(
        value: GigStopProgress,
        gigId: String,
        requestId: String,
    ) {
        val saved = value.request
        val financial = mapOf("none" to "none", "release" to "released", "refund" to "refunded")[saved.financialAction]
        val status = if (saved.action in setOf("reopen_bidding", "worker_release")) "open" else "cancelled"
        val receipt =
            GigStopReceipt(
                requestId, gigId, saved.terms.paymentId, saved.terms.ownerId, saved.terms.workerId,
                saved.terms.amountCents, "usd", saved.action, status, checkNotNull(financial),
            )
        check(
            !value.canRetry && value.receipt == receipt && value.financialStatus == financial,
        ) { "Completion is not confirmed. Check the original request." }
    }
}
