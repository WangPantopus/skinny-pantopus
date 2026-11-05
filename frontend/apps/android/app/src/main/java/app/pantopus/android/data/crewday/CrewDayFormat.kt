@file:Suppress("MagicNumber")

package app.pantopus.android.data.crewday

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/**
 * Crew Day's words for money and time (01-spec.md, "Copy"): times in the Crew Day's own time zone, written
 * "9 AM–1 PM" and "Tue, Nov 17"; whole-dollar prices without cents ("$180") and receipts with them ("$180.00").
 */
@Suppress("TooManyFunctions")
object CrewDayFormat {
    private val locale: Locale get() = Locale.US
    private val dateShort: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEE, MMM d", locale)
    private val dateLong: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEEE, MMM d", locale)
    private val weekday: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEEE", locale)

    /** The zone Crew Days run in unless a day says otherwise (the pilot is in Camas, WA). */
    val DEFAULT_ZONE: ZoneId = ZoneId.of("America/Los_Angeles")

    fun zone(timezone: String?): ZoneId = timezone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: DEFAULT_ZONE

    /** Parses an ISO-8601 instant (with `Z` or an offset); null when absent or unreadable. */
    fun instant(raw: String?): Instant? {
        if (raw.isNullOrBlank()) return null
        return try {
            Instant.parse(raw)
        } catch (_: DateTimeParseException) {
            runCatching { ZonedDateTime.parse(raw).toInstant() }.getOrNull()
        }
    }

    /** `2026-11-17` → the date; null when absent or unreadable. */
    fun date(raw: String?): LocalDate? = raw?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

    /** `09:00` or `09:00:00` → the time of day; null when absent or unreadable. */
    fun time(raw: String?): LocalTime? = raw?.takeIf { it.isNotBlank() }?.let { runCatching { LocalTime.parse(it) }.getOrNull() }

    /** "$180" (whole dollars, no cents), "$1,440"; "$180.50" keeps the cents when there are some. */
    fun price(cents: Int?): String {
        val value = cents ?: 0
        val dollars = NumberFormat.getIntegerInstance(locale).format(value / 100)
        val rest = value % 100
        return if (rest == 0) "$$dollars" else "$$dollars.${rest.toString().padStart(2, '0')}"
    }

    /** "$180.00": a receipt's amount. */
    fun receipt(cents: Int?): String {
        val value = cents ?: 0
        val dollars = NumberFormat.getIntegerInstance(locale).format(value / 100)
        return "$$dollars.${(value % 100).toString().padStart(2, '0')}"
    }

    /** "9 AM", "9:30 AM", "12 PM". */
    fun clock(time: LocalTime): String {
        val hour = if (time.hour % 12 == 0) 12 else time.hour % 12
        val suffix = if (time.hour < 12) "AM" else "PM"
        return if (time.minute == 0) "$hour $suffix" else "$hour:${time.minute.toString().padStart(2, '0')} $suffix"
    }

    /** "9 AM–1 PM"; "10–11 AM" when both ends share AM or PM. Null without both ends. */
    fun window(
        start: LocalTime?,
        end: LocalTime?,
    ): String? {
        if (start == null || end == null) return null
        val sameHalf = (start.hour < 12) == (end.hour < 12)
        return if (sameHalf) "${clock(start).substringBefore(' ')}–${clock(end)}" else "${clock(start)}–${clock(end)}"
    }

    /** The arrival window from a day's `window_start` / `window_end`: "9 AM–1 PM". */
    fun window(
        start: String?,
        end: String?,
    ): String? = window(time(start), time(end))

    /** An ETA from two instants, in [zone]: "10–11 AM". */
    fun eta(
        start: String?,
        end: String?,
        zone: ZoneId,
    ): String? =
        window(
            instant(start)?.atZone(zone)?.toLocalTime(),
            instant(end)?.atZone(zone)?.toLocalTime(),
        )

    /** "Tue, Nov 17". */
    fun shortDate(date: LocalDate?): String? = date?.format(dateShort)

    /** "Tuesday, Nov 17". */
    fun longDate(date: LocalDate?): String? = date?.format(dateLong)

    /** "Tuesday". */
    fun weekday(date: LocalDate?): String? = date?.format(weekday)

    /** "Tue, Nov 17" from a `YYYY-MM-DD` string. */
    fun shortDate(raw: String?): String? = shortDate(date(raw))

    /** An instant's date in [zone]: "Sun, Nov 15". */
    fun shortDate(
        instant: Instant?,
        zone: ZoneId,
    ): String? = instant?.atZone(zone)?.toLocalDate()?.let(::shortDate)

    /** An instant's clock time in [zone]: "9 AM", "11:42 AM". */
    fun clock(
        instant: Instant?,
        zone: ZoneId,
    ): String? = instant?.atZone(zone)?.toLocalTime()?.let(::clock)

    /** "Tue, Nov 17 · 9 AM–1 PM". */
    fun dateAndWindow(
        serviceDate: String?,
        windowStart: String?,
        windowEnd: String?,
    ): String = listOfNotNull(shortDate(serviceDate), window(windowStart, windowEnd)).joinToString(" · ")

    /** "Gutter cleaning" for `gutter_cleaning`. */
    fun service(key: String?): String =
        when (key) {
            "gutter_cleaning" -> "Gutter cleaning"
            "leaf_cleanup" -> "Leaf cleanup"
            "roof_moss" -> "Roof moss"
            "holiday_lights" -> "Holiday lights"
            "window_washing" -> "Window washing"
            "pressure_washing" -> "Pressure washing"
            else -> "Something else"
        }

    /** The services a crew or a street request picks from, in the spec's order. */
    val SERVICES: List<String> =
        listOf("gutter_cleaning", "leaf_cleanup", "roof_moss", "holiday_lights", "window_washing", "pressure_washing", "other")
}
