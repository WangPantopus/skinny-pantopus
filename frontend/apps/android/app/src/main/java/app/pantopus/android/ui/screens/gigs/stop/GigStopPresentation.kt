package app.pantopus.android.ui.screens.gigs.stop

import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopProgress
import java.util.Locale

/** Display copy for already verified action terms and receipts. */
object GigStopPresentation {
    fun label(action: String): String =
        when (action) {
            "reopen_bidding" -> "Reopen bidding"
            "worker_release" -> "Leave assignment"
            "close" -> "Close task"
            else -> "Cancel task"
        }

    fun money(cents: Int): String = String.format(Locale.US, "$%.2f", cents / 100.0)

    /**
     * A started $0 task: the stop rules send every started task to review, but
     * there is no fee to review, so say what to do instead (as web does).
     */
    fun startedFreeTaskMessage(preview: GigStopPreview): String? =
        when {
            preview.eligible || preview.unavailableReason != "STARTED_POLICY_REVIEW" || preview.terms.amountCents != 0 -> null
            preview.terms.ownerId == preview.actorId ->
                "This task has already started. A started task can't be cancelled here. Message your helper to sort " +
                    "it out; when they mark it delivered, you can confirm it."
            else ->
                "You've already started this task. A started task can't be cancelled here. Message the poster to " +
                    "sort it out, and mark it delivered when you're done."
        }

    fun message(progress: GigStopProgress): String =
        when {
            progress.status == "needs_review" -> "This task action needs review. Check status or contact support."
            progress.status != "completed" && progress.financialStatus == "refund_pending" ->
                "The refund is pending. The task action is not complete yet."
            progress.status != "completed" && progress.financialStatus == "release_pending" ->
                "The payment hold release is pending. The task action is not complete yet."
            progress.status != "completed" -> "The task action is pending. Check status before continuing."
            else -> {
                val task = if (progress.receipt?.gigStatus == "open") "This action reopened bidding." else "This action cancelled the task."
                when (progress.financialStatus) {
                    "refunded" -> "$task The refund is confirmed; your bank may take additional time to show it."
                    "released" -> "$task The payment hold release is confirmed."
                    "fee_charged" -> {
                        val fee = progress.receipt?.feeCents
                        val released = progress.receipt?.releasedCents
                        if (fee != null && released != null) {
                            "$task Cancellation fee ${money(fee)} charged · ${money(released)} released."
                        } else {
                            task
                        }
                    }
                    else -> task
                }
            }
        }
}
