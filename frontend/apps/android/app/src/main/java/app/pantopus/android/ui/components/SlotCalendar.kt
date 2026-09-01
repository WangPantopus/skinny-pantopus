@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember", "LongMethod")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Date

/**
 * Visual state for a single day cell in [SlotCalendar].
 *
 *   - [Past]   — inert; muted text, no border / fill.
 *   - [Today]  — primary600 fill + white text + soft halo shadow.
 *   - [Filled] — homeBg fill + home text + 1dp home border.
 *   - [Open]   — dashed primary300 border + appText; tappable.
 *   - [Mine]   — primary50 fill + 1.5dp primary600 border + primary700
 *     text; tappable.
 */
enum class SlotCalendarState {
    Past,
    Today,
    Filled,
    Open,
    Mine,
}

/**
 * One day in the [SlotCalendar] grid. `id` is whatever stable handle the
 * caller wants (ISO `yyyy-MM-dd` is the convention).
 */
data class SlotCalendarDay(
    val id: String,
    val date: Date,
    val dayNumber: Int,
    val state: SlotCalendarState,
)

/**
 * 4-week support-train slot grid (7 × 4) + legend strip.
 *
 * Mirrors `Core/Design/Components/SlotCalendar.swift`. Cells are 40dp
 * with a 4dp gap; only `.Open` and `.Mine` cells are tappable.
 *
 * @param days Exactly 28 cells in row-major order (week 0 Sun … week 3 Sat).
 * @param onSelectDate Invoked when an `.Open` or `.Mine` cell is tapped.
 */
@Composable
fun SlotCalendar(
    days: List<SlotCalendarDay>,
    onSelectDate: (Date) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag("slotCalendar"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        WeekdayHeader()
        Grid(days = days, onSelectDate = onSelectDate)
        Legend()
    }
}

private val WeekdayLetters = listOf("S", "M", "T", "W", "T", "F", "S")
private val CellSide: Dp = 40.dp
private val CellGap: Dp = Spacing.s1

