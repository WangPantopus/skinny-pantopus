@file:Suppress("LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.auth

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.auth.OAuthBrowserCommand
import app.pantopus.android.data.auth.OAuthProvider
import app.pantopus.android.data.auth.OAuthSessionStore
import app.pantopus.android.ui.screens.auth.sign_up.ErrorBanner
import app.pantopus.android.ui.screens.settings.legal.LegalDocument
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

object LoginScreenTags {
    const val ROOT = "loginScreen"
    const val EMAIL_FIELD = "loginEmailField"
    const val PASSWORD_FIELD = "loginPasswordField"
    const val PASSWORD_VISIBILITY_TOGGLE = "loginPasswordVisibilityToggle"
    const val SUBMIT_BUTTON = "loginSubmitButton"
    const val ERROR_BANNER = "loginErrorBanner"
    const val ERROR_MESSAGE = "loginErrorMessage"
    const val FORGOT_PASSWORD_LINK = "loginForgotPasswordLink"
    const val CREATE_ACCOUNT_LINK = "loginCreateAccountLink"
    const val RESEND_VERIFICATION_BUTTON = "loginResendVerificationButton"
    const val INFO_BANNER = "loginInfoBanner"
    const val GOOGLE_BUTTON = "loginGoogleButton"
    const val APPLE_BUTTON = "loginAppleButton"
    const val LEGAL_TERMS_LINE = "loginLegalTermsLine"
}

/**
 * Redesigned log-in surface — mirrors `auth-frames.jsx` frame 1 (default)
 * and frame 6 (inline error banner on submit failure). Email form plus
 * browser-based Google / Apple OAuth.
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel = hiltViewModel(),
    onOpenLegal: (LegalDocument) -> Unit = {},
    onNavigateToSignUp: () -> Unit = {},
    onNavigateToForgotPassword: () -> Unit = {},
    onNavigateToVerifyEmail: () -> Unit = {},
    onNavigateToResetPassword: (String) -> Unit = {},
    onNavigateToAuthError: () -> Unit = {},
) {
    // Suppress unused-parameter detekt — these are part of the nav contract
    // documented on `AuthNavHost`, even if Login itself wires only signup
    // / forgot / submit. P5 wires the remaining destinations.
    @Suppress("UNUSED_VARIABLE")
    val unusedNavCallbacks =
        listOf(
            onNavigateToVerifyEmail,
            onNavigateToResetPassword,
            onNavigateToAuthError,
        )

    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showPassword by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(Unit) {
        viewModel.browserAuth.collect { command ->
            when (command) {
                is OAuthBrowserCommand.Open -> openOAuthUrl(context, command.url)
            }
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_PAUSE -> viewModel.onHostPaused()
                    Lifecycle.Event.ON_RESUME -> viewModel.onHostResumed()
                    else -> Unit
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s5, vertical = Spacing.s10)
                .testTag(LoginScreenTags.ROOT),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BrandLockup()
        Box(modifier = Modifier.height(40.dp))

        Text(
            text = "WELCOME BACK",
            style = PantopusTextStyle.overline,
            color = PantopusColors.primary600,
        )
        Box(modifier = Modifier.height(Spacing.s1))
        Text(
            text = "Log in to Pantopus",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Box(modifier = Modifier.height(Spacing.s1))
        Text(
            text = "Pick up where you left off on your block.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )

        Box(modifier = Modifier.height(Spacing.s5))

        state.errorMessage?.let { error ->
            ErrorBanner(
                error = error,
                onDismiss = viewModel::clearError,
                modifier = Modifier.fillMaxWidth().testTag(LoginScreenTags.ERROR_BANNER),
            )
            Box(modifier = Modifier.height(Spacing.s3))
        }

        state.infoMessage?.let { info ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary100)
                        .padding(Spacing.s3)
                        .testTag(LoginScreenTags.INFO_BANNER)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Mail,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = info,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                )
            }
            Box(modifier = Modifier.height(Spacing.s3))
        }

        OAuthButtonGroup(
            isLoading = state.isLoading,
            onGoogle = { viewModel.signInWithOAuth(OAuthProvider.Google) },
            onApple = { viewModel.signInWithOAuth(OAuthProvider.Apple) },
            googleTag = LoginScreenTags.GOOGLE_BUTTON,
            appleTag = LoginScreenTags.APPLE_BUTTON,
        )
        Box(modifier = Modifier.height(Spacing.s3))

        AuthOAuthTermsLine(
            testTag = LoginScreenTags.LEGAL_TERMS_LINE,
            onOpenLegal = onOpenLegal,
        )
        Box(modifier = Modifier.height(Spacing.s5))

        EmailField(
            value = state.email,
            onChange = viewModel::onEmailChange,
            isError = state.errorMessage != null,
        )
        Box(modifier = Modifier.height(Spacing.s3))
        PasswordFieldWithForgot(
            value = state.password,
            isVisible = showPassword,
            onVisibilityToggle = { showPassword = !showPassword },
            onChange = viewModel::onPasswordChange,
            onForgot = onNavigateToForgotPassword,
            isError = state.errorMessage != null,
        )

        Box(modifier = Modifier.height(Spacing.s5))

        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(
                        if (state.canSubmit) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    ).clickable(enabled = state.canSubmit, onClick = viewModel::signIn)
                    .testTag(LoginScreenTags.SUBMIT_BUTTON)
                    .semantics { contentDescription = if (state.isLoading) "Signing in" else "Log in" },
            contentAlignment = Alignment.Center,
        ) {
            if (state.isLoading) {
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
                        text = "Log in",
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

        // Unverified sign-in is a dead end without this: the backend 403s
        // with "Please verify your email before signing in."
        // (`backend/routes/users.js:1528`) and RN reveals the same link on
        // that error (`(auth)/login.tsx:190`).
        if (state.canResendVerification) {
            Box(modifier = Modifier.height(Spacing.s2))
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clickable(
                            enabled = !state.isResendingVerification && !state.isLoading,
                            onClick = viewModel::resendVerification,
                        ).testTag(LoginScreenTags.RESEND_VERIFICATION_BUTTON)
                        .semantics { contentDescription = "Resend verification email" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text =
                        if (state.isResendingVerification) {
                            "Sending verification…"
                        } else {
                            "Resend verification email"
                        },
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary600,
                )
            }
        }

        Box(modifier = Modifier.height(Spacing.s4))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "New to Pantopus?",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Create account",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clickable(onClick = onNavigateToSignUp)
                        .testTag(LoginScreenTags.CREATE_ACCOUNT_LINK),
            )
        }

        Box(modifier = Modifier.height(Spacing.s10))

        AuthTrustFooter()

        // Hidden a11y live region for legacy tests.
        state.errorMessage?.let {
            Text(
                text = it.message,
                modifier =
                    Modifier
                        .padding(PaddingValues(0.dp))
                        .testTag(LoginScreenTags.ERROR_MESSAGE)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                color = PantopusColors.appText,
                fontSize = 1.sp,
            )
        }
    }
}

/** Shared Google / Apple buttons — tags/copy match iOS `OAuthButtonGroup`. */
@Composable
fun OAuthButtonGroup(
    isLoading: Boolean,
    onGoogle: () -> Unit,
    onApple: () -> Unit,
    googleTag: String,
    appleTag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        OAuthButton(
            title = "Continue with Google",
            enabled = !isLoading,
            onClick = onGoogle,
            testTag = googleTag,
        )
        OAuthButton(
            title = "Continue with Apple",
            enabled = !isLoading,
            onClick = onApple,
            testTag = appleTag,
        )
    }
}

