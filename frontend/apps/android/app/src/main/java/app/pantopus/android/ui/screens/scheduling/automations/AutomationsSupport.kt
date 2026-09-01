@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.automations

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Stream A16 (Reminders / workflows / templates) — the domain vocabulary shared
 * across H1–H8. Maps the backend workflow/template wire shapes to the
 * plain-English, verbs-first copy the design suite calls for, plus the reminder
 * lead-time presets, the template-variable catalog, and the read-only starter
 * templates. Pure value logic — no Compose, no tokens. Mirrors the iOS
 * `AutomationsSupport.swift`. See `reference/calendarly-backend-api.md`
 * (workflows + message-templates).
 */

// ─── Workflow trigger ───────────────────────────────────────────────────────

/**
 * A workflow's lifecycle trigger. [wire] is the backend `trigger` string;
 * `BeforeStart` / `AfterEnd` are the only triggers that carry an
 * `offset_minutes`.
 */
enum class WorkflowTrigger(val wire: String) {
    BookingCreated("booking_created"),
    Cancelled("cancelled"),
    Rescheduled("rescheduled"),
    BeforeStart("before_start"),
    AfterEnd("after_end"),
    ;

    /** Lifecycle label used in the trigger picker radio list. */
    val lifecycleLabel: String
        get() =
            when (this) {
                BookingCreated -> "Created"
                Cancelled -> "Cancelled"
                Rescheduled -> "Rescheduled"
                BeforeStart -> "Started"
                AfterEnd -> "Ended"
            }

    /** One-line description under each lifecycle radio. */
    val lifecycleDescription: String
        get() =
            when (this) {
                BookingCreated -> "The moment someone books"
                Cancelled -> "When an attendee cancels"
                Rescheduled -> "When a booking moves"
                BeforeStart -> "A set time before it starts"
                AfterEnd -> "A set time after it ends"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                BookingCreated -> PantopusIcon.CalendarPlus
                Cancelled -> PantopusIcon.XCircle
                Rescheduled -> PantopusIcon.ArrowsRepeat
                BeforeStart -> PantopusIcon.Clock
                AfterEnd -> PantopusIcon.CalendarCheck
            }

    /** Whether this trigger uses an `offset_minutes` builder (before/after). */
    val usesOffset: Boolean
        get() = this == BeforeStart || this == AfterEnd

    /**
     * Plain-English, sentence-case summary used on workflow rows + the editor
     * summary pill (e.g. "When a booking is created", "1 hour before it starts").
     */
    fun summary(offsetMinutes: Int): String =
        when (this) {
            BookingCreated -> "When a booking is created"
            Cancelled -> "When a booking is cancelled"
            Rescheduled -> "When a booking is rescheduled"
            BeforeStart ->
                if (offsetMinutes <= 0) {
                    "When it starts"
                } else {
                    "${AutomationsFormat.duration(offsetMinutes)} before it starts"
                }
            AfterEnd ->
                if (offsetMinutes <= 0) {
                    "When it ends"
                } else {
                    "${AutomationsFormat.duration(offsetMinutes)} after it ends"
                }
        }

    companion object {
        /** Tolerant decode of an arbitrary backend string (defaults to created). */
        fun fromWire(wire: String?): WorkflowTrigger = entries.firstOrNull { it.wire == (wire ?: "").lowercase() } ?: BookingCreated
    }
}

// ─── Workflow channel (action) ──────────────────────────────────────────────

/**
 * The channel a workflow's `action` fires on. [wire] is the backend string. SMS
 * is rendered but disabled ("coming soon") until carrier support.
 */
enum class WorkflowChannel(val wire: String) {
    Email("email"),
    Push("push"),
    InApp("in_app"),
    Sms("sms"),
    ;

    val label: String
        get() =
            when (this) {
                Email -> "Email"
                Push -> "Push"
                InApp -> "In-app"
                Sms -> "SMS"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Email -> PantopusIcon.Mail
                Push -> PantopusIcon.Bell
                InApp -> PantopusIcon.MessageSquare
                Sms -> PantopusIcon.Smartphone
            }

    /**
     * SMS is not yet wired end-to-end (no carrier integration) — render the chip
     * disabled with a "Coming soon" caption per the global contract.
     */
    val isComingSoon: Boolean
        get() = this == Sms

    /** Whether this channel needs a subject line (email). */
    val needsSubject: Boolean
        get() = this == Email

