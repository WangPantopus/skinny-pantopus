@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.calendar

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * State payload the host VM hands the strip. One row per day in the
 * current 7-day window plus the month label and the host's
 * `selectedIsoDate` (the date the user has tapped to filter the
 * agenda — `null` when nothing is selected and the strip should
 * highlight today only).
 */
@Immutable
data class MonthStripState(
    val monthLabel: String,
    val days: List<Day>,
    val selectedIsoDate: String?,
    val todayIsoDate: String,
) {
    @Immutable
    data class Day(
        /** ISO yyyy-MM-dd. Used as key + comparison. */
        val id: String,
        val dayOfWeek: String,
        val date: Int,
        val eventCount: Int,
    )
}

/**
 * T6.4c — reusable "month label + 7-day week strip" calendar
 * component rendered between the top bar and the agenda list. Lives
 * in the feature folder (NOT the shared shell) per the design brief —
 * the shell hosts it via its `customHeader` slot.
 *
 * The component is pure on its inputs; the caller owns navigation
 * (prev / next month) and selection state.
 */
@Composable
fun MonthStripHeader(
    state: MonthStripState,
    onSelectDay: (String) -> Unit,
    onPrevMonth: () -> Unit,
    onNextMonth: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(
                    start = Spacing.s4,
                    end = Spacing.s4,
                    top = 10.dp,
                    bottom = Spacing.s3,
                )
                .testTag("homeCalendar_monthStrip"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MonthRow(
            monthLabel = state.monthLabel,
            onPrev = onPrevMonth,
            onNext = onNextMonth,
        )
        WeekRow(
            days = state.days,
            selectedIsoDate = state.selectedIsoDate,
            todayIsoDate = state.todayIsoDate,
            onSelect = onSelectDay,
        )
    }
    HorizontalDivider(color = PantopusColors.appBorder)
}

@Composable
private fun MonthRow(
    monthLabel: String,
    onPrev: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            modifier = Modifier.testTag("homeCalendar_monthLabel"),
        ) {
            Text(
                text = monthLabel,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Spacer(Modifier.weight(1f))
        ChevronButton(
            icon = PantopusIcon.ChevronLeft,
            contentDescription = "Previous month",
            tag = "homeCalendar_prevMonth",
            onClick = onPrev,
        )
        Spacer(Modifier.width(Spacing.s1))
        ChevronButton(
            icon = PantopusIcon.ChevronRight,
            contentDescription = "Next month",
            tag = "homeCalendar_nextMonth",
            onClick = onNext,
        )
    }
}

@Composable
private fun ChevronButton(
    icon: PantopusIcon,
    contentDescription: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(26.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun WeekRow(
    days: List<MonthStripState.Day>,
    selectedIsoDate: String?,
    todayIsoDate: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        days.forEach { day ->
            val isSelected = isHighlighted(day, selectedIsoDate, todayIsoDate)
            val isToday = day.id == todayIsoDate
            DayCell(
                day = day,
                isSelected = isSelected,
                isToday = isToday,
                onSelect = onSelect,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

private fun isHighlighted(
    day: MonthStripState.Day,
    selectedIsoDate: String?,
    todayIsoDate: String,
): Boolean =
    if (selectedIsoDate != null) {
        day.id == selectedIsoDate
    } else {
        day.id == todayIsoDate
    }

@Composable
private fun DayCell(
    day: MonthStripState.Day,
    isSelected: Boolean,
    isToday: Boolean,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Spec: each date is a 30dp circular pill — solid green fill when selected,
    // a 1.5dp green ring when it is today but a different day is selected.
    val todayRing = isToday && !isSelected
    val pillBackground = if (isSelected) PantopusColors.home else Color.Transparent
    val dateColor = if (isSelected) PantopusColors.appTextInverse else PantopusColors.appText
    val dotColor = if (isSelected) Color.White.copy(alpha = 0.9f) else PantopusColors.home
    val cellLabel = "${day.dayOfWeek} ${day.date} · ${day.eventCount} events"

    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.sm))
                .clickable { onSelect(day.id) }
                .padding(vertical = 6.dp)
                .testTag("homeCalendar_day_${day.id}")
                .semantics {
                    contentDescription = cellLabel
                    selected = isSelected
                },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(
            text = day.dayOfWeek.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(pillBackground)
                    .then(
                        if (todayRing) {
                            Modifier.border(1.5.dp, PantopusColors.home, CircleShape)
                        } else {
                            Modifier
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = day.date.toString(),
                fontSize = 14.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                color = dateColor,
                textAlign = TextAlign.Center,
            )
        }
        DotsRow(eventCount = day.eventCount, dotColor = dotColor)
    }
}

@Composable
private fun DotsRow(
    eventCount: Int,
    dotColor: Color,
) {
    Row(
        modifier = Modifier.height(4.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(eventCount.coerceAtMost(3)) {
            Box(
                modifier =
                    Modifier
                        .size(4.dp)
                        .clip(CircleShape)
                        .background(dotColor),
            )
        }
    }
}
