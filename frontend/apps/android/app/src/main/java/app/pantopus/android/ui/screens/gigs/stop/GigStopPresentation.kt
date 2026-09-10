package app.pantopus.android.ui.screens.gigs.stop

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
                    else -> task
                }
            }
        }
}
