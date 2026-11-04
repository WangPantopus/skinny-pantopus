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
//
//  Sharing scopes follow current Home permissions. The occupant list does not
//  describe effective per-person access, so it is not an authorization preview.
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
public enum AccessVisibility: String, CaseIterable, Sendable, Hashable {
    case members
    case managers
    case sensitive
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
        case .members: "Household members"
        case .managers: "Owners & managers"
        case .sensitive: "Sensitive access"
        }
    }

    public var subcopy: String {
        switch self {
        case .everyone:
            "People with Home access and permission to view this type of code."
        case .members:
            "Household members with permission to view this type of code."
        case .managers:
            "Owners, admins, and managers with permission to view this type of code."
        case .sensitive:
            "People with sensitive-access permission and permission to view this type of code."
        }
    }
}

/// Render state for the form.
public enum EditAccessCodeFormState: Sendable, Equatable {
    case editing
    case error(String)
}

/// Add/edit state, with fresh Home authority and separate confirmation of the current secret.
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
    var toast: ToastMessage?
    private(set) var shakeTrigger: Int = 0
    private(set) var shouldDismiss: Bool = false
    private(set) var isLoading = false
    private(set) var isConfirmingAccess = true
    private(set) var hasCurrentAccess = false
    private(set) var canManage = false
    private(set) var availableVisibilities: Set<AccessVisibility> = []
    private(set) var accessError: String?

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
    private let authority: HomeDashboardAccess
    private let clipboard: @MainActor (String) -> Void
    private var toastTask: Task<Void, Never>?
    private var readGeneration = 0
    private var accessGeneration = 0

    init(
        homeId: String,
        secretId: String? = nil,
        initialCategory: AccessCategory? = nil,
        api: APIClient = .shared,
        clipboard: @escaping @MainActor (String) -> Void = { value in
            SensitivePasteboard.copy(value)
        }
    ) {
        self.homeId = homeId
        self.secretId = secretId
        category = initialCategory ?? .wifi
        self.api = api
        authority = HomeDashboardAccess(homeId: homeId, api: api)
        self.clipboard = clipboard
        seedDefaultFields()
    }

    /// Confirm the existing secret against current server visibility without waiting for a roster.
    func load() async {
        readGeneration &+= 1
        let generation = readGeneration
        isLoading = true
        defer { if generation == readGeneration { isLoading = false } }
        if let secretId {
            await loadSecret(secretId: secretId, generation: generation)
        } else {
            state = .editing
        }
    }

    func suspend() {
        readGeneration &+= 1
        accessGeneration &+= 1
        hasCurrentAccess = false
        canManage = false
        availableVisibilities = []
        isLoading = true
        isConfirmingAccess = true
        isRevealed = false
        toastTask?.cancel()
        toast = nil
    }

    /// Fresh authority for the live screen and for each attempted write. The access-code read
    /// separately confirms that this specific record remains visible to the current account.
    @discardableResult
    func confirmAccess() async -> Bool {
        accessGeneration &+= 1
        let generation = accessGeneration
        hasCurrentAccess = false
        canManage = false
        availableVisibilities = []
        isConfirmingAccess = true
        accessError = nil
        defer { if generation == accessGeneration { isConfirmingAccess = false } }
        do {
            let current = try await authority.read()
            guard generation == accessGeneration, !Task.isCancelled else { return false }
            let permissions = current.access?.permissions ?? []
            canManage = permissions.contains("access.manage")
            if canManage {
                availableVisibilities = [.everyone, .members]
                if ["owner", "admin", "manager"].contains(current.access?.roleBase ?? "") {
                    availableVisibilities.insert(.managers)
                }
                if permissions.contains("sensitive.view") { availableVisibilities.insert(.sensitive) }
            }
            hasCurrentAccess = canManage || (isEditing && permissions.contains {
                $0 == "access.view_wifi" || $0 == "access.view_codes"
            })
            if !hasCurrentAccess { accessError = "You don't have permission to open this access code." }
            return canManage
        } catch {
            guard generation == accessGeneration, !Task.isCancelled else { return false }
            accessError = "Couldn't confirm your access. Try again."
            return false
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

    // MARK: - Delete

    /// Removes this code for everyone it was shared with, guest pass pages included.
    @discardableResult
    func delete() async -> Bool {
        guard let secretId else { return false }
        if !NetworkMonitor.shared.isOnline {
            toast = ToastMessage(text: "You're offline. Try again when you're back online.", kind: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.deleteAccessSecret(homeId: homeId, secretId: secretId)
            )
            toast = ToastMessage(text: "Code deleted.", kind: .success)
            try? await Task.sleep(nanoseconds: 800_000_000)
            shouldDismiss = true
            return true
        } catch {
            toast = ToastMessage(text: (error as? APIError)?.errorDescription ?? "Couldn't delete code.", kind: .error)
            return false
        }
    }

    func acknowledgeDismiss() {
        shouldDismiss = false
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

    private func loadSecret(secretId: String, generation: Int) async {
        // Backend has no GET-one endpoint — pull the list and find the
        // matching row under the server's current access and visibility checks.
        let endpoint = HomesEndpoints.accessSecrets(homeId: homeId)
        do {
            let response: HomeAccessSecretsResponse = try await api.request(endpoint)
            guard generation == readGeneration, !Task.isCancelled else { return }
            if let secret = response.secrets.first(where: { $0.id == secretId }) {
                if !isDirty { hydrate(from: secret) }
                state = .editing
            } else {
                state = .error("Couldn't find that access code.")
            }
        } catch {
            guard generation == readGeneration, !Task.isCancelled else { return }
            state = .error("Couldn't load access code. Try again.")
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
