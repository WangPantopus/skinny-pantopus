//
//  InviteTeammateWizardViewModel.swift
//  Pantopus
//
//  Three-step wizard for inviting a teammate to a business. Cloned from
//  `InviteMemberWizardViewModel` (the per-home invite flow):
//
//    1. Role     — pick an assignable role (admin / editor / staff / viewer).
//    2. Identify — display name + email (+ optional note).
//    3. Review   — summary + submit.
//
//  On submit, POSTs `/api/businesses/:id/seats/invite` with a
//  `BusinessSeatInviteRequest`. The returned seat is emitted via
//  `pendingEvent` so the host view can dismiss + feed the list VM.
//

import Foundation
import Observation

/// Discrete steps in the wizard.
public enum InviteTeammateStep: Int, CaseIterable, Sendable, Equatable {
    case role
    case identify
    case review

    public var title: String {
        switch self {
        case .role: "Pick a role"
        case .identify: "Who are you inviting?"
        case .review: "Send invite"
        }
    }

    public var subcopy: String {
        switch self {
        case .role: "Roles set what a teammate can see and do. You can change it later."
        case .identify: "We'll create a seat and send a link they can use to join your business."
        case .review: "Confirm the details below. You can cancel the invite later from the Pending section."
        }
    }

    /// 1-of-3 readout in the top bar.
    public var stepNumber: Int {
        rawValue + 1
    }
}

/// Form snapshot. Lives on the VM and is sent over the wire on submit.
public struct InviteTeammateForm: Sendable, Equatable {
    public var role: BusinessRole
    public var displayName: String
    public var email: String
    public var note: String

    public init(
        role: BusinessRole = .viewer,
        displayName: String = "",
        email: String = "",
        note: String = ""
    ) {
        self.role = role
        self.displayName = displayName
        self.email = email
        self.note = note
    }
}

/// Outbound event the host view reacts to.
public enum InviteTeammateEvent: Sendable, Equatable {
    case submitted(BusinessSeatDTO)
    case dismiss
}

/// Drives the Invite Teammate wizard.
@Observable
@MainActor
public final class InviteTeammateWizardViewModel: WizardModel {
    private(set) var currentStep: InviteTeammateStep = .role
    var form: InviteTeammateForm
    private(set) var errorMessage: String?
    var pendingEvent: InviteTeammateEvent?

    private let businessId: String
    private let api: APIClient
    private var isSubmitting = false

    init(businessId: String, api: APIClient = .shared) {
        self.businessId = businessId
        self.api = api
        form = InviteTeammateForm()
    }

    /// True when the form has any user-entered data — guards the discard
    /// confirm.
    var isDirty: Bool {
        form != InviteTeammateForm()
    }

    // MARK: - Chrome

    public var chrome: WizardChrome {
        WizardChrome(
            title: "Invite teammate",
            progressLabel: .stepOf(
                current: currentStep.stepNumber,
                total: InviteTeammateStep.allCases.count
            ),
            progressFraction: Double(currentStep.stepNumber)
                / Double(InviteTeammateStep.allCases.count),
            leading: currentStep == .role ? .close : .back,
            primaryCTALabel: primaryLabel,
            primaryCTAEnabled: primaryEnabled,
            secondaryCTA: nil,
            isSubmitting: isSubmitting,
            dirty: isDirty,
            showsProgressBar: true
        )
    }

    private var primaryLabel: String {
        switch currentStep {
        case .role, .identify: "Next"
        case .review: "Send invite"
        }
    }

    private var primaryEnabled: Bool {
        switch currentStep {
        case .role: true
        case .identify, .review: isFormValid
        }
    }

    private var isFormValid: Bool {
        !form.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && Self.isValidEmail(form.email)
    }

    // MARK: - WizardModel

    public func leadingTapped() {
        errorMessage = nil
        if currentStep == .role {
            pendingEvent = .dismiss
            return
        }
        guard let previous = InviteTeammateStep(rawValue: currentStep.rawValue - 1) else { return }
        currentStep = previous
    }

    public func discardConfirmed() {
        pendingEvent = .dismiss
    }

    public func primaryTapped() {
        errorMessage = nil
        if currentStep != .review {
            guard let next = InviteTeammateStep(rawValue: currentStep.rawValue + 1) else { return }
            currentStep = next
            return
        }
        Task { await submit() }
    }

    // MARK: - Form mutations

    public func setRole(_ role: BusinessRole) {
        form.role = role
    }

    public func setDisplayName(_ value: String) {
        form.displayName = value
    }

    public func setEmail(_ value: String) {
        form.email = value
    }

    public func setNote(_ value: String) {
        form.note = value
    }

    // MARK: - Submit

    private func submit() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        let trimmedName = form.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail = form.email.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNote = form.note.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = BusinessSeatInviteRequest(
            displayName: trimmedName,
            roleBase: form.role.rawValue,
            inviteEmail: trimmedEmail,
            notes: trimmedNote.isEmpty ? nil : trimmedNote
        )
        do {
            let response: BusinessTeamSeatInviteResponse = try await api.request(
                BusinessTeamEndpoints.inviteSeat(businessId: businessId, request: request)
            )
            pendingEvent = .submitted(response.seat)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't send the invite. Try again."
        }
    }

    // MARK: - Validation

    /// Loose email validation — backend re-validates. Mirrors the per-home
    /// invite wizard.
    public static func isValidEmail(_ raw: String) -> Bool {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 254 else { return false }
        let parts = trimmed.split(separator: "@")
        guard parts.count == 2 else { return false }
        let local = parts[0]
        let domain = parts[1]
        guard !local.isEmpty, domain.contains(".") else { return false }
        return true
    }
}
