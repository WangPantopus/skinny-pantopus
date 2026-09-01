//
//  AddHouseholdTaskFormViewModel.swift
//  Pantopus
//
//  P2.4 — Backs `AddHouseholdTaskFormView`. Drives both Add
//  (`POST /api/homes/:id/tasks`, route `backend/routes/home.js:4238`)
//  and Edit (`PUT /api/homes/:id/tasks/:taskId`, route
//  `backend/routes/home.js:4308`) of one household chore. The two
//  modes share the same fields, layout, and validators — only the
//  load behavior (Edit hydrates from the existing task) and the
//  submit verb (Add → POST, Edit → PUT) differ.
//
//  Backend constraints worth knowing:
//   * The PUT allowlist (`home.js:4316`) does **not** include
//     `recurrence_rule`. The wire body carries it (so when the
//     backend catches up nothing changes here) but the server
//     silently drops it today. Mirrored on Android.
//   * `assigned_to` is a single user uuid column. The prompt asks
//     for multi-select; the wire forces single-select. Surfaced
//     in the UI as a single-selection picker labeled "Assigned to"
//     with "Unassigned (any member)" as the default. When schema
//     grows a multi-assignee column the picker can widen.
//

import Foundation
import Observation

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

/// ViewModel for `AddHouseholdTaskFormView`. Holds the four
/// scaffold-relevant signals (`state`, `fields`, `isSaving`,
/// `shouldDismiss`) plus typed picker selections (`category`,
/// `recurrence`, `customUnit`).
@Observable
@MainActor
public final class AddHouseholdTaskFormViewModel {
    public private(set) var state: AddHouseholdTaskFormState = .editing
    public var fields: [AddHouseholdTaskField: FormFieldState] = [:]
    public private(set) var isSaving: Bool = false
    public var toast: ToastMessage?
    public private(set) var shakeTrigger: Int = 0
    public private(set) var shouldDismiss: Bool = false
    /// Newly-created task id surfaced after a successful Add — the
    /// caller can pop the form and push the detail in one step. Nil
    /// in Edit mode.
    public private(set) var createdTaskId: String?

    /// Loaded roster for the assignee picker. Lives independently of
    /// the form load so a slow members fetch can't block the title /
    /// recurrence editor.
    public private(set) var assignableMembers: [HouseholdTaskAssignableMember] = []

    public let homeId: String
    public let taskId: String?
    private let api: APIClient

    public var isEditing: Bool {
        taskId != nil
    }

    init(
        homeId: String,
        taskId: String? = nil,
        api: APIClient = .shared
    ) {
        self.homeId = homeId
        self.taskId = taskId
        self.api = api
        for field in AddHouseholdTaskField.allCases {
            fields[field] = FormFieldState(id: field.rawValue, originalValue: defaultValue(for: field))
        }
        // Re-run validators against seed values so the initial
        // aggregate matches the schema's view of "valid".
        primeErrors()
        // Seed the editing state directly when we have no `taskId` —
        // Add mode has nothing to fetch. Edit mode flips to .loading
        // until `load()` finishes hydrating.
        state = taskId == nil ? .editing : .loading
    }

    // MARK: - Lifecycle

    /// Initial load. In Add mode this only fetches the assignee
    /// roster; in Edit mode it also fetches the task itself and
    /// hydrates the field map.
    ///
    /// Note: `backend/routes/home.js:4170` only exposes a list
    /// endpoint — no GET-by-id today. Edit mode fetches the full
    /// list and matches client-side.
    public func load() async {
        if taskId == nil {
            await loadMembers()
            return
        }
        state = .loading
        do {
            let response: GetHomeTasksResponse = try await api.request(
                HomesEndpoints.tasks(homeId: homeId)
            )
            guard let match = response.tasks.first(where: { $0.id == taskId }) else {
                state = .error("Couldn't find that task.")
                return
            }
            hydrate(from: match)
            state = .editing
            await loadMembers()
        } catch {
            state = .error((error as? APIError)?.errorDescription ?? "Couldn't load the task.")
        }
    }

    public func refresh() async {
        await load()
    }

