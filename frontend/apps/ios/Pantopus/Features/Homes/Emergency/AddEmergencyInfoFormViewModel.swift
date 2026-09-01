//
//  AddEmergencyInfoFormViewModel.swift
//  Pantopus
//
//  P2.8 — Backs the Add / Edit Emergency Info form. Wraps the title +
//  details fields with `FormFieldState` so dirty / valid tracking
//  matches the rest of the Form archetype. Category and severity are
//  held directly because they're enum-typed and don't carry the
//  per-field "touched" lifecycle.
//
//  Submit paths:
//    .create → POST `/api/homes/:id/emergencies`
//              (route `backend/routes/home.js:5650`).
//    .edit   → optimistic local commit. Backend has no PUT handler for
//              emergencies today; the detail view re-renders from the
//              draft returned to `onUpdated`. A future patch will swap
//              this for a real PUT call once the backend route lands.
//
//  Verified-by is optional. The view-model lazily fetches the home's
//  occupants via `GET /api/homes/:id/occupants` so the member picker
//  has names to surface; failures are swallowed silently because the
//  field is optional.
//

import Foundation
import Observation
import SwiftUI

/// Snapshot of an emergency item used to seed the form in `.edit` mode
/// and surfaced back on commit so the detail view can re-render.
public struct EmergencyFormDraft: Sendable, Equatable, Identifiable {
    public let id: String
    public let category: EmergencyFormCategory
    public let title: String
    public let severity: EmergencySeverity?
    public let details: String
    public let verifiedByUserId: String?
    public let lastUpdated: Date

    public init(
        id: String,
        category: EmergencyFormCategory,
        title: String,
        severity: EmergencySeverity?,
        details: String,
        verifiedByUserId: String?,
        lastUpdated: Date
    ) {
        self.id = id
        self.category = category
        self.title = title
        self.severity = severity
        self.details = details
        self.verifiedByUserId = verifiedByUserId
        self.lastUpdated = lastUpdated
    }

    /// Build a draft from a backend DTO. Returns nil when the DTO's
    /// type doesn't map to one of the seven form categories (the legacy
    /// list-of-rows types like `shutoff_water` aren't editable here).
    public static func from(dto: HomeEmergencyDTO) -> EmergencyFormDraft? {
        guard let category = EmergencyFormCategory.from(type: dto.type) else {
            return nil
        }
        return EmergencyFormDraft(
            id: dto.id,
            category: category,
            title: dto.label,
            severity: EmergencySeverity.from(rawValue: dto.details["severity"]),
            details: dto.details["detail"] ?? "",
            verifiedByUserId: dto.details["verified_by"],
            lastUpdated: Self.parseDate(dto.updatedAt) ?? Self.parseDate(dto.createdAt) ?? Date()
        )
    }

    private static func parseDate(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        return ISO8601DateFormatter().date(from: iso)
    }
}

@Observable
@MainActor
public final class AddEmergencyInfoFormViewModel {
    public enum Mode: Sendable, Equatable {
        case create
        case edit(EmergencyFormDraft)
    }

    // MARK: - Bound state

    public var category: EmergencyFormCategory {
        didSet {
            if !category.supportsSeverity {
                severity = nil
            }
            rebuildAggregate()
        }
    }

    public var severity: EmergencySeverity? {
        didSet { rebuildAggregate() }
    }

    public var verifiedByUserId: String? {
        didSet { rebuildAggregate() }
    }

    public private(set) var titleField: FormFieldState
    public private(set) var detailsField: FormFieldState

    public private(set) var isDirty: Bool = false
    public private(set) var isValid: Bool = false
    public private(set) var isSaving: Bool = false
    public var toast: ToastMessage?
    public private(set) var shouldDismiss: Bool = false
    public private(set) var members: [OccupantDTO] = []

    public let mode: Mode

    // MARK: - Inputs

    private let homeId: String
    private let api: APIClient
    private let onCreated: (HomeEmergencyDTO) -> Void
    private let onUpdated: (EmergencyFormDraft) -> Void

    // Captured baseline for dirty diffing in edit mode.
    private let originalCategory: EmergencyFormCategory
    private let originalSeverity: EmergencySeverity?
    private let originalVerifiedByUserId: String?

    init(
        homeId: String,
        mode: Mode = .create,
        api: APIClient = .shared,
        onCreated: @escaping (HomeEmergencyDTO) -> Void = { _ in },
        onUpdated: @escaping (EmergencyFormDraft) -> Void = { _ in }
    ) {
        self.homeId = homeId
        self.mode = mode
        self.api = api
        self.onCreated = onCreated
        self.onUpdated = onUpdated

        switch mode {
        case .create:
            category = .other
            severity = nil
            verifiedByUserId = nil
            titleField = FormFieldState(id: "title", originalValue: "")
            detailsField = FormFieldState(id: "details", originalValue: "")
            originalCategory = .other
            originalSeverity = nil
            originalVerifiedByUserId = nil
        case let .edit(draft):
            category = draft.category
            severity = draft.severity
            verifiedByUserId = draft.verifiedByUserId
            titleField = FormFieldState(id: "title", originalValue: draft.title)
            detailsField = FormFieldState(id: "details", originalValue: draft.details)
            originalCategory = draft.category
            originalSeverity = draft.severity
            originalVerifiedByUserId = draft.verifiedByUserId
        }
        rebuildAggregate()
    }

