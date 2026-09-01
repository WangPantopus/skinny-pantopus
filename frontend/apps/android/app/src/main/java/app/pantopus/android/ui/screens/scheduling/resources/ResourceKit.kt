@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Stream A12 — Home resources & visits. View-less helpers consumed by F9–F14:
 * resource/visit type → icon+label mapping, smart rule defaults,
 * `available_hours` round-tripping, the household member projection, time
 * formatting, and the host-bookings projection.
 *
 * ── Foundation note (see also `BookingDto.resourceId`) ──────────────────────
 * Resource bookings are `Booking` rows with `resource_id` set + `event_type_id
 * = null`. The home `/events` union (home.js) does NOT emit `resource_id`, so a
 * resource-scoped booking list cannot be built from the calendar union. F9/F11/
 * F12 therefore read the host bookings list (`GET …/scheduling/bookings`, which
 * selects `*` and so returns `resource_id`) via the shared repository and
 * filter client-side. They never create `HomeCalendarEvent` rows for bookings.
 */

// ─── Resource type ──────────────────────────────────────────────────────────

/** The bookable resource taxonomy (`resource_type` wire enum). */
enum class ResourceKind(
    val wire: String,
) {
    Room("room"),
    Vehicle("vehicle"),
    Tool("tool"),
    Charger("charger"),
    Other("other"),
    ;

    /** Title-case label shown in the editor chip + type badge. */
    val label: String
        get() =
            when (this) {
                Room -> "Room"
                Vehicle -> "Vehicle"
                Tool -> "Tool"
                Charger -> "Charger"
                Other -> "Other"
            }

    /** Leading tile glyph. */
    val icon: PantopusIcon
        get() =
            when (this) {
                Room -> PantopusIcon.DoorOpen
                Vehicle -> PantopusIcon.Car
                Tool -> PantopusIcon.Wrench
                Charger -> PantopusIcon.Zap
                Other -> PantopusIcon.Package
            }

    /** Smart defaults seeded when the host picks a type in F10. */
    val defaultRules: ResourceRuleDefaults
        get() =
            when (this) {
                Charger ->
                    ResourceRuleDefaults(
                        maxDurationMin = 240,
                        bufferMin = 0,
                        requiresApproval = false,
                    )
                Room ->
                    ResourceRuleDefaults(
                        maxDurationMin = 720,
                        bufferMin = 30,
                        requiresApproval = false,
                    )
                Vehicle ->
                    ResourceRuleDefaults(
                        maxDurationMin = 480,
                        bufferMin = 15,
                        requiresApproval = true,
                    )
                Tool ->
                    ResourceRuleDefaults(
                        maxDurationMin = 240,
                        bufferMin = 0,
                        requiresApproval = false,
                    )
                Other ->
                    ResourceRuleDefaults(
                        maxDurationMin = 120,
                        bufferMin = 0,
                        requiresApproval = false,
                    )
            }

    companion object {
        /** Tolerant mapping from a wire string (defaults to [Other]). */
        fun fromWire(wire: String?): ResourceKind = entries.firstOrNull { it.wire == wire } ?: Other
    }
}

/** Smart rule defaults seeded from a resource type. */
data class ResourceRuleDefaults(
    val maxDurationMin: Int,
    val bufferMin: Int,
    val requiresApproval: Boolean,
)

/**
 * `who_can_book` wire enum (v1 honours `members`; `specific`/`guests` are
 * stored but gate to members server-side).
 */
enum class WhoCanBook(
    val wire: String,
) {
    Members("members"),
    Specific("specific"),
    Guests("guests"),
    ;

    /** Segmented-control label per the F10 design (`All / Specific / Guest link`). */
    val label: String
        get() =
            when (this) {
                Members -> "All"
                Specific -> "Specific"
                Guests -> "Guest link"
            }

    /** Header chip label ("All members" / "Specific" / "Guest link"). */
    val bookLabel: String
        get() =
            when (this) {
                Members -> "All members"
                Specific -> "Specific"
                Guests -> "Guest link"
            }

    companion object {
        fun fromWire(wire: String?): WhoCanBook = entries.firstOrNull { it.wire == wire } ?: Members
    }
}

// ─── Visit type ───────────────────────────────────────────────────────────

/**
 * `visit_type` wire enum. The backend accepts ONLY `vendor` | `guest`
 * (scheduling.js) — the design's Delivery/Service chips have no v1 persistence,
 * so this stream ships the two contract-backed types.
 */
enum class VisitKind(
    val wire: String,
) {
    Vendor("vendor"),
    Guest("guest"),
    ;

    val label: String
        get() = if (this == Vendor) "Vendor" else "Guest"

    val icon: PantopusIcon
        get() = if (this == Vendor) PantopusIcon.Wrench else PantopusIcon.UserRound

    companion object {
        fun fromWire(wire: String?): VisitKind = entries.firstOrNull { it.wire == wire } ?: Vendor
    }
}