    /// Update a single field's raw value and re-run its validator.
    public func update(_ field: AddHouseholdTaskField, to value: String) {
        guard var snapshot = fields[field] else { return }
        snapshot.value = value
        snapshot.touched = true
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    /// Typed setter for the category chip.
    public func selectCategory(_ value: AddHouseholdTaskFormCategory) {
        update(.category, to: value.rawValue)
    }

    /// Typed setter for the recurrence picker. Clears custom-only
    /// fields when switching away from `.custom` so a stale interval
    /// doesn't survive into the wire body, and re-runs the custom
    /// interval validator on the way in so a previously-typed bad
    /// value surfaces an error immediately.
    public func selectRecurrence(_ value: AddHouseholdTaskRecurrence) {
        update(.recurrence, to: value.rawValue)
        if value != .custom {
            update(.customInterval, to: "1")
            update(.customUnit, to: AddHouseholdTaskCustomUnit.weeks.rawValue)
        } else {
            // Re-validate the current customInterval value against
            // the now-active strict rule without flipping the
            // touched flag — the user hasn't typed anything new.
            if var snapshot = fields[.customInterval] {
                snapshot.error = validator(for: .customInterval).validate(snapshot.value)
                fields[.customInterval] = snapshot
            }
        }
    }

    /// Typed setter for the custom recurrence unit.
    public func selectCustomUnit(_ value: AddHouseholdTaskCustomUnit) {
        update(.customUnit, to: value.rawValue)
    }

    /// Single-select assignee. Pass `nil` for the "Unassigned (any
    /// member)" default. See top-of-file note on multi-assignee.
    public func selectAssignee(_ memberId: String?) {
        update(.assignedTo, to: memberId ?? "")
    }

    // MARK: - Typed reads

    public var selectedCategory: AddHouseholdTaskFormCategory {
        AddHouseholdTaskFormCategory(rawValue: fields[.category]?.value ?? "")
            ?? .other
    }

    public var selectedRecurrence: AddHouseholdTaskRecurrence {
        AddHouseholdTaskRecurrence(rawValue: fields[.recurrence]?.value ?? "")
            ?? .oneTime
    }

    public var selectedCustomUnit: AddHouseholdTaskCustomUnit {
        AddHouseholdTaskCustomUnit(rawValue: fields[.customUnit]?.value ?? "")
            ?? .weeks
    }

    public var selectedAssigneeId: String? {
        let id = fields[.assignedTo]?.value ?? ""
        return id.isEmpty ? nil : id
    }

    public var dueDate: Date? {
        Self.parseISODay(fields[.dueAt]?.value ?? "")
    }

    public func setDueDate(_ date: Date?) {
        update(.dueAt, to: date.map(Self.formatISODay) ?? "")
    }

    // MARK: - Aggregate

    /// Aggregate dirty + validity across every field. Drives the
    /// FormShell save action.
    public var aggregate: FormAggregate {
        FormAggregate(fields: AddHouseholdTaskField.allCases.compactMap { fields[$0] })
    }

    public var isValid: Bool {
        aggregate.isValid
    }

    /// Add mode treats every field as "new" so the Save button is
    /// active the moment a valid title lands. Edit mode keeps the
    /// dirty gate so an untouched task can't accidentally re-save.
    public var isDirty: Bool {
        isEditing ? aggregate.isDirty : true
    }

    /// Whether the custom recurrence sub-form should render.
    public var showsCustomRecurrenceSubForm: Bool {
        selectedRecurrence == .custom
    }

    // MARK: - Submit

    /// Run every validator. Returns the first invalid field id, if any.
    @discardableResult
    public func validateAll() -> AddHouseholdTaskField? {
        var firstInvalid: AddHouseholdTaskField?
        for field in AddHouseholdTaskField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if firstInvalid == nil, message != nil { firstInvalid = field }
        }
        return firstInvalid
    }

    /// Submit. Returns true on success.
    @discardableResult
    public func save() async -> Bool {
        if validateAll() != nil {
            shakeTrigger &+= 1
            toast = ToastMessage(text: "Fix the highlighted field.", kind: .error)
            return false
        }
        if !NetworkMonitor.shared.isOnline {
            toast = ToastMessage(
                text: "You're offline. Try again when you're back online.",
                kind: .error
            )
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            if let taskId {
                let response: HomeTaskResponse = try await api.request(
                    HomesEndpoints.updateTask(
                        homeId: homeId,
                        taskId: taskId,
                        request: buildUpdateRequest()
                    )
                )
                hydrate(from: response.task)
                toast = ToastMessage(text: "Task updated.", kind: .success)
            } else {
                let response: HomeTaskResponse = try await api.request(
                    HomesEndpoints.createTask(
                        homeId: homeId,
                        request: buildCreateRequest()
                    )
                )
                createdTaskId = response.task.id
                toast = ToastMessage(text: "Task added.", kind: .success)
            }
            shouldDismiss = true
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? (isEditing ? "Couldn't update the task." : "Couldn't add the task."),
                kind: .error
            )
            return false
        }
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Members

    private func loadMembers() async {
        do {
            let response: OccupantsResponse = try await api.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            assignableMembers = response.occupants.compactMap(HouseholdTaskAssignableMember.from)
        } catch {
            // Picker keeps the assignee snapshot value but only shows
            // "Unassigned (any member)" as an option — the editor
            // doesn't gate on members loading, so swallow the error.
            assignableMembers = []
        }
    }
}
