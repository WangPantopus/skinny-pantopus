package app.pantopus.android.ui.screens.homes.members

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.data.homes.HomeMemberRemovalCurrent
import app.pantopus.android.data.homes.HomeMemberRemovalRecovery
import app.pantopus.android.data.homes.memberRemovalRefusalMessage
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskResumeEffect
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

private data class RemovalConfirmation(val review: String?, val requestId: String?, val generation: Long)

@Composable
fun HomeMemberRemovalDialog(
    target: HomeMemberRemovalTarget,
    onClose: () -> Unit,
    onAcknowledged: () -> Unit,
    viewModel: HomeMemberRemovalViewModel = hiltViewModel(),
) {
    SecureScreenEffect()
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmation by remember { mutableStateOf<RemovalConfirmation?>(null) }
    HomeTaskResumeEffect({ viewModel.resume(target) }) {
        confirmation = null
        viewModel.pause()
    }
    DisposableEffect(viewModel, target) { onDispose { viewModel.pause() } }
    LaunchedEffect(state.generation) { confirmation = null }
    Dialog(
        onDismissRequest = onClose,
        properties =
            DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnClickOutside = false,
                securePolicy = SecureFlagPolicy.SecureOn,
            ),
    ) {
        Surface(color = PantopusColors.appBg) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4).testTag("homeMemberRemoval"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                TextButton(onClick = onClose, modifier = Modifier.testTag("homeMemberRemovalClose")) { Text("Close") }
                Text(
                    if (state.pending != null) {
                        "Saved member removal"
                    } else if (target.self) {
                        "Review leaving this Home"
                    } else {
                        "Review member removal"
                    },
                    color = PantopusColors.appText,
                )
                Text(state.accountLabel, color = PantopusColors.appTextSecondary)
                if (state.working) CircularProgressIndicator()
                state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("homeMemberRemovalError")) }
                when {
                    state.pending != null ->
                        RemovalOriginal(state, target, viewModel, onAcknowledged) {
                            confirmation = RemovalConfirmation(null, it, state.generation)
                        }
                    state.context != null -> {
                        Text(checkNotNull(state.context).summary, modifier = Modifier.testTag("homeMemberRemovalPreparedSummary"))
                        Text(
                            "End this member’s current household access. Their historical residency decisions remain saved. " +
                                "Ownership rules are checked again before removal.",
                        )
                        TextButton(
                            onClick = { confirmation = RemovalConfirmation(state.context?.decisionToken, null, state.generation) },
                            enabled = state.canSubmit && !state.working,
                            modifier = Modifier.testTag("homeMemberRemovalSubmit"),
                        ) { Text(if (target.self) "Leave reviewed Home" else "Remove reviewed member") }
                        TextButton(
                            onClick = { viewModel.resume(target) },
                            enabled = !state.working,
                        ) { Text("Review current details again") }
                    }
                    !state.working -> {
                        if (state.opened && state.error == null) {
                            Text(
                                "No member removal needs recovery on this device. Choose a current member to review a removal.",
                            )
                        }
                        TextButton(onClick = { viewModel.resume(target) }, modifier = Modifier.testTag("homeMemberRemovalReload")) {
                            Text("Check removal recovery")
                        }
                    }
                }
            }
        }
    }
    RemovalConfirmDialog(confirmation, viewModel) { confirmation = null }
}

