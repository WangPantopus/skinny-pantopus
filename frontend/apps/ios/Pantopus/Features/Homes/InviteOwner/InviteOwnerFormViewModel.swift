//
//  InviteOwnerFormViewModel.swift
//  Pantopus
//
//  A13.2 — Invite Owner single-screen form. `submit()` sends the invite
//  via `POST /api/homes/:id/owners/invite` (route
//  `backend/routes/homeOwnership.js:1526`). The ownership-share split
//  (grantPercent / owners) is a client-side affordance the invite route
//  doesn't consume, so it still hydrates from deterministic sample data
//  to keep previews, snapshots, and local UI tests stable.
//

import Foundation
import Observation

/// Stable identifiers for every editable Invite Owner field.
public enum InviteOwnerField: String, CaseIterable, Sendable {
    case email
    case phone
    case role
}

/// Top-level render state for the Invite Owner form.
public enum InviteOwnerFormState: Sendable, Equatable {
    case loading
    case empty
    case editing
    case error(String)
}

/// ViewModel backing `InviteOwnerFormView`.
@Observable
@MainActor
public final class InviteOwnerFormViewModel {
    public private(set) var state: InviteOwnerFormState
    public private(set) var homeContext: InviteOwnerHomeContext
    public private(set) var owners: [InviteOwnerOwnerShare]
    public var fields: [InviteOwnerField: FormFieldState]
    public private(set) var grantPercent: Int
    /// RN's "Fast track (vouch)" switch, defaulted ON
    /// (`src/app/homes/[id]/owners/invite.tsx:22`). Sent as `fast_track`;
    /// the handler files the claim as `method: 'vouch'` +
    /// `state: 'pending_challenge_window'` instead of `invite` /
    /// `submitted` (`backend/routes/homeOwnership.js:1473-1481`).
    public var fastTrack = true
    public private(set) var isSaving = false
    public var toast: ToastMessage?
    public private(set) var shouldDismiss = false
    public private(set) var shakeTrigger = 0

    public let homeId: String
    public let currentUserEmail: String
    public let noteMaxLength = InviteOwnerSampleData.noteMaxLength

    private let initialDraft: InviteOwnerDraft
    private let onSent: @MainActor (InviteOwnerSentInvite) -> Void
    private let api: APIClient
    private var originalGrantPercent: Int
    private var autoBalancesSoleOwner: Bool

    init(
        homeId: String,
        currentUserEmail: String,
        initialDraft: InviteOwnerDraft? = nil,
        initialState: InviteOwnerFormState = .loading,
        api: APIClient = .shared,
        onSent: @escaping @MainActor (InviteOwnerSentInvite) -> Void = { _ in }
    ) {
        self.homeId = homeId
        self.currentUserEmail = currentUserEmail
        self.api = api
        let draft = initialDraft ?? InviteOwnerSampleData.initialDraft(homeId: homeId)
        self.initialDraft = draft
        homeContext = draft.homeContext
        owners = draft.owners
        grantPercent = draft.grantPercent
        originalGrantPercent = draft.grantPercent
        autoBalancesSoleOwner = draft.autoBalancesSoleOwner
        self.onSent = onSent
        state = initialState
        fields = Self.fields(from: draft, currentUserEmail: currentUserEmail)
        syncSoleOwnerShareIfNeeded()
        validateLoadedFields()
    }

    public var aggregate: FormAggregate {
        FormAggregate(fields: InviteOwnerField.allCases.compactMap { fields[$0] })
    }

    public var existingTotal: Int {
        owners.reduce(0) { $0 + $1.sharePercent }
    }

    public var totalAfterGrant: Int {
        existingTotal + grantPercent
    }

    public var availablePool: Int {
        max(0, 100 - existingTotal)
    }

    public var conflictOverage: Int {
        max(0, totalAfterGrant - 100)
    }

    public var hasShareConflict: Bool {
        conflictOverage > 0
    }

    public var isValid: Bool {
        guard case .editing = state else { return false }
        let email = fields[.email]?.value.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return aggregate.isValid && !email.isEmpty && grantPercent > 0 && !hasShareConflict
    }

