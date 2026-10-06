@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.token_accept

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.data.homes.HomeInvitationRecoveryAction
import app.pantopus.android.data.homes.PendingHomeInvitationDecision
import app.pantopus.android.data.homes.invitationRefusalMessage
import app.pantopus.android.data.homes.reviewedDateLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.Instant

private data class InvitationConfirmation(val action: String?, val review: String, val requestId: String, val generation: Long)

@Composable
fun HomeInvitationDecisionScreen(
    onDismiss: () -> Unit,
    onReopen: () -> Unit,
    viewModel: HomeInvitationDecisionViewModel = hiltViewModel(),
) {
    SecureScreenEffect()
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmation by remember { mutableStateOf<InvitationConfirmation?>(null) }
    var accountSwitch by remember { mutableStateOf<Long?>(null) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(Unit) { viewModel.resume() }
    DisposableEffect(viewModel, lifecycle) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_STOP) {
                    viewModel.pause()
                } else if (event == Lifecycle.Event.ON_RESUME) {
                    viewModel.resume()
                }
            }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            viewModel.pause()
        }
    }
    LaunchedEffect(state.generation) {
        confirmation = null
        accountSwitch = null
    }
    LaunchedEffect(state.context?.decisionToken) {
        state.context?.expiresAt?.let {
            delay((Instant.parse(it).toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(0L))
            confirmation = null
            viewModel.resume()
        }
    }

    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s5).testTag("homeInvitationDecision"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        val title = invitationHeading(state)
        Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold, modifier = Modifier.testTag("homeInvitationHeading"))
        Text(
            "Signed in as ${state.accountLabel}",
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("homeInvitationAccount"),
        )
        state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("homeInvitationError")) }
        state.context?.let { context ->
            Text(context.homeLabel, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.testTag("homeInvitationHome"))
            if (context.city.isNotBlank()) Text(context.city, color = PantopusColors.appTextSecondary)
            Text("Invited by ${context.inviter}")
            Text("Offered role: ${TokenAcceptViewModel.humanRole(context.role)}")
            Text(
                "Household permissions and access dates still apply. " +
                    "This invitation gives you household access. " +
                    "To send neighbor messages or get a residency letter, verify the address yourself.",
            )
            context.accessStart?.let { Text("Access starts: ${reviewedDateLabel(it)}") }
            context.accessEnd?.let { Text("Access ends: ${reviewedDateLabel(it)}") }
            context.expiresAt?.let { Text("Invitation expires: ${reviewedDateLabel(it)}") }
            InvitationButton("Accept invitation", "homeInvitationAccept", state.canDecide) {
                confirmation = InvitationConfirmation("accept", context.decisionToken, "", state.generation)
            }
            InvitationButton("Decline invitation", "homeInvitationDecline", state.canDecide) {
                confirmation = InvitationConfirmation("decline", context.decisionToken, "", state.generation)
            }
        }
        state.pending?.let { draft ->
            RecoveryContent(state, draft, viewModel, onDismiss, onReopen) {
                confirmation = InvitationConfirmation(null, "", draft.request.requestId, state.generation)
            }
        }
        if (state.working) CircularProgressIndicator(Modifier.testTag("homeInvitationLoading"))
        if (state.error != null || state.pending == null && state.context == null) {
            InvitationButton("Reload", "homeInvitationReopen", !state.working, onReopen)
        }
        InvitationButton("Use another account", "homeInvitationSwitchAccount", !state.working) { accountSwitch = state.generation }
        InvitationButton("Close", "homeInvitationClose", true, onDismiss)
    }

    confirmation?.let { selected ->
        InvitationDecisionDialog(selected, state, viewModel) { confirmation = null }
    }
    accountSwitch?.let { selected ->
        InvitationAccountDialog(selected, viewModel) { accountSwitch = null }
    }
}

private fun invitationHeading(state: HomeInvitationDecisionUiState): String =
    when (state.outcome?.state) {
        "completed" -> if (state.pending?.request?.action == "accept") "Invitation accepted" else "Invitation declined"
        "cancelled" -> "Attempt discarded"
        "rejected" -> "Couldn't finish this"
        else ->
            if (state.pending != null) {
                "Check your answer"
            } else if (state.context != null) {
                "You're invited"
            } else {
                "Invitation status"
            }
    }

private fun invitationConfirmationText(
    action: String?,
    account: String,
    homeLabel: String?,
): String {
    val home = homeLabel?.takeIf(String::isNotBlank) ?: "this Home"
    return when (action) {
        null -> "If your answer already went through, it stays. Discarding doesn't decline the invitation."
        "decline" -> "$account won't join the household at $home. The sender can invite you again later."
        else -> "$account will join the household at $home. What you can open depends on your role and the invitation's dates."
    }
}

