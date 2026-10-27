//
//  WaitingRoomApproval.swift
//  Pantopus
//
//  Why a claim in review isn't approved yet and what the claimant does about
//  it. Approval needs a confirmed identity (a Stripe Identity check) and a
//  document a Pantopus reviewer checked; the server reports both
//  (`approval` on `GET /api/homes/my-ownership-claims`, the same tests
//  approval uses). Copy matches the web `ClaimApprovalChecklist` and Android
//  `WaitingRoomApproval`.
//

import SwiftUI

/// Where one step stands.
public enum WaitingRoomApprovalTone: String, Sendable, Hashable {
    case done
    case todo
    case waiting
    case retry
}

/// One step of the approval checklist, with the claimant's next action if any.
public struct WaitingRoomApprovalStep: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let tone: WaitingRoomApprovalTone
    public let title: String
    public let detail: String
    public let actionLabel: String?
    /// `confirm_identity` or `upload_document`.
    public let actionKey: String?

    public init(
        id: String,
        icon: PantopusIcon,
        tone: WaitingRoomApprovalTone,
        title: String,
        detail: String,
        actionLabel: String? = nil,
        actionKey: String? = nil
    ) {
        self.id = id
        self.icon = icon
        self.tone = tone
        self.title = title
        self.detail = detail
        self.actionLabel = actionLabel
        self.actionKey = actionKey
    }
}

public enum WaitingRoomApproval {
    static let confirmIdentityKey = "confirm_identity"
    static let uploadDocumentKey = "upload_document"

    /// Both steps for a claim in review, or none when the server didn't say.
    static func steps(_ approval: ClaimApprovalProgressDTO?, residency: Bool) -> [WaitingRoomApprovalStep] {
        guard let approval else { return [] }
        return [identityStep(approval), proofStep(approval, residency: residency)]
    }

    static func identityStep(_ approval: ClaimApprovalProgressDTO) -> WaitingRoomApprovalStep {
        if approval.identity == "verified" {
            return identity(.done, "Identity confirmed", "Stripe checked your ID and selfie.")
        }
        if approval.identity == "processing" {
            return identity(.waiting, "Checking your ID", "Stripe is checking your ID and selfie. This usually takes a few minutes.")
        }
        guard approval.identityCheckAvailable else {
            return identity(
                .todo,
                "Identity confirmation",
                "A Pantopus reviewer confirms who you are before approving your claim."
            )
        }
        switch approval.identity {
        case "requires_input":
            return identity(
                .retry,
                "Your ID check didn\u{2019}t go through",
                "Try again with a clear photo of your ID and your face in good light.",
                action: "Try again"
            )
        case "started":
            return identity(
                .todo,
                "Finish confirming your identity",
                "Pick up where you left off: a photo of your ID and a selfie.",
                action: "Continue"
            )
        default:
            return identity(
                .todo,
                "Confirm your identity",
                "Take a photo of your driver\u{2019}s license, passport or ID card and a selfie. " +
                    "Stripe, our identity partner, checks them.",
                action: "Confirm identity"
            )
        }
    }

    static func proofStep(_ approval: ClaimApprovalProgressDTO, residency: Bool) -> WaitingRoomApprovalStep {
        switch approval.proof {
        case "verified":
            proof(.done, "Document checked", "A Pantopus reviewer checked your document.")
        case "pending":
            proof(.waiting, "Document waiting for review", "A Pantopus reviewer will check it.")
        default:
            proof(
                .todo,
                residency ? "Upload proof you live here" : "Upload proof you own this home",
                residency
                    ? "A lease or utility bill with your name and this address."
                    : "A deed, closing disclosure or property tax bill with your name and this address.",
                action: "Upload document"
            )
        }
    }

    private static func identity(
        _ tone: WaitingRoomApprovalTone,
        _ title: String,
        _ detail: String,
        action: String? = nil
    ) -> WaitingRoomApprovalStep {
        WaitingRoomApprovalStep(
            id: "identity",
            icon: .idCard,
            tone: tone,
            title: title,
            detail: detail,
            actionLabel: action,
            actionKey: action == nil ? nil : confirmIdentityKey
        )
    }

    private static func proof(
        _ tone: WaitingRoomApprovalTone,
        _ title: String,
        _ detail: String,
        action: String? = nil
    ) -> WaitingRoomApprovalStep {
        WaitingRoomApprovalStep(
            id: "proof",
            icon: .fileText,
            tone: tone,
            title: title,
            detail: detail,
            actionLabel: action,
            actionKey: action == nil ? nil : uploadDocumentKey
        )
    }
}

/// The checklist card in the waiting room.
struct WaitingRoomApprovalCard: View {
    let steps: [WaitingRoomApprovalStep]
    /// The action whose request is in flight (its button shows "Opening…").
    let busyKey: String?
    let notice: String?
    let onAction: (String) -> Void

    private var ready: Bool {
        steps.allSatisfy { $0.tone == .done }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(ready ? "Everything\u{2019}s in. A Pantopus reviewer will approve your claim."
                : "Before we can approve your claim")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            ForEach(steps) { step in
                row(step)
            }
            if let notice {
                Text(notice)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.warning)
                    .accessibilityIdentifier("waitingRoomApprovalNotice")
            }
            if !ready {
                Text("Then a Pantopus reviewer approves your claim.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("waitingRoomApproval")
    }

    private func row(_ step: WaitingRoomApprovalStep) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            statusIcon(step.tone)
            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(step.detail)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let label = step.actionLabel, let key = step.actionKey {
                    Button { onAction(key) } label: {
                        Text(busyKey == key ? "Opening\u{2026}" : label)
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 32)
                            .background(Theme.Color.primarySolid)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(busyKey != nil)
                    .padding(.top, Spacing.s1)
                    .accessibilityIdentifier("waitingRoomApproval_\(step.id)_action")
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("waitingRoomApproval_\(step.id)")
    }

    @ViewBuilder
    private func statusIcon(_ tone: WaitingRoomApprovalTone) -> some View {
        switch tone {
        case .done: Icon(.checkCircle2, size: 20, color: Theme.Color.success)
        case .waiting: Icon(.clock, size: 20, color: Theme.Color.info)
        case .retry: Icon(.alertCircle, size: 20, color: Theme.Color.warning)
        case .todo: Icon(.circle, size: 20, color: Theme.Color.appTextMuted)
        }
    }
}
