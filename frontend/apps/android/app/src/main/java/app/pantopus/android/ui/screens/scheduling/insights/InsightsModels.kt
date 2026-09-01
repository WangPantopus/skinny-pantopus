@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.insights

import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.HostPerformance
import app.pantopus.android.data.api.models.scheduling.NoShowRecent
import app.pantopus.android.data.api.models.scheduling.SummaryByEventType
import app.pantopus.android.data.api.models.scheduling.SummarySparkPoint
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * A17 Insights & reports — the period/filter model the H13 sheet drives, value
 * formatting, and the pure projection builders the four report view-models
 * consume. Everything here is side-effect-free so the aggregations are
 * unit-testable without networking. Mirrors the iOS `InsightsModels.swift`.
 */

// ─── Period & filter (H13 drives this) ──────────────────────────────────────

/**
 * A date-range preset for the insights surfaces. [presetDays] maps onto the
 * report endpoints' `days` query (≤ 365); [InsightsPeriod.Custom] carries an
 * explicit start/end on [InsightsFilter].
 */
enum class InsightsPeriod(val title: String, val presetDays: Int?) {
    Last7("Last 7 days", 7),
    Last30("Last 30 days", 30),
    Last90("Last 90 days", 90),
    YearToDate("Year to date", null),
    Custom("Custom range", null),
}

/**
 * The shared insights filter. The date range drives the API window; the
 * event-type and member selections are applied client-side where a surface
 * supports them.
 */
data class InsightsFilter(
    val period: InsightsPeriod = InsightsPeriod.Last30,
    val customStart: LocalDate? = null,
    val customEnd: LocalDate? = null,
    /** Empty == all event types. */
    val eventTypeIds: Set<String> = emptySet(),
    /** Empty == everyone (business team-performance only). */
    val memberIds: Set<String> = emptySet(),
) {
    /** `days` window the report endpoints accept, clamped to 1…365. */
    fun days(today: LocalDate = LocalDate.now()): Int =
        when (period) {
            InsightsPeriod.Last7, InsightsPeriod.Last30, InsightsPeriod.Last90 -> period.presetDays ?: 30
            InsightsPeriod.YearToDate -> {
                val startOfYear = today.withDayOfYear(1)
                (ChronoUnit.DAYS.between(startOfYear, today).toInt() + 1).coerceIn(1, 365)
            }
            InsightsPeriod.Custom -> {
                val start = customStart
                val end = customEnd
                if (start == null || end == null) {
                    30
                } else {
                    val lo = minOf(start, end)
                    val hi = maxOf(start, end)
                    (ChronoUnit.DAYS.between(lo, hi).toInt() + 1).coerceIn(1, 365)
                }
            }
        }

    /**
     * `from`/`to` UTC day keys (`yyyy-MM-dd`) for `GET /bookings?from&to`. `to`
     * is EXCLUSIVE (the day after the last included day): the backend parses a
     * date-only bound as UTC midnight, so an inclusive `to` would exclude every
     * booking on the final day — including all of today.
     */
    fun range(today: LocalDate = LocalDate.now()): Pair<String, String> {
        if (period == InsightsPeriod.Custom && customStart != null && customEnd != null) {
            val lo = minOf(customStart, customEnd)
            val hi = maxOf(customStart, customEnd)
            return lo.toString() to hi.plusDays(1).toString()
        }
        val from = today.minusDays(days(today).toLong())
        return from.toString() to today.plusDays(1).toString()
    }

    /** Number of non-date filters applied (for the Apply-button badge). */
    val activeFilterCount: Int
        get() = (if (eventTypeIds.isEmpty()) 0 else 1) + (if (memberIds.isEmpty()) 0 else 1)

    /** Short label for the period chip, e.g. "Last 30 days" or "Jun 1 – Jun 13". */
    fun chipLabel(): String {
        if (period == InsightsPeriod.Custom && customStart != null && customEnd != null) {
            val lo = minOf(customStart, customEnd)
            val hi = maxOf(customStart, customEnd)
            return "${InsightsFormat.shortDay(lo)} – ${InsightsFormat.shortDay(hi)}"
        }
        return period.title
    }

    companion object {
        val Default = InsightsFilter()
    }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

object InsightsFormat {
    private val MONTH_DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)

    /** A whole-number percent value (already 0–100) → "13%"; null → em dash. */
    fun percent(
        value: Double?,
        dashIfNil: Boolean = true,
    ): String {
        if (value == null || value.isNaN() || value.isInfinite()) return if (dashIfNil) "—" else "0%"
        return "${value.roundToInt()}%"
    }

    /** A whole-number percent value (already 0–100) → "13%"; null → em dash. */
    fun percent(
        value: Int?,
        dashIfNil: Boolean = true,
    ): String = percent(value?.toDouble(), dashIfNil)

    /** A fraction (0–1) → "13%". */
    fun percentFraction(
        fraction: Double?,
        dashIfNil: Boolean = true,
    ): String {
        if (fraction == null || fraction.isNaN() || fraction.isInfinite()) return if (dashIfNil) "—" else "0%"
        return "${(fraction * 100).roundToInt()}%"
    }

    /** A signed delta percent for the trend chip, e.g. "+12%" / "-4%". */
    fun signedPercent(delta: Int?): String? {
        if (delta == null) return null
        return "${if (delta >= 0) "+" else ""}$delta%"
    }

    /** "30 min" / "1 hr" / "1 hr 30 min". */
    fun duration(minutes: Int?): String {
        if (minutes == null || minutes <= 0) return ""
        return when {
            minutes % 60 == 0 -> "${minutes / 60} hr"
            minutes > 60 -> "${minutes / 60} hr ${minutes % 60} min"
            else -> "$minutes min"
        }
    }

    /** "Jun 1" from a [LocalDate]. */
    fun shortDay(date: LocalDate): String = date.format(MONTH_DAY)

    /** "Jun 16" from a UTC ISO string rendered in [zone]; falls back to the date portion. */
    fun dayLabel(
        iso: String?,
        zone: ZoneId,
    ): String {
        if (iso == null) return ""
        val instant = parseInstant(iso)
        if (instant != null) return instant.atZone(zone).toLocalDate().format(MONTH_DAY)
        return iso.take(10)
    }

    /** Best-effort UTC instant from an ISO string (`…Z` or with an offset). */
    fun parseInstant(iso: String?): Instant? {
        if (iso.isNullOrBlank()) return null
        return runCatching { Instant.parse(iso) }
            .recoverCatching { OffsetDateTime.parse(iso).toInstant() }
            .getOrNull()
    }
}

