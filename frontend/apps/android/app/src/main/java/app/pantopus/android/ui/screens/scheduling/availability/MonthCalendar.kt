@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.availability

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.YearMonth

private val WEEKDAY_HEADERS = listOf("S", "M", "T", "W", "T", "F", "S")
private val DAY_CELL = 36.dp

/**
 * A compact, Sunday-first month calendar. The selected day fills a sky circle;
 * days with an override carry a small dot. Used by the date-overrides screen.
 */
@Composable
fun MonthCalendar(
    month: YearMonth,
    selectedDate: LocalDate?,
    markedDates: Set<LocalDate>,
    onSelect: (LocalDate) -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
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
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(monthTitle(month), color = PantopusColors.appText, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
            Row {
                Box(modifier = Modifier.size(28.dp).clip(CircleShape).clickable(onClick = onPrev), contentAlignment = Alignment.Center) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = "Previous month",
                        size = 17.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
                Box(modifier = Modifier.size(28.dp).clip(CircleShape).clickable(onClick = onNext), contentAlignment = Alignment.Center) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = "Next month",
                        size = 17.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            WEEKDAY_HEADERS.forEach { header ->
                Text(
                    header,
                    modifier = Modifier.weight(1f),
                    color = PantopusColors.appTextMuted,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            }
        }
        val firstDay = month.atDay(1)
        val leadingBlanks = firstDay.dayOfWeek.value % 7 // Sunday-first offset
        val daysInMonth = month.lengthOfMonth()
        val cells = List(leadingBlanks) { 0 } + (1..daysInMonth).toList()
        cells.chunked(7).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
                for (i in 0 until 7) {
                    val day = week.getOrNull(i) ?: 0
                    Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        if (day > 0) {
                            val date = month.atDay(day)
                            DayCell(
                                day = day,
                                selected = date == selectedDate,
                                marked = date in markedDates,
                                isToday = date == LocalDate.now(),
                                onClick = { onSelect(date) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    day: Int,
    selected: Boolean,
    marked: Boolean,
    isToday: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(DAY_CELL)
                .clip(CircleShape)
                .background(if (selected) PantopusColors.primary600 else PantopusColors.appSurface)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            day.toString(),
            // Tint today's number primary600 when not the selected day (mirrors iOS).
            color =
                when {
                    selected -> PantopusColors.appTextInverse
                    isToday -> PantopusColors.primary600
                    else -> PantopusColors.appText
                },
            fontSize = 12.sp,
            fontWeight = if (selected || isToday) FontWeight.Bold else FontWeight.Medium,
        )
        if (marked && !selected) {
            Box(
                modifier =
                    Modifier
                        .padding(top = 18.dp)
                        .size(4.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}
