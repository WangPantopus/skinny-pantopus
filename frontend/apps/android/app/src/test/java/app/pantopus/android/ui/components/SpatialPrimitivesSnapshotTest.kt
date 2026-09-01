@file:Suppress("MagicNumber", "LongMethod", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test
import java.util.Date

/**
 * P1.3 — Paparazzi snapshots for the three spatial / temporal
 * primitives. Mirrors `PantopusTests/Core/Design/Components/`
 * `SpatialPrimitivesSnapshotTests.swift`. Each named test produces one
 * baseline PNG under `app/src/test/snapshots/images/`.
 *
 *   - `slot_calendar_*` — one frame per cell state + a mixed-state grid.
 *   - `fuzz_map_*` — one frame per fuzz stop (5 frames).
 *   - `date_span_*` — one frame per tone variant (3 frames).
 */
class SpatialPrimitivesSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    // ── SlotCalendar ───────────────────────────────────────────────

    @Test
    fun slot_calendar_past_cell() {
        paparazzi.snapshot { CalendarFrame(allState = SlotCalendarState.Past) }
    }

    @Test
    fun slot_calendar_today_cell() {
        paparazzi.snapshot { CalendarFrame(allState = SlotCalendarState.Today) }
    }

    @Test
    fun slot_calendar_filled_cell() {
        paparazzi.snapshot { CalendarFrame(allState = SlotCalendarState.Filled) }
    }

    @Test
    fun slot_calendar_open_cell() {
        paparazzi.snapshot { CalendarFrame(allState = SlotCalendarState.Open) }
    }

    @Test
    fun slot_calendar_mine_cell() {
        paparazzi.snapshot { CalendarFrame(allState = SlotCalendarState.Mine) }
    }

    @Test
    fun slot_calendar_mixed_states() {
        paparazzi.snapshot { CalendarFrame(allState = null) }
    }

    // ── FuzzMap ────────────────────────────────────────────────────

    @Test
    fun fuzz_map_exact() {
        paparazzi.snapshot { FuzzFrame(stop = FuzzStop.Exact) }
    }

    @Test
    fun fuzz_map_block() {
        paparazzi.snapshot { FuzzFrame(stop = FuzzStop.Block) }
    }

    @Test
    fun fuzz_map_quarter_mile() {
        paparazzi.snapshot { FuzzFrame(stop = FuzzStop.QuarterMile) }
    }

    @Test
    fun fuzz_map_half_mile() {
        paparazzi.snapshot { FuzzFrame(stop = FuzzStop.HalfMile) }
    }

    @Test
    fun fuzz_map_neighborhood() {
        paparazzi.snapshot { FuzzFrame(stop = FuzzStop.Neighborhood) }
    }

    // ── DateSpan ───────────────────────────────────────────────────

    @Test
    fun date_span_info() {
        paparazzi.snapshot {
            DateSpanFrame(days = 13, from = "MON", to = "WED", tone = DateSpanTone.Info)
        }
    }

    @Test
    fun date_span_success() {
        paparazzi.snapshot {
            DateSpanFrame(days = 7, from = "FRI", to = "THU", tone = DateSpanTone.Success)
        }
    }

    @Test
    fun date_span_warning() {
        paparazzi.snapshot {
            DateSpanFrame(days = 30, from = "TUE", to = "WED", tone = DateSpanTone.Warning)
        }
    }
}

// MARK: - Frame helpers

@Composable
private fun CalendarFrame(allState: SlotCalendarState?) {
    val days =
        if (allState == null) {
            mixedDays()
        } else {
            uniformDays(allState)
        }
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
    ) {
        SlotCalendar(days = days, onSelectDate = {})
    }
}

@Composable
private fun FuzzFrame(stop: FuzzStop) {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
    ) {
        FuzzMap(stop = stop)
    }
}

@Composable
private fun DateSpanFrame(
    days: Int,
    from: String,
    to: String,
    tone: DateSpanTone,
) {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        DateSpan(days = days, fromWeekday = from, toWeekday = to, tone = tone)
    }
}

private fun uniformDays(state: SlotCalendarState): List<SlotCalendarDay> {
    val baseMs = 1_733_011_200_000L // 2024-12-01
    return (0 until 28).map { i ->
        SlotCalendarDay(
            id = "fixture-${state.name}-$i",
            date = Date(baseMs + i * 86_400_000L),
            dayNumber = (i % 30) + 1,
            state = state,
        )
    }
}

private fun mixedDays(): List<SlotCalendarDay> {
    val baseMs = 1_733_011_200_000L
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
    return states.mapIndexed { i, s ->
        SlotCalendarDay(
            id = "mixed-$i",
            date = Date(baseMs + i * 86_400_000L),
            dayNumber = (i % 30) + 1,
            state = s,
        )
    }
}
