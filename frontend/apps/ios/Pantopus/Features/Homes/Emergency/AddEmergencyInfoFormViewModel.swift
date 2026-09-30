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
//    .create → POST `/api/homes/:id/emergencies` with one
//              `clientRequestId` per unchanged draft, so a retry after a
//              lost reply returns the saved entry instead of a duplicate.
//    .edit   → PUT `/api/homes/:id/emergencies/:emergencyId`
//              (route `backend/routes/home.js:3896`) with the stored type,
//              location and details, changing only what this form edits
//              (Android's `buildEditDetailsMap`). The detail view
//              re-renders from the saved entry returned to `onUpdated`.
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
    /// The row as stored, so an edit keeps what this form doesn't show
    /// (another client's `phone` / `notes`, a legacy type, the location).
    public let backendType: String?
    public let location: String?
    public let rawDetails: [String: String]

    public init(
        id: String,
        category: EmergencyFormCategory,
        title: String,
        severity: EmergencySeverity?,
        details: String,
        verifiedByUserId: String?,
        lastUpdated: Date,
        backendType: String? = nil,
        location: String? = nil,
        rawDetails: [String: String] = [:]
    ) {
        self.id = id
        self.category = category
        self.title = title
        self.severity = severity
        self.details = details
        self.verifiedByUserId = verifiedByUserId
        self.lastUpdated = lastUpdated
        self.backendType = backendType
        self.location = location
        self.rawDetails = rawDetails
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
            lastUpdated: Self.parseDate(dto.updatedAt) ?? Self.parseDate(dto.createdAt) ?? Date(),
            backendType: dto.type,
            location: dto.location,
            rawDetails: dto.details
        )
    }

    /// `from(dto:)`, or for a legacy type (`shutoff_water` …) the raw
    /// fields under the generic "Other" category so they still render.
    public static func display(dto: HomeEmergencyDTO) -> EmergencyFormDraft {
        from(dto: dto) ?? EmergencyFormDraft(
            id: dto.id,
            category: .other,
            title: dto.label,
            severity: EmergencySeverity.from(rawValue: dto.details["severity"]),
            details: dto.details["detail"] ?? dto.location ?? "",
            verifiedByUserId: dto.details["verified_by"],
            lastUpdated: parseDate(dto.updatedAt) ?? parseDate(dto.createdAt) ?? Date(),
            backendType: dto.type,
            location: dto.location,
            rawDetails: dto.details
        )
    }

    /// The backend sends Postgres timestamps with microseconds
    /// ("…17.222792+00:00"), which the default ISO parser rejects (the old
    /// fallback showed "now" as Last updated). Keep milliseconds, then parse.
    static func parseDate(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let trimmed = iso.replacingOccurrences(of: #"(\.\d{3})\d+"#, with: "$1", options: .regularExpression)
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: trimmed) ?? ISO8601DateFormatter().date(from: trimmed)
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

    /// One id per unchanged create draft; cleared after a confirmed save.
    @ObservationIgnored private var pendingCreate: (draft: String, id: String)?

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
            return await submitEdit(originalDraft: draft)
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

    /// Edit mode: the stored details with only the keys this form edits
    /// changed, so another client's keys survive (Android's
    /// `buildEditDetailsMap`).
    public func buildEditDetailsMap(original: EmergencyFormDraft) -> [String: String] {
        var details = original.rawDetails
        if detailsField.isDirty {
            let trimmed = detailsField.value.trimmingCharacters(in: .whitespacesAndNewlines)
            details["detail"] = trimmed.isEmpty ? nil : trimmed
        }
        if severity != originalSeverity {
            details["severity"] = severity?.rawValue
        }
        if verifiedByUserId != originalVerifiedByUserId {
            details["verified_by"] = (verifiedByUserId?.isEmpty == false) ? verifiedByUserId : nil
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
        let label = titleField.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let details = buildDetailsMap()
        let draftKey = ([category.backendType, label] + details.keys.sorted().map { "\($0)=\(details[$0] ?? "")" })
            .joined(separator: "\u{1F}")
        if pendingCreate?.draft != draftKey {
            pendingCreate = (draftKey, UUID().uuidString)
        }
        let request = CreateEmergencyRequest(
            type: category.backendType,
            label: label,
            location: nil,
            details: details,
            clientRequestId: pendingCreate?.id
        )
        do {
            let response: CreateEmergencyResponse = try await api.request(
                HomesEndpoints.createEmergency(homeId: homeId, request: request)
            )
            pendingCreate = nil
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

    private func submitEdit(originalDraft: EmergencyFormDraft) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        // Keep the stored type unless the member picked another category.
        let type = category == originalCategory
            ? (originalDraft.backendType ?? category.backendType)
            : category.backendType
        let request = CreateEmergencyRequest(
            type: type,
            label: titleField.value.trimmingCharacters(in: .whitespacesAndNewlines),
            location: originalDraft.location,
            details: buildEditDetailsMap(original: originalDraft)
        )
        do {
            let response: CreateEmergencyResponse = try await api.request(
                HomesEndpoints.updateEmergency(homeId: homeId, emergencyId: originalDraft.id, request: request)
            )
            guard response.emergency.id == originalDraft.id else {
                toast = ToastMessage(text: "Server returned invalid emergency info. Please try again.", kind: .error)
                return false
            }
            onUpdated(EmergencyFormDraft.display(dto: response.emergency))
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
