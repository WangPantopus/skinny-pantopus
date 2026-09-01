@file:Suppress("PackageNaming", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val HALO = 50.dp
private val HALO_ICON = 23.dp
private val BODY_MAX = 230.dp

/**
 * C8 — the no-availability state shown inside the slot picker when a whole
 * month (or window) has no open times. Calm, never alarming: a dashed card with
 * an advance-the-window CTA. A5 has no writes, so actions stay navigation-only
 * (next month / next available); waitlist join lives downstream.
 */
@Composable
fun NoAvailabilityState(
    icon: PantopusIcon,
    title: String,
    body: String,
    primaryLabel: String,
    onPrimary: () -> Unit,
    accent: Color,
    modifier: Modifier = Modifier,
    primaryIcon: PantopusIcon? = null,
    secondaryLabel: String? = null,
    secondaryIcon: PantopusIcon? = null,
    onSecondary: (() -> Unit)? = null,
    countChip: String? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .dashedBorder(PantopusColors.appBorderStrong, Radii.xl)
                .padding(horizontal = Spacing.s5, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(HALO).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = HALO_ICON, tint = PantopusColors.appTextSecondary)
        }
        Text(
            text = title,
            // Spec empty-card title is 15sp/700 with 20sp leading — one notch below
            // the 16sp body token, clamped to ~230dp so two-line titles wrap as designed.
            style = PantopusTextStyle.body,
            fontSize = 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = BODY_MAX),
        )
        Text(
            text = body,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = BODY_MAX),
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            AccentFilledButton(label = primaryLabel, accent = accent, icon = primaryIcon, onClick = onPrimary)
            if (secondaryLabel != null && onSecondary != null) {
                EmptyCardSecondaryButton(
                    label = secondaryLabel,
                    icon = secondaryIcon,
                    countChip = countChip,
                    onClick = onSecondary,
                )
            }
        }
    }
}

/**
 * The empty-card secondary action — a bordered ghost button with an optional
 * leading icon and a trailing count chip (the spec's "Get notified" / "Join
 * waitlist · 3 waiting" treatment). Built locally rather than reusing
 * [GhostButton] so the icon + chip slots match the design exactly.
 */
@Composable
private fun EmptyCardSecondaryButton(
    label: String,
    icon: PantopusIcon?,
    countChip: String?,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appText,
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(start = if (icon != null) Spacing.s2 else 0.dp),
        )
        if (countChip != null) {
            Row(
                modifier =
                    Modifier
                        .padding(start = Spacing.s2)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
            ) {
                Text(
                    text = countChip,
                    style = PantopusTextStyle.overline,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/**
 * The lighter "no times left this day" notice shown when the selected day is
 * empty but the month still has other open days — offers a text link to the
 * next available day.
 */
@Composable
fun DayFullyBookedNotice(
    onSeeNextAvailable: () -> Unit,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .dashedBorder(PantopusColors.appBorderStrong, Radii.xl)
                .padding(horizontal = Spacing.s5, vertical = Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                // calendar-x is reserved for the composed-empty frame; the day-full
                // notice carries the calm "looking for the next open time" glyph.
                icon = PantopusIcon.CalendarClock,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "No open times this day",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            // Calm, expected outcome — no alarm styling (spec voice).
            text = "Try another highlighted day, or jump to the next open time.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Row(
            modifier = Modifier.clickable(onClick = onSeeNextAvailable).padding(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(text = "See next available", style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = accent)
            PantopusIconImage(icon = PantopusIcon.ArrowRight, contentDescription = null, size = 13.dp, tint = accent)
        }
    }
}

/** Rounded dashed outline (1dp) — the calm no-availability card stroke (spec: `1px dashed`). */
private fun Modifier.dashedBorder(
    color: Color,
    radius: androidx.compose.ui.unit.Dp,
): Modifier =
    drawBehind {
        val stroke = 1.dp.toPx()
        val r = radius.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(stroke / 2f, stroke / 2f),
            size = Size(size.width - stroke, size.height - stroke),
            cornerRadius = CornerRadius(r, r),
            style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f))),
        )
    }