// ─── Projections ────────────────────────────────────────────────────────────

/** A 2×2 headline metric tile. */
data class MetricTile(
    val id: String,
    val label: String,
    val value: String,
    val delta: Int? = null,
    val caption: String? = null,
)

/** A ranked row (top event types). */
data class RankedRow(
    val id: String,
    val rank: Int,
    val title: String,
    val count: Int,
    /** 0…1 share vs the top row, for the proportion bar. */
    val proportion: Double,
)

/** One bar in a mini bar chart. */
data class DayBar(
    val id: String,
    val dateLabel: String,
    val value: Int,
    /** 0…1 height vs the tallest bar. */
    val proportion: Double,
    val accessibilityLabel: String,
)

/** One segment of a stacked reliability bar. */
data class BreakdownSegment(
    val kind: Kind,
    val label: String,
    val count: Int,
    /** 0…1 of the total. */
    val fraction: Double,
) {
    enum class Kind { Honored, LateCancel, NoShow }

    val id: String get() = kind.name
}

/** Aggregated funnel/stat numbers for a single event type. */
data class EventTypePerf(
    val booked: Int,
    val confirmed: Int,
    val completed: Int,
    val noShow: Int,
    val cancelled: Int,
    /** Percent, `completed / (completed + noShow)` — null when nothing concluded. */
    val completionRate: Double?,
    /** Percent, `noShow / (completed + noShow)` — null when nothing concluded. */
    val noShowRate: Double?,
) {
    companion object {
        val Empty = EventTypePerf(0, 0, 0, 0, 0, null, null)
    }
}

