@file:Suppress(
    "PackageNaming",
    "MatchingDeclarationName",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.auth.set_password

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.auth.AuthTrustFooter
import app.pantopus.android.ui.screens.auth.sign_up.ErrorBanner
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

object SetNewPasswordScreenTags {
    const val ROOT = "setPasswordScreen"
    const val NEW_FIELD = "setPassword.newField"
    const val CONFIRM_FIELD = "setPassword.confirmField"
    const val STRENGTH_HINT = "setPassword.strengthHint"
    const val MATCH_HINT = "setPassword.matchHint"
    const val SUBMIT = "setPassword.submit"
    const val SUCCESS_VIEW = "setPassword.successView"
    const val CONTINUE_BTN = "setPassword.continueBtn"
    const val BACK_LINK = "setPassword.backLink"
    const val ERROR_BANNER = "setPassword.errorBanner"
}

private const val SUBCOPY =
    "Create a new password for your account — you'll use it to sign in next time."

/**
 * §1B-1 — "Set a new password" surface. Reached from the password-reset
 * email deep link. Auth-archetype form variant (same vertical rhythm as
 * [app.pantopus.android.ui.screens.auth.LoginScreen]): brand lockup →
 * kicker → headline → subcopy → two secure fields (new + confirm, leading
 * lock, eye toggle) → 3-bar strength meter → primary "Update password" →
 * "Back to sign in" link → trust footer. On success flips to the bespoke
 * "Password updated" → "Continue to sign in" confirmation.
 */
@Composable
fun SetNewPasswordScreen(
    token: String,
    viewModel: SetNewPasswordViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
    onContinue: () -> Unit = {},
) {
    // Token reaches the VM via SavedStateHandle; the explicit arg keeps the
    // NavHost call site parallel with the iOS initializer.
    @Suppress("UNUSED_PARAMETER")
    val tokenForRouter = token
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5, vertical = Spacing.s10)
                .testTag(SetNewPasswordScreenTags.ROOT),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when (state.phase) {
            is SetNewPasswordViewModel.Phase.Form ->
                FormBody(state = state, viewModel = viewModel, onBack = onBack)
            is SetNewPasswordViewModel.Phase.Success ->
                SuccessBody(onContinue = onContinue)
        }
    }
}

@Composable
private fun FormBody(
    state: SetNewPasswordViewModel.UiState,
    viewModel: SetNewPasswordViewModel,
    onBack: () -> Unit,
) {
    var showNew by remember { mutableStateOf(false) }
    var showConfirm by remember { mutableStateOf(false) }

    BrandLockup()
    Box(modifier = Modifier.height(40.dp))

    Text(
        text = "ALMOST DONE",
        style = PantopusTextStyle.overline,
        color = PantopusColors.primary600,
    )
    Box(modifier = Modifier.height(Spacing.s1))
    Text(
        text = "Set a new password",
        style = PantopusTextStyle.h2,
        color = PantopusColors.appText,
        modifier = Modifier.semantics { heading() },
    )
    Box(modifier = Modifier.height(Spacing.s1))
    Text(
        text = SUBCOPY,
        style = PantopusTextStyle.small,
        color = PantopusColors.appTextSecondary,
        textAlign = TextAlign.Center,
        modifier = Modifier.widthIn(max = 300.dp),
    )

    Box(modifier = Modifier.height(Spacing.s5))

    state.errorMessage?.let { error ->
        ErrorBanner(
            error = error,
            onDismiss = viewModel::clearError,
            modifier = Modifier.fillMaxWidth().testTag(SetNewPasswordScreenTags.ERROR_BANNER),
        )
        Box(modifier = Modifier.height(Spacing.s3))
    }

    SecurePasswordField(
        label = "New password",
        value = state.password,
        placeholder = "Enter a new password",
        onChange = viewModel::onPasswordChange,
        isRevealed = showNew,
        onToggleReveal = { showNew = !showNew },
        isValid = state.passwordsMeetStrength,
        isError = false,
        tag = SetNewPasswordScreenTags.NEW_FIELD,
    )
    Box(modifier = Modifier.height(Spacing.s2))
    PasswordStrengthRow(
        score = state.passwordStrength,
        label = state.passwordStrengthLabel,
        hint = state.strengthHint,
    )

    Box(modifier = Modifier.height(Spacing.s3))

    SecurePasswordField(
        label = "Confirm password",
        value = state.confirmPassword,
        placeholder = "Re-enter your password",
        onChange = viewModel::onConfirmPasswordChange,
        isRevealed = showConfirm,
        onToggleReveal = { showConfirm = !showConfirm },
        isValid = state.confirmMatch == SetNewPasswordViewModel.ConfirmMatch.Match,
        isError = state.confirmMatch == SetNewPasswordViewModel.ConfirmMatch.Mismatch,
        tag = SetNewPasswordScreenTags.CONFIRM_FIELD,
    )
    if (state.confirmMatch != SetNewPasswordViewModel.ConfirmMatch.None) {
        Box(modifier = Modifier.height(Spacing.s2))
        MatchHint(isMatch = state.confirmMatch == SetNewPasswordViewModel.ConfirmMatch.Match)
    }

    Box(modifier = Modifier.height(Spacing.s5))

    SubmitButton(
        isLoading = state.isLoading,
        isEnabled = state.canSubmit,
        onClick = viewModel::submit,
    )

    Box(modifier = Modifier.height(Spacing.s4))

    Text(
        text = "← Back to sign in",
        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
        color = PantopusColors.primary600,
        modifier =
            Modifier
                .clickable(onClick = onBack)
                .testTag(SetNewPasswordScreenTags.BACK_LINK),
    )

    Box(modifier = Modifier.height(40.dp))

    AuthTrustFooter()
}

