//
//  ResourceEditorViewModel.swift
//  Pantopus
//
//  Stream I12 — F10 Resource Editor (create / edit / delete). Mirrors the
//  grouped FormShell. Type selection seeds smart rule defaults; edit mode
//  loads the existing resource. Home-only (`owner: .home`).
//

import Observation
import SwiftUI

@Observable
@MainActor
final class ResourceEditorViewModel {
    enum LoadState: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    // MARK: Editable fields

    var name: String = ""
    var kind: ResourceKind = .other
    var whoCanBook: WhoCanBook = .members
    /// Booking-rule fields. Duration is edited in whole hours, stored as minutes.
    var maxDurationHours: Int = 2
    var bufferMin: Int = 0
    var requiresApproval: Bool = false
    /// Available-hours window.
    var hoursDays: Set<Int> = AvailableHours.weekdayDefault.days
    var hoursStart: Date = ResourceEditorViewModel.seedTime(hhmm: AvailableHours.weekdayDefault.start)
    var hoursEnd: Date = ResourceEditorViewModel.seedTime(hhmm: AvailableHours.weekdayDefault.end)

    // MARK: UI state

    private(set) var loadState: LoadState = .loading
    private(set) var isSaving = false
    var saveError: String?
    var showDeleteConfirm = false
    private(set) var isDeleting = false
    /// Booking-rules disclosure (F10 `RulesDisclosure`). Collapsed on create so
    /// the smart-defaults helper shows; expanded on edit per the design frames.
    var isRulesExpanded = false

    // MARK: Specific-member picker (view-only structure)

    /// Household members surfaced when "Specific" is selected (F10
    /// `WhoCanBook` → `MemberSelectRow`s). The directory feed is deferred —
    /// this stays empty until a roster source is wired, so the picker renders
    /// the rows + checks only once members are present and otherwise falls
    /// back to the "coming soon" caption.
    private(set) var members: [ResourceHomeMember] = []
    /// Member ids granted access in the "Specific" picker (drives the row check).
    var selectedMemberIds: Set<String> = []

    // MARK: Dependencies

    let homeId: String
    let resourceId: String?
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    init(
        homeId: String,
        resourceId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.homeId = homeId
        self.resourceId = resourceId
        self.push = push
        self.client = client
    }

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    // MARK: Derived

    var isCreate: Bool {
        resourceId == nil
    }

