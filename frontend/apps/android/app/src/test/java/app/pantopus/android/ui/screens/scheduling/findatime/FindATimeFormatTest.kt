@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.findatime

import app.pantopus.android.data.api.models.scheduling.SlotDto
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class FindATimeFormatTest {
    @Test
    fun durationLabel_formats_minutes_and_hours() {
        assertEquals("30 min", FindATimeFormat.durationLabel(30))
        assertEquals("1 hr", FindATimeFormat.durationLabel(60))
        assertEquals("1 hr 30 min", FindATimeFormat.durationLabel(90))
        assertEquals("45 min", FindATimeFormat.durationLabel(45))
    }

    @Test
    fun peopleLabel_pluralizes() {
        assertEquals("1 person", FindATimeFormat.peopleLabel(1))
        assertEquals("3 people", FindATimeFormat.peopleLabel(3))
    }

    @Test
    fun freeLabel_distinguishes_all_vs_partial() {
        assertEquals("All 3 free", FindATimeFormat.freeLabel(3, 3))
        assertEquals("2 of 3 free", FindATimeFormat.freeLabel(2, 3))
    }

    @Test
    fun windowPhrase_buckets_by_span() {
        val from = LocalDate.of(2026, 6, 15)
        assertEquals("this week", FindATimeFormat.windowPhrase(from, from.plusDays(6)))
        assertEquals("next 2 weeks", FindATimeFormat.windowPhrase(from, from.plusDays(13)))
    }

    @Test
    fun bucketIndexForHour_maps_into_two_hour_buckets() {
        val starts = listOf(8, 10, 12, 14, 16, 18)
        assertEquals(0, FindATimeFormat.bucketIndexForHour(8, starts, 2))
        assertEquals(0, FindATimeFormat.bucketIndexForHour(9, starts, 2))
        assertEquals(2, FindATimeFormat.bucketIndexForHour(13, starts, 2))
        assertEquals(-1, FindATimeFormat.bucketIndexForHour(7, starts, 2))
        assertEquals(-1, FindATimeFormat.bucketIndexForHour(20, starts, 2))
    }

    @Test
    fun dayLabel_prefers_startLocal() {
        val slot = SlotDto(start = "2026-06-22T21:00:00Z", startLocal = "2026-06-22T14:00:00")
        assertEquals("Mon Jun 22", FindATimeFormat.dayLabel(slot))
    }

    @Test
    fun zoned_renders_utc_instant_in_zone() {
        // 2026-06-22T21:00Z is 2:00 PM in America/Los_Angeles (PDT, -7).
        assertEquals("Mon Jun 22", FindATimeFormat.zonedDay("2026-06-22T21:00:00Z", "America/Los_Angeles"))
        assertEquals("2:00 PM", FindATimeFormat.zonedTime("2026-06-22T21:00:00Z", "America/Los_Angeles"))
    }

    @Test
    fun isoDate_emits_iso_local_date() {
        assertEquals("2026-06-15", FindATimeFormat.isoDate(LocalDate.of(2026, 6, 15)))
    }
}
