@file:Suppress("PackageNaming", "MatchingDeclarationName", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.status.verify_email

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.HaloCircle
import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.screens.status.StatusHalo
import app.pantopus.android.ui.screens.status.StatusPillTone
import app.pantopus.android.ui.screens.status.StatusPillView
import app.pantopus.android.ui.screens.status.StatusWaitingPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Cross-platform contract tags — mirror iOS `.accessibilityIdentifier`. */
object VerifyEmailLandingTags {
    const val ROOT = "verifyEmailScreen"
    const val VERIFYING = "verifyEmail.verifyingView"
    const val SUCCESS = "verifyEmail.successView"
    const val CONTINUE = "verifyEmail.continueBtn"
    const val EXPIRED = "verifyEmail.expiredView"
    const val RESEND = "verifyEmail.resendBtn"
    const val DIFFERENT_EMAIL = "verifyEmail.differentEmailBtn"
    const val TRUST_FOOTER = "verifyEmail.trustFooter"
    const val RESEND_TOAST = "verifyEmail.resendToast"
}

private const val TOAST_DISMISS_MS = 2_500L

/**
 * §1B-2 — Verify email DEEP-LINK LANDING. The A18 collapsed-status variant
 * the app opens when the user taps the link in their verification email —
 * the POST-tap result, distinct from A18.1 "Verify Email Sent". Confirms the
 * link's token on appear and renders verifying → success / expired. Reuses
 * the shared [HaloCircle] + [StatusPillView] primitives so it's a true
 * sibling of `StatusWaitingScreen`.
 */
@Composable
fun VerifyEmailLandingScreen(
    viewModel: VerifyEmailLandingViewModel = hiltViewModel(),
    onContinue: () -> Unit = {},
    onUseDifferentEmail: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.verifyOnAppearIfNeeded() }
    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(TOAST_DISMISS_MS)
            viewModel.clearToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(VerifyEmailLandingTags.ROOT),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s6),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Spacer(modifier = Modifier.height(Spacing.s10))
                PhaseBody(
                    state = state,
                    onContinue = onContinue,
                    onResend = viewModel::resend,
                    onUseDifferentEmail = onUseDifferentEmail,
                )
                Spacer(modifier = Modifier.height(Spacing.s10))
            }
            TrustFooter()
        }

        state.toast?.let { toast ->
            ResendToastBar(
                toast = toast,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = Spacing.s4)
                        .padding(bottom = Spacing.s12),
            )
        }
    }
}

