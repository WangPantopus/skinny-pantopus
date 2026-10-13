@file:Suppress("MagicNumber", "TooManyFunctions", "CyclomaticComplexMethod", "NestedBlockDepth")

package app.pantopus.android.data.plans

import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanPinDto
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * Words for plans: times in the plan's own time zone, distance bands, day parts and the one-line summaries the
 * rows, pins and cards use. Mirrors the copy on the design boards (F1 to A5); distances are always bands
 * (brief section 6), never exact.
 */
object PlanFormat {
    private val locale: Locale get() = Locale.US
    private val clock: DateTimeFormatter get() = DateTimeFormatter.ofPattern("h:mm a", locale)
    private val clockShort: DateTimeFormatter get() = DateTimeFormatter.ofPattern("h:mm", locale)
    private val dayShort: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEE", locale)
    private val dayLong: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEEE", locale)
    private val dateShort: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEE, MMM d", locale)
    private val dateLong: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEEE, MMM d", locale)

    private const val ONE_WEEK_DAYS = 6L

    /** Parses an ISO-8601 instant (with `Z` or an offset); null when absent or unreadable. */
    fun instant(raw: String?): Instant? {
        if (raw.isNullOrBlank()) return null
        return try {
            Instant.parse(raw)
        } catch (_: DateTimeParseException) {
            runCatching { ZonedDateTime.parse(raw).toInstant() }.getOrNull()
        }
    }

    fun zone(timezone: String?): ZoneId = timezone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()

    /** `under_1_mi` → "under 1 mi"; `about_2_mi` → "about 2 mi". */
    fun distance(band: String?): String? =
        when (band) {
            "under_1_mi" -> "under 1 mi"
            "about_1_mi" -> "about 1 mi"
            "about_2_mi" -> "about 2 mi"
            "about_3_mi" -> "about 3 mi"
            "about_5_mi" -> "about 5 mi"
            else -> null
        }

    /** The spoken form for TalkBack: "about 1 mile". */
    fun distanceSpoken(band: String?): String? =
        when (band) {
            "under_1_mi" -> "under 1 mile"
            "about_1_mi" -> "about 1 mile"
            "about_2_mi" -> "about 2 miles"
            "about_3_mi" -> "about 3 miles"
            "about_5_mi" -> "about 5 miles"
            else -> null
        }

    /** `morning` → "Morning". */
    fun dayPart(part: String?): String? = part?.takeIf { it.isNotBlank() }?.replaceFirstChar { it.titlecase(locale) }

    private fun relativeDay(
        date: LocalDate,
        today: LocalDate,
    ): String? =
        when (ChronoUnit.DAYS.between(today, date)) {
            0L -> "Today"
            1L -> "Tomorrow"
            else -> null
        }

    /** "Sun 1:25" on a pin this week, "5:30 PM" today, "Now" while on, "Full" when full, "Morning" for a playdate. */
    fun pinTag(
        pin: PlanPinDto,
        now: Instant = Instant.now(),
    ): String {
        val state = pin.planState
        val start = instant(pin.startsAt)
        return when {
            state == PlanState.LIVE -> "Now"
            pin.isFull && pin.standing != PlanViewerStanding.IN && pin.standing != PlanViewerStanding.HOSTING -> "Full"
            start == null -> dayPart(pin.dayPart) ?: pin.planKind?.label.orEmpty()
            else -> {
                val zone = zone(pin.timezone)
                val at = start.atZone(zone)
                if (at.toLocalDate() == now.atZone(zone).toLocalDate()) {
                    at.format(clock)
                } else {
                    "${at.format(dayShort)} ${at.format(clockShort)}"
                }
            }
        }
    }

    /** "Today 7:00 PM", "Tomorrow 7:30 PM", "Thu 5:15 PM" this week, else "Oct 23, 7:00 PM". */
    fun shortWhen(
        at: Instant,
        zone: ZoneId,
        now: Instant = Instant.now(),
    ): String {
        val time = at.atZone(zone)
        val days = ChronoUnit.DAYS.between(now.atZone(zone).toLocalDate(), time.toLocalDate())
        return when {
            days == 0L -> "Today ${time.format(clock)}"
            days == 1L -> "Tomorrow ${time.format(clock)}"
            days in 2..ONE_WEEK_DAYS -> "${time.format(dayShort)} ${time.format(clock)}"
            else -> "${time.format(DateTimeFormatter.ofPattern("MMM d", locale))}, ${time.format(clock)}"
        }
    }

    /** "Sunday at 2:00 PM", "today at 2:41 AM", "tomorrow at 7:30 PM" (H11's "Still coming?"). */
    fun dayAt(
        plan: PlanDto,
        now: Instant = Instant.now(),
    ): String {
        val zone = zone(plan.timezone)
        val start = instant(plan.startsAt)?.atZone(zone) ?: return hiddenWhen(plan)
        val day =
            when (ChronoUnit.DAYS.between(now.atZone(zone).toLocalDate(), start.toLocalDate())) {
                0L -> "today"
                1L -> "tomorrow"
                in 2..ONE_WEEK_DAYS -> start.format(dayLong)
                else -> start.format(dateLong)
            }
        return "$day at ${start.format(clock)}"
    }