@Composable
private fun InvitationDecisionDialog(
    selected: InvitationConfirmation,
    state: HomeInvitationDecisionUiState,
    viewModel: HomeInvitationDecisionViewModel,
    dismiss: () -> Unit,
) {
    val title =
        when (selected.action) {
            "accept" -> "Accept this invitation?"
            "decline" -> "Decline this invitation?"
            else -> "Discard this attempt?"
        }
    AlertDialog(
        onDismissRequest = { dismiss() },
        title = { Text(title) },
        text = {
            Text(
                invitationConfirmationText(selected.action, state.accountLabel, state.context?.homeLabel),
            )
        },
        confirmButton = {
            TextButton(
                modifier =
                    Modifier.testTag(
                        if (selected.action == null) "homeInvitationConfirmCancel" else "homeInvitationConfirmDecision",
                    ),
                onClick = {
                    dismiss()
                    if (selected.action == null) {
                        viewModel.recover(HomeInvitationRecoveryAction.Cancel, selected.requestId, selected.generation)
                    } else {
                        viewModel.decide(selected.action, selected.review, selected.generation)
                    }
                },
            ) {
                Text(
                    when (selected.action) {
                        "accept" -> "Accept"
                        "decline" -> "Decline"
                        else -> "Discard"
                    },
                )
            }
        },
        dismissButton = { TextButton(onClick = { dismiss() }) { Text("Keep reviewing") } },
    )
}

@Composable
private fun InvitationAccountDialog(
    selected: Long,
    viewModel: HomeInvitationDecisionViewModel,
    dismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { dismiss() },
        title = { Text("Use another account?") },
        text = { Text("You'll be signed out. Any answer you already gave stays with this account.") },
        confirmButton = {
            TextButton(modifier = Modifier.testTag("homeInvitationConfirmSwitchAccount"), onClick = {
                dismiss()
                viewModel.switchAccount(selected)
            }) { Text("Sign out and continue") }
        },
        dismissButton = { TextButton(onClick = { dismiss() }) { Text("Keep this account") } },
    )
}

@Composable
private fun RecoveryContent(
    state: HomeInvitationDecisionUiState,
    draft: PendingHomeInvitationDecision,
    viewModel: HomeInvitationDecisionViewModel,
    onDismiss: () -> Unit,
    onReopen: () -> Unit,
    cancel: () -> Unit,
) {
    Text(draft.homeLabel, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.testTag("homeInvitationOriginalHome"))
    Text("Your answer: ${if (draft.request.action == "accept") "Accept" else "Decline"}")
    if (draft.request.token != state.token) {
        Text("This is an earlier invitation. Finish it before answering the one you just opened.")
    }
    val explanation =
        when (state.outcome?.state) {
            "completed" ->
                if (draft.request.action == "accept") {
                    "You're part of this household now. What you can open depends on your role and the invitation's dates."
                } else {
                    "You won't join this household. If it was shared as an open link, other people with the link can still use it."
                }
            "cancelled" -> "Nothing changed. This attempt was discarded before it took effect."
            "rejected" -> invitationRefusalMessage(state.outcome.code)
            else ->
                "We couldn't confirm your answer. It's saved on this device, so you can check again or try again without answering twice."
        }
    Text(explanation, modifier = Modifier.testTag("homeInvitationExplanation"))
    if (state.outcome?.isTerminal == true) {
        if (state.outcome.state == "completed" && draft.request.action == "accept") {
            CurrentAccessContent(state, draft, viewModel, onDismiss)
        }
        InvitationButton(
            if (state.outcome.state == "completed") "Done" else "Review invitation again",
            "homeInvitationAcknowledge",
            state.canAcknowledge,
        ) {
            viewModel.acknowledge(draft.request.requestId, false) { original ->
                if (state.outcome.state == "completed" && original.request.token == state.token) onDismiss() else onReopen()
            }
        }
    } else {
        InvitationButton("Check again", "homeInvitationCheck", !state.working) {
            viewModel.recover(HomeInvitationRecoveryAction.Check, draft.request.requestId, state.generation)
        }
        InvitationButton("Try again", "homeInvitationRetry", !state.working) {
            viewModel.recover(HomeInvitationRecoveryAction.Retry, draft.request.requestId, state.generation)
        }
        InvitationButton("Discard attempt", "homeInvitationCancel", !state.working, cancel)
    }
}

@Composable
private fun CurrentAccessContent(
    state: HomeInvitationDecisionUiState,
    draft: PendingHomeInvitationDecision,
    viewModel: HomeInvitationDecisionViewModel,
    onDismiss: () -> Unit,
) {
    val openHome = {
        viewModel.acknowledge(draft.request.requestId, true) { original ->
            onDismiss()
            DeepLinkRouter.handle("/homes/${original.request.homeId}/dashboard")
        }
    }
    InvitationButton("Check Home access", "homeInvitationAccess", !state.working, viewModel::checkAccess)
    state.access?.let { access ->
        Text(
            if (access.currentAccess == "shared") {
                "You can open this Home now."
            } else {
                "You can't open this Home yet. My Homes shows what's next."
            },
            modifier = Modifier.testTag("homeInvitationCurrentAccess"),
        )
        if (access.currentAccess == "shared") {
            InvitationButton("Open Home", "homeInvitationOpenHome", state.canAcknowledge, openHome)
        }
    }
}

@Composable
private fun InvitationButton(
    title: String,
    tag: String,
    enabled: Boolean,
    action: () -> Unit,
) {
    TextButton(onClick = action, enabled = enabled, modifier = Modifier.heightIn(min = 48.dp).testTag(tag)) { Text(title) }
}
