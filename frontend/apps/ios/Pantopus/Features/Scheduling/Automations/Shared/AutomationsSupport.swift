//
//  AutomationsSupport.swift
//  Pantopus
//
//  Stream I16 (Reminders / workflows / templates) — domain vocabulary shared
//  across H1–H8. Maps the backend workflow/template wire shapes to the
//  plain-English, verbs-first copy the design suite calls for, plus the reminder
//  lead-time presets, the template-variable catalog, and the read-only starter
//  templates. Pure value logic — no UI, no tokens. See
//  `reference/calendarly-backend-api.md` (workflows + message-templates).
//

import Foundation

// MARK: - Workflow trigger

/// A workflow's lifecycle trigger. Raw value is the backend wire string
/// (`trigger` on `SchedulingWorkflow`); `before_start` / `after_end` are the
/// only triggers that carry an `offset_minutes`.
enum WorkflowTrigger: String, CaseIterable, Hashable, Identifiable {
    case bookingCreated = "booking_created"
    case cancelled
    case rescheduled
    case beforeStart = "before_start"
    case afterEnd = "after_end"

    var id: String {
        rawValue
    }

    /// Tolerant decode of an arbitrary backend string (defaults to created).
    init(wire: String?) {
        self = WorkflowTrigger(rawValue: (wire ?? "").lowercased()) ?? .bookingCreated
    }

    /// Lifecycle label used in the trigger picker radio list.
    var lifecycleLabel: String {
        switch self {
        case .bookingCreated: "Created"
        case .cancelled: "Cancelled"
        case .rescheduled: "Rescheduled"
        case .beforeStart: "Started"
        case .afterEnd: "Ended"
        }
    }

    /// One-line description under each lifecycle radio.
    var lifecycleDescription: String {
        switch self {
        case .bookingCreated: "The moment someone books"
        case .cancelled: "When an attendee cancels"
        case .rescheduled: "When a booking moves"
        case .beforeStart: "A set time before it starts"
        case .afterEnd: "A set time after it ends"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .bookingCreated: .calendarPlus
        case .cancelled: .xCircle
        case .rescheduled: .arrowsRepeat
        case .beforeStart: .clock
        case .afterEnd: .calendarCheck
        }
    }

    /// Whether this trigger uses an `offset_minutes` builder (before/after).
    var usesOffset: Bool {
        self == .beforeStart || self == .afterEnd
    }

    /// Plain-English, sentence-case summary used on workflow rows + the editor
    /// summary pill (e.g. "When a booking is created", "1 hour before it starts").
    func summary(offsetMinutes: Int) -> String {
        switch self {
        case .bookingCreated: "When a booking is created"
        case .cancelled: "When a booking is cancelled"
        case .rescheduled: "When a booking is rescheduled"
        case .beforeStart:
            offsetMinutes <= 0
                ? "When it starts"
                : "\(AutomationsFormat.duration(offsetMinutes)) before it starts"
        case .afterEnd:
            offsetMinutes <= 0
                ? "When it ends"
                : "\(AutomationsFormat.duration(offsetMinutes)) after it ends"
        }
    }
}

// MARK: - Workflow channel (action)

/// The channel a workflow's `action` fires on. Raw value is the backend wire
/// string. SMS is rendered but disabled ("coming soon") until carrier support.
enum WorkflowChannel: String, CaseIterable, Hashable {
    case email
    case push
    case inApp = "in_app"
    case sms

    init(wire: String?) {
        self = WorkflowChannel(rawValue: (wire ?? "").lowercased()) ?? .email
    }

    var label: String {
        switch self {
        case .email: "Email"
        case .push: "Push"
        case .inApp: "In-app"
        case .sms: "SMS"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .email: .mail
        case .push: .bell
        case .inApp: .messageSquare
        case .sms: .smartphone
        }
    }

    /// SMS is not yet wired end-to-end (no carrier integration) — render the
    /// chip disabled with a "Coming soon" caption per the global contract.
    var isComingSoon: Bool {
        self == .sms
    }

