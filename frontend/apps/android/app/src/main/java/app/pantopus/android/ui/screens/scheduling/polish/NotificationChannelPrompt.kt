@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.polish

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.HaloCircle
import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val EXPLAINER_MAX_WIDTH = 280.dp
private val GRABBER_WIDTH = 36.dp
private val GRABBER_HEIGHT = 5.dp
private val CLOSE_TARGET = 40.dp

/**
 * The reusable H15 channel-connect prompt content (the A18 status-screen layout:
 * a centered halo, headline, muted explainer, and CTAs, plus the 6-box code /
 * phone inputs on the verify frames). Render it full-screen from the routed host
 * ([NotificationPermissionPromptScreen]) or locally via a `ModalBottomSheet` from
 * a reminder/workflow channel toggle (pass [showCloseButton] = true). Tokens only.
 */
@Composable
fun NotificationChannelPrompt(
    state: NotificationPromptUiState,
    accent: Color,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
    onCodeChange: (String) -> Unit,
    onPhoneChange: (String) -> Unit,
    onResend: () -> Unit,
    modifier: Modifier = Modifier,
    showCloseButton: Boolean = false,
    onClose: () -> Unit = {},
) {
    val content = promptContent(state.frame)
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag("scheduling.notificationPrompt.${content.id}"),
    ) {
        if (showCloseButton) PromptCloseRow(onClose = onClose)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(Spacing.s6))
            HaloCircle(tone = content.tone, icon = content.icon)
            Spacer(Modifier.height(Spacing.s5))
            PromptHeadline(content = content, state = state)
            Spacer(Modifier.height(Spacing.s5))
            PromptMiddle(state = state, accent = accent, onCodeChange = onCodeChange, onPhoneChange = onPhoneChange, onResend = onResend)
            Spacer(Modifier.height(Spacing.s4))
        }
        PromptCtaDock(content = content, state = state, onPrimary = onPrimary, onSecondary = onSecondary)
    }
}

@Composable
private fun PromptHeadline(
    content: PromptContent,
    state: NotificationPromptUiState,
) {
    Text(
        text = content.headline,
        style = PantopusTextStyle.h2,
        color = PantopusColors.appText,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(Spacing.s2))
    Text(
        text = content.explainer(state.accountEmail, state.phone),
        style = PantopusTextStyle.body,
        color = PantopusColors.appTextSecondary,
        textAlign = TextAlign.Center,
        modifier = Modifier.widthIn(max = EXPLAINER_MAX_WIDTH),
    )
}

@Composable
private fun PromptMiddle(
    state: NotificationPromptUiState,
    accent: Color,
    onCodeChange: (String) -> Unit,
    onPhoneChange: (String) -> Unit,
    onResend: () -> Unit,
) {
    when (state.frame) {
        is NotificationPromptFrame.EmailVerify -> CodeEntry(state.code, onCodeChange, onResend, accent)
        NotificationPromptFrame.SmsVerify ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3), horizontalAlignment = Alignment.CenterHorizontally) {
                PhoneEntryField(phone = state.phone, onPhoneChange = onPhoneChange)
                CodeEntry(state.code, onCodeChange, onResend, accent)
                Text("Carrier rates may apply.", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
            }
        else -> Unit
    }
}

@Composable
private fun CodeEntry(
    code: String,
    onCodeChange: (String) -> Unit,
    onResend: () -> Unit,
    accent: Color,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        CodeBoxField(code = code, onCodeChange = onCodeChange, accent = accent)
        Text(
            text = "Resend code",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = accent,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .clickable(onClick = onResend)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                    .testTag("scheduling.notificationPrompt.resend"),
        )
    }
}

