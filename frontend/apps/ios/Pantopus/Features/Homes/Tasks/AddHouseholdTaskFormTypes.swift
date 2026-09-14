import Foundation

/// Form-level category — distinct from the display-only
/// `HouseholdTaskCategory` palette (which is inferred from a free-form
/// title). These seven values are the user-pickable bucket from the
/// prompt. The wire payload sets `task_type` based on the mapping in
/// `taskType` below — the backend's `task_type` enum is `chore /
/// shopping / project / reminder / repair` and the seven design
/// buckets collapse into that vocabulary.
public enum AddHouseholdTaskFormCategory: String, CaseIterable, Sendable {
    case cleaning
    case cooking
    case shopping
    case yardwork
    case pets
    case repairs
    case other

    public var label: String {
        switch self {
        case .cleaning: "Cleaning"
        case .cooking: "Cooking"
        case .shopping: "Shopping"
        case .yardwork: "Yardwork"
        case .pets: "Pets"
        case .repairs: "Repairs"
        case .other: "Other"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .cleaning: .sparkles
        case .cooking: .utensils
        case .shopping: .shoppingBag
        case .yardwork: .leaf
        case .pets: .pawPrint
        case .repairs: .hammer
        case .other: .checkCircle
        }
    }

    /// Wire `task_type` value (one of the 5 backend buckets).
    public var taskType: String {
        switch self {
        case .shopping: "shopping"
        case .repairs: "repair"
        default: "chore"
        }
    }

    /// Best-guess inference from an existing task's `task_type` +
    /// title — used in Edit mode to preselect the picker. Falls back
    /// to `.other` when nothing matches.
    public static func from(taskType: String?, title: String?) -> AddHouseholdTaskFormCategory {
        // Hard-coded title keywords mirror the display palette but
        // map onto the form's vocabulary. First match wins.
        let lower = (title ?? "").lowercased()
        if !lower.isEmpty {
            if matchAny(lower, cookingKeywords) { return .cooking }
            if matchAny(lower, cleaningKeywords) { return .cleaning }
            if matchAny(lower, trashKeywords) { return .cleaning }
            if matchAny(lower, yardworkKeywords) { return .yardwork }
            if matchAny(lower, petKeywords) { return .pets }
            if matchAny(lower, repairKeywords) { return .repairs }
            if matchAny(lower, shoppingKeywords) { return .shopping }
        }
        switch taskType?.lowercased() {
        case "shopping": return .shopping
        case "repair": return .repairs
        default: return .other
        }
    }

    private static let cookingKeywords = ["cook", "meal", "dinner", "lunch", "breakfast"]
    private static let cleaningKeywords = [
        "dish", "clean", "vacuum", "dust", "mop", "wipe", "scrub",
        "sweep", "tidy", "bathroom", "bedroom"
    ]
    private static let trashKeywords = ["trash", "garbage", "recycle", "recycling", "compost"]
    private static let yardworkKeywords = [
        "water plants", "plants", "garden", "mow", "lawn", "rake",
        "leaves", "yard", "weed"
    ]
    private static let petKeywords = ["dog", "cat", "puppy", " pet ", "litter box", "vet "]
    private static let repairKeywords = ["fix", "repair", "replace", "patch", "screw", "leak"]
    private static let shoppingKeywords = [
        "costco", "grocery", "groceries", "shopping", "shop ", "pickup",
        "pick up", "store run", "errand", "buy "
    ]

    private static func matchAny(_ haystack: String, _ needles: [String]) -> Bool {
        needles.contains { haystack.contains($0) }
    }
}

/// The five recurrence options exposed by the form. `custom` reveals
/// the "every N days / weeks / months" sub-form.
public enum AddHouseholdTaskRecurrence: String, CaseIterable, Sendable {
    case oneTime = "one_time"
    case daily
    case weekly
    case monthly
    case custom

    public var label: String {
        switch self {
        case .oneTime: "One-time"
        case .daily: "Daily"
        case .weekly: "Weekly"
        case .monthly: "Monthly"
        case .custom: "Custom"
        }
    }

    public var isRecurring: Bool {
        self != .oneTime
    }
}

/// Unit for the custom recurrence sub-form.
public enum AddHouseholdTaskCustomUnit: String, CaseIterable, Sendable {
    case days
    case weeks
    case months

    public var label: String {
        switch self {
        case .days: "Days"
        case .weeks: "Weeks"
        case .months: "Months"
        }
    }

    /// RRULE FREQ token paired with the unit.
    public var rruleFreq: String {
        switch self {
        case .days: "DAILY"
        case .weeks: "WEEKLY"
        case .months: "MONTHLY"
        }
    }
}

/// Stable identifiers for every editable field in the Add/Edit
/// Household Task form. All non-enum payload uses `FormFieldState`
/// for dirty + validation tracking; the typed enums above ride
/// alongside via the stable raw-value mapping.
public enum AddHouseholdTaskField: String, CaseIterable, Sendable {
    case title
    case category
    case assignedTo
    case recurrence
    case customInterval
    case customUnit
    case dueAt
    case notes
}

/// One assignable member surfaced by the picker. Built from
/// `OccupantDTO` so the form doesn't depend on the wire shape.
public struct HouseholdTaskAssignableMember: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let initials: String

    public init(id: String, displayName: String, initials: String) {
        self.id = id
        self.displayName = displayName
        self.initials = initials
    }

    public static func from(_ occupant: OccupantDTO) -> HouseholdTaskAssignableMember? {
        guard occupant.isActive else { return nil }
        let name = occupant.displayName?.trimmingCharacters(in: .whitespaces)
            ?? occupant.username?.trimmingCharacters(in: .whitespaces)
            ?? ""
        let display = name.isEmpty ? "Member \(occupant.userId.prefix(4).uppercased())" : name
        let initials = display
            .split(separator: " ")
            .compactMap { $0.first.map(String.init) }
            .prefix(2)
            .joined()
            .uppercased()
        return HouseholdTaskAssignableMember(
            id: occupant.userId,
            displayName: display,
            initials: initials.isEmpty ? "··" : initials
        )
    }
}

/// Render state for the Add/Edit Household Task form.
public enum AddHouseholdTaskFormState: Sendable, Equatable {
    case loading
    case editing
    case error(String)
}