    /** "1:25–4:45 PM", or "11:30 AM–1:00 PM" across noon. */
    fun timeRange(
        start: ZonedDateTime,
        end: ZonedDateTime?,
    ): String {
        if (end == null) return start.format(clock)
        val sameHalf = start.format(DateTimeFormatter.ofPattern("a", locale)) == end.format(DateTimeFormatter.ofPattern("a", locale))
        return if (sameHalf && start.toLocalDate() == end.toLocalDate()) {
            "${start.format(clockShort)}–${end.format(clock)}"
        } else {
            "${start.format(clock)}–${end.format(clock)}"
        }
    }

    /**
     * "Sun, Oct 18 · 1:25–4:45 PM" ([long] = false) or "Sunday, Oct 18 · 1:25–4:45 PM"; for a playdate whose time
     * is still hidden, "Saturday morning" (or just "Morning" without a date).
     */
    fun whenLine(
        plan: PlanDto,
        long: Boolean = false,
    ): String {
        val zone = zone(plan.timezone)
        val start = instant(plan.startsAt)?.atZone(zone) ?: return hiddenWhen(plan)
        val end = instant(plan.endsAt)?.atZone(zone)
        return "${start.format(if (long) dateLong else dateShort)} · ${timeRange(start, end)}"
    }

    /** A playdate before you're in: "Saturday morning" when the server sends the local date, else "Morning". */
    fun hiddenWhen(plan: PlanDto): String {
        val part = plan.dayPart?.lowercase(locale)
        val date = plan.localDate
        if (date != null && part != null) {
            val today = LocalDate.now(zone(plan.timezone))
            val relative =
                when (ChronoUnit.DAYS.between(today, date)) {
                    0L -> if (part == "night") "Tonight" else "This $part"
                    1L -> "Tomorrow $part"
                    else -> "${date.format(dayLong)} $part"
                }
            return relative
        }
        return dayPart(plan.dayPart) ?: "Time shared when you're in"
    }

    /**
     * The second line of a plan row (board P2, F2): "Happening now · until 10:30 · 1.2 mi",
     * "You're hosting · Sun 1:25 PM", "Today 5:30 PM · under 1 mi", "Sun 1:25 PM · Downtown · about 2 mi",
     * "This morning · Downtown · ages 2–4".
     */
    fun rowSubtitle(
        plan: PlanDto,
        now: Instant = Instant.now(),
    ): String {
        val zone = zone(plan.timezone)
        val start = instant(plan.startsAt)?.atZone(zone)
        val end = instant(plan.endsAt)?.atZone(zone)
        val today = now.atZone(zone).toLocalDate()
        val distance = distance(plan.distanceBand)
        val area = plan.area?.label?.removePrefix("Near ")
        val parts = mutableListOf<String>()
        val whenText =
            when {
                plan.planState == PlanState.LIVE ->
                    listOfNotNull(
                        "Happening now",
                        end?.let { "until ${it.format(clockShort)}" },
                    ).joinToString(" · ")
                start == null -> hiddenWhen(plan)
                else -> {
                    val relative = relativeDay(start.toLocalDate(), today)
                    when {
                        relative == "Today" -> "Today ${start.format(clock)}"
                        relative == "Tomorrow" -> "Tomorrow ${start.format(clock)}"
                        ChronoUnit.DAYS.between(today, start.toLocalDate()) <= ONE_WEEK_DAYS ->
                            "${start.format(dayShort)} ${start.format(clock)}"
                        else -> "${start.format(dateShort)} ${start.format(clock)}"
                    }
                }
            }
        when (plan.standing) {
            PlanViewerStanding.HOSTING -> {
                parts += "You're hosting"
                parts += whenText
            }
            else -> {
                parts += whenText
                if (plan.isPlaydate) {
                    area?.let { parts += it }
                    KidsAgeBand.rangeLabel(plan.details?.kidsAgeBands)?.let { parts += "ages $it" }
                } else {
                    if (start != null && relativeDay(start.toLocalDate(), today) == null && plan.planState != PlanState.LIVE) {
                        area?.let { parts += it }
                    }
                    distance?.let { parts += it }
                }
            }
        }
        return parts.filter { it.isNotBlank() }.joinToString(" · ")
    }

    /** "5 going · 3 spots left" for the slot meter's caption; families for playdates. */
    fun goingLine(plan: PlanDto): Pair<String, String?> {
        val noun = if (plan.isPlaydate) (if (plan.goingCount == 1) "family" else "families") else null
        val going = if (noun != null) "${plan.goingCount} $noun going" else "${plan.goingCount} going"
        val left =
            when {
                plan.isFull -> "full"
                plan.spotsLeft == 1 -> "1 spot left"
                else -> "${plan.spotsLeft} spots left"
            }
        return going to left
    }

