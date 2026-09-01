@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto

/**
 * Checkout types for the invoice "Pay" CTA. The view-model creates the
 * PaymentIntent (`POST api/businesses/invoices/{id}/pay`) and emits an
 * [InvoiceDetailEvent.PresentCheckout]; the screen presents Stripe's
 * PaymentSheet (it needs the Activity's `ActivityResultRegistry`) and reports
 * the outcome back. We never mark the invoice paid here — the VM confirms
 * with the backend and re-reads server state on success.
 */

/** Where the "Pay" CTA currently sits, so the screen can surface the right toast. */
sealed interface InvoicePaymentStatus {
    data object Idle : InvoicePaymentStatus

    data object Paying : InvoicePaymentStatus

    data object Paid : InvoicePaymentStatus

    data object Canceled : InvoicePaymentStatus

    data class Declined(val message: String) : InvoicePaymentStatus
}

/** One-shot effects the [InvoiceDetailViewModel] asks the screen to perform. */
sealed interface InvoiceDetailEvent {
    /** Present Stripe PaymentSheet for the created PaymentIntent. */
    data class PresentCheckout(val params: PaymentIntentSheetParamsDto) : InvoiceDetailEvent
}