    convenience init(
        homeId: String,
        onCreated: @escaping (HomeEmergencyDTO) -> Void
    ) {
        self.init(
            homeId: homeId,
            mode: .create,
            api: .shared,
            onCreated: onCreated
        )
    }

    // MARK: - Labels

    public var screenTitle: String {
        switch mode {
        case .create: "Add emergency info"
        case .edit: "Edit emergency info"
        }
    }

    /// Display name for the currently selected verified-by member, if
    /// resolvable. Returns nil when the picker has no selection or the
    /// occupants list hasn't loaded yet.
    public var verifiedByLabel: String? {
        guard let verifiedByUserId else { return nil }
        return members
            .first { $0.userId == verifiedByUserId }
            .flatMap { $0.displayName ?? $0.username }
    }

    // MARK: - Field updates

    public func updateTitle(_ value: String) {
        titleField.value = value
        titleField.touched = true
        titleField.error = Self.validateTitle(value)
        rebuildAggregate()
    }

    public func updateDetails(_ value: String) {
        detailsField.value = value
        detailsField.touched = true
        detailsField.error = Self.validateDetails(value)
        rebuildAggregate()
    }

    // MARK: - Members

    public func loadMembers() async {
        guard members.isEmpty else { return }
        do {
            let response: OccupantsResponse = try await api.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            members = response.occupants.filter(\.isActive)
        } catch {
            members = []
        }
    }

    // MARK: - Submit

    @discardableResult
    public func submit() async -> Bool {
        if validateAll() != nil {
            toast = ToastMessage(text: "Fix the highlighted fields.", kind: .error)
            return false
        }
        guard isDirty, isValid else { return false }

        switch mode {
        case .create:
            return await submitCreate()
        case let .edit(draft):
            return submitEdit(originalDraft: draft)
        }
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Detail map

    /// Compose the backend `details` map. Public so tests can lock the
    /// serialization contract without standing up the network layer.
    public func buildDetailsMap() -> [String: String] {
        var details: [String: String] = [:]
        let trimmedDetail = detailsField.value.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedDetail.isEmpty {
            details["detail"] = trimmedDetail
        }
        if let severity {
            details["severity"] = severity.rawValue
        }
        if let verifiedByUserId, !verifiedByUserId.isEmpty {
            details["verified_by"] = verifiedByUserId
        }
        return details
    }

    // MARK: - Validation

    static func validateTitle(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Title is required." }
        if trimmed.count > 255 { return "Title is too long." }
        return nil
    }

    static func validateDetails(_ value: String) -> String? {
        if value.count > 2000 { return "Details are too long." }
        return nil
    }

    // MARK: - Private

    private func submitCreate() async -> Bool {
        isSaving = true
        defer { isSaving = false }
        let request = CreateEmergencyRequest(
            type: category.backendType,
            label: titleField.value.trimmingCharacters(in: .whitespacesAndNewlines),
            location: nil,
            details: buildDetailsMap()
        )
        do {
            let response: CreateEmergencyResponse = try await api.request(
                HomesEndpoints.createEmergency(homeId: homeId, request: request)
            )
            onCreated(response.emergency)
            toast = ToastMessage(text: "Saved.", kind: .success)
            shouldDismiss = true
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't save.",
                kind: .error
            )
            return false
        }
    }

    private func submitEdit(originalDraft: EmergencyFormDraft) -> Bool {
        // Backend has no PUT handler today — commit locally so the
        // detail surface re-renders with the new draft. The patched
        // draft is surfaced back through `onUpdated` so the parent
        // navigator can re-bind state.
        let draft = EmergencyFormDraft(
            id: originalDraft.id,
            category: category,
            title: titleField.value.trimmingCharacters(in: .whitespacesAndNewlines),
            severity: severity,
            details: detailsField.value,
            verifiedByUserId: verifiedByUserId,
            lastUpdated: Date()
        )
        onUpdated(draft)
        toast = ToastMessage(text: "Saved.", kind: .success)
        shouldDismiss = true
        return true
    }

    private func rebuildAggregate() {
        let title = titleField.value.trimmingCharacters(in: .whitespacesAndNewlines)
        isValid = !title.isEmpty && titleField.error == nil && detailsField.error == nil
        switch mode {
        case .create:
            isDirty = !title.isEmpty
                || !detailsField.value.isEmpty
                || severity != nil
                || verifiedByUserId != nil
                || category != originalCategory
        case .edit:
            isDirty = titleField.isDirty
                || detailsField.isDirty
                || category != originalCategory
                || severity != originalSeverity
                || verifiedByUserId != originalVerifiedByUserId
        }
    }

    @discardableResult
    private func validateAll() -> String? {
        titleField.error = Self.validateTitle(titleField.value)
        titleField.touched = true
        detailsField.error = Self.validateDetails(detailsField.value)
        detailsField.touched = true
        rebuildAggregate()
        return titleField.error ?? detailsField.error
    }
}