/** A team-member row for team performance. */
data class HostRow(
    val id: String,
    val name: String,
    val initials: String,
    val bookings: Int,
    val completed: Int,
    val noShow: Int,
    val cancelled: Int,
    /** Percent, `noShow / total`. */
    val noShowRate: Double,
    /** 0…1 share of the team's total bookings (round-robin balance bar). */
    val share: Double,
)

/** One selectable option (event type / member) in the H13 filter sheet. */
data class InsightsFilterOption(
    val id: String,
    val name: String,
)

/** How team performance is sorted. */
enum class HostSort(val title: String) {
    Bookings("Bookings"),
    NoShow("No-show rate"),
}

// ─── Pure aggregation ───────────────────────────────────────────────────────

/**
 * Side-effect-free builders. Kept separate from the view-models so the math is
 * directly unit-testable.
 */
object InsightsMath {
    private val DAY_KEY: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)
    private val MONTH_DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)

    /** Bars from the summary's 30-day sparkline (most recent [maxBars]). */
    fun dailyBars(
        sparkline: List<SummarySparkPoint>?,
        maxBars: Int = 14,
    ): List<DayBar> {
        val points = (sparkline ?: emptyList()).takeLast(maxBars)
        val maxValue = max(1, points.maxOfOrNull { it.count } ?: 0)
        val zone = ZoneId.systemDefault()
        return points.mapIndexed { index, point ->
            val value = point.count
            val plural = if (value == 1) "" else "s"
            val spoken = InsightsFormat.dayLabel(point.date, zone)
            DayBar(
                id = "${point.date ?: ""}-$index",
                dateLabel = dayOfMonth(point.date),
                value = value,
                proportion = value.toDouble() / maxValue.toDouble(),
                accessibilityLabel = "$spoken: $value booking$plural",
            )
        }
    }

    /** Bars from raw bookings, bucketed by local day across the window. */
    fun dailyBars(
        bookings: List<BookingDto>,
        zone: ZoneId,
        daysSpan: Int,
        now: Instant = Instant.now(),
        maxBars: Int = 14,
    ): List<DayBar> {
        val counts = HashMap<String, Int>()
        for (booking in bookings) {
            val instant = InsightsFormat.parseInstant(booking.startAt) ?: continue
            val key = instant.atZone(zone).toLocalDate().format(DAY_KEY)
            counts[key] = (counts[key] ?: 0) + 1
        }

        val windowDays = daysSpan.coerceIn(1, maxBars)
        val today = now.atZone(zone).toLocalDate()
        val buckets =
            (windowDays - 1 downTo 0).map { offset ->
                val day = today.minusDays(offset.toLong())
                Triple(day.format(DAY_KEY), day.format(MONTH_DAY), counts[day.format(DAY_KEY)] ?: 0)
            }

        val maxValue = max(1, buckets.maxOfOrNull { it.third } ?: 0)
        return buckets.mapIndexed { index, entry ->
            val plural = if (entry.third == 1) "" else "s"
            DayBar(
                id = "${entry.first}-$index",
                dateLabel = entry.second,
                value = entry.third,
                proportion = entry.third.toDouble() / maxValue.toDouble(),
                accessibilityLabel = "${entry.second}: ${entry.third} booking$plural",
            )
        }
    }

    /** Top event types from the summary's `byEventType`, joined to names. */
    fun topEventTypes(
        byEventType: List<SummaryByEventType>?,
        names: Map<String, String>,
        limit: Int = 5,
    ): List<RankedRow> {
        val buckets =
            (byEventType ?: emptyList())
                .mapNotNull { bucket -> bucket.eventTypeId?.let { it to bucket.count } }
                .sortedByDescending { it.second }
                .take(limit)
        val maxCount = max(1, buckets.maxOfOrNull { it.second } ?: 0)
        return buckets.mapIndexed { index, bucket ->
            RankedRow(
                id = bucket.first,
                rank = index + 1,
                title = names[bucket.first] ?: "Untitled event type",
                count = bucket.second,
                proportion = bucket.second.toDouble() / maxCount.toDouble(),
            )
        }
    }

    /** Funnel/stat numbers for one event type's bookings. */
    fun eventTypePerf(bookings: List<BookingDto>): EventTypePerf {
        val completed = bookings.count { it.status == "completed" }
        val noShow = bookings.count { it.status == "no_show" }
        val cancelled = bookings.count { it.status == "cancelled" || it.status == "declined" }
        val confirmed = bookings.count { it.status == "confirmed" }
        val concluded = completed + noShow
        return EventTypePerf(
            booked = bookings.size,
            confirmed = confirmed,
            completed = completed,
            noShow = noShow,
            cancelled = cancelled,
            completionRate = if (concluded > 0) completed.toDouble() / concluded.toDouble() * 100 else null,
            noShowRate = if (concluded > 0) noShow.toDouble() / concluded.toDouble() * 100 else null,
        )
    }

    /** Reliability breakdown segments from a no-show report. */
    fun breakdown(
        completed: Int,
        cancelled: Int,
        noShow: Int,
    ): List<BreakdownSegment> {
        val total = max(1, completed + cancelled + noShow)
        return listOf(
            BreakdownSegment(BreakdownSegment.Kind.Honored, "Honored", completed, completed.toDouble() / total),
            BreakdownSegment(BreakdownSegment.Kind.LateCancel, "Late cancel", cancelled, cancelled.toDouble() / total),
            BreakdownSegment(BreakdownSegment.Kind.NoShow, "No-show", noShow, noShow.toDouble() / total),
        )
    }

    /** Host rows for team performance, joined to member names and proportioned. */
    fun hostRows(
        hosts: List<HostPerformance>?,
        names: Map<String, String>,
        sort: HostSort = HostSort.Bookings,
    ): List<HostRow> {
        val stats = (hosts ?: emptyList()).filter { it.hostUserId != null }
        val teamTotal = max(1, stats.sumOf { it.total })
        val rows =
            stats.map { stat ->
                val id = stat.hostUserId.orEmpty()
                val name = names[id] ?: "Team member"
                val rate = if (stat.total > 0) stat.noShow.toDouble() / stat.total.toDouble() * 100 else 0.0
                HostRow(
                    id = id,
                    name = name,
                    initials = initials(name),
                    bookings = stat.total,
                    completed = stat.completed,
                    noShow = stat.noShow,
                    cancelled = stat.cancelled,
                    noShowRate = rate,
                    share = stat.total.toDouble() / teamTotal.toDouble(),
                )
            }
        return when (sort) {
            HostSort.Bookings -> rows.sortedByDescending { it.bookings }
            HostSort.NoShow -> rows.sortedByDescending { it.noShowRate }
        }
    }

    /** A balance label for the round-robin distribution. */
    fun balanceLabel(rows: List<HostRow>): String {
        if (rows.size <= 1) return "Only one member takes bookings"
        val maxShare = rows.maxOfOrNull { it.share } ?: return "Evenly distributed"
        val leader = rows.maxByOrNull { it.share } ?: return "Evenly distributed"
        val even = 1.0 / rows.size
        // Within ~12pts of an even split reads as balanced.
        if (maxShare - even <= 0.12) return "Evenly distributed"
        return "Skewed toward ${leader.name}"
    }

    /** Invitee names that recur in the recent list (repeat-offender flag). */
    fun repeatOffenders(recent: List<NoShowRecent>): Set<String> {
        val counts = HashMap<String, Int>()
        for (row in recent) {
            val name = row.inviteeName
            if (name.isNullOrBlank()) continue
            counts[name] = (counts[name] ?: 0) + 1
        }
        return counts.filter { it.value > 1 }.keys
    }

    fun initials(name: String): String {
        val parts = name.split(" ").filter { it.isNotBlank() }.take(2)
        val letters = parts.mapNotNull { it.firstOrNull()?.toString() }
        return if (letters.isEmpty()) "?" else letters.joinToString("").uppercase()
    }

    private fun dayOfMonth(iso: String?): String {
        if (iso == null || iso.length < 10) return ""
        // `yyyy-MM-dd` → day number.
        val day = iso.substring(8, 10)
        return (day.toIntOrNull() ?: 0).toString()
    }
}