// ─── Available hours ────────────────────────────────────────────────────────

/**
 * Structured projection of a resource's opaque `available_hours` jsonb. The
 * backend stores it verbatim; this stream owns the shape:
 * `{ "days": [1,2,3,4,5], "start": "07:00", "end": "22:00" }` (days are
 * `Calendar`-style weekday integers, Sun = 1 … Sat = 7).
 */
data class AvailableHours(
    val days: Set<Int>,
    val start: String,
    val end: String,
) {
    /** Encode back to the jsonb map for `POST`/`PUT /resources`. */
    fun toJson(): Map<String, Any?> =
        mapOf(
            "days" to days.sorted(),
            "start" to start,
            "end" to end,
        )

    /** "7 AM – 10 PM" window label for the editor value row. */
    val windowLabel: String
        get() = "${ResourceTime.clockLabel(start)} – ${ResourceTime.clockLabel(end)}"

    companion object {
        /** Mon–Fri, 9–5 — the editor's seed when a resource has no stored hours. */
        val weekdayDefault =
            AvailableHours(days = setOf(2, 3, 4, 5, 6), start = "09:00", end = "17:00")

        /** Lenient decode from the stored jsonb (returns `null` for an empty `{}`). */
        fun fromJson(json: Map<String, Any?>?): AvailableHours? {
            if (json.isNullOrEmpty()) return null
            val days =
                (json["days"] as? List<*>)
                    ?.mapNotNull {
                        (it as? Number)?.toInt()
                    }?.toSet()
                    .orEmpty()
            val start = json["start"] as? String
            val end = json["end"] as? String
            if (days.isEmpty() || start == null || end == null) return null
            return AvailableHours(days, start, end)
        }
    }
}

// ─── Household member projection ────────────────────────────────────────────

/** Token-mapped avatar tones (resolved by `HomeMemberAvatar`). */
enum class MemberTone(
    val background: Color,
    val foreground: Color,
) {
    Green(PantopusColors.homeBg, PantopusColors.home),
    Sky(PantopusColors.personalBg, PantopusColors.personal),
    Violet(PantopusColors.businessBg, PantopusColors.business),
    Amber(PantopusColors.warningBg, PantopusColors.warning),
    Rose(PantopusColors.errorBg, PantopusColors.error),
    Teal(PantopusColors.successBg, PantopusColors.success),
}

/**
 * Lightweight household member for avatars + the who-is-home / for-whom
 * pickers. Projected from the shared [OccupantDto] roster.
 */
data class HomeMember(
    val id: String,
    val name: String,
    val avatarUrl: String? = null,
) {
    /** 1–2 letter initials for the avatar disc. */
    val initials: String
        get() {
            val letters =
                name
                    .split(" ")
                    .filter { it.isNotBlank() }
                    .take(2)
                    .mapNotNull { it.firstOrNull() }
                    .joinToString("")
            return letters.ifBlank { "?" }.uppercase(Locale.US)
        }

    /**
     * Stable palette tone so a member keeps the same avatar colour across
     * screens. Runs djb2 in 64-bit (Long) over the UTF-8 bytes, then
     * abs % count — byte-for-byte the iOS `ResourceHomeMember.toneIndex`
     * algorithm, so the same member reads the same tone on both platforms.
     */
    val tone: MemberTone
        get() {
            var hash = 5381L
            for (byte in id.toByteArray(Charsets.UTF_8)) {
                hash = (hash shl 5) + hash + (byte.toLong() and 0xFF)
            }
            val index = ((if (hash < 0) -hash else hash) % MemberTone.entries.size).toInt()
            return MemberTone.entries[index]
        }

    companion object {
        /** Project the active-occupant roster into bookable members. */
        fun from(occupants: List<OccupantDto>): List<HomeMember> =
            occupants
                .filter { it.isActive }
                .map { occupant ->
                    HomeMember(
                        id = occupant.userId,
                        name =
                            occupant.displayName?.takeIf { it.isNotBlank() }
                                ?: occupant.username?.takeIf { it.isNotBlank() }
                                ?: "Member",
                        avatarUrl = occupant.avatarUrl,
                    )
                }
    }
}

// ─── Home context ─────────────────────────────────────────────────────────

/**
 * Fallback home inference for A12 view-models when the route carries no
 * `homeId` query arg (deep links / legacy callers): the primary owner home,
 * else the first home. Returns `null` when the user has no home. Callers that
 * know the home (Home Calendar, sibling A12 screens) pass it explicitly via
 * `SchedulingRoutes.ARG_HOME_ID` instead.
 */
suspend fun resolvePrimaryHomeId(homes: HomesRepository): String? =
    when (val result = homes.myHomes()) {
        is NetworkResult.Success -> {
            val list = result.data.homes
            (list.firstOrNull { it.isPrimaryOwner == true } ?: list.firstOrNull())?.id
        }
        is NetworkResult.Failure -> null
    }

