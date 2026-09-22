@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.gigs.authorization

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
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.payments.RefundValidation
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import com.stripe.android.paymentsheet.rememberPaymentSheet
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@Composable
fun GigAssignedAuthorizationHost(coordinator: GigAssignedAuthorizationCoordinator) {
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
            coordinator.close()
        }
    }
    val presentation = state.presentation
    if (presentation != null) {
        key(presentation.token) { AssignedAuthorizationSheet(presentation, coordinator) }
    }
    if (state.visible) {
        AlertDialog(
            modifier = Modifier.testTag("gigAuthorization.dialog"),
            onDismissRequest = coordinator::close,
            title = { Text("Task payment authorization") },
            text = {
                Column {
                    state.progress?.amountCents?.let { Text("Agreed task amount: ${RefundValidation.money(it)}") }
                    Text(state.message ?: authorizationMessage(state))
                }
            },
            confirmButton = {
                Column {
                    if (state.mayContinue) {
                        TextButton(onClick = coordinator::continueAuthorization, modifier = Modifier.testTag("gigAuthorization.continue")) {
                            Text("Continue payment")
                        }
                    }
                    if (!state.invalidated && state.progress?.authorizationReady != true) {
                        TextButton(
                            enabled = !state.busy && state.presentation == null,
                            onClick = coordinator::checkStatus,
                            modifier = Modifier.testTag("gigAuthorization.check"),
                        ) {
                            Text(if (state.busy || state.presentation != null) "Checking…" else "Check status")
                        }
                    }
                }
            },
            dismissButton = { TextButton(onClick = coordinator::close) { Text("Close") } },
        )
    }
}

private fun authorizationMessage(state: GigAssignedAuthorizationState): String {
    val receipt = state.progress
    return when {
        state.presentation != null -> "Checking payment before checkout… You can close this screen to stop waiting."
        state.busy -> "Checking the current authorization…"
        receipt?.cancellationPending == true ->
            "Cancellation is being confirmed. Payment cannot continue until its result is known. Check status again."
        receipt?.authorizationAvailableAt != null -> {
            val available =
                Instant.parse(receipt.authorizationAvailableAt).atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM))
            "Your saved card is scheduled for authorization starting $available. No new hold is needed yet."
        }
        receipt?.authorizationReady == true -> "The authorization hold is confirmed. The task payment has not been captured yet."
        receipt?.recoveryState == "action_required" -> "Continue to complete payment verification for this exact task amount."
        receipt?.canRetry == true -> "Continue to recover this same payment authorization."
        receipt?.recoveryState == "pending" -> "The authorization is still pending. Check status to confirm its result."
        else -> "Payment needs verification. Check status again or contact support if it remains unresolved."
    }
}

@Composable
private fun AssignedAuthorizationSheet(
    presentation: GigAuthorizationPresentation,
    coordinator: GigAssignedAuthorizationCoordinator,
) {
    val context = LocalContext.current
    val token = presentation.token
    val sheet = rememberPaymentSheet { coordinator.onSheetResult(token, StripePaymentSheets.checkoutOutcome(it)) }
    LaunchedEffect(token) {
        if (!coordinator.claimPresentation(token)) return@LaunchedEffect
        try {
            sheet.presentWithPaymentIntent(
                paymentIntentClientSecret = presentation.clientSecret,
                configuration = StripePaymentSheets.paymentConfiguration(context, null, null, BuildConfig.STRIPE_PUBLISHABLE_KEY),
            )
        } catch (_: IllegalStateException) {
            coordinator.presentationFailed(token)
        } catch (_: IllegalArgumentException) {
            coordinator.presentationFailed(token)
        }
    }
}