    /// Whether this channel needs a subject line (email).
    var needsSubject: Bool {
        self == .email
    }

    /// Plain-English action summary on workflow rows (channel + implied
    /// recipient — the backend has no separate recipient field, so the channel
    /// carries the intent: email/SMS reach attendees, push/in-app reach you).
    var actionSummary: String {
        switch self {
        case .email: "Email attendees"
        case .push: "Notify you"
        case .inApp: "Notify you in-app"
        case .sms: "Text attendees"
        }
    }

    /// SMS soft length limit; over this a message sends as multiple segments.
    static let smsSegmentLimit = 160
    /// General message body cap (matches the backend 5000 ceiling, but the UI
    /// counter uses a friendlier 600 for non-SMS).
    static let bodyCounterLimit = 600
}

// MARK: - Formatting

/// Stateless formatters for offsets, reminder lead-times, and previews.
enum AutomationsFormat {
    /// "15 minutes" / "1 hour" / "2 days" / "1 week".
    static func duration(_ minutes: Int) -> String {
        let m = max(0, minutes)
        if m == 0 { return "0 minutes" }
        if m % 10080 == 0 { let w = m / 10080
            return "\(w) week\(w == 1 ? "" : "s")"
        }
        if m % 1440 == 0 { let d = m / 1440
            return "\(d) day\(d == 1 ? "" : "s")"
        }
        if m % 60 == 0 { let h = m / 60
            return "\(h) hour\(h == 1 ? "" : "s")"
        }
        return "\(m) minute\(m == 1 ? "" : "s")"
    }

    /// Compact lead-time label for the reminder card rows ("1 day before").
    static func reminderRowLabel(_ minutes: Int) -> String {
        minutes <= 0 ? "At start" : "\(duration(minutes)) before"
    }

    /// Compact chip label for the pinned reminders summary ("1 day", "1 hr").
    static func reminderShort(_ minutes: Int) -> String {
        switch minutes {
        case 0: "at start"
        case 15: "15 min"
        case 30: "30 min"
        case 60: "1 hour"
        case 1440: "1 day"
        case 10080: "1 week"
        default: duration(minutes)
        }
    }

    /// "1 day + 1 hour before · Push" subtitle for the pinned default-reminders
    /// row. Empty array → an off state.
    static func remindersSummary(_ minutes: [Int]) -> String {
        guard !minutes.isEmpty else { return "No reminders yet" }
        let sorted = minutes.sorted(by: >)
        let parts = sorted.prefix(3).map(reminderShort)
        var lead = parts.joined(separator: " + ")
        if sorted.count > 3 { lead += " +\(sorted.count - 3)" }
        let suffix = sorted.contains(0) ? "" : " before"
        return "\(lead)\(suffix) · Push"
    }
}

// MARK: - Reminder presets (H1)

/// The fixed reminder lead-times the H1 card offers, in display order.
enum ReminderPreset {
    /// (minutes, row label). Mirrors the reminders-frames design rows.
    static let all: [(minutes: Int, label: String)] = [
        (10080, "1 week before"),
        (1440, "1 day before"),
        (60, "1 hour before"),
        (30, "30 minutes before"),
        (15, "15 minutes before"),
        (0, "At start")
    ]

    /// Smart default on first open: 1 day + 1 hour.
    static let smartDefault: [Int] = [1440, 60]

    /// Custom-time unit for the inline stepper.
    enum Unit: String, CaseIterable, Identifiable {
        case minutes, hours, days
        var id: String {
            rawValue
        }

        var label: String {
            switch self {
            case .minutes: "minutes"
            case .hours: "hours"
            case .days: "days"
            }
        }

        var multiplier: Int {
            switch self {
            case .minutes: 1
            case .hours: 60
            case .days: 1440
            }
        }
    }
}

// MARK: - Template variables (H6)

/// A dynamic `{{token}}` a message can interpolate. Grouped for the picker.
struct TemplateVariable: Identifiable, Hashable {
    enum Group: String, CaseIterable {
        case event = "Event"
        case people = "People"
        case links = "Links"
    }