    public var isDirty: Bool {
        aggregate.isDirty || grantPercent != originalGrantPercent
    }

    public var ownershipSummary: InviteOwnershipSummary {
        InviteOwnershipSummary(
            owners: owners,
            availablePercent: availablePool,
            grantPercent: grantPercent,
            totalAfterGrant: totalAfterGrant,
            conflictOverage: conflictOverage
        )
    }

    public var retentionHint: String {
        if let soleOwner = owners.first, owners.count == 1, soleOwner.name == "You" {
            return "Used for bill splits and decision quorum. You keep \(soleOwner.sharePercent)%."
        }
        return "Used for bill splits and decision quorum."
    }

    public var conflictMessage: String? {
        guard hasShareConflict else { return nil }
        return "Total would be \(totalAfterGrant)%. \(ownerMathSentence) Pick \(availablePool)% or less, or rebalance existing shares."
    }

    public func load() async {
        guard case .loading = state else { return }
        try? await Task.sleep(nanoseconds: 120_000_000)
        state = owners.isEmpty ? .empty : .editing
    }

    public func refresh() async {
        state = .loading
        apply(draft: initialDraft, markDirty: false)
        await load()
    }

    public func update(_ field: InviteOwnerField, to value: String) {
        guard var snapshot = fields[field] else { return }
        snapshot.value = field == .role ? String(value.prefix(noteMaxLength)) : value
        snapshot.touched = true
        snapshot.error = validator(for: field).validate(snapshot.value)
        fields[field] = snapshot
    }

    public func updateGrantPercent(_ value: Int) {
        grantPercent = min(100, max(0, value))
        syncSoleOwnerShareIfNeeded()
    }

    public func snapGrantToAvailablePool() {
        updateGrantPercent(availablePool)
        toast = ToastMessage(text: "Share snapped to \(grantPercent)%.", kind: .success)
    }

    public func rebalanceShares() {
        guard grantPercent > 0, owners.isEmpty == false else { return }
        let ownerPool = max(0, 100 - grantPercent)
        let currentTotal = max(1, existingTotal)
        var remaining = ownerPool
        owners = owners.enumerated().map { index, owner in
            let share: Int
            if index == owners.count - 1 {
                share = remaining
            } else {
                share = Int((Double(owner.sharePercent) / Double(currentTotal) * Double(ownerPool)).rounded())
                remaining -= share
            }
            return owner.withShare(max(0, share))
        }
        autoBalancesSoleOwner = false
        toast = ToastMessage(text: "Existing shares rebalanced.", kind: .success)
    }

