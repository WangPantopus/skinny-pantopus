@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.availability

import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId

class AvailabilityFormatTest {
    private fun rule(
        weekday: Int,
        start: String = "09:00",
        end: String = "17:00",
    ) = AvailabilityRuleDto(scheduleId = "s1", weekday = weekday, startTime = start, endTime = end)

    @Test
    fun `formatTime12 renders 12-hour clock`() {
        assertEquals("9:00 AM", formatTime12("09:00"))
        assertEquals("5:00 PM", formatTime12("17:00"))
        assertEquals("12:00 PM", formatTime12("12:00"))
        assertEquals("12:30 AM", formatTime12("00:30"))
    }

    @Test
    fun `formatRange12 joins with en dash`() {
        assertEquals("9:00 AM – 5:00 PM", formatRange12("09:00", "17:00"))
    }

    @Test
    fun `normalizeHHmm drops seconds`() {
        assertEquals("09:00", normalizeHHmm("09:00:00"))
        assertEquals("13:05", normalizeHHmm("13:05"))
    }

    @Test
    fun `hhmm stays ASCII under an Arabic-digit default locale`() {
        // hhmm() is the wire format the backend validates with an ASCII-only
        // \d{2}:\d{2} pattern — a localized-digit default locale (ar-EG uses
        // Arabic-Indic digits) must not leak into it.
        val previous = java.util.Locale.getDefault()
        try {
            java.util.Locale.setDefault(java.util.Locale.forLanguageTag("ar-EG"))
            assertEquals("09:05", hhmm(9, 5))
            assertEquals("09:05", normalizeHHmm("09:05:00"))
            assertEquals("9:05 AM", formatTime12("09:05"))
        } finally {
            java.util.Locale.setDefault(previous)
        }
    }

    @Test
    fun `formatDayRange collapses contiguous runs`() {
        assertEquals("Mon–Fri", formatDayRange(setOf(1, 2, 3, 4, 5)))
        assertEquals("Sat–Sun", formatDayRange(setOf(6, 0)))
        assertEquals("Mon, Wed, Fri", formatDayRange(setOf(1, 3, 5)))
    }

    @Test
    fun `scheduleSummary describes a uniform week`() {
        val rules = listOf(rule(1), rule(2), rule(3), rule(4), rule(5))
        assertEquals("Mon–Fri, 9:00 AM – 5:00 PM", scheduleSummary(rules))
    }

    @Test
    fun `scheduleSummary marks varied hours`() {
        val rules = listOf(rule(1, "09:00", "12:00"), rule(2, "13:00", "17:00"))
        assertTrue(scheduleSummary(rules).contains("varied"))
    }

    @Test
    fun `scheduleSummary handles empty`() {
        assertEquals("No hours set", scheduleSummary(emptyList()))
    }

    @Test
    fun `weekday helpers map ISO weekdays`() {
        assertEquals("Sun", weekdayShort(0))
        assertEquals("Sat", weekdayShort(6))
        assertEquals("Monday", weekdayFull(1))
        assertEquals(0, DayOfWeek.SUNDAY.toBackendWeekday())
        assertEquals(1, DayOfWeek.MONDAY.toBackendWeekday())
        assertEquals(6, DayOfWeek.SATURDAY.toBackendWeekday())
    }

    @Test
    fun `usPublicHolidays returns 11 observed days including July 4`() {
        val holidays = usPublicHolidays(2026)
        assertEquals(11, holidays.size)
        assertTrue(holidays.any { it.first == LocalDate.of(2026, 7, 4) && it.second == "Independence Day" })
    }

    @Test
    fun `block repeat maps to RRULE`() {
        assertNull(BlockRepeat.None.toRRule())
        assertEquals("FREQ=WEEKLY", BlockRepeat.Weekly.toRRule())
        assertEquals("FREQ=DAILY", BlockRepeat.Daily.toRRule())
        assertEquals("FREQ=MONTHLY;UNTIL=20260701T000000Z", BlockRepeat.Monthly.toRRule(LocalDate.of(2026, 7, 1)))
    }

    @Test
    fun `start interval maps to and from minutes`() {
        assertEquals(StartInterval.Hourly, StartInterval.fromMinutes(60))
        assertEquals(StartInterval.HalfHour, StartInterval.fromMinutes(30))
        assertEquals(StartInterval.Quarter, StartInterval.fromMinutes(15))
        assertEquals(StartInterval.Quarter, StartInterval.fromMinutes(null))
        assertEquals(15, StartInterval.Quarter.minutes)
    }

    @Test
    fun `toUtcIso composes a UTC instant from a local date-time`() {
        assertEquals("2026-06-18T14:00:00Z", toUtcIso(LocalDate.of(2026, 6, 18), 14, 0, ZoneId.of("UTC")))
        assertEquals("2026-06-18T00:00:00Z", allDayStartIso(LocalDate.of(2026, 6, 18), ZoneId.of("UTC")))
        assertEquals("2026-06-19T00:00:00Z", allDayEndIso(LocalDate.of(2026, 6, 18), ZoneId.of("UTC")))
    }

    @Test
    fun `overrideDetail describes unavailable and custom days`() {
        assertEquals("Unavailable", overrideDetail(isUnavailable = true, start = null, end = null))
        assertEquals("10:00 AM – 2:00 PM", overrideDetail(isUnavailable = false, start = "10:00", end = "14:00"))
    }
}
