package app.pantopus.android.ui.screens.homes.members

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.homes.HomeInvitationSenderContext
import app.pantopus.android.data.homes.HomeInvitationSenderIntent
import app.pantopus.android.data.homes.HomeInvitationSenderOutcome
import app.pantopus.android.data.homes.HomeInvitationSenderRecovery
import app.pantopus.android.data.homes.PendingHomeInvitationSender
import app.pantopus.android.data.homes.homeInvitationSenderLink
import app.pantopus.android.data.homes.senderRefusalMessage
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

@Composable
internal fun SenderCreateForm(
    state: HomeInvitationSenderUiState,
    target: HomeInvitationSenderTarget,
    viewModel: HomeInvitationSenderViewModel,
) {
    val form = state.form
    val recipient = form.recipient
    val message = form.message
    val username = form.username
    val role = form.role
    Text(
        "An invitation gives someone household access for the role you choose. It doesn't verify that they live here or own the Home.",
        color = PantopusColors.appTextSecondary,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        FilterChip(
            selected = role == "member",
            onClick = { viewModel.setForm(form.copy(role = "member")) },
            enabled = !state.working,
            label = { Text("Member") },
            modifier = Modifier.testTag("inviteMember_role_member"),
        )
        FilterChip(
            selected = role == "guest",
            onClick = { viewModel.setForm(form.copy(role = "guest")) },
            enabled = !state.working,
            label = { Text("Guest") },
            modifier = Modifier.testTag("inviteMember_role_guest"),
        )
    }
    Text(
        "Members can see and help with household tasks. Guests get limited, view-only access. " +
            "For a short visit, send a guest pass from the Guests tab instead.",
        color = PantopusColors.appTextSecondary,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        FilterChip(
            selected = !username,
            onClick = { viewModel.setForm(form.copy(username = false, recipient = "")) },
            enabled = !state.working,
            label = { Text("Email") },
        )
        FilterChip(
            selected = username,
            onClick = { viewModel.setForm(form.copy(username = true, recipient = "")) },
            enabled = !state.working,
            label = { Text("Username") },
        )
    }
    PantopusTextField(
        label = if (username) "Username" else "Email",
        value = recipient,
        onValueChange = { viewModel.setForm(form.copy(recipient = it)) },
        fieldTestTag = "inviteMember_email",
    )
    PantopusTextField(
        label = "Personal note (optional)",
        value = message,
        onValueChange = { viewModel.setForm(form.copy(message = it)) },
        fieldTestTag = "inviteMember_message",
    )
    TextButton(onClick = {
        viewModel.prepare(
            HomeInvitationSenderIntent(
                target.homeId,
                "create",
                payload =
                    linkedMapOf(
                        (if (username) "username" else "email") to recipient.trim().let { if (username) it.removePrefix("@") else it },
                        "relationship" to role,
                        "message" to message.trim().ifEmpty { null },
                    ),
            ),
            state.generation,
        )
    }, enabled = !state.working && senderRecipientValid(recipient, username), modifier = Modifier.testTag("homeSenderPrepare")) {
        Text("Review invitation")
    }
}

internal fun senderRecipientValid(
    recipient: String,
    username: Boolean,
): Boolean {
    val trimmed = recipient.trim()
    if (trimmed.isEmpty() || trimmed.length > MAX_RECIPIENT_LENGTH) return false
    return if (username) {
        trimmed.removePrefix("@").matches(Regex("^[A-Za-z0-9_.-]+$"))
    } else {
        trimmed.split("@").let { it.size == 2 && it[0].isNotBlank() && it[1].contains(".") }
    }
}

@Composable
internal fun SenderPrepared(
    state: HomeInvitationSenderUiState,
    prepared: HomeInvitationSenderContext,
    onConfirm: (String) -> Unit,
    onEdit: () -> Unit,
) {
    Text("Check the details", color = PantopusColors.appText)
    Text(prepared.summary, color = PantopusColors.appText, modifier = Modifier.testTag("homeSenderPreparedSummary"))
    Text(senderConfirmationText(prepared.intent.action), color = PantopusColors.appTextSecondary)
    TextButton(
        onClick = { onConfirm(prepared.decisionToken) },
        enabled = state.canSubmit,
        modifier = Modifier.testTag("homeSenderSubmit"),
    ) {
        Text(
            when (prepared.intent.action) {
                "withdraw" -> "Withdraw invitation"
                "resend" -> "Resend invitation"
                else -> "Send invitation"
            },
        )
    }
    TextButton(onClick = onEdit, enabled = !state.working, modifier = Modifier.testTag("homeSenderEdit")) {
        Text(if (prepared.intent.action == "create") "Edit invitation" else "Review current details again")
    }
}