@Composable
private fun BrandLockup() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 48.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Pantopus",
            style = PantopusTextStyle.h1,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun SecurePasswordField(
    label: String,
    value: String,
    placeholder: String,
    onChange: (String) -> Unit,
    isRevealed: Boolean,
    onToggleReveal: () -> Unit,
    isValid: Boolean,
    isError: Boolean,
    tag: String,
) {
    val borderColor =
        when {
            isError -> PantopusColors.error
            isValid -> PantopusColors.success
            else -> PantopusColors.appBorder
        }
    val lockTint =
        when {
            isError -> PantopusColors.error
            isValid -> PantopusColors.success
            else -> PantopusColors.appTextSecondary
        }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "*",
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, borderColor, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = Radii.xl,
                tint = lockTint,
            )
            BasicTextField(
                value = value,
                onValueChange = onChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                visualTransformation =
                    if (isRevealed) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag(tag)
                        .semantics { contentDescription = label },
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = placeholder,
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            if (isValid) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.success,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clickable(onClick = onToggleReveal)
                        .semantics {
                            contentDescription = if (isRevealed) "Hide password" else "Show password"
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (isRevealed) PantopusIcon.EyeOff else PantopusIcon.Eye,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun PasswordStrengthRow(
    score: Int,
    label: String,
    hint: String,
) {
    val color =
        when (score) {
            1 -> PantopusColors.error
            2 -> PantopusColors.warning
            3 -> PantopusColors.success
            else -> PantopusColors.appBorder
        }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            repeat(3) { index ->
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (index < score) color else PantopusColors.appSurfaceSunken),
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = hint,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f).testTag(SetNewPasswordScreenTags.STRENGTH_HINT),
            )
            if (label.isNotEmpty()) {
                Text(
                    text = label,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = color,
                )
            }
        }
    }
}

@Composable
private fun MatchHint(isMatch: Boolean) {
    val color = if (isMatch) PantopusColors.success else PantopusColors.error
    Row(
        modifier = Modifier.fillMaxWidth().testTag(SetNewPasswordScreenTags.MATCH_HINT),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = if (isMatch) PantopusIcon.Check else PantopusIcon.AlertCircle,
            contentDescription = null,
            size = Radii.lg,
            tint = color,
        )
        Text(
            text = if (isMatch) "Passwords match" else "Passwords don't match",
            style = PantopusTextStyle.caption,
            color = color,
        )
    }
}

@Composable
private fun SubmitButton(
    isLoading: Boolean,
    isEnabled: Boolean,
    onClick: () -> Unit,
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
                .testTag(SetNewPasswordScreenTags.SUBMIT)
                .semantics {
                    contentDescription = if (isLoading) "Updating password" else "Update password"
                },
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = PantopusColors.appTextInverse,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Update password",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextInverse,
                )
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun SuccessBody(onContinue: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag(SetNewPasswordScreenTags.SUCCESS_VIEW),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 38.dp,
                tint = PantopusColors.success,
            )
        }

        Box(modifier = Modifier.height(Spacing.s5))
        Text(
            text = "Password updated",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Box(modifier = Modifier.height(Spacing.s2))
        Text(
            text = "Your password has been changed. Sign in with your new password to continue.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 280.dp),
        )

        Box(modifier = Modifier.height(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Signed out of other devices for security",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }

        Box(modifier = Modifier.height(Spacing.s5))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onContinue)
                    .testTag(SetNewPasswordScreenTags.CONTINUE_BTN)
                    .semantics { contentDescription = "Continue to sign in" },
            contentAlignment = Alignment.Center,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Continue to sign in",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextInverse,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