@Composable
private fun PhaseBody(
    state: VerifyEmailLandingViewModel.UiState,
    onContinue: () -> Unit,
    onResend: () -> Unit,
    onUseDifferentEmail: () -> Unit,
) {
    when (state.phase) {
        VerifyEmailLandingViewModel.Phase.Verifying ->
            StatePanel(
                stateTag = VerifyEmailLandingTags.VERIFYING,
                halo = StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.Mail, isPulsing = true),
                headline = "Verifying your email…",
                body = emphasized("Hold on while we confirm the link for ${state.recipient}.", state.email),
                pill =
                    StatusWaitingPill(
                        text = "Checking your link…",
                        icon = PantopusIcon.RefreshCw,
                        tone = StatusPillTone.Neutral,
                        isSpinning = true,
                    ),
            ) {
                Text(
                    text = "This only takes a moment.",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextMuted,
                )
            }

        VerifyEmailLandingViewModel.Phase.Success ->
            StatePanel(
                stateTag = VerifyEmailLandingTags.SUCCESS,
                halo = StatusHalo(tone = HaloCircleTone.Success, icon = PantopusIcon.Check),
                headline = "Email verified",
                body = emphasized("${state.recipient} is confirmed. Your account is ready to go.", state.email),
                pill =
                    StatusWaitingPill(
                        text = "Verified · just now",
                        icon = PantopusIcon.CheckCircle,
                        tone = StatusPillTone.Success,
                    ),
            ) {
                PrimaryButton(
                    label = "Continue",
                    icon = PantopusIcon.ArrowRight,
                    tag = VerifyEmailLandingTags.CONTINUE,
                    onClick = onContinue,
                )
            }

        VerifyEmailLandingViewModel.Phase.Expired ->
            StatePanel(
                stateTag = VerifyEmailLandingTags.EXPIRED,
                halo = StatusHalo(tone = HaloCircleTone.Warning, icon = PantopusIcon.AlertTriangle),
                headline = "This link has expired",
                body =
                    emphasized(
                        "Verification links last 24 hours. We can send a fresh one to ${state.recipient}.",
                        state.email,
                    ),
                pill =
                    StatusWaitingPill(
                        text = "Link expired",
                        icon = PantopusIcon.Clock,
                        tone = StatusPillTone.Warning,
                    ),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                    PrimaryButton(
                        label = "Resend verification",
                        icon = PantopusIcon.RefreshCw,
                        tag = VerifyEmailLandingTags.RESEND,
                        isLoading = state.isResending,
                        isEnabled = state.canResend,
                        onClick = onResend,
                    )
                    GhostButton(
                        label = "Use a different email",
                        icon = PantopusIcon.Pencil,
                        tag = VerifyEmailLandingTags.DIFFERENT_EMAIL,
                        onClick = onUseDifferentEmail,
                    )
                }
            }
    }
}

/**
 * Centred A18 collapsed-status block: halo → headline → body → pill →
 * phase-specific [actions]. [stateTag] is the per-phase contract tag.
 */
@Composable
private fun StatePanel(
    stateTag: String,
    halo: StatusHalo,
    headline: String,
    body: AnnotatedString,
    pill: StatusWaitingPill,
    actions: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag(stateTag),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        HaloCircle(tone = halo.tone, icon = halo.icon, isPulsing = halo.isPulsing)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = headline,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = body,
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 280.dp),
            )
        }
        StatusPillView(pill)
        Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2)) { actions() }
    }
}

@Composable
private fun PrimaryButton(
    label: String,
    icon: PantopusIcon,
    tag: String,
    onClick: () -> Unit,
    isLoading: Boolean = false,
    isEnabled: Boolean = true,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isEnabled) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                .clickable(enabled = isEnabled && !isLoading, onClick = onClick)
                .testTag(tag)
                .semantics { contentDescription = label },
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
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = label,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 17.dp,
                    strokeWidth = 2.6f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun GhostButton(
    label: String,
    icon: PantopusIcon,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = label,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** Shield-check trust footer, pinned to the bottom of every phase. */
@Composable
private fun TrustFooter() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(top = Spacing.s3, bottom = Spacing.s5)
                .testTag(VerifyEmailLandingTags.TRUST_FOOTER)
                .semantics { contentDescription = "Verified by address, encrypted" },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.success,
            modifier = Modifier.padding(end = 7.dp),
        )
        Text(
            text = "Verified by address · encrypted",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun ResendToastBar(
    toast: VerifyEmailLandingViewModel.ResendToast,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (toast.isError) PantopusColors.error else PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag(VerifyEmailLandingTags.RESEND_TOAST),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = if (toast.isError) PantopusIcon.AlertCircle else PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = toast.message,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextInverse,
        )
    }
}

/** Body copy with the email fragment rendered bold (mirrors `StatusWaitingScreen`). */
private fun emphasized(
    text: String,
    emphasis: String?,
): AnnotatedString =
    buildAnnotatedString {
        val start = emphasis?.takeIf { it.isNotEmpty() }?.let { text.indexOf(it) } ?: -1
        if (start < 0 || emphasis == null) {
            append(text)
            return@buildAnnotatedString
        }
        append(text.substring(0, start))
        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.appText)) {
            append(emphasis)
        }
        append(text.substring(start + emphasis.length))
    }
