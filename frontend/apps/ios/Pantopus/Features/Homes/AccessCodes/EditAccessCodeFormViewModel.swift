//
//  EditAccessCodeFormViewModel.swift
//  Pantopus
//
//  P3.1 — Single-screen form for adding (POST) or editing (PUT) a home
//  access secret. Drives `FormShell` on the iOS side with parity to the
//  Android `EditAccessCodeFormViewModel`.
//
//  Routes:
//    POST   `/api/homes/:id/access`            (`backend/routes/home.js:5735`)
//    PUT    `/api/homes/:id/access/:secretId`  (`backend/routes/home.js:5794`)
//    GET    `/api/homes/:id/access`            (`backend/routes/home.js:5695`)
//    GET    `/api/homes/:id/occupants`         (`backend/routes/home.js:3705`)
//
//  Shared-with — the backend's `visibility` column is the coarse
//  `home_record_visibility` enum (`public / members / managers /
//  sensitive`). The form renders household-member-aware copy ("All 4
//  members") so the picker reads as a roster scope chooser rather than
//  a 4-way generic enum.
//

import Foundation
import Observation
import UIKit

/// Stable identifiers for every editable Access Code field.
public enum EditAccessCodeField: String, CaseIterable, Sendable {
    case category
    case label
    case value
    case notes
    case sharedWith
}

/// The four scopes the backend persists on `HomeAccessSecret.visibility`.
///
/// Rendered as a "Shared with" picker on the form. Labels intentionally
/// reference the household-member roster so the picker reads as a roster
/// scope chooser rather than a generic enum (`members` becomes "All
/// household members (N)" once the roster loads).
public enum AccessVisibility: String, CaseIterable, Sendable, Hashable {
    /// `members` — every active household member can read the value.
    case members
    /// `managers` — owners + managers (the IAM role bundle that owns
    /// `members.manage`).
    case managers
    /// `sensitive` — owners only.
    case sensitive
    /// `public` — visible to anyone with viewing access to the home
    /// (members + guests-with-passes etc.).
    case everyone = "public"

    /// Default scope mirrors the backend default
    /// (`schema.sql:6004 visibility DEFAULT 'members'`).
    public static let `default`: AccessVisibility = .members

    /// Display ordering on the picker. Most-permissive on the left so
    /// the user reads the scope as a tightening selector left-to-right.
    public static let displayOrder: [AccessVisibility] = [
        .everyone, .members, .managers, .sensitive
    ]

    public var headline: String {
        switch self {
        case .everyone: "Everyone with access"
        case .members: "All household members"
        case .managers: "Owners & managers"
        case .sensitive: "Owners only (sensitive)"
        }
    }

    public var subcopy: String {
        switch self {
        case .everyone:
            "Members, guests, and anyone given a visitor pass."
        case .members:
            "Every active member of this household."
        case .managers:
            "Roles with access management — owners, admins, and managers."
        case .sensitive:
            "Visible only to verified owners."
        }
    }
}

/// Render state for the form.
public enum EditAccessCodeFormState: Sendable, Equatable {
    case editing
    case error(String)
}

/// Lightweight household-member summary projected from the
/// `/occupants` payload. We keep only the fields the picker actually
/// renders so the form stays decoupled from the Members screen DTO.
public struct AccessRosterMember: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let role: String?
    public let canManageAccess: Bool
    public let canViewSensitive: Bool

    public init(
        id: String,
        displayName: String,
        role: String?,
        canManageAccess: Bool,
        canViewSensitive: Bool
    ) {
        self.id = id
        self.displayName = displayName
        self.role = role
        self.canManageAccess = canManageAccess
        self.canViewSensitive = canViewSensitive
    }
}

/// ViewModel backing `EditAccessCodeFormView`.
///
/// Holds two pieces of state besides the field map:
/// 1. `isRevealed` — flipped by the eye toggle on the value field.
///    The clipboard copy works in either pose (you can copy a masked
///    code without revealing it).
/// 2. `roster` — the active household members, projected from
///    `/api/homes/:id/occupants`. Drives the "Shared with" picker copy
///    ("All 4 members" etc.) so the scope picker is roster-aware.
@Observable
@MainActor
final class EditAccessCodeFormViewModel {
    // MARK: - Public state

    let homeId: String
    /// Nil when adding a brand-new code; set when editing an existing
    /// row. Drives the form title + submit verb.
    let secretId: String?

    private(set) var state: EditAccessCodeFormState = .editing
    var fields: [EditAccessCodeField: FormFieldState] = [:]
    private(set) var category: AccessCategory
    private(set) var visibility: AccessVisibility = .default
    private(set) var isRevealed: Bool = false
    private(set) var isSaving: Bool = false
    private(set) var roster: [AccessRosterMember] = []
    var toast: ToastMessage?
    private(set) var shakeTrigger: Int = 0
    private(set) var shouldDismiss: Bool = false

