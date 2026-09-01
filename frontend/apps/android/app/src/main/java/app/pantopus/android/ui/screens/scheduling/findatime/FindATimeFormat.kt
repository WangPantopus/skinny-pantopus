@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.scheduling.findatime

import app.pantopus.android.data.api.models.scheduling.SlotDto
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Pure (Android-free) formatting + slot-bucketing helpers for Stream A11 so the
 * view-models stay JVM-unit-testable. Slots arrive as UTC `start` + a
 * pre-rendered `startLocal`; we render `startLocal` and compare on `start` per
 * the global wiring contract.
 */
object FindATimeFormat {
    private val DAY_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
    private val DAY_LONG_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.US)
    private val WINDOW_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
    private val ISO_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    /** Best-effort local date-time of a slot (prefers `startLocal`, then `start`). */
    fun localDateTime(slot: SlotDto): LocalDateTime? {
        val raw = slot.startLocal ?: slot.start
        return runCatching { LocalDateTime.parse(raw) }
            .recoverCatching { OffsetDateTime.parse(raw).toLocalDateTime() }
            .getOrNull()
    }

    /** The slot's UTC instant (for storage/compare). */
    fun instant(slot: SlotDto): Instant? =
        runCatching { Instant.parse(slot.start) }
            .recoverCatching { OffsetDateTime.parse(slot.start).toInstant() }
            .getOrNull()

    /** "Sun Jun 22" from a slot's local time (falls back to the raw value). */
    fun dayLabel(slot: SlotDto): String = localDateTime(slot)?.format(DAY_FMT) ?: (slot.startLocal ?: slot.start)

    /** "Sunday, Jun 22". */
    fun dayLongLabel(slot: SlotDto): String = localDateTime(slot)?.format(DAY_LONG_FMT) ?: dayLabel(slot)

    /** "3 people". */
    fun peopleLabel(count: Int): String = if (count == 1) "1 person" else "$count people"

    /** "30 min" / "1 hr" / "1 hr 30 min". */
    fun durationLabel(min: Int): String =
        when {
            min < MIN_PER_HOUR -> "$min min"
            min % MIN_PER_HOUR == 0 -> "${min / MIN_PER_HOUR} hr"
            else -> "${min / MIN_PER_HOUR} hr ${min % MIN_PER_HOUR} min"
        }

    /** "Sun Jun 15 — Sat Jun 21" for the date-window control. */
    fun rangeLabel(
        from: LocalDate,
        to: LocalDate,
    ): String = "${from.format(WINDOW_FMT)} — ${to.format(WINDOW_FMT)}"

    /** A short window phrase for the F5 sub-head ("this week" / "next 2 weeks"). */
    fun windowPhrase(
        from: LocalDate,
        to: LocalDate,
    ): String {
        val span = java.time.temporal.ChronoUnit.DAYS.between(from, to)
        return when {
            span <= DAYS_IN_WEEK -> "this week"
            span <= 2 * DAYS_IN_WEEK -> "next 2 weeks"
            else -> rangeLabel(from, to)
        }
    }

    fun isoDate(date: LocalDate): String = date.format(ISO_DATE)

    private val TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

    private fun zoned(
        utcIso: String,
        zoneId: String,
    ): java.time.ZonedDateTime? {
        val instant =
            runCatching { Instant.parse(utcIso) }
                .recoverCatching { OffsetDateTime.parse(utcIso).toInstant() }
                .getOrNull() ?: return null
        val zone = runCatching { ZoneId.of(zoneId) }.getOrDefault(ZoneId.systemDefault())
        return java.time.ZonedDateTime.ofInstant(instant, zone)
    }

    /** "Sun Jun 22" for a UTC instant rendered in [zoneId]. */
    fun zonedDay(
        utcIso: String,
        zoneId: String,
    ): String = zoned(utcIso, zoneId)?.format(DAY_FMT) ?: utcIso

    /** "2:00 PM" for a UTC instant rendered in [zoneId]. */
    fun zonedTime(
        utcIso: String,
        zoneId: String,
    ): String = zoned(utcIso, zoneId)?.format(TIME_FMT) ?: utcIso

    /**
     * Free-label for an F5 slot: "All 3 free" when everyone is, else
     * "2 of 3 free".
     */
    fun freeLabel(
        freeCount: Int,
        total: Int,
    ): String = if (freeCount >= total) "All $total free" else "$freeCount of $total free"

    /**
     * Which of the six F7 day buckets [bucketStartHours] a free slot falls into,
     * by its local start hour; -1 when outside the grid. A bucket spans
     * `[hour, hour + bucketSpanHours)`.
     */
    fun bucketIndexForHour(
        hour: Int,
        bucketStartHours: List<Int>,
        bucketSpanHours: Int,
    ): Int = bucketStartHours.indexOfFirst { start -> hour >= start && hour < start + bucketSpanHours }

    private const val MIN_PER_HOUR = 60
    private const val DAYS_IN_WEEK = 7L

    /** Convenience: the device's IANA zone id. */
    fun deviceZoneId(): String = ZoneId.systemDefault().id
}
