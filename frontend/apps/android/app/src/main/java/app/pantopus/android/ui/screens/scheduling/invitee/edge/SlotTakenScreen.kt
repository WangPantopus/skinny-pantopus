@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

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
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val SLOT_TAKEN_TAG = "schedulingSlotTaken"

/**
 * D5 — Slot taken / conflict recovery, presented full-screen (the takeover
 * variant of the Foundation `ConflictAlternativesSheet`). On a 409
 * `SLOT_TAKEN|SLOT_UNAVAILABLE|SLOT_FULL` at confirm/reschedule it never
 * dead-ends: it surfaces the nearest open times, or — when the whole day is
 * full — the waitlist. The sticky "Your details are saved." footer reassures
 * nothing is retyped.
 */
@Composable
fun SlotTakenScreen(
    alternatives: List<SlotDto>,
    onPick: (SlotDto) -> Unit,
    onPickAnotherTime: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    refreshing: Boolean = false,
    accent: Color = SchedulingPillar.Personal.accent,
    title: String = "That time was just taken",
    onJoinWaitlist: (() -> Unit)? = null,
    showSavedNote: Boolean = true,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(SLOT_TAKEN_TAG)) {
        SlotTakenTopBar(onBack = onBack)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            when {
                refreshing -> RefreshingBody(onPickAnotherTime)
                alternatives.isEmpty() -> FullyBookedBody(onJoinWaitlist = onJoinWaitlist, onPickAnotherTime = onPickAnotherTime)
                else ->
                    AlternativesBody(
                        alternatives = alternatives,
                        accent = accent,
                        title = title,
                        onPick = onPick,
                        onPickAnotherTime = onPickAnotherTime,
                    )
            }
        }
        if (showSavedNote) SavedNote()
    }
}

@Composable
private fun SlotTakenTopBar(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(onClickLabel = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
        }
        Text(
            text = "Pick a new time",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        Box(modifier = Modifier.size(34.dp))
    }
}

@Composable
private fun AlternativesBody(
    alternatives: List<SlotDto>,
    accent: Color,
    title: String,
    onPick: (SlotDto) -> Unit,
    onPickAnotherTime: () -> Unit,
) {
    EdgeHalo(
        tone = EdgeTone.Warn,
        icon = PantopusIcon.CalendarX,
        title = title,
        body = "Someone grabbed that time first. Here are the closest open times — these are still open.",
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        alternatives.forEachIndexed { index, slot ->
            AlternativeSlotRow(slot = slot, soonest = index == 0, accent = accent, onClick = { onPick(slot) })
        }
    }
    GhostButton(title = "Pick another time", onClick = onPickAnotherTime)
}

@Composable
private fun FullyBookedBody(
    onJoinWaitlist: (() -> Unit)?,
    onPickAnotherTime: () -> Unit,
) {
    EdgeHalo(
        tone = EdgeTone.Warn,
        icon = PantopusIcon.CalendarX,
        title = "That time was just taken",
        body = "And the rest of this day just filled up too.",
    )
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .dashedBorder(PantopusColors.appBorderStrong, Radii.xl)
                .padding(vertical = Spacing.s6, horizontal = Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarX,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "This day is fully booked",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "Join the waitlist and we'll let you know the moment a time opens up.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 220.dp),
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (onJoinWaitlist != null) PrimaryButton(title = "Join the waitlist", onClick = onJoinWaitlist)
        GhostButton(title = "See another day", onClick = onPickAnotherTime)
    }
}

@Composable
private fun RefreshingBody(onPickAnotherTime: () -> Unit) {
    EdgeHalo(
        tone = EdgeTone.Warn,
        icon = PantopusIcon.CalendarX,
        title = "That time was just taken",
        body = "Checking which times are still open right now.",
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        repeat(3) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 16.dp, height = 16.dp, cornerRadius = Radii.xs)
                Shimmer(width = 90.dp, height = 12.dp, cornerRadius = Radii.xs)
                Box(modifier = Modifier.weight(1f))
                Shimmer(width = 56.dp, height = 12.dp, cornerRadius = Radii.xs)
            }
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(SchedulingPillar.Personal.accent))
        Text(
            text = "Checking live availability",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
    GhostButton(title = "Pick another time", onClick = onPickAnotherTime)
}

@Composable
private fun SavedNote() {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        // Spec footer: a 1px top hairline above the saved-details note.
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp, bottom = 18.dp, start = Spacing.s4, end = Spacing.s4),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.success,
                modifier = Modifier.padding(end = Spacing.s1),
            )
            Text(
                text = "Your details are saved.",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** Rounded dashed outline (1dp) — the fully-booked empty card stroke (spec: `1px dashed`). */
private fun Modifier.dashedBorder(
    color: Color,
    radius: Dp,
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
