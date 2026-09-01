//
//  StartSupportTrainContent.swift
//  Pantopus
//
//  P2.6 — Start-a-Support-Train wizard render models. The wizard is a
//  three-step organizer compose flow:
//
//    1. Who & why     — beneficiary + reason
//    2. What & when   — kind + date range + slot duration
//    3. Review & launch — generated slot grid preview + confirm
//
//  All types here are render-only — networking lives in
//  `SupportTrainsEndpoints` and form/state lives in the view model.
//

import Foundation

/// The three ordered steps in the organizer wizard, plus the terminal
/// success screen the shell flips to after publish.
public enum StartSupportTrainStep: Int, CaseIterable, Sendable {
    case whoAndWhy = 0
    case whatAndWhen
    case reviewAndLaunch
    case success

    public var stepNumber: Int? {
        switch self {
        case .whoAndWhy: 1
        case .whatAndWhen: 2
        case .reviewAndLaunch: 3
        case .success: nil
        }
    }

    public static let progressTotal: Int = 5
}

/// Step-1 reason picker values from A12.11. This is separate from
/// `SupportTrainKind`: the reason names the moment the train rallies
/// around, while kind drives the volunteer slot type on the next step.
///
/// The six tiles render in declaration order as a 3×2 grid — the first
/// row groups the everyday-help reasons (meal train · ride · errand)
/// and the second row the life-moment reasons (surgery · baby · loss).
public enum StartSupportTrainReason: String, CaseIterable, Sendable, Identifiable {
    case mealTrain = "meal_train"
    case ride
    case errand
    case surgery
    case baby
    case loss

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .mealTrain: "Meal train"
        case .ride: "Ride"
        case .errand: "Errand"
        case .surgery: "Surgery"
        case .baby: "Baby"
        case .loss: "Loss"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .mealTrain: .utensils
        case .ride: .car
        case .errand: .shoppingBag
        case .surgery: .stethoscope
        case .baby: .baby
        case .loss: .flower
        }
    }
}

/// A mutual connection shared between the organizer and the recipient,
/// surfaced as a micro-avatar strip on the verified-neighbor card so the
/// organizer can confirm they have the right person.
public struct StartSupportTrainMutual: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }

    /// One- or two-letter monogram for the micro-avatar.
    public var initials: String {
        let pieces = name.split(separator: " ")
        let chars = pieces.prefix(2).compactMap(\.first)
        let letters = chars.map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}

/// The recipient the organizer typed but who isn't a verified Pantopus
/// neighbor yet — the Frame-2 invite branch. Carries the typed name plus
/// the (stubbed) contact handles the organizer can send the invite to.
public struct StartSupportTrainInviteCandidate: Sendable, Hashable {
    public let typedName: String
    public let phone: String
    public let email: String

    public init(typedName: String, phone: String, email: String) {
        self.typedName = typedName
        self.phone = phone
        self.email = email
    }

    /// The contact handle for a given invite method, rendered in the
    /// invite row's monospace value line.
    public func value(for method: StartSupportTrainInviteMethod) -> String {
        switch method {
        case .phone: phone
        case .email: email
        }
    }
}

/// Invite path option for a recipient who is not a verified Pantopus
/// neighbor yet.
public enum StartSupportTrainInviteMethod: String, CaseIterable, Sendable, Identifiable {
    case phone
    case email

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .phone: "Invite by phone"
        case .email: "Invite by email"
        }
    }

    public var value: String {
        switch self {
        case .phone: "+1 (415) 555-0142"
        case .email: "d.chen@example.com"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .phone: .phone
        case .email: .mail
        }
    }
}

/// One of the six designed train kinds plus a generic "other" escape
/// hatch. Mirrors `SupportTrainType` on the list screen but adds the
/// backend wire string + a default daily slot window (the wizard's
/// slot-grid generator uses this when the organizer hasn't customised
/// the window).
public enum SupportTrainKind: String, CaseIterable, Sendable, Identifiable {
    case meals
    case rides
    case childcare
    case errands
    case dogWalks = "dog_walks"
    case other