    /** "Sam R." → "Sam". */
    fun firstName(displayName: String?): String = displayName?.trim()?.substringBefore(' ')?.takeIf { it.isNotBlank() } ?: "The host"

    /** "Sam approves each person" / "Maya approves each family" / "Lets in anyone nearby automatically". */
    fun howPeopleGetIn(plan: PlanDto): String {
        val host = firstName(plan.host?.displayName)
        // The host sees their rules; a guest sees the rule that would let them in (`viewer.auto_rule`).
        val rules = plan.autoRules.orEmpty() + listOfNotNull(plan.viewer?.autoRule)
        return when {
            !plan.hostApproves && PlanAutoRule.ANYONE_NEARBY in rules -> "Lets in anyone nearby automatically"
            !plan.hostApproves && PlanAutoRule.VERIFIED in rules -> "Lets in verified neighbors automatically"
            !plan.hostApproves -> "You can get in right away"
            plan.isPlaydate -> "$host approves each family"
            else -> "$host approves each person"
        }
    }

    /** The spoken pin for TalkBack (journey 13): "Watch party, Sunday 1:25 PM, about 1 mile, 3 spots left". */
    fun pinSpoken(
        pin: PlanPinDto,
        distanceBand: String?,
        now: Instant = Instant.now(),
    ): String {
        val parts = mutableListOf(pin.planKind?.label ?: "Plan")
        val start = instant(pin.startsAt)
        when {
            pin.planState == PlanState.LIVE -> parts += "happening now"
            start != null -> {
                val zone = zone(pin.timezone)
                val at = start.atZone(zone)
                val relative = relativeDay(at.toLocalDate(), now.atZone(zone).toLocalDate())
                parts += "${relative ?: at.format(dayLong)} ${at.format(clock)}"
            }
            else -> dayPart(pin.dayPart)?.let { parts += it }
        }
        distanceSpoken(distanceBand ?: pin.distanceBand)?.let { parts += it }
        parts +=
            when {
                pin.isFull -> "full"
                pin.spotsLeft == 1 -> "1 spot left"
                else -> "${pin.spotsLeft} spots left"
            }
        when (pin.standing) {
            PlanViewerStanding.HOSTING -> parts += "you're hosting"
            PlanViewerStanding.IN -> parts += "you're in"
            PlanViewerStanding.REQUESTED -> parts += "requested"
            PlanViewerStanding.WAITLISTED -> parts += "on the waitlist"
            else -> Unit
        }
        return parts.joinToString(", ")
    }

    /** "Starts in 7 hours" / "Starts in 25 minutes" / "Started". */
    fun startsIn(
        plan: PlanDto,
        now: Instant = Instant.now(),
    ): String? {
        val start = instant(plan.startsAt) ?: return null
        val minutes = Duration.between(now, start).toMinutes()
        return when {
            minutes <= 0 -> null
            minutes < 60 -> "Starts in $minutes minute${if (minutes == 1L) "" else "s"}"
            minutes < 60 * 24 -> (minutes / 60).let { "Starts in $it hour${if (it == 1L) "" else "s"}" }
            else -> (minutes / (60 * 24)).let { "Starts in $it day${if (it == 1L) "" else "s"}" }
        }
    }

    /** "just now", "12 min ago", "3 hours ago", else the day ("Mon 9:42 AM"): when someone answered (J7). */
    fun ago(
        raw: String?,
        now: Instant = Instant.now(),
    ): String? {
        val at = instant(raw) ?: return null
        val minutes = Duration.between(at, now).toMinutes()
        return when {
            minutes < 2 -> "just now"
            minutes < 60 -> "$minutes min ago"
            minutes < 12 * 60 -> (minutes / 60).let { "$it hour${if (it == 1L) "" else "s"} ago" }
            else -> sentAt(raw)
        }
    }

    /** "9:42 AM" today, "Mon 9:42 AM" earlier this week, else "Oct 12". */
    fun sentAt(
        raw: String?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String? {
        val at = instant(raw)?.atZone(zone) ?: return null
        val today = LocalDate.now(zone)
        return when {
            at.toLocalDate() == today -> at.format(clock)
            ChronoUnit.DAYS.between(at.toLocalDate(), today) < ONE_WEEK_DAYS -> "${at.format(dayShort)} ${at.format(clock)}"
            else -> at.format(DateTimeFormatter.ofPattern("MMM d", locale))
        }
    }
}

/** The plan's local date: `local_date` when the time is hidden (a playdate before you're in), else from the start. */
val PlanDto.localDate: LocalDate?
    get() =
        localDateRaw?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            ?: PlanFormat.instant(startsAt)?.atZone(PlanFormat.zone(timezone))?.toLocalDate()