    var screenTitle: String {
        isCreate ? "New resource" : "Edit resource"
    }

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && maxDurationHours > 0
    }

    var nameError: String? {
        name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Give this resource a name" : nil
    }

    var durationError: String? {
        maxDurationHours > 0 ? nil : "Set a max duration above zero"
    }

    /// Drives FormShell's Save-enabled + discard-confirm. Create is dirty once a
    /// name is entered; edit treats the loaded form as always-committable.
    var isDirty: Bool {
        isCreate ? !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty : true
    }

    /// Collapsed-rule helper. Create prefixes the type ("Charger defaults: 4 hr
    /// max · No approval"); edit drops the prefix ("4 hr max · No approval") —
    /// matching the two F10 `RulesDisclosure` `defaultHelper` strings.
    var ruleHelper: String {
        let approval = requiresApproval ? "Needs approval" : "No approval"
        let summary = "\(maxDurationHours) hr max · \(approval)"
        return isCreate ? "\(kind.label) defaults: \(summary)" : summary
    }

    // MARK: Load

    func load() async {
        guard let resourceId else {
            // Create — seed defaults for the initial type and present. Rules
            // stay collapsed so the smart-defaults helper reads (F10 create).
            applyDefaults(for: kind)
            isRulesExpanded = false
            loadState = .ready
            return
        }
        if case .ready = loadState { return }
        loadState = .loading
        do {
            let response: ResourcesResponse = try await client.request(
                SchedulingEndpoints.getResources(owner: owner)
            )
            guard let resource = response.resources.first(where: { $0.id == resourceId }) else {
                loadState = .error(message: "This resource is no longer available.")
                return
            }
            apply(resource)
            // Edit opens the rules disclosure expanded (F10 edit frame).
            isRulesExpanded = true
            loadState = .ready
        } catch let error as SchedulingError {
            loadState = .error(message: error.userMessage ?? "Couldn't load this resource.")
        } catch {
            loadState = .error(message: "Couldn't load this resource.")
        }
    }

    private func apply(_ resource: ResourceDTO) {
        name = resource.name
        kind = ResourceKind(wire: resource.resourceType)
        whoCanBook = WhoCanBook(wire: resource.whoCanBook)
        maxDurationHours = max(1, (resource.maxDurationMin ?? 120) / 60)
        bufferMin = resource.bufferMin ?? 0
        requiresApproval = resource.requiresApproval ?? false
        if let hours = AvailableHours(json: resource.availableHours) {
            hoursDays = hours.days
            hoursStart = Self.seedTime(hhmm: hours.start)
            hoursEnd = Self.seedTime(hhmm: hours.end)
        }
    }

    // MARK: Type selection → smart defaults

    func selectKind(_ newKind: ResourceKind) {
        kind = newKind
        applyDefaults(for: newKind)
    }

    private func applyDefaults(for kind: ResourceKind) {
        let defaults = kind.defaultRules
        maxDurationHours = max(1, defaults.maxDurationMin / 60)
        bufferMin = defaults.bufferMin
        requiresApproval = defaults.requiresApproval
    }

    func toggleDay(_ weekday: Int) {
        if hoursDays.contains(weekday) {
            hoursDays.remove(weekday)
        } else {
            hoursDays.insert(weekday)
        }
    }

    /// Toggle the disclosure (F10 chevron-up / chevron-down).
    func toggleRules() {
        isRulesExpanded.toggle()
    }

    /// Toggle a member's access in the "Specific" picker (view-only).
    func toggleMember(_ id: String) {
        if selectedMemberIds.contains(id) {
            selectedMemberIds.remove(id)
        } else {
            selectedMemberIds.insert(id)
        }
    }

    // MARK: Save / delete

    private var availableHours: AvailableHours {
        AvailableHours(
            days: hoursDays,
            start: Self.hhmm(from: hoursStart),
            end: Self.hhmm(from: hoursEnd)
        )
    }

    /// Returns true on success so the view can dismiss.
    func save() async -> Bool {
        guard isValid, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            if let resourceId {
                let request = UpdateResourceRequest(
                    name: trimmed,
                    resourceType: kind.rawValue,
                    whoCanBook: whoCanBook.rawValue,
                    maxDurationMin: maxDurationHours * 60,
                    bufferMin: bufferMin,
                    requiresApproval: requiresApproval,
                    availableHours: availableHours.json
                )
                _ = try await client.request(
                    SchedulingEndpoints.updateResource(owner: owner, resourceId: resourceId, request),
                    as: ResourceResponse.self
                )
            } else {
                let request = CreateResourceRequest(
                    name: trimmed,
                    resourceType: kind.rawValue,
                    whoCanBook: whoCanBook.rawValue,
                    maxDurationMin: maxDurationHours * 60,
                    bufferMin: bufferMin,
                    requiresApproval: requiresApproval,
                    availableHours: availableHours.json
                )
                _ = try await client.request(
                    SchedulingEndpoints.createResource(owner: owner, request),
                    as: ResourceResponse.self
                )
            }
            return true
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't save this resource."
            return false
        } catch {
            saveError = "Couldn't save this resource."
            return false
        }
    }

    func confirmDelete() async -> Bool {
        guard let resourceId, !isDeleting else { return false }
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await client.send(SchedulingEndpoints.deleteResource(owner: owner, resourceId: resourceId))
            return true
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't delete this resource."
            return false
        } catch {
            saveError = "Couldn't delete this resource."
            return false
        }
    }

    // MARK: hh:mm <-> Date

    static func seedTime(hhmm: String) -> Date {
        let parts = hhmm.split(separator: ":")
        let hour = parts.first.flatMap { Int($0) } ?? 9
        let minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        return cal.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
    }

    static func hhmm(from date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        let comps = cal.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", comps.hour ?? 0, comps.minute ?? 0)
    }
}