    @discardableResult
    public func validateAll() -> InviteOwnerField? {
        var firstInvalid: InviteOwnerField?
        for field in InviteOwnerField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if firstInvalid == nil, message != nil { firstInvalid = field }
        }
        if firstInvalid == nil, grantPercent <= 0 {
            firstInvalid = .email
        }
        return firstInvalid
    }

    @discardableResult
    public func submit() async -> Bool {
        if validateAll() != nil || hasShareConflict || grantPercent <= 0 {
            shakeTrigger &+= 1
            toast = ToastMessage(
                text: hasShareConflict ? "Resolve the ownership split first." : "Fix the highlighted field.",
                kind: .error
            )
            return false
        }

        let email = fields[.email]?.value.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let phoneRaw = fields[.phone]?.value.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let phone = phoneRaw.isEmpty ? nil : phoneRaw

        isSaving = true
        do {
            // The backend invite endpoint identifies the co-owner by
            // email/phone; the share-split math (grantPercent / owners)
            // is a client-side affordance the invite route doesn't
            // consume, so it stays local.
            _ = try await api.request(
                HomesEndpoints.inviteOwner(
                    homeId: homeId,
                    request: InviteOwnerRequest(email: email, phone: phone, fastTrack: fastTrack)
                ),
                as: InviteOwnerResponse.self
            )
        } catch {
            isSaving = false
            shakeTrigger &+= 1
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? "Couldn't send the invite. Try again.",
                kind: .error
            )
            return false
        }
        isSaving = false

        let sent = InviteOwnerSentInvite(
            email: email,
            phone: phone,
            grantPercent: grantPercent,
            owners: owners
        )
        toast = ToastMessage(text: "Invite sent.", kind: .success)
        onSent(sent)
        try? await Task.sleep(nanoseconds: 650_000_000)
        shouldDismiss = true
        return true
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Private

    private static func fields(
        from draft: InviteOwnerDraft,
        currentUserEmail: String
    ) -> [InviteOwnerField: FormFieldState] {
        var email = FormFieldState(id: InviteOwnerField.email.rawValue, originalValue: "")
        email.value = draft.email
        email.touched = draft.email.isEmpty == false
        email.error = FormValidator.all([.email(), .emailNotMatching(currentUserEmail)]).validate(draft.email)

        var phone = FormFieldState(id: InviteOwnerField.phone.rawValue, originalValue: "")
        phone.value = draft.phone
        phone.touched = draft.phone.isEmpty == false
        phone.error = Self.phoneValidator.validate(draft.phone)

        var role = FormFieldState(id: InviteOwnerField.role.rawValue, originalValue: "")
        role.value = draft.role
        role.touched = draft.role.isEmpty == false
        role.error = FormValidator.maxLength(InviteOwnerSampleData.noteMaxLength).validate(draft.role)

        return [.email: email, .phone: phone, .role: role]
    }

    private func apply(draft: InviteOwnerDraft, markDirty: Bool) {
        fastTrack = true
        homeContext = draft.homeContext
        owners = draft.owners
        grantPercent = draft.grantPercent
        originalGrantPercent = markDirty ? 0 : draft.grantPercent
        autoBalancesSoleOwner = draft.autoBalancesSoleOwner
        fields = Self.fields(from: draft, currentUserEmail: currentUserEmail)
        if markDirty {
            var updatedFields = fields
            for field in InviteOwnerField.allCases {
                guard var snapshot = updatedFields[field] else { continue }
                snapshot.originalValue = ""
                updatedFields[field] = snapshot
            }
            fields = updatedFields
        }
        syncSoleOwnerShareIfNeeded()
        validateLoadedFields()
    }

    private func syncSoleOwnerShareIfNeeded() {
        guard autoBalancesSoleOwner, owners.count == 1 else { return }
        owners[0] = owners[0].withShare(max(0, 100 - grantPercent))
    }

    private func validateLoadedFields() {
        var updatedFields = fields
        for field in InviteOwnerField.allCases {
            guard var snapshot = updatedFields[field], snapshot.touched else { continue }
            snapshot.error = validator(for: field).validate(snapshot.value)
            updatedFields[field] = snapshot
        }
        fields = updatedFields
    }

    private func validator(for field: InviteOwnerField) -> FormValidator {
        switch field {
        case .email:
            .all([.email(), .emailNotMatching(currentUserEmail)])
        case .phone:
            Self.phoneValidator
        case .role:
            .maxLength(noteMaxLength)
        }
    }

    private static let phoneValidator = FormValidator { value in
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let e164 = #"^\+[1-9]\d{1,14}$"#
        if trimmed.range(of: e164, options: .regularExpression) != nil { return nil }

        let allowed = CharacterSet(charactersIn: "0123456789 +()-.")
        guard trimmed.unicodeScalars.allSatisfy({ allowed.contains($0) }) else {
            return "Enter a valid phone number."
        }
        let digits = trimmed.filter(\.isNumber)
        return (digits.count == 10 || (digits.count == 11 && digits.first == "1"))
            ? nil
            : "Enter a valid phone number."
    }

    private var ownerMathSentence: String {
        let clauses = owners.map { "\($0.name) holds \($0.sharePercent)%" }
        guard clauses.isEmpty == false else { return "Existing owners already use \(existingTotal)%." }
        if clauses.count == 1 { return "\(clauses[0])." }
        return "\(clauses.dropLast().joined(separator: ", ")) and \(clauses.last ?? "")."
    }
}
