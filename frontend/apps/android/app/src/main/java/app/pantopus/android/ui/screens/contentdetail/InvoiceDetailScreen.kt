@file:Suppress("MagicNumber", "PackageNaming", "FunctionNaming")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import com.stripe.android.paymentsheet.rememberPaymentSheet

/**
 * A09.4 invoice detail. The invoice is read from
 * `GET api/businesses/invoices/{id}`; the "Pay" CTA runs the real
 * pay → PaymentSheet → confirm sequence. PaymentSheet (created in composition
 * — it registers an ActivityResult launcher) collects the card + handles SCA,
 * and the outcome drives a success / declined / canceled toast. On success
 * the VM confirms with the backend and re-reads the invoice, so the paid
 * frame is whatever the server says it is.
 */
@Composable
fun InvoiceDetailScreen(
    onBack: () -> Unit = {},
    viewModel: InvoiceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val paymentStatus by viewModel.paymentStatus.collectAsStateWithLifecycle()
    val toastController = remember { ToastController() }
    val context = LocalContext.current

    val paymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onCheckoutOutcome(StripePaymentSheets.checkoutOutcome(result))
        }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is InvoiceDetailEvent.PresentCheckout ->
                    paymentSheet.presentWithPaymentIntent(
                        paymentIntentClientSecret = event.params.clientSecret.orEmpty(),
                        configuration =
                            StripePaymentSheets.paymentConfiguration(
                                context = context,
                                customerId = event.params.customer,
                                ephemeralKey = event.params.ephemeralKey,
                                publishableKey = event.params.publishableKey,
                            ),
                    )
            }
        }
    }

    // Surface the post-checkout result as a (self-dismissing) toast. The
    // status itself sticks until the next pay() so the checkout.* marker stays
    // assertable by UI tests.
    LaunchedEffect(paymentStatus) {
        when (val status = paymentStatus) {
            is InvoicePaymentStatus.Paid -> toastController.success("Payment complete.")
            is InvoicePaymentStatus.Canceled -> toastController.info("Payment canceled.")
            is InvoicePaymentStatus.Declined -> toastController.error(status.message)
            else -> Unit
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag("checkout.paymentSheet")) {
        ContentDetailShell(
            state = state,
            onBack = onBack,
            onPrimaryAction = { viewModel.pay() },
            // Only the paid dock carries a secondary button ("Share") —
            // the due dock's secondary slot is null.
            onSecondaryAction = { context.shareText(viewModel.shareSummary(), "Share invoice") },
            onRetry = { viewModel.refresh() },
            onMessageCounterparty = null,
        )
        PaymentResultMarker(paymentStatus)
        ToastHost(controller = toastController)
    }
}

/** Invisible test anchor that mirrors the last terminal checkout outcome. */
@Composable
private fun PaymentResultMarker(status: InvoicePaymentStatus) {
    val tag =
        when (status) {
            is InvoicePaymentStatus.Paid -> "checkout.paySuccess"
            is InvoicePaymentStatus.Declined -> "checkout.payDeclined"
            is InvoicePaymentStatus.Canceled -> "checkout.cancel"
            else -> null
        }
    if (tag != null) {
        Box(modifier = Modifier.size(0.dp).testTag(tag))
    }
}
