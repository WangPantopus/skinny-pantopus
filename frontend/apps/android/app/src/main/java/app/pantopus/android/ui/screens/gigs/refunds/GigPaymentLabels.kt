@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.models.gigs.GigPaymentFeeDto
import java.util.Locale

/** The task amount stays distinct from the route's separately aggregated tips. */
fun gigPaymentAmountLabel(payment: GigPaymentDto): String =
    when {
        payment.paymentStatus == "authorized" -> "Authorization hold"
        payment.paymentStatus == "capture_pending" -> "Capture pending"
        payment.capturedAt != null -> "Task charged"
        payment.paymentStatus in
            listOf(
                "captured_hold", "transfer_scheduled", "transfer_pending", "transferred", "refunded_partial", "refunded_full", "disputed",
            )
        -> "Task charged"
        else -> "Payment total"
    }

/** "No-show fee $3.13 charged · $9.37 released" for a fee charged from the hold. */
fun gigPaymentFeeLine(fee: GigPaymentFeeDto): String =
    String.format(
        Locale.US,
        "%s $%.2f charged · $%.2f released",
        if (fee.kind == "poster_no_show") "No-show fee" else "Cancellation fee",
        fee.feeCents / 100.0,
        fee.releasedCents / 100.0,
    )
