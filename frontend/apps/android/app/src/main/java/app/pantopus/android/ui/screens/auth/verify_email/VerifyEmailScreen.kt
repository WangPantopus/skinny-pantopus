@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.auth.verify_email

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.ui.screens.status.StatusActionButton
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.screens.status.StatusWaitingScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

object VerifyEmailScreenTags {
    const val ROOT = "verifyEmailScreen"
    const val BACK = "verifyEmailBackButton"
    const val BANNER = "verifyEmailBanner"
}

/** Heartbeat for the wall-clock resend countdown. */
private const val COUNTDOWN_TICK_MS = 1_000L
private const val SECONDS_PER_MINUTE = 60
private const val MILLIS_PER_SECOND = 1_000L

private val TopBarHeight = 52.dp
private val TopBarHorizontalPadding = 10.dp
private val BackTargetSize = 36.dp
private val BackChevronSize = 20.dp
private val TopBarTitleSize = 15.sp

/**
 * A18.1 "Verify Email Sent" — the post-signup surface. Renders the designed
 * [StatusWaitingContent.checkYourEmail] frame (halo + headline + status pill +
 * Open Mail / Resend / Use a different email stack + footnote) rather than the
 * older bespoke mail-disc layout it replaced. Mirrors iOS `VerifyEmailView`.
 *
 * The verification email's deep link lands on `VerifyEmailLandingScreen`
 * (§1B-2), so in production this screen is always reached with a null token.
 * The token path is kept because the route still accepts one: when present the
 * view-model fires the verification call on appear and the banner reports it.
 */
@Composable
fun VerifyEmailScreen(
    viewModel: VerifyEmailViewModel = hiltViewModel(),
    onDone: () -> Unit = {},
    onChangeEmail: (String) -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(state.token) { viewModel.verifyOnAppearIfNeeded() }
    LaunchedEffect(state.didComplete) {
        if (state.didComplete) onDone()
    }
    // The cooldown is wall-clock based, so the disabled button's
    // "Resend in m:ss" label needs a heartbeat to redraw.
    LaunchedEffect(state.resendCooldownUntilEpochMs) {
        while (state.cooldownRemaining(now) != null) {
            delay(COUNTDOWN_TICK_MS)
            now = System.currentTimeMillis()
        }
    }

    val remaining = state.cooldownRemaining(now)
    val content =
        StatusWaitingContent.checkYourEmail(
            email = state.email,
            resent = remaining != null,
            resendCountdown = countdownLabel(remaining ?: 0L),
        )

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag(VerifyEmailScreenTags.ROOT),
    ) {
        TopBar(showBack = state.softGate, onBack = onDone)
        BannerLine(state = state)
        StatusWaitingScreen(
            content = content,
            onStackAction = { button ->
                handleStackAction(
                    button = button,
                    onOpenMail = { openMailApp(context) },
                    onResend = viewModel::resend,
                    onChangeEmail = { onChangeEmail(state.email.orEmpty()) },
                )
            },
            modifier = Modifier.weight(1f),
        )
    }
}

private fun handleStackAction(
    button: StatusActionButton,
    onOpenMail: () -> Unit,
    onResend: () -> Unit,
    onChangeEmail: () -> Unit,
) {
    when (button.actionKey) {
        "open_mail" -> onOpenMail()
        "resend_email" -> onResend()
        "change_email" -> onChangeEmail()
        else -> Unit
    }
}

/** "0:42" — minutes:seconds, matching the design frame. */
internal fun countdownLabel(remainingMs: Long): String {
    val total = ((remainingMs + MILLIS_PER_SECOND - 1) / MILLIS_PER_SECOND).coerceAtLeast(0L)
    return "${total / SECONDS_PER_MINUTE}:${(total % SECONDS_PER_MINUTE).toString().padStart(2, '0')}"
}

/**
 * A18.1's back-chevron + title bar. The chevron is the soft-gate exit
 * ("verify later"); hard-gate hosts pass `softGate = false` and it hides.
 */
@Composable
private fun TopBar(
    showBack: Boolean,
    onBack: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(TopBarHeight)
                .background(PantopusColors.appSurface)
                .padding(horizontal = TopBarHorizontalPadding),
    ) {
        if (showBack) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(BackTargetSize)
                        .clickable(onClick = onBack)
                        .testTag(VerifyEmailScreenTags.BACK)
                        .semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = BackChevronSize,
                    tint = PantopusColors.appText,
                )
            }
        }
        Text(
            text = "Check your email",
            style = PantopusTextStyle.body.copy(fontSize = TopBarTitleSize, fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.align(Alignment.Center).semantics { heading() },
        )
    }
}

private data class BannerCopy(
    val text: String,
    val color: Color,
    val background: Color,
)

@Composable
private fun BannerLine(state: VerifyEmailViewModel.UiState) {
    val copy = bannerCopyFor(state) ?: return
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(copy.background)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag(VerifyEmailScreenTags.BANNER),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = copy.text,
            style = PantopusTextStyle.caption,
            color = copy.color,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * Only states the A18.1 frame can't express itself: the deep-link verify
 * progress and any error. "Resent" is covered by the status pill.
 */
private fun bannerCopyFor(state: VerifyEmailViewModel.UiState): BannerCopy? {
    if (state.isVerifying) {
        return BannerCopy(
            text = "Verifying your email…",
            color = PantopusColors.primary700,
            background = PantopusColors.primary50,
        )
    }
    if (state.didVerify) {
        return BannerCopy(
            text = "Email verified. You can now sign in.",
            color = PantopusColors.success,
            background = PantopusColors.successBg,
        )
    }
    state.errorMessage?.let { error ->
        return BannerCopy(
            text = errorBlurb(error),
            color = PantopusColors.error,
            background = PantopusColors.errorBg,
        )
    }
    return null
}

private fun errorBlurb(error: AuthError): String = error.message

/**
 * Fires an [Intent.ACTION_VIEW] against `mailto:` so the system picker
 * surfaces whichever mail apps the user has installed. If no app handles
 * the intent (rare; the AOSP base image ships Gmail) the launcher
 * silently swallows it — we don't crash.
 */
private fun openMailApp(context: android.content.Context) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("mailto:"))
    if (intent.resolveActivity(context.packageManager) != null) {
        context.startActivity(intent)
    }
}
