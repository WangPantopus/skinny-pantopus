@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "MatchingDeclarationName", "CyclomaticComplexMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

internal enum class NotifChipState { On, Off, Disabled, Locked }

@Composable
internal fun NotifChannelChip(
    letter: String,
    chipState: NotifChipState,
    accent: androidx.compose.ui.graphics.Color,
) {
    val on = chipState == NotifChipState.On || chipState == NotifChipState.Locked
    val bg =
        when (chipState) {
            NotifChipState.On, NotifChipState.Locked -> accent
            NotifChipState.Off -> PantopusColors.appSurface
            NotifChipState.Disabled -> PantopusColors.appSurfaceSunken
        }
    val fg =
        when (chipState) {
            NotifChipState.On, NotifChipState.Locked -> PantopusColors.appTextInverse
            NotifChipState.Off -> PantopusColors.appTextMuted
            NotifChipState.Disabled -> PantopusColors.appBorderStrong
        }
    val border =
        if (chipState == NotifChipState.Off) {
            PantopusColors.appBorderStrong
        } else if (on) {
            accent
        } else {
            PantopusColors.appBorder
        }
    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier.size(
                    22.dp,
                ).clip(RoundedCornerShape(Radii.sm)).background(bg).border(1.dp, border, RoundedCornerShape(Radii.sm)),
            contentAlignment = Alignment.Center,
        ) {
            Text(letter, color = fg, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 10.sp)
        }
        if (chipState == NotifChipState.Locked) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 3.dp, y = 3.dp)
                        .size(11.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, accent, RoundedCornerShape(Radii.pill)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 6.5.dp, tint = accent)
            }
        }
    }
}

@Composable
internal fun NotifCategoryCard(
    label: String,
    helper: String,
    disabled: Boolean,
    accent: androidx.compose.ui.graphics.Color,
    accentBg: androidx.compose.ui.graphics.Color,
    smsHint: Boolean = false,
    onSmsTap: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3)) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .alpha(if (disabled) 0.55f else 1f),
        ) {
            Box {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(accentBg)
                            .padding(start = 16.dp, end = 16.dp, top = 9.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        label.uppercase(java.util.Locale.US),
                        color = accent,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.5.sp,
                        letterSpacing = 0.06.em,
                        modifier = Modifier.weight(1f),
                    )
                    ColumnLetter("P")
                    ColumnLetter("E")
                    Row(
                        modifier =
                            Modifier
                                .width(22.dp)
                                .then(if (onSmsTap != null) Modifier.clickable(onClick = onSmsTap) else Modifier)
                                .testTag("notifSmsHeader"),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "S",
                            color = PantopusColors.appTextMuted,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                        )
                        PantopusIconImage(
                            icon = PantopusIcon.Lock,
                            contentDescription = null,
                            size = 8.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                    }
                }
                if (smsHint) {
                    SmsTooltip(modifier = Modifier.align(Alignment.TopEnd).padding(end = 10.dp).offset(y = (-18).dp))
                }
            }
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
            content()
        }
        Text(
            helper,
            color = PantopusColors.appTextSecondary,
            fontSize = 11.5.sp,
            modifier = Modifier.padding(start = Spacing.s1, top = Spacing.s2),
        )
    }
}

/** "SMS coming soon" tooltip — mirrors the iOS smsTooltip floated above the S column. */
@Composable
private fun SmsTooltip(modifier: Modifier = Modifier) {
    Text(
        "SMS coming soon",
        color = PantopusColors.appTextInverse,
        fontWeight = FontWeight.SemiBold,
        fontSize = 10.sp,
        modifier =
            modifier
                .testTag("notifSmsTooltip")
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appText)
                .padding(horizontal = 9.dp, vertical = 5.dp),
    )
}

@Composable
private fun ColumnLetter(text: String) {
    Box(modifier = Modifier.width(22.dp), contentAlignment = Alignment.Center) {
        Text(text, color = PantopusColors.appTextMuted, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 10.sp)
    }
}

