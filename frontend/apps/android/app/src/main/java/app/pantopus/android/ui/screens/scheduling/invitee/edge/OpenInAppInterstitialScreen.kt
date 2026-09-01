@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling.invitee.edge.OpenInAppViewModel.OpenInAppUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val OPEN_IN_APP_TAG = "schedulingOpenInApp"

/**
 * D9 — Open-in-App / deep-link hand-off (native interstitial). Resolves the
 * inbound booking link and hands the invitee into the in-app flow ("Continue in
 * app"), or falls back to the web when it can't ("Continue on the web"). The
 * pending link is read read-only from the Foundation `DeepLinkRouter`; this
 * screen adds no route plumbing.
 */
@Composable
fun OpenInAppInterstitialScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: OpenInAppViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.start() }

    val openWeb: (String?) -> Unit = { url ->
        if (url != null) {
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                .onFailure { onBack() }
        } else {
            onBack()
        }
    }

    OpenInAppContent(
        state = state,
        onContinueInApp = onNavigate,
        onStayOnWeb = openWeb,
        onRetry = viewModel::retry,
    )
}

@Composable
fun OpenInAppContent(
    state: OpenInAppUiState,
    onContinueInApp: (String) -> Unit,
    onStayOnWeb: (String?) -> Unit,
    modifier: Modifier = Modifier,
    onBack: () -> Unit = {},
    onRetry: () -> Unit = onBack,
) {
    Box(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(OPEN_IN_APP_TAG)) {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s6).padding(bottom = Spacing.s16),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when (state) {
                is OpenInAppUiState.Resolving -> ResolvingBody()
                is OpenInAppUiState.Resolved -> ResolvedBody(state)
                is OpenInAppUiState.Failed -> FailedBody()
            }
        }
        Dock(state = state, onContinueInApp = onContinueInApp, onStayOnWeb = onStayOnWeb, onRetry = onRetry)
    }
}