    public var id: String {
        rawValue
    }

    /// Backend `support_train_type` enum value.
    public var wire: String {
        switch self {
        case .meals: "meal_support"
        case .rides: "ride_support"
        case .childcare: "childcare"
        case .errands: "errand_support"
        case .dogWalks: "pet_care"
        case .other: "visit_support"
        }
    }

    public var title: String {
        switch self {
        case .meals: "Meals"
        case .rides: "Rides"
        case .childcare: "Childcare"
        case .errands: "Errands"
        case .dogWalks: "Dog walks"
        case .other: "Other"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .meals: .utensils
        case .rides: .navigation
        case .childcare: .baby
        case .errands: .shoppingBag
        case .dogWalks: .pawPrint
        case .other: .handCoins
        }
    }

    /// Default start-of-window hour (24h) used by the slot-grid generator
    /// when the organizer hasn't customised the daily window. Picked to
    /// match the most common volunteer-rotation cadence per archetype.
    public var defaultStartHour: Int {
        switch self {
        case .meals: 17
        case .rides: 9
        case .childcare: 9
        case .errands: 10
        case .dogWalks: 8
        case .other: 10
        }
    }

    /// Default slot label per archetype, matching the backend's
    /// `SupportTrainSlot.slot_label` enum.
    public var defaultSlotLabel: String {
        switch self {
        case .meals: "Dinner"
        case .errands: "Groceries"
        case .rides, .childcare, .dogWalks, .other: "Custom"
        }
    }

    /// Backend `support_mode` enum match for the train kind.
    public var supportMode: String {
        switch self {
        case .errands: "groceries"
        default: "meal"
        }
    }
}

/// Slot duration choices the organizer can pick from. Stored as
/// minutes so the slot-grid generator can derive end-time directly.
public enum StartSupportTrainSlotDuration: Int, CaseIterable, Sendable, Identifiable {
    case thirty = 30
    case sixty = 60
    case ninety = 90
    case oneTwenty = 120

    public var id: Int {
        rawValue
    }

    public var title: String {
        switch self {
        case .thirty: "30 min"
        case .sixty: "1 hr"
        case .ninety: "1.5 hr"
        case .oneTwenty: "2 hr"
        }
    }
}

/// Who can see this train. Maps onto the backend's `sharing_mode` +
/// `activity_visibility` columns.
public enum StartSupportTrainVisibility: String, CaseIterable, Sendable, Identifiable {
    case neighbors
    case connections
    case linkOnly = "link_only"

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .neighbors: "Nearby neighbors"
        case .connections: "My connections"
        case .linkOnly: "Link only"
        }
    }

    public var subtitle: String {
        switch self {
        case .neighbors: "Anyone within 25 mi can find and sign up."
        case .connections: "Only people you're connected to can find this."
        case .linkOnly: "Hidden — share the link with people you trust."
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .neighbors: .users
        case .connections: .userPlus
        case .linkOnly: .link
        }
    }

    /// `sharing_mode` wire value for `POST /api/support-trains/`.
    public var sharingModeWire: String {
        switch self {
        case .neighbors: "private_link"
        case .connections: "invited_only"
        case .linkOnly: "direct_share_only"
        }
    }
}

/// One generated slot in the preview grid. Render-only — the launch
/// step turns these into POST bodies for `/generate-slots`.
public struct StartSupportTrainSlot: Sendable, Hashable, Identifiable {
    /// Stable id so the slot grid view can diff cleanly.
    public let id: String
    /// `YYYY-MM-DD` — matches the backend's `slot_date` column.
    public let dateKey: String
    /// "Tue Oct 22" — short label rendered in the grid.
    public let dayLabel: String
    /// "5:00–5:30 pm" — the slot's time-of-day range.
    public let timeLabel: String
    /// `HH:mm` — wire value for `start_time`.
    public let startTime: String
    /// `HH:mm` — wire value for `end_time`.
    public let endTime: String

