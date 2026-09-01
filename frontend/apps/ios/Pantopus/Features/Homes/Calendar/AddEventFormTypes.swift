//
//  AddEventFormTypes.swift
//  Pantopus
//
//  P2.7 — Enums and value types shared by the Add / Edit Event form
//  and its view-model. Lifted out of `AddEventFormViewModel.swift` to
//  keep that file under SwiftLint's file/type-length budgets.
//

import Foundation

/// Recurrence choices the form exposes. Mapped to iCal RRULE on submit.
enum AddEventRecurrence: String, CaseIterable, Hashable {
    case none
    case daily
    case weekly
    case monthly
    case yearly

    var label: String {
        switch self {
        case .none: "Does not repeat"
        case .daily: "Repeats daily"
        case .weekly: "Repeats weekly"
        case .monthly: "Repeats monthly"
        case .yearly: "Repeats yearly"
        }
    }

    /// Short label rendered in the Home add/edit-event segmented control
    /// (`Segmented options={['No','Daily','Weekly','Monthly']}` in
    /// `add-event-frames.jsx:69`).
    var segmentedLabel: String {
        switch self {
        case .none: "No"
        case .daily: "Daily"
        case .weekly: "Weekly"
        case .monthly: "Monthly"
        case .yearly: "Yearly"
        }
    }

    /// The four options the design's segmented control offers. `.yearly`
    /// stays in the enum for round-tripping an existing FREQ=YEARLY event on
    /// edit, but the picker only exposes the designed four.
    static let pickerOptions: [AddEventRecurrence] = [.none, .daily, .weekly, .monthly]

    /// Serialize to an iCal RRULE. `.none` → nil.
    var rrule: String? {
        switch self {
        case .none: nil
        case .daily: "FREQ=DAILY"
        case .weekly: "FREQ=WEEKLY"
        case .monthly: "FREQ=MONTHLY"
        case .yearly: "FREQ=YEARLY"
        }
    }

    /// Best-effort inverse for prefilling the picker on edit. Anything
    /// not recognised lands on `.none` (the row still renders "Repeats"
    /// in the agenda via the existing `recurrenceShortLabel`).
    static func from(rrule: String?) -> AddEventRecurrence {
        guard let raw = rrule?.uppercased(), !raw.isEmpty else { return .none }
        if raw.contains("FREQ=DAILY") { return .daily }
        if raw.contains("FREQ=WEEKLY") { return .weekly }
        if raw.contains("FREQ=MONTHLY") { return .monthly }
        if raw.contains("FREQ=YEARLY") { return .yearly }
        return .none
    }
}

/// Reminder lead-times (multi-select, Stream I10). Serialized to the event's
/// `reminders` jsonb array as minutes-before integers; `alerts_enabled` mirrors
/// whether any reminder is set, for backwards-compatibility with the column.
enum AddEventReminderOffset: Int, CaseIterable, Hashable {
    case atTime = 0
    case tenMin = 10
    case oneHour = 60
    case oneDay = 1440

    var label: String {
        switch self {
        case .atTime: "At time"
        case .tenMin: "10 min"
        case .oneHour: "1 hour"
        case .oneDay: "1 day"
        }
    }
}

/// Stable identifiers for free-text fields. Date / category / attendee
/// fields don't fit `FormFieldState`'s string shape so they live on the
/// view-model directly.
enum AddEventField: String, CaseIterable {
    case title
    case location
    case notes
}

/// Render state for the Add Event form.
enum AddEventFormState: Equatable {
    /// Initial — fetching members + (when editing) the source event.
    case loading
    case editing
    case error(String)
}

/// Outbound event after a successful commit. The host route reads
/// `pendingEvent` and pops / replaces / pushes as needed.
enum AddEventFormEvent: Equatable {
    case created(eventId: String)
    case updated(eventId: String)
}

/// Attendee row surfaced in the multi-pick. Built from `OccupantDTO`
/// but exposed as a tiny value type so view code doesn't depend on the
/// wire shape.
struct AddEventAttendee: Hashable, Identifiable {
    let id: String
    let displayName: String
    let initials: String
}