    let group: Group
    /// Human label ("Attendee name").
    let label: String
    /// Wire token without braces ("attendee_name").
    let key: String
    /// Sample value shown in the picker + used to fill the preview.
    let sample: String

    var id: String {
        key
    }

    /// The inserted token, e.g. `{{attendee_name}}`.
    var token: String {
        "{{\(key)}}"
    }
}

/// One grouped section of variables (Identifiable so it drives `ForEach`).
struct VariableSection: Identifiable {
    let group: TemplateVariable.Group
    let items: [TemplateVariable]
    var id: String {
        group.rawValue
    }
}

/// The full variable catalog offered in H6, grouped EVENT / PEOPLE / LINKS.
enum TemplateVariableCatalog {
    static let all: [TemplateVariable] = [
        .init(group: .event, label: "Event title", key: "event_title", sample: "Intro call"),
        .init(group: .event, label: "Date", key: "event_date", sample: "Tue, Jun 16"),
        .init(group: .event, label: "Time", key: "event_time", sample: "3:00 PM"),
        .init(group: .event, label: "Duration", key: "event_duration", sample: "30 min"),
        .init(group: .event, label: "Location", key: "event_location", sample: "Video call"),
        .init(group: .people, label: "Attendee name", key: "attendee_name", sample: "Maria K."),
        .init(group: .people, label: "Host name", key: "host_name", sample: "Sam R."),
        .init(group: .people, label: "Attendee email", key: "attendee_email", sample: "maria@pantopus.co"),
        .init(group: .links, label: "Reschedule link", key: "reschedule_link", sample: "pantopus.com/r/ab12"),
        .init(group: .links, label: "Cancel link", key: "cancel_link", sample: "pantopus.com/c/ab12"),
        .init(group: .links, label: "Join link", key: "join_link", sample: "meet.pantopus.co/ab12")
    ]

    /// Catalog grouped + filtered by a search query (case-insensitive on label).
    static func grouped(filter: String) -> [VariableSection] {
        let needle = filter.trimmingCharacters(in: .whitespaces).lowercased()
        return TemplateVariable.Group.allCases.compactMap { group in
            let items = all.filter { variable in
                variable.group == group &&
                    (needle.isEmpty || variable.label.lowercased().contains(needle) || variable.key.contains(needle))
            }
            return items.isEmpty ? nil : VariableSection(group: group, items: items)
        }
    }

    /// Sample values keyed by token name — feeds the preview interpolation.
    static var sampleValues: [String: String] {
        Dictionary(uniqueKeysWithValues: all.map { ($0.key, $0.sample) })
    }
}

// MARK: - Starter templates (H8)

/// A read-only starter the user can duplicate into their own templates. These
/// are client-side seeds (not backend rows) — duplicating POSTs a real copy.
struct StarterTemplate: Identifiable, Hashable {
    let id: String
    let name: String
    let channel: WorkflowChannel
    let subject: String?
    let body: String

    static let all: [StarterTemplate] = [
        .init(
            id: "starter_confirmation",
            name: "Booking confirmation",
            channel: .email,
            subject: "You're booked: {{event_title}}",
            // swiftlint:disable:next line_length
            body: "Hi {{attendee_name}}, your {{event_title}} is confirmed for {{event_date}} at {{event_time}}. Need to change it? {{reschedule_link}}"
        ),
        .init(
            id: "starter_reminder",
            name: "Reminder",
            channel: .push,
            subject: nil,
            body: "Reminder: {{event_title}} with {{host_name}} starts at {{event_time}}."
        ),
        .init(
            id: "starter_thankyou",
            name: "Thank-you",
            channel: .email,
            subject: "Thanks for coming, {{attendee_name}}",
            body: "Thanks for meeting today, {{attendee_name}}. It was good to talk. Book again anytime: {{join_link}}"
        ),
        .init(
            id: "starter_review",
            name: "Review request",
            channel: .email,
            subject: "How did {{event_title}} go?",
            body: "Hi {{attendee_name}}, we'd love your feedback on {{event_title}} with {{host_name}}. It takes a minute and helps a lot."
        )
    ]
}
