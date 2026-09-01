@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.HostPerformance
import app.pantopus.android.data.api.models.scheduling.NoShowRecent
import app.pantopus.android.data.api.models.scheduling.SummaryByEventType
import app.pantopus.android.data.api.models.scheduling.SummarySparkPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

/** Pure-logic coverage for the insights aggregation + the period/filter model. */
class InsightsMathTest {
    // ─── InsightsFilter ─────────────────────────────────────────────────────

    @Test
    fun `preset days map straight through`() {
        assertEquals(7, InsightsFilter(period = InsightsPeriod.Last7).days())
        assertEquals(30, InsightsFilter(period = InsightsPeriod.Last30).days())
        assertEquals(90, InsightsFilter(period = InsightsPeriod.Last90).days())
    }

    @Test
    fun `custom range is inclusive and clamped to 365`() {
        val span =
            InsightsFilter(
                period = InsightsPeriod.Custom,
                customStart = LocalDate.of(2026, 6, 1),
                customEnd = LocalDate.of(2026, 6, 10),
            ).days()
        assertEquals(10, span)

        val huge =
            InsightsFilter(
                period = InsightsPeriod.Custom,
                customStart = LocalDate.of(2020, 1, 1),
                customEnd = LocalDate.of(2026, 1, 1),
            ).days()
        assertEquals(365, huge)
    }

    @Test
    fun `year to date counts from Jan 1`() {
        val days = InsightsFilter(period = InsightsPeriod.YearToDate).days(today = LocalDate.of(2026, 1, 10))
        assertEquals(10, days)
    }

    @Test
    fun `range spans from minus days through an exclusive day-after-today end`() {
        val (from, to) =
            InsightsFilter(period = InsightsPeriod.Last30).range(today = LocalDate.of(2026, 6, 17))
        assertEquals("2026-05-18", from)
        // Exclusive end: the backend parses date-only bounds as UTC midnight, so
        // covering today requires sending tomorrow.
        assertEquals("2026-06-18", to)
    }

    @Test
    fun `range returns the ordered custom bounds with an exclusive end`() {
        val (from, to) =
            InsightsFilter(
                period = InsightsPeriod.Custom,
                customStart = LocalDate.of(2026, 6, 10),
                customEnd = LocalDate.of(2026, 6, 1),
            ).range()
        assertEquals("2026-06-01", from)
        assertEquals("2026-06-11", to)
    }

    @Test
    fun `active filter count and chip label`() {
        val filter = InsightsFilter(eventTypeIds = setOf("a"), memberIds = setOf("b", "c"))
        assertEquals(2, filter.activeFilterCount)
        assertEquals("Last 30 days", filter.chipLabel())
        val custom =
            InsightsFilter(
                period = InsightsPeriod.Custom,
                customStart = LocalDate.of(2026, 6, 1),
                customEnd = LocalDate.of(2026, 6, 13),
            )
        assertEquals("Jun 1 – Jun 13", custom.chipLabel())
    }

    // ─── InsightsFormat ─────────────────────────────────────────────────────

    @Test
    fun `percent formatting rounds and dashes on nil`() {
        assertEquals("12%", InsightsFormat.percent(12.4))
        assertEquals("13%", InsightsFormat.percent(12.6))
        assertEquals("—", InsightsFormat.percent(null as Double?))
        assertEquals("13%", InsightsFormat.percent(13))
        assertEquals("50%", InsightsFormat.percentFraction(0.5))
    }

    @Test
    fun `signed percent and duration`() {
        assertEquals("+12%", InsightsFormat.signedPercent(12))
        assertEquals("-4%", InsightsFormat.signedPercent(-4))
        assertNull(InsightsFormat.signedPercent(null))
        assertEquals("30 min", InsightsFormat.duration(30))
        assertEquals("1 hr", InsightsFormat.duration(60))
        assertEquals("1 hr 30 min", InsightsFormat.duration(90))
        assertEquals("", InsightsFormat.duration(0))
    }

    @Test
    fun `day labels parse utc`() {
        assertEquals("Jun 16", InsightsFormat.dayLabel("2026-06-16T14:00:00Z", ZoneOffset.UTC))
        assertEquals("Jun 1", InsightsFormat.shortDay(LocalDate.of(2026, 6, 1)))
    }

    // ─── Aggregation ────────────────────────────────────────────────────────

    @Test
    fun `daily bars from sparkline proportion against the tallest`() {
        val bars =
            InsightsMath.dailyBars(
                listOf(
                    SummarySparkPoint("2026-06-14", 1),
                    SummarySparkPoint("2026-06-15", 4),
                    SummarySparkPoint("2026-06-16", 2),
                ),
            )
        assertEquals(3, bars.size)
        assertEquals(1.0, bars[1].proportion, 0.0001)
        assertEquals(0.25, bars[0].proportion, 0.0001)
        assertEquals("16", bars[2].dateLabel)
    }

