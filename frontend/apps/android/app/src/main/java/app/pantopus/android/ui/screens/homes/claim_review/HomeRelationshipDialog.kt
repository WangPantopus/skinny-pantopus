@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homes.HomeRelationshipAction
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskResumeEffect
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

private const val RELATIONSHIP_DIALOG_HEIGHT = 0.94f

@Composable
fun HomeRelationshipDialog(
    controller: HomeRelationshipController,
    onClosed: () -> Unit,
) {
    val state by controller.state.collectAsStateWithLifecycle()
    HomeTaskResumeEffect(controller::resume, controller::pause)
    DisposableEffect(controller) { onDispose { controller.close() } }
    Dialog(
        onDismissRequest = onClosed,
        properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn),
    ) {
        Surface(
            Modifier.fillMaxWidth().fillMaxHeight(RELATIONSHIP_DIALOG_HEIGHT).testTag("homeRelationship"),
            color = PantopusColors.appSurface,
        ) {
            Column(Modifier.padding(Spacing.s4).imePadding(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Household response", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = onClosed, modifier = Modifier.testTag("homeRelationship.close")) { Text("Close") }
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    if (!state.active || state.retired) {
                        Text(state.error ?: "Claim content is hidden.")
                    } else {
                        if (state.busy) CircularProgressIndicator()
                        state.error?.let { Text(it, Modifier.testTag("homeRelationship.error"), color = PantopusColors.error) }
                        HomeRelationshipContent(state, controller)
                        TextButton(
                            onClick = controller::reload,
                            enabled = !state.busy,
                            modifier = Modifier.testTag("homeRelationship.reload"),
                        ) {
                            Text("Reload current claim")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeRelationshipContent(
    state: HomeRelationshipUiState,
    controller: HomeRelationshipController,
) {
    val claim = state.review?.claim
    if (claim == null) {
        if (state.empty) {
            Text(
                "No saved relationship decision on this device. Choose a claim from the review queue to begin.",
                Modifier.testTag("homeRelationship.empty"),
            )
        }
        return
    }
    Text("Current claim", style = MaterialTheme.typography.titleSmall)
    Text(
        "${claim.claimType.replace('_', ' ')} claim · ${(claim.claimPhase ?: claim.state).replace('_', ' ')}",
        Modifier.testTag("homeRelationship.current"),
    )
    Text(
        "${claim.evidence.count { it.eligibleForReview }} of ${claim.evidence.size} evidence items eligible for review.",
        Modifier.testTag("homeRelationship.evidence"),
    )
    claim.evidence.forEach {
        Text("${it.evidenceType.replace('_', ' ')} · ${if (it.eligibleForReview) "Eligible for review" else "Not yet eligible for review"}")
    }
    Text("A filename or pending document does not establish ownership or a qualifying dispute.")
    if (state.pending != null) {
        HomeRelationshipRecovery(state, controller)
    } else if (state.canEdit || state.busy) {
        HomeRelationshipInputs(state, controller)
    } else {
        Text("This claim is no longer available for a household response. Use its current review or dispute process.")
    }
}

@Composable
private fun HomeRelationshipInputs(
    state: HomeRelationshipUiState,
    controller: HomeRelationshipController,
) {
    val focus = LocalFocusManager.current
    var choosing by remember { mutableStateOf(false) }
    Text("Review your response", style = MaterialTheme.typography.titleSmall)
    Column {
        TextButton(onClick = { choosing = true }, enabled = state.canEdit, modifier = Modifier.testTag("homeRelationship.action")) {
            Text("Response: ${state.action.title}")
        }
        DropdownMenu(expanded = choosing, onDismissRequest = { choosing = false }) {
            HomeRelationshipAction.entries.forEach { action ->
                DropdownMenuItem(text = { Text(action.title) }, onClick = {
                    controller.editAction(action)
                    choosing = false
                })
            }
        }
    }
    Text(state.action.explanation)
    OutlinedTextField(
        value = state.note,
        onValueChange = controller::editNote,
        enabled = state.canEdit,
        label = { Text("Optional private note") },
        minLines = 3,
        modifier = Modifier.fillMaxWidth().testTag("homeRelationship.note"),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
    )
    Text("${state.note.length}/1000")
    Row {
        Checkbox(
            checked = state.reviewed,
            onCheckedChange = controller::review,
            enabled = state.canEdit,
            modifier =
                Modifier.testTag("homeRelationship.reviewed").semantics {
                    contentDescription = "I reviewed the current claim, evidence eligibility and this response."
                },
        )
        Text("I reviewed the current claim, evidence eligibility and this response.", Modifier.weight(1f))
    }
    TextButton(onClick = {
        focus.clearFocus()
        controller.submit()
    }, enabled = state.canSubmit, modifier = Modifier.testTag("homeRelationship.submit")) {
        Text(state.action.title)
    }
}

@Composable
private fun HomeRelationshipRecovery(
    state: HomeRelationshipUiState,
    controller: HomeRelationshipController,
) {
    val pending = state.pending ?: return
    val receipt = pending.confirmed
    Text(if (receipt == null) "Decision needs confirmation" else "Original decision confirmed", style = MaterialTheme.typography.titleSmall)
    if (state.recoveringAnotherClaim) {
        Text(
            "Finish this saved decision before reviewing another claim.",
            Modifier.testTag("homeRelationship.otherClaim"),
        )
    }
    Text(pending.command.action.title, Modifier.testTag("homeRelationship.savedAction"))
    if (pending.command.note.isNotEmpty()) Text(pending.command.note, Modifier.testTag("homeRelationship.savedNote"))
    if (receipt == null) {
        Text("Your original response is saved on this device. Retry to confirm its outcome without recording a second decision.")
        TextButton(onClick = controller::retry, enabled = !state.busy, modifier = Modifier.testTag("homeRelationship.retry")) {
            Text("Retry original decision")
        }
    } else {
        Text(
            "Recorded outcome: ${(receipt.result.claimPhase ?: receipt.result.state).replace('_', ' ')}",
            Modifier.testTag("homeRelationship.receipt"),
        )
        if (receipt.action == HomeRelationshipAction.Flag) {
            Text(
                if (receipt.result.qualifiesForDispute) {
                    "Qualified for dispute review."
                } else {
                    "Sent for admin review. This response did not establish a qualifying dispute."
                },
                Modifier.testTag("homeRelationship.routing"),
            )
        }
        Text("This receipt records your original response. The current claim above may have changed since then.")
    }
    if (receipt != null || state.canDismiss) {
        TextButton(onClick = controller::acknowledge, enabled = !state.busy, modifier = Modifier.testTag("homeRelationship.acknowledge")) {
            Text(if (receipt != null) "I reviewed this confirmation" else "Review current claim again")
        }
    }
}
