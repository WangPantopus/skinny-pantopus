@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Date/time + label helpers shared across the Stream A9 "bookings extras"
 * surfaces. Backend timestamps are UTC ISO-8601 (`start_at`, `created_at`);
 * slot payloads also carry a pre-rendered `startLocal`. Host surfaces render in
 * the device zone (parity with iOS `BookingsExtrasFormatting`), storing/
 * comparing the raw UTC value.
 */
internal object BookingsExtrasFormatting {
    private val DAY_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
    private val DAY_WITH_WEEKDAY: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    private val WEEKDAY_SHORT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE", Locale.US)
    private val DAY_NUM: DateTimeFormatter = DateTimeFormatter.ofPattern("d", Locale.US)

    /** Parse a UTC/offset ISO instant (best-effort). */
    fun instantOrNull(iso: String?): Instant? {
        if (iso.isNullOrBlank()) return null
        return runCatching { Instant.parse(iso) }
            .recoverCatching { OffsetDateTime.parse(iso).toInstant() }
            .recoverCatching { LocalDateTime.parse(iso).atZone(ZoneId.systemDefault()).toInstant() }
            .getOrNull()
    }

    private fun localDateTime(
        iso: String?,
        zone: ZoneId,
    ): LocalDateTime? = instantOrNull(iso)?.atZone(zone)?.toLocalDateTime()

    /** "Jun 8" from a UTC instant, in [zone]. */
    fun shortDay(
        iso: String?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String = localDateTime(iso, zone)?.format(DAY_FORMAT) ?: ""

    /** "joined Jun 8" caption for roster/waitlist rows. */
    fun joinedLabel(
        iso: String?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String = shortDay(iso, zone).let { if (it.isEmpty()) "" else "joined $it" }

    /** "1:00 PM" from a UTC instant, in [zone]. */
    fun timeOnly(
        iso: String?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String = localDateTime(iso, zone)?.format(TIME_FORMAT) ?: ""

    /**
     * A friendly day+time label: "Today · 1:00 PM", "Tomorrow · 9:00 AM", or
     * "Tue, Jun 14 · 10:00 AM".
     */
    fun dayAndTime(
        iso: String?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String {
        val ldt = localDateTime(iso, zone) ?: return ""
        val today = LocalDate.now(zone)
        val day =
            when (ldt.toLocalDate()) {
                today -> "Today"
                today.plusDays(1) -> "Tomorrow"
                else -> ldt.format(DAY_WITH_WEEKDAY)
            }
        return "$day · ${ldt.format(TIME_FORMAT)}"
    }

    /** Short weekday ("Tue") for the manual-booking day strip. */
    fun weekdayShort(date: LocalDate): String = date.format(WEEKDAY_SHORT)

    /** Day-of-month ("14") for the manual-booking day strip. */
    fun dayNumber(date: LocalDate): String = date.format(DAY_NUM)

    /** Up-to-two-letter initials for an avatar disc. */
    fun initials(name: String?): String {
        val cleaned = name?.trim().orEmpty()
        if (cleaned.isEmpty()) return "?"
        val parts = cleaned.split(Regex("\\s+")).filter { it.isNotBlank() }
        return when {
            parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase(Locale.US)
            else -> parts.first().take(2).uppercase(Locale.US)
        }
    }
}
