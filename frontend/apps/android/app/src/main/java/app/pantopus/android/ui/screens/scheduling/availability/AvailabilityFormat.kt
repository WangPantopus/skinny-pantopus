@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.availability

import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters
import java.util.Locale

/**
 * Pure (JVM-testable) formatting + mapping helpers shared across the A3
 * Availability screens. No Compose, no Android — so they run on the plain JVM
 * unit-test classpath.
 *
 * Backend conventions (see `reference/calendarly-backend-api.md`):
 *  - weekly rules use `weekday` ISO `0=Sunday … 6=Saturday`, times `HH:MM`/`HH:MM:SS`.
 *  - overrides use `date` `YYYY-MM-DD`.
 *  - blocks use ISO-8601 UTC `start_at`/`end_at`.
 */

/** Weekday rendering order — Monday-first, the way the design grid reads. */
val WEEKDAY_DISPLAY_ORDER: List<Int> = listOf(1, 2, 3, 4, 5, 6, 0)

/** Short weekday label for a backend ISO weekday (`0=Sun … 6=Sat`). */
fun weekdayShort(weekday: Int): String =
    when (weekday) {
        0 -> "Sun"
        1 -> "Mon"
        2 -> "Tue"
        3 -> "Wed"
        4 -> "Thu"
        5 -> "Fri"
        6 -> "Sat"
        else -> ""
    }

/** Full weekday label for a backend ISO weekday (`0=Sun … 6=Sat`). */
fun weekdayFull(weekday: Int): String =
    when (weekday) {
        0 -> "Sunday"
        1 -> "Monday"
        2 -> "Tuesday"
        3 -> "Wednesday"
        4 -> "Thursday"
        5 -> "Friday"
        6 -> "Saturday"
        else -> ""
    }

/** Map a java.time [DayOfWeek] to the backend ISO weekday (`0=Sun … 6=Sat`). */
fun DayOfWeek.toBackendWeekday(): Int = if (this == DayOfWeek.SUNDAY) 0 else value

/** Parse `"HH:MM"` / `"HH:MM:SS"` into `(hour, minute)`, defaulting to `(0,0)`. */
fun parseHourMinute(raw: String): Pair<Int, Int> {
    val parts = raw.split(":")
    val hour = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 0
    val minute = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
    return hour to minute
}

/** Canonicalize a time to `"HH:MM"` (drops seconds the backend may include). */
fun normalizeHHmm(raw: String): String {
    val (hour, minute) = parseHourMinute(raw)
    return hhmm(hour, minute)
}

/** Minutes since midnight for an `"HH:MM"` / `"HH:MM:SS"` time. */
fun minutesOfDay(raw: String): Int {
    val (hour, minute) = parseHourMinute(raw)
    return hour * 60 + minute
}

/**
 * `"HH:MM"` for an hour/minute pair. Locale.ROOT-pinned: this is the WIRE
 * format (rules PUT bodies validate against an ASCII `\d{2}:\d{2}` pattern
 * server-side), so locale digit substitution (e.g. Arabic-Indic) must never
 * leak in from the device locale.
 */
fun hhmm(
    hour: Int,
    minute: Int,
): String = "%02d:%02d".format(Locale.ROOT, hour, minute)

/** `"9:00 AM"` for a `"HH:MM"` 24-hour time. */
fun formatTime12(hhmm: String): String {
    val (hour, minute) = parseHourMinute(hhmm)
    return formatTime12(hour, minute)
}

/** `"9:00 AM"` for an hour/minute pair (Locale.US display digits). */
fun formatTime12(
    hour: Int,
    minute: Int,
): String {
    val period = if (hour < 12) "AM" else "PM"
    val hour12 = if (hour % 12 == 0) 12 else hour % 12
    return "%d:%02d %s".format(Locale.US, hour12, minute, period)
}