@Composable
private fun PromptCtaDock(
    content: PromptContent,
    state: NotificationPromptUiState,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s5, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        state.toast?.let { PromptToast(it) }
        PrimaryButton(
            title = content.primaryTitle,
            onClick = onPrimary,
            isLoading = state.isWorking,
            isEnabled = content.primaryEnabled(state),
            modifier = Modifier.testTag("scheduling.notificationPrompt.primary"),
        )
        content.secondaryTitle?.let {
            GhostButton(title = it, onClick = onSecondary, modifier = Modifier.testTag("scheduling.notificationPrompt.secondary"))
        }
    }
}

@Composable
private fun PromptToast(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.infoBg)
                .padding(Spacing.s3)
                .testTag("scheduling.notificationPrompt.toast"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Info, contentDescription = null, size = 14.dp, tint = PantopusColors.info)
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
    }
}

@Composable
private fun PromptCloseRow(onClose: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3)) {
        Box(
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .size(width = GRABBER_WIDTH, height = GRABBER_HEIGHT)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appBorderStrong),
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterEnd)
                    .size(CLOSE_TARGET)
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(onClickLabel = "Close", onClick = onClose)
                    .testTag("scheduling.notificationPrompt.close"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = "Close", size = 18.dp, tint = PantopusColors.appTextSecondary)
        }
    }
}

// MARK: - Per-frame copy + chrome

/** Per-frame copy + chrome, computed from the active frame. Sentence case, no exclamation points. */
private class PromptContent(
    val id: String,
    val tone: HaloCircleTone,
    val icon: PantopusIcon,
    val headline: String,
    val explainer: (email: String, phone: String) -> String,
    val primaryTitle: String,
    val secondaryTitle: String?,
    val primaryEnabled: (NotificationPromptUiState) -> Boolean,
)

private fun promptContent(frame: NotificationPromptFrame): PromptContent =
    when (frame) {
        NotificationPromptFrame.Push ->
            PromptContent(
                id = "push",
                tone = HaloCircleTone.Info,
                icon = NotificationChannel.Push.glyph,
                headline = "Turn on push reminders",
                explainer = { _, _ ->
                    "Pantopus needs permission to send reminders to this device. You can change this anytime in Settings."
                },
                primaryTitle = "Allow notifications",
                secondaryTitle = "Use email instead",
                primaryEnabled = { true },
            )
        is NotificationPromptFrame.EmailVerify ->
            PromptContent(
                id = "emailVerify",
                tone = HaloCircleTone.Info,
                icon = NotificationChannel.Email.glyph,
                headline = "Confirm your email",
                explainer = { email, _ -> "We sent a 6-digit code to $email." },
                primaryTitle = "Verify",
                secondaryTitle = null,
                primaryEnabled = { it.isCodeComplete },
            )
        NotificationPromptFrame.SmsVerify ->
            PromptContent(
                id = "smsVerify",
                tone = HaloCircleTone.Info,
                icon = NotificationChannel.Sms.glyph,
                headline = "Confirm your phone",
                explainer = { _, _ -> "Enter your phone number, then the 6-digit code we text you." },
                primaryTitle = "Verify",
                secondaryTitle = null,
                primaryEnabled = { it.isSmsReady },
            )
        is NotificationPromptFrame.Connected ->
            PromptContent(
                id = "connected",
                tone = HaloCircleTone.Success,
                icon = PantopusIcon.CheckCheck,
                headline = frame.channel.connectedTitle,
                explainer = { email, phone ->
                    frame.channel.connectedBody(target = if (frame.channel == NotificationChannel.Sms) phone else email)
                },
                primaryTitle = "Done",
                secondaryTitle = null,
                primaryEnabled = { true },
            )
        NotificationPromptFrame.Denied ->
            PromptContent(
                id = "denied",
                tone = HaloCircleTone.Warning,
                icon = PantopusIcon.BellOff,
                headline = "Push is turned off",
                explainer = { _, _ ->
                    "Reminders can't reach this device until you enable notifications in Android Settings. Email still works."
                },
                primaryTitle = "Open Settings",
                secondaryTitle = "Keep email only",
                primaryEnabled = { true },
            )
    }