@Composable
private fun OAuthButton(
    title: String,
    enabled: Boolean,
    onClick: () -> Unit,
    testTag: String,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .clickable(enabled = enabled, onClick = onClick)
                .testTag(testTag)
                .semantics { contentDescription = title },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
    }
}

/**
 * Opens the authorization URL in Custom Tabs, falling back to any browser
 * that handles `ACTION_VIEW`.
 *
 * The browser is launched into the **caller's task** — no
 * `FLAG_ACTIVITY_NEW_TASK` — so the `pantopus://auth/callback` redirect
 * re-fronts the `singleTask` MainActivity sitting underneath it and the
 * browser goes away. A separate task would leave it stranded behind the app.
 *
 * Both launches are guarded: on a device with no browser at all,
 * `startActivity` throws `ActivityNotFoundException`, which would otherwise
 * escape the collecting `LaunchedEffect` and crash the app. Instead the
 * in-flight attempt is failed so the ViewModel surfaces a normal auth error,
 * mirroring iOS's `OAuthWebAuthenticationError.unableToStart`.
 */
internal fun openOAuthUrl(
    context: android.content.Context,
    url: String,
) {
    val uri = Uri.parse(url)
    val launched =
        runCatching {
            CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
                .launchUrl(context, uri)
        }.recoverCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        }.isSuccess
    if (!launched) {
        OAuthSessionStore.failBrowserLaunch()
    }
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
        Text(
            text = "Your neighborhood, verified.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun EmailField(
    value: String,
    onChange: (String) -> Unit,
    isError: Boolean,
) {
    val borderColor = if (isError) PantopusColors.error else PantopusColors.appBorder
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
                    .border(1.dp, borderColor, RoundedCornerShape(Radii.md))
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
                        .testTag(LoginScreenTags.EMAIL_FIELD)
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
private fun PasswordFieldWithForgot(
    value: String,
    isVisible: Boolean,
    onVisibilityToggle: () -> Unit,
    onChange: (String) -> Unit,
    onForgot: () -> Unit,
    isError: Boolean,
) {
    val borderColor = if (isError) PantopusColors.error else PantopusColors.appBorder
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "Password",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Forgot password?",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clickable(onClick = onForgot)
                        .testTag(LoginScreenTags.FORGOT_PASSWORD_LINK),
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
                tint = PantopusColors.appTextSecondary,
            )
            BasicTextField(
                value = value,
                onValueChange = onChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                singleLine = true,
                visualTransformation =
                    if (isVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag(LoginScreenTags.PASSWORD_FIELD)
                        .semantics { contentDescription = "Password" },
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "••••••••",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clickable(onClick = onVisibilityToggle)
                        .testTag(LoginScreenTags.PASSWORD_VISIBILITY_TOGGLE)
                        .semantics {
                            contentDescription = if (isVisible) "Hide password" else "Show password"
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Eye,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/** Trust footer matching iOS `AuthTrustFooter`. */
@Composable
fun AuthTrustFooter() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Verified by address",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}