/** `"9:00 AM – 5:00 PM"` for a start/end `"HH:MM"` pair. */
fun formatRange12(
    start: String,
    end: String,
): String = "${formatTime12(start)} – ${formatTime12(end)}"

/**
 * A compact, human summary of a schedule's weekly rules, e.g.
 * `"Mon–Fri, 9:00 AM – 5:00 PM"`, `"Sat–Sun, 10:00 AM – 4:00 PM"`, or
 * `"Mon, Wed, Fri · varied hours"`. Returns `"No hours set"` when empty.
 */
fun scheduleSummary(rules: List<AvailabilityRuleDto>): String {
    if (rules.isEmpty()) return "No hours set"
    val activeDays = rules.map { it.weekday }.distinct()
    val dayLabel = formatDayRange(activeDays)
    val ranges = rules.map { normalizeHHmm(it.startTime) to normalizeHHmm(it.endTime) }.distinct()
    val singleRulePerDay = rules.groupBy { it.weekday }.all { it.value.size == 1 }
    return if (ranges.size == 1 && singleRulePerDay) {
        val (start, end) = ranges.first()
        "$dayLabel, ${formatRange12(start, end)}"
    } else {
        "$dayLabel · varied hours"
    }
}

/**
 * `"Mon–Fri"` for a contiguous run, `"Mon, Wed, Fri"` otherwise. Days are
 * ordered Monday-first; contiguous runs of 3+ collapse to a dashed range.
 */
fun formatDayRange(weekdays: Collection<Int>): String {
    val ordered = WEEKDAY_DISPLAY_ORDER.filter { it in weekdays }
    if (ordered.isEmpty()) return ""
    val runs = mutableListOf<MutableList<Int>>()
    for (day in ordered) {
        val last = runs.lastOrNull()?.lastOrNull()
        val lastIndex = last?.let { WEEKDAY_DISPLAY_ORDER.indexOf(it) } ?: -2
        val thisIndex = WEEKDAY_DISPLAY_ORDER.indexOf(day)
        if (last != null && thisIndex == lastIndex + 1) {
            runs.last().add(day)
        } else {
            runs.add(mutableListOf(day))
        }
    }
    return runs.joinToString(", ") { run ->
        if (run.size >= 2) {
            "${weekdayShort(run.first())}–${weekdayShort(run.last())}"
        } else {
            run.joinToString(", ") { weekdayShort(it) }
        }
    }
}

/** `"Mon–Fri, 9–5"`-class short label used in list rows when a quick hint helps. */
fun overrideDetail(
    isUnavailable: Boolean,
    start: String?,
    end: String?,
): String =
    if (isUnavailable || start == null || end == null) {
        "Unavailable"
    } else {
        formatRange12(start, end)
    }

private val OVERRIDE_DATE_FORMAT: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)

/** `"Sat, Jul 4"` for a `YYYY-MM-DD` override date; falls back to the raw value. */
fun formatOverrideDate(isoDate: String): String =
    runCatching { LocalDate.parse(isoDate).format(OVERRIDE_DATE_FORMAT) }.getOrDefault(isoDate)

private val FULL_DATE_FORMAT: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.US)

/** `"Thursday, Jun 18"` for a [LocalDate]. */
fun formatFullDate(date: LocalDate): String = date.format(FULL_DATE_FORMAT)

/** A friendly timezone label, e.g. `"America/Los_Angeles"` → `"Los Angeles"`. */
fun friendlyTimezone(id: String?): String {
    if (id.isNullOrBlank()) return "Auto-detected"
    return id.substringAfterLast('/').replace('_', ' ')
}

/**
 * Build the 11 observed US public holidays for [year] (fixed + floating),
 * returned as `(date, name)` ordered by date. Used by the date-overrides
 * holiday-set toggle.
 */
