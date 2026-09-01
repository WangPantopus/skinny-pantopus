//
//  InviteMemberWizardViewModel.swift
//  Pantopus
//
//  T6.3a / P9 — Three-step wizard for inviting a new member or guest:
//
//    1. Role     — segmented Member / Guest (drives `relationship`).
//    2. Identify — email field (the canonical channel for first-time
//                  invites). Future steps may add username search +
//                  QR codes; the design's "By handle / By text / QR
//                  code" tiles map to alternate channels we'll add
//                  incrementally.
//    3. Review   — summary of the role + recipient + submit.
//
//  On submit, POSTs `/api/homes/:id/invite` with an
//  `InviteMemberRequest`. The returned `InvitationDTO` is emitted via
//  `pendingEvent` so the host view can dismiss + feed the list VM.
//

import Foundation
import Observation

/// Discrete steps in the wizard.
public enum InviteMemberStep: Int, CaseIterable, Sendable, Equatable {
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
        case .role: "Members get full access. Guests are short-term — sitters, visitors, contractors."
        case .identify: "We'll send them a link to verify their address and join the household."
        case .review: "Confirm the details below. You can resend or cancel later from the Pending tab."
        }
    }

    /// 1-of-3 readout in the top bar.
    public var stepNumber: Int {
        rawValue + 1
    }
}

/// Form snapshot. Lives on the VM and is sent over the wire on submit.
public struct InviteMemberForm: Sendable, Equatable {
    public var role: MemberRole
    public var email: String
    public var message: String

    public init(
        role: MemberRole = .member,
        email: String = "",
        message: String = ""
    ) {
        self.role = role
        self.email = email
        self.message = message
    }
}

/// Outbound event the host view reacts to.
public enum InviteMemberEvent: Sendable, Equatable {
    case submitted(InvitationDTO)
    case dismiss
}

/// Drives the Invite Member wizard.
@Observable
@MainActor
public final class InviteMemberWizardViewModel: WizardModel {
    private(set) var currentStep: InviteMemberStep = .role
    var form: InviteMemberForm
    private(set) var errorMessage: String?
    var pendingEvent: InviteMemberEvent?

    private let homeId: String
    private let api: APIClient
    private var isSubmitting = false

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
        form = InviteMemberForm()
    }

    /// True when the form has any user-entered data — guards the
    /// discard-confirm.
    var isDirty: Bool {
        form != InviteMemberForm()
    }

    // MARK: - Chrome

    public var chrome: WizardChrome {
        WizardChrome(
            title: "Invite member",
            progressLabel: .stepOf(
                current: currentStep.stepNumber,
                total: InviteMemberStep.allCases.count
            ),
            progressFraction: Double(currentStep.stepNumber)
                / Double(InviteMemberStep.allCases.count),
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
        case .identify: Self.isValidEmail(form.email)
        case .review: Self.isValidEmail(form.email)
        }
    }

    // MARK: - WizardModel

    public func leadingTapped() {
        errorMessage = nil
        if currentStep == .role {
            pendingEvent = .dismiss
            return
        }
        guard let previous = InviteMemberStep(rawValue: currentStep.rawValue - 1) else { return }
        currentStep = previous
        Analytics.track(.screenMembersWizardStepViewed(
            stepNumber: currentStep.stepNumber,
            stepName: String(describing: currentStep)
        ))
    }

    public func discardConfirmed() {
        pendingEvent = .dismiss
    }

    public func primaryTapped() {
        errorMessage = nil
        if currentStep != .review {
            guard let next = InviteMemberStep(rawValue: currentStep.rawValue + 1) else { return }
            currentStep = next
            Analytics.track(.screenMembersWizardStepViewed(
                stepNumber: currentStep.stepNumber,
                stepName: String(describing: currentStep)
            ))
            return
        }
        Task { await submit() }
    }

    // MARK: - Form mutations

    public func setRole(_ role: MemberRole) {
        form.role = role
    }

    public func setEmail(_ value: String) {
        form.email = value
    }

    public func setMessage(_ value: String) {
        form.message = value
    }

    // MARK: - Submit

    private func submit() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        let trimmedEmail = form.email.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedMessage = form.message.trimmingCharacters(in: .whitespacesAndNewlines)
        // The backend's `relationship` field maps to the wire role.
        // Guests are routed via the literal "guest"; everything else
        // sends the role's raw value (owner / admin / member / …).
        let relationship = switch form.role {
        case .guest: "guest"
        case .owner: "owner"
        case .admin: "admin"
        case .manager: "manager"
        case .restricted: "restricted_member"
        case .tenant: "lease_resident"
        case .member: "member"
        }
        let request = InviteMemberRequest(
            email: trimmedEmail,
            userId: nil,
            relationship: relationship,
            message: trimmedMessage.isEmpty ? nil : trimmedMessage
        )
        do {
            let response: InviteMemberResponse = try await api.request(
                HomesEndpoints.inviteMember(homeId: homeId, request: request)
            )
            pendingEvent = .submitted(response.invitation)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't send the invite. Try again."
        }
    }

    // MARK: - Validation

    /// Loose email validation — backend re-validates. Just enough to
    /// gate the Next CTA on the Identify step.
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
