//
//  CertifiedConfirmGate.swift
//  Pantopus
//
//  Delivery-signing sheet for unread certified mail. The sheet appears
//  before the first signature action and requires the user to explicitly
//  confirm recipient intent before Pantopus records the receipt.
//

import SwiftUI

@MainActor
public struct CertifiedConfirmGate: View {
    private let senderName: String
    private let referenceNumber: String
    private let deadlineLabel: String?
    private let isSigning: Bool
    private let onReviewFirst: @MainActor () -> Void
    private let onSign: @MainActor () -> Void
    @State private var didConfirm = false

    public init(
        senderName: String,
        referenceNumber: String,
        deadlineLabel: String? = nil,
        isSigning: Bool = false,
        onReviewFirst: @escaping @MainActor () -> Void,
        onSign: @escaping @MainActor () -> Void
    ) {
        self.senderName = senderName
        self.referenceNumber = referenceNumber
        self.deadlineLabel = deadlineLabel
        self.isSigning = isSigning
        self.onReviewFirst = onReviewFirst
        self.onSign = onSign
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 42, height: 4)
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)

            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(.badgeCheck, size: 22, color: Theme.Color.warning)
                    .frame(width: 44, height: 44)
                    .background(Theme.Color.warningBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Sign for delivery")
                        .pantopusTextStyle(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("This certified item is unread. Signing records a delivery receipt in the chain of custody.")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.s0) {
                SummaryRow(label: "From", value: senderName, icon: .landmark)
                Divider().background(Theme.Color.appBorderSubtle)
                SummaryRow(label: "Tracking", value: referenceNumber, icon: .hash, isCode: true)
                if let deadlineLabel {
                    Divider().background(Theme.Color.appBorderSubtle)
                    SummaryRow(label: "Respond by", value: deadlineLabel, icon: .calendarClock)
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))

            PantopusCheckbox(
                isChecked: $didConfirm,
                label: "I am the recipient and understand this confirms delivery only.",
                accessibilityIdentifier: "certifiedConfirmGate_confirmation"
            )
            .padding(Spacing.s3)
            .background(Theme.Color.appSurfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))

            VStack(spacing: Spacing.s2) {
                PrimaryButton(
                    title: "Sign for delivery",
                    isLoading: isSigning,
                    isEnabled: didConfirm && !isSigning
                ) {
                    await MainActor.run { onSign() }
                }
                GhostButton(title: "Review first", isEnabled: !isSigning) {
                    await MainActor.run { onReviewFirst() }
                }
            }

            Text("Signing does not waive your right to appeal, dispute, or pay through the issuing agency.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("certifiedConfirmGate")
    }

    private struct SummaryRow: View {
        let label: String
        let value: String
        let icon: PantopusIcon
        var isCode = false

        var body: some View {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(icon, size: 14, color: Theme.Color.appTextStrong)
                    .frame(width: 28, height: 28)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(value)
                        .font(isCode ? .system(size: 12, design: .monospaced) : .system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
        }
    }
}

#Preview("States") {
    CertifiedConfirmGate(
        senderName: "Alameda County",
        referenceNumber: "7014 2026 0411 3344 5577",
        deadlineLabel: "Tue Jun 30, 2026",
        onReviewFirst: {},
        onSign: {}
    )
}