    /// `true` when this VM is editing an existing code.
    var isEditing: Bool {
        secretId != nil
    }

    /// Form title — different for add vs edit per the P3.1 brief.
    var title: String {
        isEditing ? "Edit access code" : "Add access code"
    }

    /// Submit verb in the top-right action.
    var commitLabel: String {
        "Save"
    }

    // MARK: - Dependencies

    private let api: APIClient
    private let clipboard: @MainActor (String) -> Void
    private var toastTask: Task<Void, Never>?

    init(
        homeId: String,
        secretId: String? = nil,
        initialCategory: AccessCategory? = nil,
        api: APIClient = .shared,
        clipboard: @escaping @MainActor (String) -> Void = { value in
            UIPasteboard.general.string = value
        }
    ) {
        self.homeId = homeId
        self.secretId = secretId
        category = initialCategory ?? .wifi
        self.api = api
        self.clipboard = clipboard
        seedDefaultFields()
    }

    /// Load the existing secret (when editing) plus the household
    /// roster. Idempotent: re-running re-fetches both.
    func load() async {
        // Always pull the roster — it powers the "Shared with" copy
        // even in the create flow.
        await loadRoster()
        // Then hydrate from the existing secret, if any.
        if let secretId {
            await loadSecret(secretId: secretId)
        }
    }

    // MARK: - Field updates