@Composable
internal fun SenderOriginal(
    state: HomeInvitationSenderUiState,
    original: PendingHomeInvitationSender,
    currentHomeId: String,
    viewModel: HomeInvitationSenderViewModel,
    onCancel: (String) -> Unit,
    onAcknowledged: () -> Unit,
) {
    Text(senderOriginalActionText(original), color = PantopusColors.appText)
    if (original.request.intent.homeId != currentHomeId) {
        Text(
            "This is for another of your Homes. Finish it before inviting someone here.",
            color = PantopusColors.appTextSecondary,
        )
    }
    Text(original.summary, color = PantopusColors.appText, modifier = Modifier.testTag("homeSenderOriginalSummary"))
    val outcome = state.outcome
    if (outcome?.isTerminal == true) {
        SenderTerminal(original, outcome, state, viewModel)
        TextButton(
            onClick = { viewModel.acknowledge(original.request.requestId, onAcknowledged) },
            enabled = state.canAcknowledge,
            modifier = Modifier.testTag("homeSenderAcknowledge"),
        ) { Text("Done") }
    } else {
        Text(
            "We couldn't confirm whether this went through. Check again, or try again. Trying again won't send a second email.",
            color = PantopusColors.appText,
        )
        TextButton(
            onClick = { viewModel.recover(HomeInvitationSenderRecovery.Check, original.request.requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderCheck"),
        ) { Text("Check again") }
        TextButton(
            onClick = { viewModel.recover(HomeInvitationSenderRecovery.Retry, original.request.requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderRetry"),
        ) { Text("Try again") }
        TextButton(
            onClick = { onCancel(original.request.requestId) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderCancelAttempt"),
        ) { Text("Discard attempt") }
    }
}

internal fun senderOriginalActionText(original: PendingHomeInvitationSender): String =
    "Action: " +
        when (original.request.intent.action) {
            "withdraw" -> "Withdraw invitation"
            "resend" -> "Resend invitation"
            else -> "Send invitation"
        }

@Composable
private fun SenderTerminal(
    original: PendingHomeInvitationSender,
    outcome: HomeInvitationSenderOutcome,
    state: HomeInvitationSenderUiState,
    viewModel: HomeInvitationSenderViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("homeSenderTerminal")) {
        Text(senderOutcomeText(original.request.intent.action, outcome), color = PantopusColors.appText)
        if (outcome.state == "completed" && original.request.intent.action != "withdraw") {
            Text(senderDeliveryText(outcome), color = PantopusColors.appTextSecondary, modifier = Modifier.testTag("homeSenderDelivery"))
            SenderSharing(original, state, viewModel)
        }
    }
}

@Composable
private fun SenderSharing(
    original: PendingHomeInvitationSender,
    state: HomeInvitationSenderUiState,
    viewModel: HomeInvitationSenderViewModel,
) {
    val context = LocalContext.current
    val configuredLink = homeInvitationSenderLink(original, BuildConfig.PANTOPUS_WEB_BASE_URL, completed = true)
    var nowMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(state.sharingUntilMillis) {
        nowMillis = System.currentTimeMillis()
        val remaining = state.sharingUntilMillis?.minus(nowMillis) ?: 0
        if (remaining > 0) {
            delay(remaining)
            nowMillis = System.currentTimeMillis()
        }
    }
    if (configuredLink != null) {
        val current = state.sharingUntilMillis?.let { it > nowMillis } == true && !state.working
        TextButton(
            onClick = { viewModel.checkSharing(original.request.requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderCheckShare"),
        ) { Text("Get invitation link") }
        if (current) {
            Text(
                "The link is ready. Anyone with it can accept this invitation, so share it only with the person you're inviting.",
                color = PantopusColors.appTextSecondary,
            )
            TextButton(onClick = {
                viewModel.share(original.request.requestId, state.generation) { link ->
                    context.startActivity(
                        Intent.createChooser(
                            Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, link)
                            },
                            "Share invitation link",
                        ),
                    )
                }
            }, modifier = Modifier.testTag("homeSenderShare")) { Text("Share invitation link") }
        }
    }
}

internal fun senderOutcomeText(
    action: String,
    outcome: HomeInvitationSenderOutcome,
): String =
    when (outcome.state) {
        "cancelled" -> "Nothing changed. This attempt was discarded before it took effect."
        "rejected" -> senderRefusalMessage(outcome.code)
        else ->
            when (action) {
                "withdraw" -> "They can no longer accept it. Anyone already in the household stays."
                "resend" -> "Links already sent keep working, and the expiry date hasn't changed."
                else -> "They join the household when they accept. Until then, it's listed under Pending in Members."
            }
    }

/** What reached the invitee: "emailed" means the email service took the message, not that it arrived. */
internal fun senderDeliveryText(outcome: HomeInvitationSenderOutcome): String {
    val email =
        when (outcome.email) {
            "provider_accepted" -> "We emailed the invitation."
            "not_requested" -> null
            else -> "We couldn't confirm the invitation email went out. You can share the invitation link instead."
        }
    val notice =
        when (outcome.inApp) {
            "saved" -> if (email == null) "It's in their Pantopus notifications." else "It's also in their Pantopus notifications."
            "not_requested" -> null
            else -> "We couldn't confirm their Pantopus notification."
        }
    return listOfNotNull(email, notice).joinToString(" ").ifEmpty {
        "No email or notification was sent. Share the invitation link so they can accept."
    }
}

private const val MAX_RECIPIENT_LENGTH = 254