@Composable
private fun WeekdayHeader() {
    Row(horizontalArrangement = Arrangement.spacedBy(CellGap)) {
        for (i in 0 until 7) {
            Box(
                modifier = Modifier.width(CellSide),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = WeekdayLetters[i],
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun Grid(
    days: List<SlotCalendarDay>,
    onSelectDate: (Date) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(CellGap)) {
        for (row in 0 until 4) {
            Row(horizontalArrangement = Arrangement.spacedBy(CellGap)) {
                for (col in 0 until 7) {
                    val idx = row * 7 + col
                    if (idx < days.size) {
                        Cell(day = days[idx], onSelectDate = onSelectDate)
                    } else {
                        Box(modifier = Modifier.size(CellSide))
                    }
                }
            }
        }
    }
}

@Composable
private fun Cell(
    day: SlotCalendarDay,
    onSelectDate: (Date) -> Unit,
) {
    val style = cellStyleOf(day.state)
    val tappable = day.state == SlotCalendarState.Open || day.state == SlotCalendarState.Mine

    val baseShape = RoundedCornerShape(Radii.md)
    var box =
        Modifier
            .size(CellSide)
            .let { m -> if (style.shadowDp > 0.dp) m.shadow(style.shadowDp, baseShape) else m }
            .clip(baseShape)
            .background(style.background)

    box =
        if (day.state == SlotCalendarState.Open) {
            box.drawBehind {
                val stroke = 1.dp.toPx()
                val dash =
                    PathEffect.dashPathEffect(
                        intervals = floatArrayOf(3.dp.toPx(), 2.dp.toPx()),
                        phase = 0f,
                    )
                drawRoundRect(
                    color = style.border,
                    topLeft = Offset(stroke / 2, stroke / 2),
                    size = Size(size.width - stroke, size.height - stroke),
                    cornerRadius =
                        androidx.compose.ui.geometry
                            .CornerRadius(Radii.md.toPx(), Radii.md.toPx()),
                    style = Stroke(width = stroke, pathEffect = dash),
                )
            }
        } else if (style.borderWidth > 0.dp) {
            box.border(style.borderWidth, style.border, baseShape)
        } else {
            box
        }

    box =
        box
            .semantics {
                contentDescription = "${day.dayNumber}, ${day.state.name.lowercase()}"
                if (tappable) role = Role.Button
            }.let { m -> if (tappable) m.clickable { onSelectDate(day.date) } else m }

    Box(modifier = box, contentAlignment = Alignment.Center) {
        Text(
            text = day.dayNumber.toString(),
            color = style.foreground,
            fontSize = 13.sp,
            fontWeight = style.weight,
        )
    }
}

// MARK: - Styling

private data class CellStyle(
    val background: Color,
    val foreground: Color,
    val border: Color,
    val borderWidth: Dp,
    val weight: FontWeight,
    val shadowDp: Dp,
)

private fun cellStyleOf(state: SlotCalendarState): CellStyle =
    when (state) {
        SlotCalendarState.Past ->
            CellStyle(
                background = PantopusColors.appSurface,
                foreground = PantopusColors.appTextMuted,
                border = Color.Transparent,
                borderWidth = 0.dp,
                weight = FontWeight.Normal,
                shadowDp = 0.dp,
            )
        SlotCalendarState.Today ->
            CellStyle(
                background = PantopusColors.primary600,
                foreground = PantopusColors.appTextInverse,
                border = PantopusColors.primary600,
                borderWidth = 1.dp,
                weight = FontWeight.Bold,
                shadowDp = 6.dp,
            )
        SlotCalendarState.Filled ->
            CellStyle(
                background = PantopusColors.homeBg,
                foreground = PantopusColors.home,
                border = PantopusColors.home,
                borderWidth = 1.dp,
                weight = FontWeight.SemiBold,
                shadowDp = 0.dp,
            )
        SlotCalendarState.Open ->
            CellStyle(
                background = PantopusColors.appSurface,
                foreground = PantopusColors.appText,
                border = PantopusColors.primary300,
                borderWidth = 1.dp,
                weight = FontWeight.SemiBold,
                shadowDp = 0.dp,
            )
        SlotCalendarState.Mine ->
            CellStyle(
                background = PantopusColors.primary50,
                foreground = PantopusColors.primary700,
                border = PantopusColors.primary600,
                borderWidth = 1.5.dp,
                weight = FontWeight.Bold,
                shadowDp = 0.dp,
            )
    }

// MARK: - Legend

@Composable
private fun Legend() {
    Row(
        modifier = Modifier.padding(top = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        for (state in SlotCalendarState.values()) {
            LegendChip(state = state)
        }
    }
}

@Composable
private fun LegendChip(state: SlotCalendarState) {
    val style = cellStyleOf(state)
    val swatchShape = RoundedCornerShape(Radii.xs)
    val swatchSize = 10.dp

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        var swatch =
            Modifier
                .size(swatchSize)
                .clip(swatchShape)
                .background(style.background)
        swatch =
            if (state == SlotCalendarState.Open) {
                swatch.drawBehind {
                    val stroke = 1.dp.toPx()
                    val dash =
                        PathEffect.dashPathEffect(
                            intervals = floatArrayOf(2.dp.toPx(), 1.5.dp.toPx()),
                            phase = 0f,
                        )
                    drawRoundRect(
                        color = style.border,
                        topLeft = Offset(stroke / 2, stroke / 2),
                        size = Size(size.width - stroke, size.height - stroke),
                        cornerRadius =
                            androidx.compose.ui.geometry
                                .CornerRadius(Radii.xs.toPx(), Radii.xs.toPx()),
                        style = Stroke(width = stroke, pathEffect = dash),
                    )
                }
            } else if (style.borderWidth > 0.dp) {
                swatch.border(maxOf(style.borderWidth, 0.5.dp), style.border, swatchShape)
            } else {
                swatch
            }
        Box(modifier = swatch)

        Text(
            text = legendLabel(state),
            color = PantopusColors.appTextSecondary,
            fontSize = 12.sp,
        )
    }
}

private fun legendLabel(state: SlotCalendarState): String =
    when (state) {
        SlotCalendarState.Past -> "Past"
        SlotCalendarState.Today -> "Today"
        SlotCalendarState.Filled -> "Covered"
        SlotCalendarState.Open -> "Open"
        SlotCalendarState.Mine -> "Mine"
    }

// MARK: - Preview

@Preview(showBackground = true, widthDp = 360, heightDp = 320)
@Composable
private fun SlotCalendarPreview() {
    val states =
        listOf(
            SlotCalendarState.Past, SlotCalendarState.Past, SlotCalendarState.Past,
            SlotCalendarState.Past, SlotCalendarState.Past, SlotCalendarState.Past, SlotCalendarState.Past,
            SlotCalendarState.Past, SlotCalendarState.Today, SlotCalendarState.Filled, SlotCalendarState.Open,
            SlotCalendarState.Filled, SlotCalendarState.Open, SlotCalendarState.Filled,
            SlotCalendarState.Open, SlotCalendarState.Filled, SlotCalendarState.Open, SlotCalendarState.Mine,
            SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Filled,
            SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Open,
            SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Open, SlotCalendarState.Open,
        )
    val now = Date(1_733_011_200_000L)
    val days =
        states.mapIndexed { i, s ->
            SlotCalendarDay(
                id = "preview-$i",
                date = Date(now.time + i * 86_400_000L),
                dayNumber = (i % 30) + 1,
                state = s,
            )
        }
    Box(modifier = Modifier.background(PantopusColors.appSurface).padding(Spacing.s4)) {
        SlotCalendar(days = days, onSelectDate = {})
    }
}
