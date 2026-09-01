@file:Suppress("PackageNaming", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling._shared

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The reusable date+time slot grid. Consumes a `List<SlotDto>`, renders
 * `startLocal` (falling back to `start`), and exposes selection — used by the
 * invitee picker (C6), host reschedule/reassign (E4), find-a-time (F5), etc.
 *
 * The accent follows the host's pillar for today / selected; all other chrome
 * stays neutral. [SlotTimeList] is the time grid; [MonthCalendar] is the day
 * grid; feature screens stack them per the design.
 */
private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

private fun localTimeOf(slot: SlotDto): LocalTime? {
    val raw = slot.startLocal ?: slot.start
    return runCatching { LocalDateTime.parse(raw).toLocalTime() }
        .recoverCatching { OffsetDateTime.parse(raw).toLocalTime() }
        .getOrNull()
}

/** "9:30 AM" from a slot's local time (best-effort; falls back to the raw value). */
fun slotTimeLabel(slot: SlotDto): String = localTimeOf(slot)?.format(TIME_FORMAT) ?: (slot.startLocal ?: slot.start)

/** Morning / Afternoon / Evening bucket for grouping. */
enum class SlotDaypart(val label: String) {
    Morning("Morning"),
    Afternoon("Afternoon"),
    Evening("Evening"),
}

private const val NOON_HOUR = 12
private const val EVENING_HOUR = 17

private fun daypartOf(slot: SlotDto): SlotDaypart {
    val hour = localTimeOf(slot)?.hour ?: NOON_HOUR
    return when {
        hour < NOON_HOUR -> SlotDaypart.Morning
        hour < EVENING_HOUR -> SlotDaypart.Afternoon
        else -> SlotDaypart.Evening
    }
}

/**
 * The day's bookable times, grouped Morning/Afternoon/Evening. [selectedStart]
 * is the UTC `start` of the chosen slot; [hostHintFor] supplies the optional
 * host-local hint ("12:30 PM for Maria") shown under a chosen row.
 */
@Composable
fun SlotTimeList(
    slots: List<SlotDto>,
    selectedStart: String?,
    onSelect: (SlotDto) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    disabledStarts: Set<String> = emptySet(),
    hostHintFor: (SlotDto) -> String? = { null },
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SlotDaypart.entries.forEach { part ->
            val partSlots = slots.filter { daypartOf(it) == part }
            if (partSlots.isEmpty()) return@forEach
            Text(
                text = part.label.uppercase(),
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = Spacing.s1, start = Spacing.s1),
            )
            partSlots.forEach { slot ->
                SlotRow(
                    slot = slot,
                    chosen = slot.start == selectedStart,
                    disabled = slot.start in disabledStarts,
                    accent = accent,
                    hostHint = hostHintFor(slot),
                    onClick = { onSelect(slot) },
                )
            }
        }
    }
}

@Composable
private fun SlotRow(
    slot: SlotDto,
    chosen: Boolean,
    disabled: Boolean,
    accent: Color,
    hostHint: String?,
    onClick: () -> Unit,
) {
    val border = if (chosen) accent else PantopusColors.appBorder
    val container = if (chosen) PantopusColors.primary50 else PantopusColors.appSurface
    val label = slotTimeLabel(slot)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (chosen) container else PantopusColors.appSurface)
                .border(if (chosen) 1.5.dp else 1.dp, border, RoundedCornerShape(Radii.lg))
                .clickable(enabled = !disabled, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .semantics { contentDescription = if (disabled) "$label, unavailable" else label },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 14.dp,
            tint = if (chosen) accent else PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color =
                    if (disabled) {
                        PantopusColors.appTextMuted
                    } else if (chosen) {
                        PantopusColors.primary700
                    } else {
                        PantopusColors.appText
                    },
                textDecoration = if (disabled) TextDecoration.LineThrough else TextDecoration.None,
            )
            if (chosen && hostHint != null) {
                Text(text = hostHint, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        PantopusIconImage(
            icon = if (chosen) PantopusIcon.CheckCircle else PantopusIcon.ChevronRight,
            contentDescription = null,
            size = if (chosen) 18.dp else 17.dp,
            tint = if (chosen) accent else PantopusColors.appTextMuted,
        )
    }
}

private val WEEKDAY_INITIALS = listOf("S", "M", "T", "W", "T", "F", "S")
private val DAY_CELL = 36.dp
private val DAY_DISC = 34.dp

/**
 * A month day-grid. [availableDays] are the day-of-month numbers with open
 * slots; [today]/[selectedDay] are day-of-month (or null). [firstWeekdayIndex]
 * is the grid column (0=Sunday) the 1st falls on.
 */
@Composable
fun MonthCalendar(
    monthLabel: String,
    daysInMonth: Int,
    firstWeekdayIndex: Int,
    availableDays: Set<Int>,
    selectedDay: Int?,
    onSelectDay: (Int) -> Unit,
    modifier: Modifier = Modifier,
    today: Int? = null,
    accent: Color = PantopusColors.primary600,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        Text(
            text = monthLabel,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(start = Spacing.s1, bottom = Spacing.s2),
        )
        Row(modifier = Modifier.fillMaxWidth()) {
            WEEKDAY_INITIALS.forEach { initial ->
                Text(
                    text = initial,
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.weight(1f),
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        val cells =
            buildList {
                repeat(firstWeekdayIndex) { add(null) }
                for (d in 1..daysInMonth) add(d)
            }
        cells.chunked(WEEKDAY_INITIALS.size).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1)) {
                week.forEach { day ->
                    Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        if (day != null) {
                            DayCell(
                                day = day,
                                available = day in availableDays,
                                isToday = day == today,
                                selected = day == selectedDay,
                                accent = accent,
                                onClick = { onSelectDay(day) },
                            )
                        }
                    }
                }
                // pad short final weeks so the grid stays aligned
                repeat(WEEKDAY_INITIALS.size - week.size) { Box(modifier = Modifier.weight(1f)) {} }
            }
        }
    }
}

@Composable
private fun DayCell(
    day: Int,
    available: Boolean,
    isToday: Boolean,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    val clickable = available || selected
    Box(
        modifier =
            Modifier
                .size(DAY_CELL)
                .then(if (selected) Modifier.size(DAY_DISC).clip(CircleShape).background(accent) else Modifier)
                .then(if (isToday && !selected) Modifier.size(DAY_DISC).clip(CircleShape).border(1.5.dp, accent, CircleShape) else Modifier)
                .clickable(enabled = clickable, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = day.toString(),
                fontSize = 13.sp,
                fontWeight =
                    if (selected || isToday) {
                        FontWeight.Bold
                    } else if (available) {
                        FontWeight.SemiBold
                    } else {
                        FontWeight.Normal
                    },
                color =
                    when {
                        selected -> PantopusColors.appTextInverse
                        isToday -> accent
                        available -> PantopusColors.appText
                        else -> PantopusColors.appTextMuted
                    },
            )
            if (available && !selected) {
                Box(modifier = Modifier.size(4.dp).clip(CircleShape).background(accent))
            }
        }
    }
}