    func update(_ field: EditAccessCodeField, to value: String) {
        guard var snapshot = fields[field] else { return }
        snapshot.value = value
        snapshot.touched = true
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    func selectCategory(_ next: AccessCategory) {
        guard category != next else { return }
        category = next
        var snapshot = fields[.category]
            ?? FormFieldState(id: EditAccessCodeField.category.rawValue, originalValue: next.rawValue)
        snapshot.value = next.rawValue
        snapshot.touched = true
        snapshot.error = nil
        fields[.category] = snapshot
    }

    func selectVisibility(_ next: AccessVisibility) {
        guard visibility != next else { return }
        visibility = next
        var snapshot = fields[.sharedWith]
            ?? FormFieldState(id: EditAccessCodeField.sharedWith.rawValue, originalValue: next.rawValue)
        snapshot.value = next.rawValue
        snapshot.touched = true
        snapshot.error = nil
        fields[.sharedWith] = snapshot
    }

    /// Reveal-toggle for the value field. Mirrors the per-row toggle on
    /// `AccessCodesView`.
    func toggleReveal() {
        isRevealed.toggle()
    }

    /// Copy the current value field to the system clipboard and fire
    /// the "Copied" toast. Works in either reveal pose — the user can
    /// copy a masked code without unmasking it.
    func copyValue() {
        let current = (fields[.value]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !current.isEmpty else { return }
        clipboard(current)
        showToast("Copied")
    }

    // MARK: - Aggregate

    var aggregate: FormAggregate {
        FormAggregate(fields: EditAccessCodeField.allCases.compactMap { fields[$0] })
    }

    var isDirty: Bool {
        aggregate.isDirty
    }

    /// Required fields: category, label, value. Notes + visibility are
    /// optional (visibility has a default).
    var isValid: Bool {
        guard aggregate.isValid else { return false }
        let label = (fields[.label]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let value = (fields[.value]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return !label.isEmpty && !value.isEmpty
    }

    /// Household-roster summary string used by the visibility picker
    /// ("All 4 members"). Empty until the roster loads.
    func rosterSummary(for scope: AccessVisibility) -> String {
        let count = roster.count
        switch scope {
        case .everyone:
            return count == 0 ? scope.headline : "Everyone (\(count) members + guests)"
        case .members:
            return count == 0 ? scope.headline : "All household members (\(count))"
        case .managers:
            let managers = roster.filter(\.canManageAccess)
            return managers.isEmpty
                ? scope.headline
                : "Owners & managers (\(managers.count))"
        case .sensitive:
            let owners = roster.filter { $0.role?.lowercased() == "owner" }
            return owners.isEmpty
                ? scope.headline
                : "Owners only (\(owners.count))"
        }
    }

    /// Names of members the selected visibility scope grants access to.
    /// Drives the "Shared with" preview strip — keeps the picker visibly
    /// tied to the actual roster rather than abstract scope labels.
    func sharedWithNames() -> [String] {
        switch visibility {
        case .everyone, .members:
            roster.map(\.displayName)
        case .managers:
            roster.filter(\.canManageAccess).map(\.displayName)
        case .sensitive:
            roster.filter { $0.role?.lowercased() == "owner" }.map(\.displayName)
        }
    }

    // MARK: - Submit

    /// POST or PUT depending on whether `secretId` is set.
    @discardableResult
    func submit() async -> Bool {
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
            try await sendRequest()
            toast = ToastMessage(
                text: isEditing ? "Code updated." : "Code added.",
                kind: .success
            )
            try? await Task.sleep(nanoseconds: 800_000_000)
            shouldDismiss = true
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? (isEditing ? "Couldn't save code." : "Couldn't add code."),
                kind: .error
            )
            return false
        }
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Validation table

    private func validator(for field: EditAccessCodeField) -> FormValidator {
        switch field {
        case .category:
            FormValidator { value in
                AccessCategory(rawValue: value) == nil ? "Pick a category." : nil
            }
        case .label:
            .all([.required("Label"), .maxLength(120)])
        case .value:
            .all([.required("Code"), .maxLength(512)])
        case .notes:
            .maxLength(2000)
        case .sharedWith:
            FormValidator { value in
                AccessVisibility(rawValue: value) == nil ? "Pick a visibility scope." : nil
            }
        }
    }

    @discardableResult
    func validateAll() -> EditAccessCodeField? {
        var firstInvalid: EditAccessCodeField?
        for field in EditAccessCodeField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if firstInvalid == nil, message != nil { firstInvalid = field }
        }
        return firstInvalid
    }

    // MARK: - Networking

    private func sendRequest() async throws {
        let label = (fields[.label]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let value = (fields[.value]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let notes = (fields[.notes]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let accessType = category.backendAccessType
        let visibilityWire = visibility.rawValue

        if let secretId {
            let body = UpdateAccessSecretRequest(
                accessType: accessType,
                label: label,
                secretValue: value,
                notes: notes.isEmpty ? nil : notes,
                visibility: visibilityWire
            )
            let endpoint = HomesEndpoints.updateAccessSecret(
                homeId: homeId,
                secretId: secretId,
                request: body
            )
            _ = try await api.request(endpoint) as HomeAccessSecretResponse
        } else {
            let body = CreateAccessSecretRequest(
                accessType: accessType,
                label: label,
                secretValue: value,
                notes: notes.isEmpty ? nil : notes,
                visibility: visibilityWire
            )
            let endpoint = HomesEndpoints.createAccessSecret(
                homeId: homeId,
                request: body
            )
            _ = try await api.request(endpoint) as HomeAccessSecretResponse
        }
    }

    // MARK: - Hydration

    private func loadSecret(secretId: String) async {
        // Backend has no GET-one endpoint — pull the list and find the
        // matching row. The list is already cached by the screen that
        // pushed us here so re-fetching is cheap.
        let endpoint = HomesEndpoints.accessSecrets(homeId: homeId)
        do {
            let response: HomeAccessSecretsResponse = try await api.request(endpoint)
            if let secret = response.secrets.first(where: { $0.id == secretId }) {
                hydrate(from: secret)
            } else {
                state = .error("Couldn't find that access code.")
            }
        } catch {
            state = .error("Couldn't load access code. Try again.")
        }
    }

    private func loadRoster() async {
        let endpoint = HomesEndpoints.listOccupants(homeId: homeId)
        do {
            let response: OccupantsResponse = try await api.request(endpoint)
            roster = response.occupants
                .filter(\.isActive)
                .map { occupant in
                    AccessRosterMember(
                        id: occupant.userId,
                        displayName: occupant.displayName ?? occupant.username ?? "Member",
                        role: occupant.role,
                        canManageAccess: occupant.canManageAccess ?? false,
                        canViewSensitive: occupant.canViewSensitive ?? false
                    )
                }
        } catch {
            // Non-fatal — the picker still works with the bare scope
            // labels, the roster strip just stays empty.
            roster = []
        }
    }

    private func hydrate(from secret: HomeAccessSecretDTO) {
        category = AccessCategory.from(accessType: secret.accessType)
        visibility = AccessVisibility(rawValue: secret.visibility ?? "")
            ?? .default
        seed(.category, category.rawValue)
        seed(.label, secret.label)
        seed(.value, secret.secretValue)
        seed(.notes, secret.notes ?? "")
        seed(.sharedWith, visibility.rawValue)
    }

    // MARK: - Helpers

    private func seedDefaultFields() {
        seed(.category, category.rawValue)
        seed(.label, "")
        seed(.value, "")
        seed(.notes, "")
        seed(.sharedWith, visibility.rawValue)
    }

    private func seed(_ field: EditAccessCodeField, _ value: String) {
        var snapshot = FormFieldState(id: field.rawValue, originalValue: value)
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    private func showToast(_ message: String) {
        toast = ToastMessage(text: message, kind: .success)
        toastTask?.cancel()
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            await MainActor.run { self?.toast = nil }
        }
    }
}
