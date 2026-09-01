//
//  ReviewClaimDetailVerdictComponents.swift
//  Pantopus
//
//  Statement and verdict controls for the review-claim detail surface.
//

import SwiftUI

// MARK: - Statement block

struct StatementBlock: View {
    let statement: String
    let attribution: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("\u{201C}\(statement)\u{201D}")
                .font(.system(size: 13.5).italic())
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if let attribution {
                HStack(spacing: Spacing.s1) {
                    Icon(.fileSignature, size: 10, color: Theme.Color.appTextMuted)
                    Text(attribution.uppercased())
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
        .padding(.leading, 18)
        .padding(.trailing, Spacing.s4)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Theme.Color.primary600)
                .frame(width: 3)
                .padding(.vertical, 14)
                .padding(.leading, Spacing.s2)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

// MARK: - Verdict bar

struct VerdictBar: View {
    let reviewingAction: AdminClaimReviewAction?
    let onAccept: () -> Void
    let onChallenge: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            VerdictButton(
                style: .accept,
                label: reviewingAction == .approve ? "Accepting…" : "Accept claim",
                icon: .checkCircle,
                isLoading: reviewingAction == .approve,
                disabled: reviewingAction != nil,
                action: onAccept
            )
            .accessibilityIdentifier("reviewClaimDetail_accept")
            .accessibilityLabel("Accept claim")

            HStack(spacing: Spacing.s2) {
                VerdictButton(
                    style: .challenge,
                    label: "Challenge",
                    icon: .messageCircle,
                    isLoading: reviewingAction == .challenge,
                    disabled: reviewingAction != nil,
                    action: onChallenge
                )
                .accessibilityIdentifier("reviewClaimDetail_challenge")
                .accessibilityLabel("Challenge claim")

                VerdictButton(
                    style: .reject,
                    label: "Reject",
                    icon: .circleSlash,
                    isLoading: reviewingAction == .reject,
                    disabled: reviewingAction != nil,
                    action: onReject
                )
                .accessibilityIdentifier("reviewClaimDetail_reject")
                .accessibilityLabel("Reject claim")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl3))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl3)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .shadow(color: Theme.Color.appText.opacity(0.08), radius: 12, y: 4)
    }
}

private struct VerdictButton: View {
    enum Style { case accept, challenge, reject }

    let style: Style
    let label: String
    let icon: PantopusIcon
    let isLoading: Bool
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: style == .accept ? Spacing.s2 : 6) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: foreground))
                } else {
                    Icon(icon, size: style == .accept ? 17 : 15, color: foreground)
                }
                Text(label)
                    .font(.system(size: style == .accept ? 15 : 13.5, weight: .semibold))
                    .foregroundStyle(foreground)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: style == .accept ? 48 : 44)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(border, lineWidth: border == .clear ? 0 : 1)
            )
            .shadow(color: shadow, radius: style == .accept ? 8 : 0, y: style == .accept ? 6 : 0)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }

    private var cornerRadius: CGFloat {
        style == .accept ? Radii.lg : 10
    }

    private var foreground: Color {
        switch style {
        case .accept: Theme.Color.appTextInverse
        case .challenge: Theme.Color.warmAmber
        case .reject: Theme.Color.error
        }
    }

    private var background: Color {
        switch style {
        case .accept: Theme.Color.success
        case .challenge: Theme.Color.warningBg
        case .reject: Theme.Color.appSurface
        }
    }

    private var border: Color {
        switch style {
        case .accept: .clear
        case .challenge: Theme.Color.warningLight
        case .reject: Theme.Color.errorLight
        }
    }

    private var shadow: Color {
        style == .accept ? Theme.Color.primary600.opacity(0.28) : .clear
    }
}