    /**
     * Plain-English action summary on workflow rows (channel + implied recipient —
     * the backend has no separate recipient field, so the channel carries the
     * intent: email/SMS reach attendees, push/in-app reach you).
     */
    val actionSummary: String
        get() =
            when (this) {
                Email -> "Email attendees"
                Push -> "Notify you"
                InApp -> "Notify you in-app"
                Sms -> "Text attendees"
            }

    companion object {
        fun fromWire(wire: String?): WorkflowChannel = entries.firstOrNull { it.wire == (wire ?: "").lowercase() } ?: Email

        /** SMS soft length limit; over this a message sends as multiple segments. */
        const val SMS_SEGMENT_LIMIT = 160

        /**
         * General message body cap (the backend ceiling is 5000, but the UI counter
         * uses a friendlier 600 for non-SMS).
         */
        const val BODY_COUNTER_LIMIT = 600
    }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Stateless formatters for offsets, reminder lead-times, and previews. */
object AutomationsFormat {
    private const val MIN_PER_HOUR = 60
    private const val MIN_PER_DAY = 1440
    private const val MIN_PER_WEEK = 10080

    /** "15 minutes" / "1 hour" / "2 days" / "1 week". */
    fun duration(minutes: Int): String {
        val m = minutes.coerceAtLeast(0)
        return when {
            m == 0 -> "0 minutes"
            m % MIN_PER_WEEK == 0 -> (m / MIN_PER_WEEK).let { "$it week${if (it == 1) "" else "s"}" }
            m % MIN_PER_DAY == 0 -> (m / MIN_PER_DAY).let { "$it day${if (it == 1) "" else "s"}" }
            m % MIN_PER_HOUR == 0 -> (m / MIN_PER_HOUR).let { "$it hour${if (it == 1) "" else "s"}" }
            else -> "$m minute${if (m == 1) "" else "s"}"
        }
    }

    /** Compact lead-time label for the reminder card rows ("1 day before"). */
    fun reminderRowLabel(minutes: Int): String = if (minutes <= 0) "At start" else "${duration(minutes)} before"

    /** Compact chip label for the pinned reminders summary ("1 day", "1 hour"). */
    fun reminderShort(minutes: Int): String =
        when (minutes) {
            0 -> "at start"
            15 -> "15 min"
            30 -> "30 min"
            60 -> "1 hour"
            1440 -> "1 day"
            10080 -> "1 week"
            else -> duration(minutes)
        }

    /**
     * "1 day + 1 hour before · Push" subtitle for the pinned default-reminders
     * row. Empty list → an off state.
     */
    fun remindersSummary(minutes: List<Int>): String {
        if (minutes.isEmpty()) return "No reminders yet"
        val sorted = minutes.sortedDescending()
        var lead = sorted.take(3).joinToString(" + ") { reminderShort(it) }
        if (sorted.size > 3) lead += " +${sorted.size - 3}"
        val suffix = if (sorted.contains(0)) "" else " before"
        return "$lead$suffix · Push"
    }
}

// ─── Reminder presets (H1) ──────────────────────────────────────────────────

/** The fixed reminder lead-times the H1 card offers, in display order. */
object ReminderPreset {
    /** (minutes, row label). Mirrors the reminders-frames design rows. */
    val all: List<Pair<Int, String>> =
        listOf(
            10080 to "1 week before",
            1440 to "1 day before",
            60 to "1 hour before",
            30 to "30 minutes before",
            15 to "15 minutes before",
            0 to "At start",
        )

    /** Smart default on first open: 1 day + 1 hour. */
    val smartDefault: List<Int> = listOf(1440, 60)