    public init(
        id: String,
        dateKey: String,
        dayLabel: String,
        timeLabel: String,
        startTime: String,
        endTime: String
    ) {
        self.id = id
        self.dateKey = dateKey
        self.dayLabel = dayLabel
        self.timeLabel = timeLabel
        self.startTime = startTime
        self.endTime = endTime
    }
}

/// Event the wizard view model raises so the host stack can pop +
/// push the new train's review-signups screen.
public enum StartSupportTrainEvent: Sendable, Equatable {
    /// User aborted or completed before publishing.
    case dismiss
    /// Train published — host should pop the wizard and push the
    /// review-signups screen for `trainId`.
    case openTrain(trainId: String)
}

/// Generates the slot-grid preview from the user's `whatAndWhen`
/// inputs. Public so the unit test can exercise it directly without
/// spinning up the VM.
public enum StartSupportTrainSlotGenerator {
    /// Build a per-day grid of empty slots covering `[startDate,
    /// endDate]` (inclusive). Returns at most 90 slots to match the
    /// backend's `generateSlotsSchema` 90-day cap.
    public static func generate(
        startDate: Date,
        endDate: Date,
        durationMinutes: Int,
        startHour: Int,
        calendar: Calendar = .current
    ) -> [StartSupportTrainSlot] {
        let cal = calendar
        let start = cal.startOfDay(for: startDate)
        let end = cal.startOfDay(for: endDate)
        guard end >= start else { return [] }
        guard let dayCount = cal.dateComponents([.day], from: start, to: end).day else { return [] }
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "yyyy-MM-dd"
        dateFmt.calendar = cal
        dateFmt.timeZone = cal.timeZone
        let dayFmt = DateFormatter()
        dayFmt.dateFormat = "EEE MMM d"
        dayFmt.calendar = cal
        dayFmt.timeZone = cal.timeZone

        var slots: [StartSupportTrainSlot] = []
        let cap = min(dayCount + 1, 90)
        for i in 0..<cap {
            guard let day = cal.date(byAdding: .day, value: i, to: start) else { continue }
            let dateKey = dateFmt.string(from: day)
            let dayLabel = dayFmt.string(from: day)
            let range = timeRange(
                startHour: startHour,
                durationMinutes: durationMinutes
            )
            slots.append(
                StartSupportTrainSlot(
                    id: "\(dateKey)_\(range.start)",
                    dateKey: dateKey,
                    dayLabel: dayLabel,
                    timeLabel: range.label,
                    startTime: range.start,
                    endTime: range.end
                )
            )
        }
        return slots
    }

    struct TimeRange {
        let start: String
        let end: String
        let label: String
    }

    private static func timeRange(
        startHour: Int,
        durationMinutes: Int
    ) -> TimeRange {
        let startMinutes = max(0, min(23 * 60 + 59, startHour * 60))
        let endMinutes = min(23 * 60 + 59, startMinutes + max(0, durationMinutes))
        let startStr = wireString(forMinutes: startMinutes)
        let endStr = wireString(forMinutes: endMinutes)
        let label = "\(displayString(forMinutes: startMinutes))–\(displayString(forMinutes: endMinutes))"
        return TimeRange(start: startStr, end: endStr, label: label)
    }

    private static func wireString(forMinutes total: Int) -> String {
        let h = total / 60
        let m = total % 60
        return String(format: "%02d:%02d", h, m)
    }

    private static func displayString(forMinutes total: Int) -> String {
        let h24 = total / 60
        let m = total % 60
        let suffix = h24 < 12 ? "am" : "pm"
        let h12 = h24 % 12 == 0 ? 12 : h24 % 12
        if m == 0 {
            return "\(h12) \(suffix)"
        }
        return String(format: "%d:%02d %@", h12, m, suffix)
    }
}