@Composable
private fun ResolvingBody() {
    BrandMark(size = 52.dp)
    Box(modifier = Modifier.padding(top = Spacing.s5).fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 38.dp, height = 38.dp, cornerRadius = Radii.md)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Shimmer(width = 120.dp, height = 11.dp, cornerRadius = Radii.xs)
                Shimmer(width = 160.dp, height = 9.dp, cornerRadius = Radii.xs)
            }
        }
    }
    Row(modifier = Modifier.padding(top = Spacing.s5), verticalAlignment = Alignment.CenterVertically) {
        // Spec dlPulse: the 7px resolving dot fades in/out on a ~1.4s loop.
        val transition = rememberInfiniteTransition(label = "dlPulse")
        val pulseAlpha by transition.animateFloat(
            initialValue = 1f,
            targetValue = 0.3f,
            animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
            label = "dlPulseAlpha",
        )
        Box(
            modifier =
                Modifier
                    .size(7.dp)
                    .alpha(pulseAlpha)
                    .clip(CircleShape)
                    .background(SchedulingPillar.Personal.accent),
        )
        Text(
            text = "Opening your booking",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
}

@Composable
private fun ResolvedBody(state: OpenInAppUiState.Resolved) {
    HostAvatar(name = state.title, size = 64.dp)
    Text(
        text = "Pick up where you left off",
        fontSize = 19.sp,
        lineHeight = 24.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appText,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = Spacing.s5),
    )
    Text(
        text = "Your timezone and details come with you.",
        fontSize = 12.5f.sp,
        lineHeight = 18.sp,
        color = PantopusColors.appTextSecondary,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = Spacing.s2).widthIn(max = 240.dp),
    )
    Row(
        modifier =
            Modifier
                .padding(top = Spacing.s5)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(38.dp).clip(RoundedCornerShape(Radii.md)).background(SchedulingPillar.Personal.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = 18.dp,
                tint = SchedulingPillar.Personal.accent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = state.title,
                fontSize = 13.5f.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            state.subtitle?.let {
                Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
    }
    // Frame 3 design IdentityLine: inline capsule (sunken bg, border) showing
    // the invitee mini-avatar and "Continuing as <name> · times in <tz>".
    // The Resolved state carries no invitee profile, so we render the designed
    // placeholder label with a generic avatar disc.
    IdentityLine()
}

/**
 * The design `IdentityLine` pill (Frame 3 / deeplink-handoff-frames.jsx:122–128):
 * an inline-flex capsule (appSurfaceSunken bg + border) with a small
 * invitee avatar disc and "Continuing as … · times in …" text. The Resolved
 * state carries no invitee profile from the ViewModel, so we render the
 * designed placeholder copy as specified — NEVER fabricating data.
 */
@Composable
private fun IdentityLine() {
    Row(
        modifier =
            Modifier
                .padding(top = Spacing.s4)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Mini invitee avatar disc (purple gradient per design frame — fixed chrome).
        Box(
            modifier =
                Modifier
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(SchedulingPillar.Personal.avatarBrush()),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.User,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = "Continuing as you · times in local",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * The design `HostAvatar`: a 64px sky-gradient circle showing the host initials
 * with a small primary user badge bottom-right (mirrors iOS `EdgePillarAvatar`).
 */
@Composable
private fun HostAvatar(
    name: String,
    size: Dp,
) {
    Box(contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier = Modifier.size(size).clip(CircleShape).background(SchedulingPillar.Personal.avatarBrush()),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = edgeInitials(name),
                color = PantopusColors.appTextInverse,
                fontSize = (size.value * 0.34f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(size * 0.34f)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .padding(2.dp)
                    .clip(CircleShape)
                    .background(SchedulingPillar.Personal.accent),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.User,
                contentDescription = null,
                size = size * 0.16f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun FailedBody() {
    Box(
        modifier = Modifier.size(84.dp).clip(CircleShape).background(PantopusColors.warningBg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Smartphone, contentDescription = null, size = 34.dp, tint = PantopusColors.warning)
    }
    Text(
        text = "We couldn't open this in the app",
        fontSize = 19.sp,
        lineHeight = 24.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appText,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = Spacing.s5),
    )
    Text(
        text = "No problem — you can keep going on the web. Your booking is right where you left it.",
        fontSize = 12.5f.sp,
        lineHeight = 18.sp,
        color = PantopusColors.appTextSecondary,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = Spacing.s2).widthIn(max = 244.dp),
    )
}

@Composable
private fun BoxScope.Dock(
    state: OpenInAppUiState,
    onContinueInApp: (String) -> Unit,
    onStayOnWeb: (String?) -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is OpenInAppUiState.Resolving -> Unit
        is OpenInAppUiState.Resolved ->
            DockColumn {
                PrimaryButton(title = "Continue in app", onClick = { onContinueInApp(state.targetRoute) })
                GhostButton(title = "Stay on web", onClick = { onStayOnWeb(state.webUrl) })
            }
        is OpenInAppUiState.Failed ->
            DockColumn {
                PrimaryButton(title = "Continue on the web", onClick = { onStayOnWeb(state.webUrl) })
                // Spec frame 4 secondary action re-runs the resolve, not a nav-back.
                GhostButton(title = "Try the app again", onClick = onRetry)
            }
    }
}

@Composable
private fun BoxScope.DockColumn(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        content()
    }
}

/**
 * The design `PantopusMark`: a sky-gradient rounded-square (≈0.28·size radius)
 * carrying the concentric-ring brand glyph (mirrors iOS `PantopusMark` hand-drawn
 * at DeepLinkHandoffView.swift:229–242, and deeplink-handoff-frames.jsx:64–65).
 * Uses [PantopusIcon.Concentric] which maps to RadioButtonChecked — the closest
 * available ring-with-dot approximation of the three-concentric-ring SVG.
 */
@Composable
private fun BrandMark(size: Dp) {
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(RoundedCornerShape(size * 0.28f))
                .background(SchedulingPillar.Personal.avatarBrush()),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Concentric,
            contentDescription = "Pantopus",
            size = size * 0.6f,
            tint = PantopusColors.appTextInverse,
        )
    }
}
