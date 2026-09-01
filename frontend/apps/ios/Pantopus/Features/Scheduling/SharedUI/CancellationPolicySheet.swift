//
//  CancellationPolicySheet.swift
//  Pantopus
//
//  Foundation (I0b) — the read-only cancellation & refund policy presenter (the
//  "what the invitee sees" card reused at checkout, on Manage your booking, and
//  in the policy-blocked state). Renders the policy in plain language — no
//  editable controls (the owner editor lives in I14). Tokens only.
//

import SwiftUI

/// A plain-language snapshot of a booking's cancellation & refund policy. Built
/// by feature streams from the event-type / booking-page policy fields.
public struct CancellationPolicyDisplay: Sendable, Hashable {
    public var name: String?
    public var freeCancellationWindow: String?
    public var refundAfterCutoff: String?
    public var depositNonRefundable: Bool
    public var rescheduleCutoff: String?
    public var noShowHandling: String?

    public init(
        name: String? = nil,
        freeCancellationWindow: String? = nil,
        refundAfterCutoff: String? = nil,
        depositNonRefundable: Bool = false,
        rescheduleCutoff: String? = nil,
        noShowHandling: String? = nil
    ) {
        self.name = name
        self.freeCancellationWindow = freeCancellationWindow
        self.refundAfterCutoff = refundAfterCutoff
        self.depositNonRefundable = depositNonRefundable
        self.rescheduleCutoff = rescheduleCutoff
        self.noShowHandling = noShowHandling
    }

    /// The verbatim plain-language sentence shown before payment.
    public var summarySentence: String {
        if let window = freeCancellationWindow {
            let after = refundAfterCutoff.map { " After that, \($0.lowercased())." } ?? ""
            return "Free cancellation up to \(window).\(after)"
        }
        if let after = refundAfterCutoff {
            return after
        }
        return "This booking can be cancelled anytime."
    }
}

/// Read-only policy presenter. Present locally via `.sheet`.
public struct CancellationPolicySheet: View {
    private let policy: CancellationPolicyDisplay
    private let accent: Color
    private let onClose: (() -> Void)?

    public init(
        policy: CancellationPolicyDisplay,
        accent: Color = Theme.Color.primary600,
        onClose: (() -> Void)? = nil
    ) {
        self.policy = policy
        self.accent = accent
        self.onClose = onClose
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack {
                Text("Cancellation & refund policy")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                if let onClose {
                    Button("Done", action: onClose)
                        .font(Theme.Font.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary600)
                }
            }

            summaryCard

            VStack(spacing: 0) {
                if let name = policy.name { row("Policy", name) }
                if let window = policy.freeCancellationWindow { row("Free cancellation", "Up to \(window)") }
                if let after = policy.refundAfterCutoff { row("After the cutoff", after) }
                if policy.depositNonRefundable { row("Deposit", "Non-refundable") }
                if let reschedule = policy.rescheduleCutoff { row("Reschedule", reschedule) }
                if let noShow = policy.noShowHandling { row("No-show", noShow) }
            }
            .padding(.horizontal, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))

            Text("Invitees see this wording before they pay.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.cancellationPolicySheet")
    }

    private var summaryCard: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(.shieldCheck, size: 20, color: accent)
            Text(policy.summarySentence)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(spacing: Spacing.s3) {
            Text(label)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            Text(value)
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity)
    }
}

#if DEBUG
#Preview {
    CancellationPolicySheet(
        policy: CancellationPolicyDisplay(
            name: "Flexible",
            freeCancellationWindow: "24 hours before",
            refundAfterCutoff: "No refund",
            depositNonRefundable: true,
            rescheduleCutoff: "Up to 2 hours before",
            noShowHandling: "Charge full price"
        ),
        accent: Theme.Color.business
    ) {}
}
#endif