/** Cross-stream link by route to A10's Home Calendar (existing destination). */
fun homeCalendarRoute(homeId: String): String = "homes/$homeId/calendar"

// ─── Time helpers ───────────────────────────────────────────────────────────

/**
 * Date/time formatting + composition for the resources & visits surfaces. All
 * reads pass the device IANA tz; instants are stored/compared in UTC.
 */
object ResourceTime {
    /** Device IANA tz — sent on calendar reads, used for local rendering. */
    val tz: String get() = ZoneId.systemDefault().id

    private val zone: ZoneId get() = ZoneId.systemDefault()

    private val isoOut: DateTimeFormatter =
        DateTimeFormatter.ofPattern(
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            Locale.US,
        )
    private val ampm = DateTimeFormatter.ofPattern("a", Locale.US)
    private val hourMin = DateTimeFormatter.ofPattern("h:mm", Locale.US)
    private val hourMinMeridiem = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    private val dayMonth = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
    private val dayStrip = DateTimeFormatter.ofPattern("EEE · MMM d", Locale.US)
    private val monthDay = DateTimeFormatter.ofPattern("MMM d", Locale.US)

    /** Parse a UTC ISO-8601 instant (tolerant of `Z`/offset/local forms). */
    fun parseUtc(iso: String?): Instant? {
        if (iso.isNullOrBlank()) return null
        return runCatching { Instant.parse(iso) }
            .recoverCatching { OffsetDateTime.parse(iso).toInstant() }
            .getOrNull()
    }

    /** Encode an [Instant] to a UTC ISO-8601 string for write bodies. */
    fun utcIso(instant: Instant): String = isoOut.format(instant.atZone(ZoneId.of("UTC")))

    /** Combine a calendar day + hour-of-day (local tz) into a UTC [Instant]. */
    fun combine(
        day: LocalDate,
        hour: Int,
        minute: Int = 0,
    ): Instant = day.atTime(hour, minute).atZone(zone).toInstant()

    /** "HH:mm" (24h) → "7 AM" / "7:30 AM" clock label. */
    fun clockLabel(hhmm: String): String {
        val parts = hhmm.split(":")
        val hour = parts.getOrNull(0)?.toIntOrNull() ?: return hhmm
        val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0
        val time = java.time.LocalTime.of(hour.coerceIn(0, 23), minute.coerceIn(0, 59))
        val fmt =
            if (minute ==
                0
            ) {
                DateTimeFormatter.ofPattern("h a", Locale.US)
            } else {
                hourMinMeridiem
            }
        return time.format(fmt)
    }

    /** "9:00–11:00 AM" range from two UTC ISO instants, rendered in [tz]. */
    fun rangeLabel(
        startIso: String?,
        endIso: String?,
    ): String {
        val start = parseUtc(startIso)?.atZone(zone) ?: return ""
        val end =
            endIso?.let { parseUtc(it)?.atZone(zone) }
                ?: return "${start.format(hourMin)} ${start.format(ampm)}"
        val sameMeridiem = start.format(ampm) == end.format(ampm)
        val startText = if (sameMeridiem) start.format(hourMin) else start.format(hourMinMeridiem)
        return "$startText–${end.format(hourMinMeridiem)}"
    }

    /** "9:00 AM" single instant. */
    fun timeLabel(iso: String?): String {
        val date = parseUtc(iso)?.atZone(zone) ?: return ""
        return date.format(hourMinMeridiem)
    }

    /** Day-section header: "Today · Mon Jun 16" / "Tomorrow · …" / "Wed Jun 18". */
    fun daySectionLabel(iso: String?): String {
        val date = parseUtc(iso)?.atZone(zone) ?: return ""
        val stamp = date.format(dayMonth)
        val today = LocalDate.now(zone)
        return when (date.toLocalDate()) {
            today -> "Today · $stamp"
            today.plusDays(1) -> "Tomorrow · $stamp"
            else -> stamp
        }
    }

    /** "Sat · Jun 21" header for the F12 day strip. */
    fun dayStripLabel(day: LocalDate): String = day.format(dayStrip)

    /** "Sat Jun 21 · 9:00–10:00 AM" header for the visit-detail time pill. */
    fun longRangeLabel(
        startIso: String?,
        endIso: String?,
    ): String {
        val start = parseUtc(startIso)?.atZone(zone) ?: return ""
        val day = start.format(dayMonth)
        val range = rangeLabel(startIso, endIso)
        return if (range.isEmpty()) day else "$day · $range"
    }

    /** "Jun 12" short date for terminal/done headers. */
    fun shortDate(iso: String?): String {
        val date = parseUtc(iso)?.atZone(zone) ?: return ""
        return date.format(monthDay)
    }

    /** Day key (start-of-day in [tz]) for grouping bookings under day headers. */
    fun dayKey(iso: String?): LocalDate? = parseUtc(iso)?.atZone(zone)?.toLocalDate()
}
