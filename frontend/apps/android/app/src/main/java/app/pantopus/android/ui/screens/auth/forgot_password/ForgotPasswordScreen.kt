@file:Suppress("PackageNaming", "MatchingDeclarationName", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.auth.forgot_password

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.auth.sign_up.ErrorBanner
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.screens.status.StatusWaitingScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

object ForgotPasswordScreenTags {
    const val ROOT = "forgotPasswordScreen"
    const val BACK = "forgotPasswordBackButton"
    const val EMAIL_FIELD = "forgotPasswordEmailField"
    const val SUBMIT = "forgotPasswordSubmitButton"
    const val ERROR_BANNER = "forgotPasswordErrorBanner"
    const val SENT_STATUS = "forgotPasswordSentStatus"
    const val SENT_RESEND = "forgotPasswordSentResend"
    const val SENT_BACK = "forgotPasswordSentBack"
}

/**
 * Forgot-password surface. Renders the form (top-bar back chevron +
 * email field + "Send reset link" CTA) while [ForgotPasswordViewModel]'s
 * phase is [ForgotPasswordViewModel.Phase.Form]; flips to the shared
 * Status / Wait "Check your email" frame on success.
 */
@Composable
fun ForgotPasswordScreen(
    viewModel: ForgotPasswordViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag(ForgotPasswordScreenTags.ROOT),
    ) {
        TopBar(onBack = onBack)
        when (val phase = state.phase) {
            is ForgotPasswordViewModel.Phase.Form -> FormBody(state = state, viewModel = viewModel)
            is ForgotPasswordViewModel.Phase.Sent ->
                SentBody(
                    email = phase.email,
                    onResend = viewModel::resend,
                    onBack = onBack,
                )
        }
    }
}

@Composable
private fun TopBar(onBack: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(PantopusColors.appSurface)
                .border(0.dp, PantopusColors.appBorderSubtle),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(onClick = onBack)
                        .testTag(ForgotPasswordScreenTags.BACK)
                        .semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
        }
        Text(
            text = "Forgot password",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
    }
}

@Composable
private fun FormBody(
    state: ForgotPasswordViewModel.UiState,
    viewModel: ForgotPasswordViewModel,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5)
                .padding(top = Spacing.s5, bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = "Reset your password",
                style = PantopusTextStyle.h2,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "Enter your email and we'll send you a link to reset it.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }

        state.errorMessage?.let { error ->
            ErrorBanner(
                error = error,
                onDismiss = viewModel::clearError,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag(ForgotPasswordScreenTags.ERROR_BANNER),
            )
        }

        EmailField(
            value = state.email,
            onChange = viewModel::onEmailChange,
        )

        SubmitButton(
            label = "Send reset link",
            isLoading = state.isLoading,
            isEnabled = state.canSubmit,
            onClick = viewModel::submit,
            tag = ForgotPasswordScreenTags.SUBMIT,
        )
    }
}

@Composable
private fun EmailField(
    value: String,
    onChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Email",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AtSign,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
            BasicTextField(
                value = value,
                onValueChange = onChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag(ForgotPasswordScreenTags.EMAIL_FIELD)
                        .semantics { contentDescription = "Email address" },
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "you@email.com",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
    }
}

@Composable
private fun SubmitButton(
    label: String,
    isLoading: Boolean,
    isEnabled: Boolean,
    onClick: () -> Unit,
    tag: String,
) {
    val background =
        if (isEnabled) PantopusColors.primary600 else PantopusColors.appBorderStrong
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .clickable(enabled = isEnabled, onClick = onClick)
                .testTag(tag)
                .semantics { contentDescription = if (isLoading) "Sending" else label },
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = PantopusColors.appTextInverse,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
            )
        } else {
            Text(
                text = label,
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun SentBody(
    email: String,
    onResend: () -> Unit,
    onBack: () -> Unit,
) {
    val content = remember(email) { StatusWaitingContent.resetLinkSent(email = email) }
    StatusWaitingScreen(
        content = content,
        onAction = {},
        onPrimary = { onResend() },
        onSecondary = { onBack() },
        modifier = Modifier.fillMaxSize(),
        rootTestTag = ForgotPasswordScreenTags.SENT_STATUS,
        primaryTestTag = ForgotPasswordScreenTags.SENT_RESEND,
        secondaryTestTag = ForgotPasswordScreenTags.SENT_BACK,
    )
}
