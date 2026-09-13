//
//  AddHouseholdTaskFormViewModel.swift
//  Pantopus
//
//  Current task capabilities authorize the form. Creation retains one exact
//  request before sending; editing sends only the fields the user changed.
//

import Foundation
import Observation

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

    enum AssigneeReadState { case loading, loaded, unavailable }
    private(set) var assigneeReadState: AssigneeReadState = .loading

    public let homeId: String
    public let taskId: String?
    private let api: APIClient
    private let access: HomeTaskAccess
    private let creation: HomeTaskCreationCoordinator
    private var visible = false
    private var generation = 0
    private var pendingReload = false
    private var canSave = false
    private var pendingEdit: HomeTaskEditPatch?

    public var isCurrent: Bool {
        access.isCurrent
    }

    public var hasPendingSave: Bool {
        creation.pending != nil || pendingEdit != nil
    }

    var terminalRequestMessage: String? {
        creation.terminalMessage
    }

    func acknowledgeTerminalRequest() {
        guard visible, !isSaving, isCurrent else { return }
        do {
            try creation.acknowledgeTerminalRequest()
            clearPrivateDraft()
            shouldDismiss = true
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    public var saveLabel: String {
        hasPendingSave ? "Retry saved request" : "Save"
    }

    public var recoveryMessage: String? {
        hasPendingSave ? "This request is not confirmed. Its original details are kept for an exact retry." : nil
    }

    var activationRevision: Int {
        generation
    }

    public var isEditing: Bool {
        taskId != nil
    }

    init(
        homeId: String,
        taskId: String? = nil,
        api: APIClient = .shared,
        access: HomeTaskAccess? = nil,
        store: any PendingHomeTaskCreateStoring = PendingHomeTaskCreateStore(),
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.homeId = homeId
        self.taskId = taskId
        self.api = api
        let access = access ?? HomeTaskAccess(homeId: homeId, api: api)
        self.access = access
        creation = HomeTaskCreationCoordinator(home: homeId, origin: api.apiBaseURL, access: access, store: store, requestId: requestId)
        for field in AddHouseholdTaskField.allCases {
            fields[field] = FormFieldState(id: field.rawValue, originalValue: defaultValue(for: field))
        }
        // Re-run validators against seed values so the initial
        // aggregate matches the schema's view of "valid".
        primeErrors()
        state = .loading
    }

    // MARK: - Lifecycle

    public func load() async {
        guard !Task.isCancelled else { return }
        visible = true
        if isSaving { pendingReload = true
            return
        }
        generation += 1
        let revision = generation
        state = .loading
        canSave = false
        assignableMembers = []
        assigneeReadState = .loading
        do {
            if let taskId {
                try await loadEditableTask(taskId, revision: revision)
            } else {
                try creation.restore()
                let collection = try await access.list()
                guard revision == generation else { return }
                guard collection.collectionCapabilities?.canCreate == true else { throw HomeTaskAccess.AccessError.denied }
                if let draft = creation.pending { hydratePending(draft) }
            }
            try access.requireCurrent()
            guard revision == generation else { return }
            canSave = true
            state = .editing
            await loadMembers(revision: revision)
        } catch {
            guard revision == generation else { return }
            canSave = false
            state = .error(error.localizedDescription)
            if !isCurrent { clearPrivateDraft() }
        }
    }

    private func loadEditableTask(_ taskId: String, revision: Int) async throws {
        let current = try await access.detail(taskId: taskId)
        guard current.capabilities?.canEdit == true else { throw HomeTaskAccess.AccessError.denied }
        guard revision == generation else { throw CancellationError() }
        let edits = fields.filter(\.value.isDirty)
        hydrate(from: current)
        for (field, saved) in edits {
            guard var current = fields[field] else { continue }
            current.value = saved.value
            current.error = validator(for: field).validate(saved.value)
            fields[field] = current
        }
    }

    func resume(ifCurrent revision: Int) async {
        guard revision == generation else { return }
        await load()
    }

    public func refresh() async {
        await load()
    }

    func suspend() {
        visible = false
        generation += 1
        access.invalidatePending()
        canSave = false
        assignableMembers = []
        assigneeReadState = .loading
        shouldDismiss = false
        toast = nil
        state = .loading
    }

    func accessChanged() {
        guard !isCurrent else { return }
        suspend()
        access.retire()
        clearPrivateDraft()
        state = .error(HomeTaskAccess.AccessError.changed.localizedDescription)
    }

    private func clearPrivateDraft() {
        creation.hide()
        pendingEdit = nil
        fields = [:]
        createdTaskId = nil
    }

    /// Update a single field's raw value and re-run its validator.
    public func update(_ field: AddHouseholdTaskField, to value: String) {
        guard visible, isCurrent, !isSaving, !hasPendingSave else { return }
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
        guard visible, isCurrent, !isSaving, !hasPendingSave else { return }
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

    /// Single-select assignee. Pass `nil` for an unassigned task.
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
        canSave && isCurrent && (hasPendingSave || aggregate.isValid)
    }

    /// Add mode treats every field as "new" so the Save button is
    /// active the moment a valid title lands. Edit mode keeps the
    /// dirty gate so an untouched task can't accidentally re-save.
    public var isDirty: Bool {
        hasPendingSave || (isEditing ? aggregate.isDirty : true)
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

    /// A retry keeps the original UUID/body or sparse edit patch. Completion
    /// is published only within this current screen and authenticated session.
    @discardableResult
    public func save() async -> Bool {
        guard visible, !isSaving, !shouldDismiss, canSave, isCurrent else { return false }
        if !hasPendingSave, validateAll() != nil {
            shakeTrigger &+= 1
            toast = ToastMessage(text: "Fix the highlighted field.", kind: .error)
            return false
        }
        isSaving = true
        generation += 1
        let revision = generation
        defer { finishSave() }
        do {
            if let taskId {
                let patch = pendingEdit ?? buildEditPatch()
                guard !patch.values.isEmpty else { return false }
                pendingEdit = patch
                let current = try await access.edit(taskId: taskId, patch: patch)
                guard visible, revision == generation, isCurrent else { return false }
                pendingEdit = nil
                hydrate(from: current)
                toast = ToastMessage(text: "Task updated.", kind: .success)
            } else {
                let current = try await creation.save(buildCreateRequest())
                guard visible, revision == generation, isCurrent else { return false }
                createdTaskId = current.id
                toast = ToastMessage(text: "Task saved.", kind: .success)
            }
            shouldDismiss = true
            return true
        } catch {
            guard revision == generation else { return false }
            canSave = false
            assignableMembers = []
            state = .error(error.localizedDescription)
            toast = ToastMessage(text: error.localizedDescription, kind: .error)
            if !isCurrent { accessChanged() }
            return false
        }
    }

    private func finishSave() {
        isSaving = false
        if pendingReload, visible {
            pendingReload = false
            let revision = generation
            Task { [weak self] in
                guard let self, visible else { return }
                await resume(ifCurrent: revision)
            }
        }
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Members

    private func loadMembers(revision: Int) async {
        do {
            try access.requireCurrent()
            let response: OccupantsResponse = try await api.request(Endpoint(
                method: .get,
                path: "/api/homes/\(homeId)/occupants",
                headers: access.currentHeaders,
                cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
            ))
            try access.requireCurrent()
            guard revision == generation else { return }
            assignableMembers = response.occupants.compactMap(HouseholdTaskAssignableMember.from)
            assigneeReadState = .loaded
        } catch {
            guard revision == generation else { return }
            assignableMembers = []
            assigneeReadState = .unavailable
            if !isCurrent { accessChanged() }
        }
    }
}
