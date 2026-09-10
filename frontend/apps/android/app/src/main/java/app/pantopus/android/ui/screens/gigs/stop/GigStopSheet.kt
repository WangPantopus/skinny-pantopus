@file:Suppress("PackageNaming")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.gigs.stop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.gigs.GigStopValidation
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

@Composable
fun GigStopSheet(
    coordinator: GigStopCoordinator,
    onReschedule: (() -> Unit)? = null,
) {
    val state by coordinator.state.collectAsStateWithLifecycle()
    DisposableEffect(coordinator) { onDispose { coordinator.close() } }
    if (!state.visible) return
    ModalBottomSheet(onDismissRequest = coordinator::close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s5).testTag("gigStop.sheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Task action status", fontWeight = FontWeight.Bold)
            if (state.invalidated) {
                Text("Your session or connection changed. Reopen the task to continue.", Modifier.testTag("gigStop.invalidated"))
            } else {
                GigStopContent(state, coordinator, onReschedule)
            }
            TextButton(onClick = coordinator::close) { Text("Close") }
        }
    }
}

@Composable
private fun GigStopContent(
    state: GigStopState,
    coordinator: GigStopCoordinator,
    onReschedule: (() -> Unit)?,
) {
    state.progress?.let { Text(GigStopPresentation.message(it), Modifier.testTag("gigStop.status")) }
    val original = state.request
    val preview = state.preview
    val terms = original?.terms ?: preview?.terms
    val action = original?.action ?: preview?.action
    if (action != null) Text(GigStopPresentation.label(action))
    if (terms != null) Text("Task amount: ${GigStopPresentation.money(terms.amountCents)}")
    if (original != null && state.progress == null) {
        Text("The original request is not confirmed. Check status before starting another action.")
    }
    if (original == null && preview != null) GigStopPreviewForm(state, preview, coordinator, onReschedule)
    state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("gigStop.error")) }
    if (state.busy) Text("Checking task action…")
    TextButton(
        onClick = coordinator::checkStatus,
        enabled = !state.busy,
        modifier = Modifier.testTag("gigStop.check"),
    ) { Text("Check status") }
    if (state.canRetry && original != null && state.progress?.status != "completed") {
        TextButton(
            onClick = { coordinator.submit() },
            enabled = !state.busy,
            modifier = Modifier.testTag("gigStop.retry"),
        ) { Text("Retry original request") }
    }
}

@Composable
private fun GigStopPreviewForm(
    state: GigStopState,
    preview: app.pantopus.android.data.api.models.gigs.GigStopPreview,
    coordinator: GigStopCoordinator,
    onReschedule: (() -> Unit)?,
) {
    var reason by remember(preview.action, preview.terms) { mutableStateOf<String?>(null) }
    if (!preview.eligible) {
        Text("This action needs review before it can continue. No cancellation or fee charge has been confirmed.")
    } else {
        Text(
            when (preview.financialAction) {
                "refund" -> "This requests the remaining charge refund. The action stays pending until the refund is confirmed."
                "release" -> "This releases the verified payment hold. The action stays pending until the release is confirmed."
                else -> "The verified preview requires no payment operation. Confirm to finish this task action."
            },
        )
        Text("Reason (optional)")
        GigStopValidation.reasons.forEach { option ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = reason == option, onClick = { reason = option }, enabled = state.maySubmit)
                Text(option.replace('_', ' '))
            }
        }
        TextButton(
            onClick = { coordinator.submit(reason) },
            enabled = state.maySubmit,
            modifier = Modifier.testTag("gigStop.confirm"),
        ) { Text("Confirm ${GigStopPresentation.label(preview.action).lowercase()}") }
    }
    if (preview.action == "cancel" && onReschedule != null && !state.busy) {
        TextButton(onClick = {
            coordinator.close()
            onReschedule()
        }) { Text("Reschedule instead") }
    }
}
