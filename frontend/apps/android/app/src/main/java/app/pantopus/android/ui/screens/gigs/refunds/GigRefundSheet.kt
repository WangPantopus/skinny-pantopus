@file:Suppress("PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.gigs.refunds

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.payments.RefundValidation
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

@Composable
fun GigRefundSheet(coordinator: GigRefundCoordinator) {
    val state by coordinator.state.collectAsStateWithLifecycle()
    if (!state.visible) return
    var editing by remember { mutableStateOf(false) }
    var amount by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("requested_by_customer") }
    var confirming by remember { mutableStateOf(false) }
    LaunchedEffect(state.mayRequest) {
        if (!state.mayRequest) {
            editing = false
            confirming = false
        }
    }
    ModalBottomSheet(onDismissRequest = coordinator::close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s5).testTag("gigRefund.sheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Refunds and hold releases", fontWeight = FontWeight.Bold)
            if (state.invalidated) {
                Text("Your session or connection changed. Reopen this payment to continue.", Modifier.testTag("gigRefund.sessionChanged"))
            } else {
                RefundStatus(state, coordinator)
                if (state.mayRequest) {
                    if (editing) {
                        RefundForm(state, amount, reason, { amount = it }, { reason = it })
                        TextButton(onClick = { confirming = true }, enabled = validAmount(state, amount)) { Text("Continue") }
                        TextButton(onClick = { editing = false }) { Text("Cancel") }
                    } else {
                        TextButton(onClick = { editing = true }, modifier = Modifier.testTag("gigRefund.newRequest")) {
                            Text(if (state.summary?.releasing == true) "Release authorization hold" else "Request a refund")
                        }
                    }
                }
            }
            TextButton(onClick = coordinator::close) { Text("Close") }
        }
    }
    if (confirming && state.mayRequest) {
        val releasing = state.summary?.releasing == true
        val requested = if (releasing || amount.isBlank()) state.summary?.remaining ?: 0 else RefundValidation.cents(amount) ?: 0
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(if (releasing) "Release this authorization hold?" else "Submit this refund request?") },
            text = {
                Text(
                    if (releasing) {
                        "Release the ${RefundValidation.money(requested)} hold. No captured charge will be refunded. " +
                            "This does not cancel the task."
                    } else {
                        "Request ${RefundValidation.money(requested)} back to the original payment method. " +
                            "This does not cancel the task."
                    },
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirming = false
                    coordinator.submit(amount, reason)
                }, modifier = Modifier.testTag("gigRefund.confirm")) {
                    Text(if (releasing) "Release hold" else "Request refund", color = PantopusColors.error)
                }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text("Keep payment") } },
        )
    }
}

@Composable
private fun RefundStatus(
    state: GigRefundState,
    coordinator: GigRefundCoordinator,
) {
    state.summary?.let { RefundValidation.releaseMessage(it) }?.let { Text(it) }
    state.requests.forEach { Text(RefundValidation.receiptMessage(it)) }
    state.error?.let { Text(it, color = PantopusColors.error) }
    if (state.unconfirmed) Text("This request has not been confirmed yet.")
    TextButton(onClick = coordinator::checkStatus, enabled = !state.busy, modifier = Modifier.testTag("gigRefund.checkStatus")) {
        Text(if (state.busy) "Checking…" else "Check status")
    }
    if (state.mayRetry) {
        TextButton(onClick = coordinator::retry, modifier = Modifier.testTag("gigRefund.retry")) { Text("Retry this request") }
    }
}

@Composable
private fun RefundForm(
    state: GigRefundState,
    amount: String,
    reason: String,
    onAmount: (String) -> Unit,
    onReason: (String) -> Unit,
) {
    if (state.summary?.releasing != true) {
        OutlinedTextField(
            value = amount,
            onValueChange = onAmount,
            label = { Text("Amount in USD (blank for remaining)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth().testTag("gigRefund.amount"),
        )
        Text("Up to ${RefundValidation.money(state.summary?.remaining ?: 0)} is available to request.")
    }
    Text("Reason")
    RefundValidation.reasons.forEach { (code, label) ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = reason == code, onClick = { onReason(code) })
            TextButton(onClick = { onReason(code) }) { Text(label) }
        }
    }
}

private const val MINIMUM_REFUND_CENTS = 50

private fun validAmount(
    state: GigRefundState,
    text: String,
): Boolean =
    state.summary?.releasing == true || text.isBlank() ||
        RefundValidation.cents(text)?.let { it >= MINIMUM_REFUND_CENTS && it <= (state.summary?.remaining ?: 0) } == true