    @Test
    fun `top event types are name-joined and ranked desc`() {
        val rows =
            InsightsMath.topEventTypes(
                listOf(SummaryByEventType("e1", 2), SummaryByEventType("e2", 5)),
                names = mapOf("e1" to "Intro", "e2" to "Deep dive"),
            )
        assertEquals("Deep dive", rows[0].title)
        assertEquals(1, rows[0].rank)
        assertEquals(1.0, rows[0].proportion, 0.0001)
        assertEquals("Intro", rows[1].title)
    }

    @Test
    fun `event type perf computes funnel + rates`() {
        val perf =
            InsightsMath.eventTypePerf(
                listOf(
                    booking("1", "completed"),
                    booking("2", "completed"),
                    booking("3", "no_show"),
                    booking("4", "cancelled"),
                    booking("5", "confirmed"),
                ),
            )
        assertEquals(5, perf.booked)
        assertEquals(2, perf.completed)
        assertEquals(1, perf.noShow)
        assertEquals(1, perf.cancelled)
        assertEquals(1, perf.confirmed)
        // completed / (completed + noShow) = 2/3 → ~66.7
        assertEquals(66.6, perf.completionRate!!, 0.2)
        assertEquals(33.3, perf.noShowRate!!, 0.2)
    }

    @Test
    fun `event type perf rates are null with nothing concluded`() {
        val perf = InsightsMath.eventTypePerf(listOf(booking("1", "confirmed")))
        assertNull(perf.completionRate)
        assertNull(perf.noShowRate)
    }

    @Test
    fun `breakdown segments sum to one`() {
        val segments = InsightsMath.breakdown(completed = 6, cancelled = 2, noShow = 2)
        assertEquals(3, segments.size)
        val total = segments.sumOf { it.fraction }
        assertEquals(1.0, total, 0.0001)
        assertEquals(0.6, segments[0].fraction, 0.0001)
    }

    @Test
    fun `host rows proportion + sort modes`() {
        val hosts =
            listOf(
                HostPerformance(hostUserId = "u1", total = 6, completed = 5, noShow = 1, cancelled = 0),
                HostPerformance(hostUserId = "u2", total = 4, completed = 1, noShow = 3, cancelled = 0),
            )
        val names = mapOf("u1" to "Ana", "u2" to "Bo")

        val byBookings = InsightsMath.hostRows(hosts, names, HostSort.Bookings)
        assertEquals("Ana", byBookings[0].name)
        assertEquals(0.6, byBookings[0].share, 0.0001)

        val byNoShow = InsightsMath.hostRows(hosts, names, HostSort.NoShow)
        assertEquals("Bo", byNoShow[0].name)
        assertEquals(75.0, byNoShow[0].noShowRate, 0.0001)
    }

    @Test
    fun `balance label reflects distribution`() {
        val even =
            InsightsMath.hostRows(
                listOf(
                    HostPerformance(hostUserId = "a", total = 5),
                    HostPerformance(hostUserId = "b", total = 5),
                ),
                mapOf("a" to "A", "b" to "B"),
            )
        assertEquals("Evenly distributed", InsightsMath.balanceLabel(even))

        val skewed =
            InsightsMath.hostRows(
                listOf(
                    HostPerformance(hostUserId = "a", total = 9),
                    HostPerformance(hostUserId = "b", total = 1),
                ),
                mapOf("a" to "Ana", "b" to "Bo"),
            )
        assertTrue(InsightsMath.balanceLabel(skewed).startsWith("Skewed toward Ana"))

        val solo = InsightsMath.hostRows(listOf(HostPerformance(hostUserId = "a", total = 3)), mapOf("a" to "A"))
        assertEquals("Only one member takes bookings", InsightsMath.balanceLabel(solo))
    }

    @Test
    fun `repeat offenders and initials`() {
        val repeats =
            InsightsMath.repeatOffenders(
                listOf(
                    NoShowRecent(id = "1", inviteeName = "Sam Lee"),
                    NoShowRecent(id = "2", inviteeName = "Sam Lee"),
                    NoShowRecent(id = "3", inviteeName = "Pat Ng"),
                ),
            )
        assertTrue(repeats.contains("Sam Lee"))
        assertTrue(!repeats.contains("Pat Ng"))
        assertEquals("SL", InsightsMath.initials("Sam Lee"))
        assertEquals("?", InsightsMath.initials(""))
    }

    private fun booking(
        id: String,
        status: String,
    ) = BookingDto(id = id, status = status, startAt = "2026-06-10T10:00:00Z", eventTypeId = "e1")
}