@Composable
internal fun NotifMatrixRow(
    row: NotifRow,
    isAttendee: Boolean,
    paused: Boolean,
    pushOff: Boolean,
    showDivider: Boolean,
    accent: androidx.compose.ui.graphics.Color,
    onToggle: () -> Unit,
) {
    val pState =
        when {
            paused || isAttendee -> NotifChipState.Disabled
            pushOff -> NotifChipState.Disabled
            row.locked -> if (row.enabled) NotifChipState.Locked else NotifChipState.Off
            else -> if (row.enabled) NotifChipState.On else NotifChipState.Off
        }
    val eState =
        when {
            paused -> NotifChipState.Disabled
            row.locked -> if (row.enabled) NotifChipState.Locked else NotifChipState.Off
            else -> if (row.enabled) NotifChipState.On else NotifChipState.Off
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(if (paused || row.locked) Modifier else Modifier.clickable(onClick = onToggle))
                .padding(horizontal = 16.dp, vertical = 11.dp)
                .testTag("notifRow_${if (isAttendee) "att" else "me"}_${row.key}"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(row.label, color = PantopusColors.appText, fontWeight = FontWeight.Medium, fontSize = 15.sp)
            row.sub?.let { Text(it, color = PantopusColors.appTextSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp)) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            NotifChannelChip("P", pState, accent = accent)
            NotifChannelChip("E", eState, accent = accent)
            NotifChannelChip("S", NotifChipState.Disabled, accent = accent)
        }
    }
    if (showDivider) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).padding(start = 16.dp).background(PantopusColors.appBorderSubtle))
    }
}

@Composable
internal fun ReminderLeadTime(
    selected: List<Int>,
    paused: Boolean,
    accent: androidx.compose.ui.graphics.Color,
    onToggle: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp)) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Spacer(Modifier.height(Spacing.s2 + 1.dp))
        Text("Send reminders", color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
        Spacer(Modifier.height(9.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            REMINDER_PRESETS.forEach { (minutes, label) ->
                val active = minutes in selected
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (active) accent else PantopusColors.appSurface)
                            .border(1.dp, if (active) accent else PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                            .then(if (paused) Modifier.alpha(0.5f) else Modifier.clickable { onToggle(minutes) })
                            .padding(horizontal = 13.dp, vertical = 7.dp)
                            .testTag("reminderChip_$minutes"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    if (active) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 12.dp,
                            tint = PantopusColors.appTextInverse,
                        )
                    }
                    Text(
                        label,
                        color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.5.sp,
                    )
                }
            }
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .dashedBorder(PantopusColors.appBorderStrong, Radii.pill)
                        .padding(horizontal = 13.dp, vertical = 7.dp)
                        .testTag("reminderChipAdd"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextSecondary)
                Text("Add", color = PantopusColors.appTextSecondary, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
            }
        }
    }
}

@Composable
internal fun NotifLegend() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        listOf("P · Push", "E · Email").forEach {
            Text(it, color = PantopusColors.appTextMuted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("S · SMS", color = PantopusColors.appTextMuted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 9.dp, tint = PantopusColors.appTextMuted)
            Text("soon", color = PantopusColors.appTextMuted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
    }
}

/**
 * Master-pause banner (A14.5). The design leads with the window — "Paused for
 * 2 hours" / "Resumes 11:42 AM · Emergency alerts still come through"
 * (scheduling-notif-frames.jsx:198-199); when no window is known the copy
 * falls back to the static pair.
 */
@Composable
internal fun NotifPauseBanner(
    pausedForLabel: String? = null,
    resumesAtLabel: String? = null,
    onResume: (() -> Unit)? = null,
) {
    val title = pausedForLabel?.let { "Paused for $it" } ?: "Notifications paused"
    val sub =
        resumesAtLabel?.let { "Resumes $it · Emergency alerts still come through" }
            ?: "Emergency alerts still come through"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.warningLight),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.BellOff, contentDescription = null, size = 16.dp, tint = PantopusColors.warning)
        }
        Column(Modifier.weight(1f)) {
            Text(title, color = PantopusColors.warning, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            Text(sub, color = PantopusColors.warning, fontSize = 11.5.sp)
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.pill))
                    // The pill LOOKED tappable but did nothing — the only un-pause path was
                    // the separate settings toggle, so people stayed muted believing they'd
                    // resumed. Mirrors iOS.
                    .let { m -> if (onResume != null) m.clickable(onClick = onResume) else m }
                    .padding(horizontal = 11.dp, vertical = 5.dp)
                    .testTag("notifResume"),
        ) {
            Text("Resume", color = PantopusColors.warning, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
        }
    }
}

@Composable
internal fun NotifPushOffNotice(onOpenSettings: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.BellOff, contentDescription = null, size = 15.dp, tint = PantopusColors.error)
        Text(
            "Push is off for Pantopus. Turn it on in Settings to get booking alerts.",
            color = PantopusColors.appTextStrong,
            fontSize = 12.sp,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onOpenSettings)
                    .padding(horizontal = 11.dp, vertical = 5.dp),
        ) {
            Text("Settings", color = PantopusColors.error, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
        }
    }
}

@Composable
internal fun NotifOverline(
    text: String,
    color: Color = PantopusColors.appTextSecondary,
) {
    Text(
        text.uppercase(java.util.Locale.US),
        color = color,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        letterSpacing = 0.08.em,
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 18.dp, bottom = Spacing.s2),
    )
}

/** Rounded dashed outline (1dp) — the "add new" lead-time chip affordance. */
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
