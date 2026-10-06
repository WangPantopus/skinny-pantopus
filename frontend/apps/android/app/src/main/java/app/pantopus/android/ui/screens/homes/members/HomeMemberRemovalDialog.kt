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
import app.pantopus.android.data.homes.reviewedDateLabel
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
                Text(removalHeading(state, target.self), color = PantopusColors.appText)
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
                            if (target.self) {
                                "You'll lose access to this Home. " +
                                    "To come back later, someone in the household will need to invite you again."
                            } else {
                                "They'll lose access to this Home. You can invite them again later."
                            },
                        )
                        TextButton(
                            onClick = { confirmation = RemovalConfirmation(state.context?.decisionToken, null, state.generation) },
                            enabled = state.canSubmit && !state.working,
                            modifier = Modifier.testTag("homeMemberRemovalSubmit"),
                        ) { Text(if (target.self) "Leave Home" else "Remove member") }
                        TextButton(
                            onClick = { viewModel.resume(target) },
                            enabled = !state.working,
                        ) { Text("Refresh details") }
                    }
                    !state.working -> {
                        if (state.opened && state.error == null) {
                            Text("Nothing to finish here.")
                        }
                        TextButton(onClick = { viewModel.resume(target) }, modifier = Modifier.testTag("homeMemberRemovalReload")) {
                            Text("Reload")
                        }
                    }
                }
            }
        }
    }
    RemovalConfirmDialog(confirmation, target.self, viewModel) { confirmation = null }
}

@Composable
private fun RemovalConfirmDialog(
    confirmation: RemovalConfirmation?,
    leaving: Boolean,
    viewModel: HomeMemberRemovalViewModel,
    onDismiss: () -> Unit,
) {
    confirmation?.let { selected ->
        AlertDialog(
            onDismissRequest = { onDismiss() },
            properties = DialogProperties(securePolicy = SecureFlagPolicy.SecureOn),
            title = {
                Text(
                    when {
                        selected.requestId != null -> "Discard this attempt?"
                        leaving -> "Leave this Home?"
                        else -> "Remove this member?"
                    },
                )
            },
            text = {
                Text(
                    when {
                        selected.requestId != null -> "If it already went through, it stays. Discarding doesn't remove anyone."
                        leaving ->
                            "You'll lose access to this Home. " +
                                "To come back later, someone in the household will need to invite you again."
                        else -> "They'll lose access to this Home. You can invite them again later."
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
                    Text(
                        when {
                            selected.requestId != null -> "Discard"
                            leaving -> "Leave"
                            else -> "Remove"
                        },
                    )
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
    Text("Action: " + if (target.self) "Leave Home" else "Remove member")
    if (target.homeId != null && target.homeId != original.request.intent.homeId) {
        Text("This is for another of your Homes. Finish it before starting another removal.")
    }
    Text(original.summary, modifier = Modifier.testTag("homeMemberRemovalOriginalSummary"))
    val outcome = state.outcome
    if (outcome?.isTerminal == true) {
        Text(removalTerminalText(outcome.state, target.self), modifier = Modifier.testTag("homeMemberRemovalTerminal"))
        if (outcome.state == "rejected") Text(memberRemovalRefusalMessage(outcome.code))
        if (outcome.state == "completed") outcome.completedAt?.let { Text("Finished ${reviewedDateLabel(it)}") }
        TextButton(
            onClick = { viewModel.acknowledge(requestId, state.generation, onAcknowledged) },
            enabled = state.canAcknowledge && !state.working,
            modifier = Modifier.testTag("homeMemberRemovalAcknowledge"),
        ) { Text("Done") }
    } else {
        Text("We couldn't confirm whether this went through. Check again, or try again.")
        TextButton(
            onClick = { viewModel.recover(HomeMemberRemovalRecovery.Check, requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeMemberRemovalCheck"),
        ) { Text("Check again") }
        TextButton(
            onClick = { viewModel.recover(HomeMemberRemovalRecovery.Retry, requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeMemberRemovalRetry"),
        ) { Text("Try again") }
        TextButton(
            onClick = { onCancel(requestId) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeMemberRemovalCancel"),
        ) { Text("Discard attempt") }
    }
    // Someone who has left can no longer read that Home's member list, so there is nothing to check.
    if (!(target.self && outcome?.state == "completed")) RemovalRosterCheck(state, requestId, target.self, viewModel)
}

@Composable
private fun RemovalRosterCheck(
    state: HomeMemberRemovalUiState,
    requestId: String,
    leaving: Boolean,
    viewModel: HomeMemberRemovalViewModel,
) {
    Text(removalRosterText(state.currentRoster, leaving), modifier = Modifier.testTag("homeMemberRemovalCurrentRoster"))
    TextButton(
        onClick = { viewModel.checkCurrentRoster(requestId, state.generation) },
        enabled = !state.working,
        modifier = Modifier.testTag("homeMemberRemovalCheckCurrent"),
    ) { Text("Check member list") }
}

private fun removalTerminalText(
    outcomeState: String,
    leaving: Boolean,
): String =
    when (outcomeState) {
        "completed" -> if (leaving) "You left this Home." else "They no longer have access to this Home."
        "cancelled" -> "Nothing changed. This attempt was discarded before it took effect."
        else -> "This couldn't be completed."
    }

private fun removalRosterText(
    roster: HomeMemberRemovalCurrent,
    leaving: Boolean,
): String =
    when (roster) {
        HomeMemberRemovalCurrent.Unchecked -> "Check the member list to see who's in the household now."
        HomeMemberRemovalCurrent.Listed ->
            if (leaving) "You're still in the household's member list." else "They're still in the household's member list."
        HomeMemberRemovalCurrent.NotListed ->
            if (leaving) "You're no longer in the household's member list." else "They're no longer in the household's member list."
    }

/** What the removal sheet is about: the reviewed action, or what happened to the saved one. */
private fun removalHeading(
    state: HomeMemberRemovalUiState,
    leaving: Boolean,
): String =
    when {
        state.pending == null -> if (leaving) "Leave this Home" else "Remove member"
        state.outcome?.state == "completed" -> if (leaving) "You left this Home" else "Member removed"
        state.outcome?.state == "cancelled" -> "Attempt discarded"
        state.outcome?.state == "rejected" -> "Couldn't finish this"
        else -> "Check your last removal"
    }
