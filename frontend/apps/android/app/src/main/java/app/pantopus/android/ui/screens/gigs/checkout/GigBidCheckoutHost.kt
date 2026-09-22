@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.gigs.checkout

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import com.stripe.android.paymentsheet.rememberPaymentSheet
import java.util.Locale

/** Shared recovery controls for detail, offers and mail. Closing retains server progress. */
@Composable
fun GigBidCheckoutHost(coordinator: GigBidCheckoutCoordinator) {
    val state by coordinator.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(coordinator, lifecycle) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) coordinator.checkIdentity()
            }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            coordinator.dismiss()
        }
    }
    val presentation = state.presentation
    if (presentation != null) {
        key(presentation.token) { GigBidSheet(presentation, coordinator) }
    } else if (state.phase != GigBidCheckoutPhase.Idle) {
        val terminal = state.phase in listOf(GigBidCheckoutPhase.Accepted, GigBidCheckoutPhase.Canceled)
        AlertDialog(
            modifier = Modifier.testTag("gigBidCheckout.recovery"),
            onDismissRequest = { if (!state.busy) coordinator.dismiss() },
            title = { Text(if (terminal) "Payment progress" else "Bid payment") },
            text = {
                Column {
                    state.amountCents?.let { Text("Agreed amount: $${String.format(Locale.US, "%.2f", it / 100.0)}") }
                    Text(state.message ?: "Confirming payment progress…")
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !state.busy,
                    onClick = { if (terminal) coordinator.dismiss() else coordinator.retry() },
                    modifier = Modifier.testTag("gigBidCheckout.retry"),
                ) {
                    Text(
                        when {
                            terminal -> "Done"
                            state.busy -> "Confirming…"
                            state.phase == GigBidCheckoutPhase.RetryFinalize -> "Retry confirmation"
                            state.phase == GigBidCheckoutPhase.RetryCancel -> "Retry cancellation"
                            else -> "Resume payment"
                        },
                    )
                }
            },
            dismissButton = {
                if (!terminal) {
                    TextButton(
                        enabled = !state.busy,
                        onClick = coordinator::cancel,
                        modifier = Modifier.testTag("gigBidCheckout.cancel"),
                    ) { Text("Cancel payment setup") }
                }
            },
        )
    }
}

@Composable
private fun GigBidSheet(
    presentation: GigBidCheckoutPresentation,
    coordinator: GigBidCheckoutCoordinator,
) {
    val context = LocalContext.current
    // This immutable token belongs to this launcher's callback even if another
    // bid or account later opens a new PaymentSheet.
    val token = presentation.token
    val sheet = rememberPaymentSheet { result -> coordinator.onSheetResult(token, StripePaymentSheets.checkoutOutcome(result)) }
    LaunchedEffect(token) {
        if (!coordinator.claimPresentation(token)) return@LaunchedEffect
        try {
            sheet.presentWithPaymentIntent(
                paymentIntentClientSecret = presentation.params.clientSecret.orEmpty(),
                configuration =
                    StripePaymentSheets.paymentConfiguration(
                        context,
                        presentation.params.customer,
                        presentation.params.ephemeralKey,
                        presentation.params.publishableKey,
                    ),
            )
        } catch (_: IllegalStateException) {
            coordinator.presentationFailed(token)
        } catch (_: IllegalArgumentException) {
            coordinator.presentationFailed(token)
        }
    }
}
