@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The single status-driven terminal surface for first-class non-error states:
 * paused / expired / unavailable / secret (+ not-found / fully-booked /
 * cancelled). Reuses the "not shareable" centered halo + headline + body + dock
 * layout. Neutral chrome; the pillar accent appears only on the primary CTA.
 *
 * Per the design, this is ONE component whose icon/headline/body switch on
 * [SchedulingTerminalState] — never separate screens per state.
 */
enum class SchedulingTerminalState(
    internal val icon: PantopusIcon,
    internal val defaultTitle: String,
    internal val defaultBody: String,
) {
    NotFound(PantopusIcon.SearchX, "We can't find that page", "The link may be mistyped, or this page no longer exists."),
    Secret(PantopusIcon.Lock, "This is a private link", "Ask the host for the right link, or enter your access code."),
    Expired(PantopusIcon.Clock, "This link has expired", "For your security, these links stop working after a while."),
    Paused(PantopusIcon.PauseCircle, "Bookings are paused", "This host isn't taking new bookings at the moment."),
    Unavailable(PantopusIcon.CalendarX, "This page isn't available", "This booking page isn't available right now."),
    FullyBooked(PantopusIcon.CalendarX, "No times are open right now", "Every slot is taken for now — new times open up regularly."),
    Cancelled(PantopusIcon.XCircle, "This booking was cancelled", "The slot was released. Nothing further is owed."),

    /** No connection — full-screen variant for public flows where the strip banner isn't enough. */
    Offline(PantopusIcon.WifiOff, "You're offline", "Check your connection and try again — your details are saved."),

    /** The host blocked this invitee (403 beyond a secret link), or the action isn't permitted. */
    Blocked(PantopusIcon.Ban, "This isn't available to you", "You don't have access to this page. Ask the host for help."),
}

/** Map a decoded [SchedulingError] to its terminal state (null when it isn't terminal). */
fun SchedulingError.toTerminalState(): SchedulingTerminalState? =
    when (this) {
        is SchedulingError.Paused -> SchedulingTerminalState.Paused
        is SchedulingError.Expired -> SchedulingTerminalState.Expired
        is SchedulingError.Unavailable -> SchedulingTerminalState.Unavailable
        is SchedulingError.Secret -> SchedulingTerminalState.Secret
        else -> null
    }

/** A CTA in the terminal-state dock. */
data class TerminalAction(
    val label: String,
    val onClick: () -> Unit,
    val icon: PantopusIcon? = null,
)

private val HALO_SIZE = 84.dp
private val HALO_ICON = 36.dp
private val PRIMARY_HEIGHT = 46.dp
private val BODY_MAX_WIDTH = 260.dp

/**
 * @param state which terminal state to render.
 * @param pillar tints the primary CTA only.
 * @param title/body optional overrides (e.g. a host's paused note).
 * @param extra optional inline content under the body (access-code input,
 *   paused note card, "book again" link).
 * @param primaryAction filled pillar CTA in the dock (e.g. "Get the app").
 * @param secondaryAction ghost CTA above the primary (e.g. "Notify me").
 */
@Composable
fun PausedExpiredUnavailableState(
    state: SchedulingTerminalState,
    modifier: Modifier = Modifier,
    pillar: SchedulingPillar = SchedulingPillar.Personal,
    title: String? = null,
    body: String? = null,
    extra: (@Composable () -> Unit)? = null,
    primaryAction: TerminalAction? = null,
    secondaryAction: TerminalAction? = null,
) {
    Box(
        modifier = modifier.fillMaxSize().background(PantopusColors.appBg),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = Spacing.s6)
                    .padding(bottom = Spacing.s16),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier.size(HALO_SIZE).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = state.icon,
                    contentDescription = null,
                    size = HALO_ICON,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = title ?: state.defaultTitle,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.s5),
            )
            Text(
                text = body ?: state.defaultBody,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.s2).widthIn(max = BODY_MAX_WIDTH),
            )
            if (extra != null) {
                Box(modifier = Modifier.padding(top = Spacing.s5)) { extra() }
            }
        }

        if (primaryAction != null || secondaryAction != null) {
            Column(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(PantopusColors.appSurface)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                secondaryAction?.let { GhostButton(title = it.label, onClick = it.onClick) }
                primaryAction?.let { PillarPrimaryButton(label = it.label, accent = pillar.accent, icon = it.icon, onClick = it.onClick) }
            }
        }
    }
}

/** Filled CTA tinted with the pillar accent (the design's only pillar-colored chrome here). */
@Composable
private fun PillarPrimaryButton(
    label: String,
    accent: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = PRIMARY_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(accent)
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextInverse,
                    modifier = Modifier.padding(end = Spacing.s2),
                )
            }
            Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appTextInverse)
        }
    }
}
