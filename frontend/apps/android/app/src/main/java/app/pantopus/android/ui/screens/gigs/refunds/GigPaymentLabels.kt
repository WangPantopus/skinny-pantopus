@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.api.models.gigs.GigPaymentDto

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
