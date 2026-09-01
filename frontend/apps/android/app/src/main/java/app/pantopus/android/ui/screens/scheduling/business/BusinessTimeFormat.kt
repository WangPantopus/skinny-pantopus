@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.runtime.Immutable
import java.util.Locale

/**
 * Self-contained weekday + time formatting for the A13 Business stream (G4
 * member working-hours). Mirrors A3's `AvailabilityFormat` by design — the
 * conflict-safety architecture keeps each scheduling stream's files disjoint,
 * so the business folder carries its own copy rather than importing A3's.
 *
 * Backend weekday is ISO `0=Sunday … 6=Saturday`; times are `HH:MM`/`HH:MM:SS`.
 * The editor lays the week out Monday-first per the design.
 */

/** Monday-first display order over the backend's ISO weekday ints. */
val WEEKDAY_DISPLAY_ORDER: List<Int> = listOf(1, 2, 3, 4, 5, 6, 0)

/** Mon–Fri (used by "copy Monday to weekdays"). */
val WEEKDAYS_MON_FRI: Set<Int> = setOf(1, 2, 3, 4, 5)

/** One contiguous open window within a day, as `"HH:MM"` start/end. */
@Immutable
data class HoursRange(
    val start: String,
    val end: String,
) {
    fun label(): String = formatRange12(start, end)

    /** Start strictly before end, both parseable. */
    val isValid: Boolean
        get() {
            val (sh, sm) = parseHhMm(start)
            val (eh, em) = parseHhMm(end)
            return (sh * 60 + sm) < (eh * 60 + em)
        }
}

/** Short weekday label for a backend ISO weekday (`0=Sun … 6=Sat`). */
fun weekdayShort(weekday: Int): String =
    when (((weekday % 7) + 7) % 7) {
        0 -> "Sun"
        1 -> "Mon"
        2 -> "Tue"
        3 -> "Wed"
        4 -> "Thu"
        5 -> "Fri"
        else -> "Sat"
    }

/** Full weekday label for a backend ISO weekday (`0=Sun … 6=Sat`). */
fun weekdayFull(weekday: Int): String =
    when (((weekday % 7) + 7) % 7) {
        0 -> "Sunday"
        1 -> "Monday"
        2 -> "Tuesday"
        3 -> "Wednesday"
        4 -> "Thursday"
        5 -> "Friday"
        else -> "Saturday"
    }

/** Plural weekday label (`"Thursdays"`) for the coverage copy. */
fun weekdayPlural(weekday: Int): String = weekdayFull(weekday) + "s"

/** Parse `"HH:MM"` / `"HH:MM:SS"` into `(hour, minute)`, defaulting to `(0,0)`. */
fun parseHhMm(time: String): Pair<Int, Int> {
    val parts = time.split(":")
    val hour = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 0
    val minute = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
    return hour to minute
}

/** Canonicalize a time to `"HH:MM"` (drops seconds the backend may include). */
fun normalizeHhMm(time: String): String {
    val (hour, minute) = parseHhMm(time)
    return hhmm(hour, minute)
}

/**
 * `"HH:MM"` for an hour/minute pair. Locale.ROOT-pinned: this is the WIRE
 * format (working-hours PUT bodies validate against an ASCII `\d{2}:\d{2}`
 * pattern server-side), so locale digit substitution must never leak in.
 */
fun hhmm(
    hour: Int,
    minute: Int,
): String = "%02d:%02d".format(Locale.ROOT, hour.coerceIn(0, 23), minute.coerceIn(0, 59))

/** `"9:00 AM"` for a `"HH:MM"` 24-hour time (Locale.US display digits). */
fun formatTime12(time: String): String {
    val (hour, minute) = parseHhMm(time)
    val period = if (hour < 12) "AM" else "PM"
    val h12 =
        when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
    return "%d:%02d %s".format(Locale.US, h12, minute, period)
}

/** `"9:00 AM–5:00 PM"` for a start/end `"HH:MM"` pair (en-dash per the design). */
fun formatRange12(
    start: String,
    end: String,
): String = "${formatTime12(start)}–${formatTime12(end)}"

/** Display label for an IANA timezone id; the design shows the full id. */
fun friendlyTimezone(tz: String?): String = tz?.takeIf { it.isNotBlank() } ?: "Set a time zone"