    /** Custom-time unit for the inline stepper. */
    enum class Unit(val label: String, val multiplier: Int) {
        Minutes("minutes", 1),
        Hours("hours", 60),
        Days("days", 1440),
    }
}

// ─── Template variables (H6) ────────────────────────────────────────────────

/** A dynamic `{{token}}` a message can interpolate. Grouped for the picker. */
data class TemplateVariable(
    val group: Group,
    /** Human label ("Attendee name"). */
    val label: String,
    /** Wire token without braces ("attendee_name"). */
    val key: String,
    /** Sample value shown in the picker + used to fill the preview. */
    val sample: String,
) {
    enum class Group(val title: String) {
        Event("Event"),
        People("People"),
        Links("Links"),
    }

    /** The inserted token, e.g. `{{attendee_name}}`. */
    val token: String
        get() = "{{$key}}"
}

/** One grouped section of variables. */
data class VariableSection(
    val group: TemplateVariable.Group,
    val items: List<TemplateVariable>,
)

/** The full variable catalog offered in H6, grouped EVENT / PEOPLE / LINKS. */
object TemplateVariableCatalog {
    val all: List<TemplateVariable> =
        listOf(
            TemplateVariable(TemplateVariable.Group.Event, "Event title", "event_title", "Intro call"),
            TemplateVariable(TemplateVariable.Group.Event, "Date", "event_date", "Tue, Jun 16"),
            TemplateVariable(TemplateVariable.Group.Event, "Time", "event_time", "3:00 PM"),
            TemplateVariable(TemplateVariable.Group.Event, "Duration", "event_duration", "30 min"),
            TemplateVariable(TemplateVariable.Group.Event, "Location", "event_location", "Video call"),
            TemplateVariable(TemplateVariable.Group.People, "Attendee name", "attendee_name", "Maria K."),
            TemplateVariable(TemplateVariable.Group.People, "Host name", "host_name", "Sam R."),
            TemplateVariable(TemplateVariable.Group.People, "Attendee email", "attendee_email", "maria@pantopus.co"),
            TemplateVariable(TemplateVariable.Group.Links, "Reschedule link", "reschedule_link", "pantopus.com/r/ab12"),
            TemplateVariable(TemplateVariable.Group.Links, "Cancel link", "cancel_link", "pantopus.com/c/ab12"),
            TemplateVariable(TemplateVariable.Group.Links, "Join link", "join_link", "meet.pantopus.co/ab12"),
        )

    /** Catalog grouped + filtered by a search query (case-insensitive on label). */
    fun grouped(filter: String): List<VariableSection> {
        val needle = filter.trim().lowercase()
        return TemplateVariable.Group.entries.mapNotNull { group ->
            val items =
                all.filter { variable ->
                    variable.group == group &&
                        (needle.isEmpty() || variable.label.lowercase().contains(needle) || variable.key.contains(needle))
                }
            if (items.isEmpty()) null else VariableSection(group, items)
        }
    }

    /** Sample values keyed by token name — feeds the preview interpolation. */
    val sampleValues: Map<String, String>
        get() = all.associate { it.key to it.sample }
}

// ─── Starter templates (H8) ─────────────────────────────────────────────────

/**
 * A read-only starter the user can duplicate into their own templates. These are
 * client-side seeds (not backend rows) — duplicating POSTs a real copy.
 */
data class StarterTemplate(
    val id: String,
    val name: String,
    val channel: WorkflowChannel,
    val subject: String?,
    val body: String,
) {
    companion object {
        val all: List<StarterTemplate> =
            listOf(
                StarterTemplate(
                    id = "starter_confirmation",
                    name = "Booking confirmation",
                    channel = WorkflowChannel.Email,
                    subject = "You're booked: {{event_title}}",
                    body =
                        "Hi {{attendee_name}}, your {{event_title}} is confirmed for {{event_date}} at " +
                            "{{event_time}}. Need to change it? {{reschedule_link}}",
                ),
                StarterTemplate(
                    id = "starter_reminder",
                    name = "Reminder",
                    channel = WorkflowChannel.Push,
                    subject = null,
                    body = "Reminder: {{event_title}} with {{host_name}} starts at {{event_time}}.",
                ),
                StarterTemplate(
                    id = "starter_thankyou",
                    name = "Thank-you",
                    channel = WorkflowChannel.Email,
                    subject = "Thanks for coming, {{attendee_name}}",
                    body =
                        "Thanks for meeting today, {{attendee_name}}. It was good to talk. " +
                            "Book again anytime: {{join_link}}",
                ),
                StarterTemplate(
                    id = "starter_review",
                    name = "Review request",
                    channel = WorkflowChannel.Email,
                    subject = "How did {{event_title}} go?",
                    body =
                        "Hi {{attendee_name}}, we'd love your feedback on {{event_title}} with {{host_name}}. " +
                            "It takes a minute and helps a lot.",
                ),
            )
    }
}

/** Replaces every `{{key}}` token in [template] with the matching value. */
fun interpolateTemplate(
    template: String,
    values: Map<String, String>,
): String {
    var result = template
    for ((key, value) in values) {
        result = result.replace("{{$key}}", value)
    }
    return result
}
