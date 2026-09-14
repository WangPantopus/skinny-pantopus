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
        "Choose household access. This invitation does not verify an address or establish ownership.",
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
    Text("The household’s role and permission rules determine access. Guests have limited access.", color = PantopusColors.appTextSecondary)
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
    Text("Review the current invitation", color = PantopusColors.appText)
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
                else -> "Save invitation"
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
            "This saved original belongs to another Home. Review its saved details before continuing.",
            color = PantopusColors.appTextSecondary,
        )
    }
    Text("Finish this saved original before starting another invitation action.", color = PantopusColors.appTextSecondary)
    Text(original.summary, color = PantopusColors.appText, modifier = Modifier.testTag("homeSenderOriginalSummary"))
    val outcome = state.outcome
    if (outcome?.isTerminal == true) {
        SenderTerminal(original, outcome, state, viewModel)
        TextButton(
            onClick = { viewModel.acknowledge(original.request.requestId, onAcknowledged) },
            enabled = state.canAcknowledge,
            modifier = Modifier.testTag("homeSenderAcknowledge"),
        ) { Text("Acknowledge result") }
    } else {
        Text("The original result is not confirmed. Keep this original until it is resolved.", color = PantopusColors.appText)
        TextButton(
            onClick = { viewModel.recover(HomeInvitationSenderRecovery.Check, original.request.requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderCheck"),
        ) { Text("Check original result") }
        TextButton(
            onClick = { viewModel.recover(HomeInvitationSenderRecovery.Retry, original.request.requestId, state.generation) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderRetry"),
        ) { Text("Retry original action") }
        TextButton(
            onClick = { onCancel(original.request.requestId) },
            enabled = !state.working,
            modifier = Modifier.testTag("homeSenderCancelAttempt"),
        ) { Text("Cancel original attempt") }
    }
}

internal fun senderOriginalActionText(original: PendingHomeInvitationSender): String =
    "Saved original action: " +
        when (original.request.intent.action) {
            "withdraw" -> "Withdraw invitation"
            "resend" -> "Resend invitation"
            else -> "Create invitation"
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
            Text(
                "This receipt does not establish current invitation availability or household access.",
                color = PantopusColors.appTextSecondary,
            )
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
        ) { Text("Check link for sharing") }
        if (current) {
            Text(
                "Current invitation availability checked. Sharing checks it again before opening the share sheet.",
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
        "cancelled" -> "Original attempt cancelled. No invitation action was performed by this attempt."
        "rejected" -> senderRefusalMessage(outcome.code)
        else ->
            when (action) {
                "withdraw" -> "Invitation withdrawn. Existing household membership was preserved."
                "resend" -> "Resend saved. Earlier links remain valid; expiry and access dates were not extended."
                else -> "Invitation saved. The recipient must accept to join the household."
            }
    }

internal fun senderDeliveryText(outcome: HomeInvitationSenderOutcome): String =
    listOf(
        when (outcome.email) {
            "provider_accepted" -> "Email provider accepted the message. Inbox delivery is not confirmed."
            "not_requested" -> "Email delivery was not requested."
            else -> "Email delivery is unconfirmed."
        },
        when (outcome.inApp) {
            "saved" -> "In-app notification saved. Push or device delivery is not confirmed."
            "not_requested" -> "An in-app notification was not requested."
            else -> "In-app notification delivery is unconfirmed."
        },
    ).joinToString("\n")

private const val MAX_RECIPIENT_LENGTH = 254
