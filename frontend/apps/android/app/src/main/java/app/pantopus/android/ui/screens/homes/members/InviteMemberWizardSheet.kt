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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.data.homes.HomeInvitationSenderOutcome
import app.pantopus.android.data.homes.HomeInvitationSenderRecovery
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

const val INVITE_MEMBER_WIZARD_TAG = "inviteMemberWizard"

private data class SenderConfirmation(val review: String?, val requestId: String?, val generation: Long)

/** Prepared create/resend/withdraw and protected recovery share one lifecycle-owned surface. */
@Composable
fun InviteMemberWizardSheet(
    target: HomeInvitationSenderTarget,
    onClose: () -> Unit,
    onAcknowledged: () -> Unit,
    viewModel: HomeInvitationSenderViewModel = hiltViewModel(),
) {
    SecureScreenEffect()
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmation by remember { mutableStateOf<SenderConfirmation?>(null) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(target) { viewModel.resume(target) }
    LaunchedEffect(state.generation) { confirmation = null }
    DisposableEffect(viewModel, lifecycle, target) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_STOP) viewModel.pause()
                if (event == Lifecycle.Event.ON_RESUME) viewModel.resume(target)
            }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            viewModel.pause()
        }
    }
    SenderSheetContent(state, target, viewModel, onClose, onAcknowledged) { confirmation = it }
    SenderConfirmDialog(confirmation, state.context?.intent?.action, viewModel) { confirmation = null }
}

@Composable
private fun SenderSheetContent(
    state: HomeInvitationSenderUiState,
    target: HomeInvitationSenderTarget,
    viewModel: HomeInvitationSenderViewModel,
    onClose: () -> Unit,
    onAcknowledged: () -> Unit,
    onConfirmation: (SenderConfirmation) -> Unit,
) {
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnClickOutside = false),
    ) {
        Surface(color = PantopusColors.appBg) {
            Column(
                modifier =
                    Modifier.fillMaxSize().verticalScroll(
                        rememberScrollState(),
                    ).padding(Spacing.s4).testTag(INVITE_MEMBER_WIZARD_TAG),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                TextButton(onClick = onClose, modifier = Modifier.testTag("homeSenderClose")) { Text("Close") }
                Text(senderHeading(state, target), color = PantopusColors.appText)
                Text(state.accountLabel, color = PantopusColors.appTextSecondary)
                if (state.working) CircularProgressIndicator()
                state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("homeSenderError")) }
                when {
                    state.pending != null ->
                        SenderOriginal(
                            state,
                            checkNotNull(state.pending),
                            target.homeId,
                            viewModel,
                            onCancel = { onConfirmation(SenderConfirmation(null, it, state.generation)) },
                            onAcknowledged = onAcknowledged,
                        )
                    state.context != null ->
                        SenderPrepared(
                            state,
                            checkNotNull(state.context),
                            onConfirm = { onConfirmation(SenderConfirmation(it, null, state.generation)) },
                            onEdit = { if (target.action == "create") viewModel.edit() else viewModel.resume(target) },
                        )
                    state.canPrepare && target.action == "create" -> SenderCreateForm(state, target, viewModel)
                    !state.working ->
                        TextButton(onClick = { viewModel.resume(target) }, modifier = Modifier.testTag("homeSenderReload")) {
                            Text("Reload")
                        }
                }
            }
        }
    }
}

@Composable
private fun SenderConfirmDialog(
    selected: SenderConfirmation?,
    action: String?,
    viewModel: HomeInvitationSenderViewModel,
    onDismiss: () -> Unit,
) {
    selected?.let { selected ->
        AlertDialog(
            onDismissRequest = { onDismiss() },
            title = { Text(if (selected.requestId == null) senderConfirmationTitle(action) else "Discard this attempt?") },
            text = {
                Text(
                    if (selected.requestId == null) {
                        senderConfirmationText(action)
                    } else {
                        "If it already went through, it stays. Discarding doesn't withdraw an invitation or remove anyone."
                    },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDismiss()
                        if (selected.requestId == null) {
                            viewModel.submit(checkNotNull(selected.review), selected.generation)
                        } else {
                            viewModel.recover(HomeInvitationSenderRecovery.Cancel, selected.requestId, selected.generation)
                        }
                    },
                    modifier = Modifier.testTag("homeSenderConfirm"),
                ) { Text(if (selected.requestId == null) senderConfirmLabel(action) else "Discard") }
            },
            dismissButton = { TextButton(onClick = { onDismiss() }) { Text(if (selected.requestId == null) "Keep reviewing" else "Keep it") } },
        )
    }
}

private fun senderHeading(
    state: HomeInvitationSenderUiState,
    target: HomeInvitationSenderTarget,
): String =
    when {
        state.pending != null -> senderResultHeading(checkNotNull(state.pending).request.intent.action, state.outcome)
        target.action == "withdraw" -> "Withdraw invitation"
        target.action == "resend" -> "Resend invitation"
        else -> "Invite household member"
    }

internal fun senderConfirmationText(action: String?): String =
    when (action) {
        "withdraw" -> "They won't be able to accept it anymore. Anyone already in the household stays."
        "resend" -> "We'll send the same invitation again. Links already sent keep working, and the expiry date doesn't change."
        else -> "We'll send them the invitation. They join the household only if they accept."
    }

internal fun senderConfirmationTitle(action: String?): String =
    when (action) {
        "withdraw" -> "Withdraw this invitation?"
        "resend" -> "Resend this invitation?"
        else -> "Send this invitation?"
    }

internal fun senderConfirmLabel(action: String?): String =
    when (action) {
        "withdraw" -> "Withdraw"
        "resend" -> "Resend"
        else -> "Send"
    }

/** The heading over a saved invitation action: what happened, never a delivery claim. */
internal fun senderResultHeading(
    action: String,
    outcome: HomeInvitationSenderOutcome?,
): String =
    when (outcome?.state) {
        "completed" ->
            when (action) {
                "withdraw" -> "Invitation withdrawn"
                "resend" -> "Resend requested"
                else -> "Invitation created"
            }
        "cancelled" -> "Attempt discarded"
        "rejected" -> "Couldn't finish this"
        else -> "Check your last invitation"
    }