fun usPublicHolidays(year: Int): List<Pair<LocalDate, String>> {
    fun nth(
        month: Int,
        dow: DayOfWeek,
        n: Int,
    ): LocalDate = LocalDate.of(year, month, 1).with(TemporalAdjusters.dayOfWeekInMonth(n, dow))

    fun last(
        month: Int,
        dow: DayOfWeek,
    ): LocalDate = LocalDate.of(year, month, 1).with(TemporalAdjusters.lastInMonth(dow))

    return listOf(
        LocalDate.of(year, 1, 1) to "New Year's Day",
        nth(1, DayOfWeek.MONDAY, 3) to "Martin Luther King Jr. Day",
        nth(2, DayOfWeek.MONDAY, 3) to "Presidents' Day",
        last(5, DayOfWeek.MONDAY) to "Memorial Day",
        LocalDate.of(year, 6, 19) to "Juneteenth",
        LocalDate.of(year, 7, 4) to "Independence Day",
        nth(9, DayOfWeek.MONDAY, 1) to "Labor Day",
        nth(10, DayOfWeek.MONDAY, 2) to "Indigenous Peoples' Day",
        LocalDate.of(year, 11, 11) to "Veterans Day",
        nth(11, DayOfWeek.THURSDAY, 4) to "Thanksgiving",
        LocalDate.of(year, 12, 25) to "Christmas Day",
    ).sortedBy { it.first }
}

/** `"MMM d"` (e.g. `"Jul 4"`) for a holiday date. */
fun formatHolidayDate(date: LocalDate): String = date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))

/** Month + year header, e.g. `"July 2026"`. */
fun monthTitle(yearMonth: java.time.YearMonth): String = "${yearMonth.month.getDisplayName(TextStyle.FULL, Locale.US)} ${yearMonth.year}"

/**
 * Compose a UTC ISO-8601 instant string from a local date+time in [zone].
 * The engine stores/compares UTC; the UI renders local — this is the write side.
 */
fun toUtcIso(
    date: LocalDate,
    hour: Int,
    minute: Int,
    zone: ZoneId = ZoneId.systemDefault(),
): String =
    ZonedDateTime.of(date, LocalTime.of(hour, minute), zone)
        .toInstant()
        .toString()

/** All-day start (00:00 local → UTC). */
fun allDayStartIso(
    date: LocalDate,
    zone: ZoneId = ZoneId.systemDefault(),
): String = toUtcIso(date, 0, 0, zone)

/** All-day end (next-day 00:00 local → UTC), making the block span the full day. */
fun allDayEndIso(
    date: LocalDate,
    zone: ZoneId = ZoneId.systemDefault(),
): String = toUtcIso(date.plusDays(1), 0, 0, zone)

/** How a block repeats; maps to an optional RRULE on write. */
enum class BlockRepeat(val label: String) {
    None("Does not repeat"),
    Daily("Daily"),
    Weekly("Weekly"),
    Monthly("Monthly"),
    ;

    /** RRULE string for the engine, or null for a one-off. Adds `UNTIL` when [until] is set. */
    fun toRRule(until: LocalDate? = null): String? {
        val freq =
            when (this) {
                None -> return null
                Daily -> "DAILY"
                Weekly -> "WEEKLY"
                Monthly -> "MONTHLY"
            }
        val untilClause =
            until?.let { ";UNTIL=${it.format(DateTimeFormatter.ofPattern("yyyyMMdd"))}T000000Z" }.orEmpty()
        return "FREQ=$freq$untilClause"
    }
}

/** Where slot start times land within the hour — maps to `slot_interval_min`. */
enum class StartInterval(val minutes: Int, val label: String) {
    Hourly(60, ":00 only"),
    HalfHour(30, ":00 & :30"),
    Quarter(15, "every 15 min"),
    ;

    companion object {
        /** Nearest interval for a backend `slot_interval_min`, defaulting to [Quarter]. */
        fun fromMinutes(minutes: Int?): StartInterval =
            when (minutes) {
                60 -> Hourly
                30 -> HalfHour
                else -> Quarter
            }
    }
}