@Composable
private fun RemovalConfirmDialog(
    confirmation: RemovalConfirmation?,
    viewModel: HomeMemberRemovalViewModel,
    onDismiss: () -> Unit,
) {
    confirmation?.let { selected ->
        AlertDialog(
            onDismissRequest = { onDismiss() },
            properties = DialogProperties(securePolicy = SecureFlagPolicy.SecureOn),
            title = { Text(if (selected.requestId == null) "Confirm reviewed removal?" else "Cancel original removal attempt?") },
            text = {
                Text(
                    if (selected.requestId == null) {
                        "Submit exactly the member and household details you reviewed. If the reply is lost, " +
                            "recover this saved original before starting another removal."
                    } else {
                        "This cancels an unseen original attempt. If removal already completed, its saved result wins. " +
                            "Cancellation does not restore membership."
                    },
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    onDismiss()
                    if (selected.requestId == null) {
                        viewModel.submit(checkNotNull(selected.review), selected.generation)
                    } else {
                        viewModel.recover(HomeMemberRemovalRecovery.Cancel, selected.requestId, selected.generation)
                    }
                }, modifier = Modifier.testTag("homeMemberRemovalConfirm")) {
                    Text(if (selected.requestId == null) "Confirm removal" else "Cancel original attempt")
                }
            },
            dismissButton = { TextButton(onClick = { onDismiss() }) { Text("Keep reviewing") } },
        )
    }
}

@Composable
private fun RemovalOriginal(
    state: HomeMemberRemovalUiState,
    target: HomeMemberRemovalTarget,
    viewModel: HomeMemberRemovalViewModel,
    onAcknowledged: () -> Unit,
    onCancel: (String) -> Unit,
) {
    val original = checkNotNull(state.pending)
    val requestId = original.request.requestId
    Text("Saved original action: Remove member")
    if (target.homeId != null && target.homeId != original.request.intent.homeId) {
        Text("This saved original belongs to another Home. Review its saved details before continuing.")
    }
    Text(original.summary, modifier = Modifier.testTag("homeMemberRemovalOriginalSummary"))
    Text("Finish this saved original before starting another removal.")
    val outcome = state.outcome
    if (outcome?.isTerminal == true) {
        Text(
            when (outcome.state) {
                "completed" -> "Removal saved"
                "cancelled" -> "Original attempt cancelled"
                else -> "Removal not completed"
            },
            modifier = Modifier.testTag("homeMemberRemovalTerminal"),
        )
        if (outcome.state == "rejected") Text(memberRemovalRefusalMessage(outcome.code))
        if (outcome.state == "completed") Text("Original removal completed: ${outcome.completedAt}")
        if (outcome.state == "cancelled") Text("This result did not restore membership or undo a completed removal.")
        Text("This is the historical result of the saved original. Current membership is checked separately.")
        TextButton(
            onClick = { viewModel.acknowledge(requestId, state.generation, onAcknowledged) },
            enabled = state.canAcknowledge && !state.working,
            modifier = Modifier.testTag("homeMemberRemovalAcknowledge"),
        ) { Text("Acknowledge removal result") }
    } else {
        Text("The original result is not confirmed. Keep it until the server proves its outcome.")
        TextButton(
            onClick = { viewModel.recover(HomeMemberRemovalRecovery.Check, requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeMemberRemovalCheck"),
        ) { Text("Check original removal result") }
        TextButton(
            onClick = { viewModel.recover(HomeMemberRemovalRecovery.Retry, requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeMemberRemovalRetry"),
        ) { Text("Retry original removal") }
        TextButton(
            onClick = { onCancel(requestId) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeMemberRemovalCancel"),
        ) { Text("Cancel original removal attempt") }
    }
    Text(
        when (state.currentRoster) {
            HomeMemberRemovalCurrent.Unchecked -> "Current household roster has not been confirmed in this view."
            HomeMemberRemovalCurrent.Listed ->
                "This account is listed in the current household roster. The historical removal result stays unchanged."
            HomeMemberRemovalCurrent.NotListed ->
                "This account is not listed in the current household roster. Historical residency records and other access are separate."
        },
        modifier = Modifier.testTag("homeMemberRemovalCurrentRoster"),
    )
    TextButton(
        onClick = { viewModel.checkCurrentRoster(requestId, state.generation) },
        enabled = !state.working,
        modifier = Modifier.testTag("homeMemberRemovalCheckCurrent"),
    ) { Text("Check current household roster") }
}
