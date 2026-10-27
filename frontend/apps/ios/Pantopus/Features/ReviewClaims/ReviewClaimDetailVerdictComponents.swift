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
            Text(statement)
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

// MARK: - Approval role

/// The household role Accept grants. Starts at what the person claimed; the "Before you approve" panel
/// above follows the choice (owner and admin need an ownership document).
struct ApprovalChoiceCard: View {
    let detail: AdminClaimDetailResponse
    @Bindable var viewModel: ReviewClaimDetailViewModel

    private var claimedRole: AdminClaimApprovalRole {
        .claimed(by: detail.claim.claimType)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Menu {
                ForEach(AdminClaimApprovalRole.allCases) { option in
                    Button(title(for: option)) { viewModel.approveAs = option }
                        .accessibilityIdentifier("reviewClaimDetail_role_\(option.rawValue)")
                }
            } label: {
                HStack(spacing: Spacing.s2) {
                    Text(title(for: viewModel.approveAs))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s2)
                    Icon(.chevronDown, size: 16, color: Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            .disabled(viewModel.reviewingAction != nil)
            .accessibilityIdentifier("reviewClaimDetail_approveAs")
            .accessibilityLabel("Approve as \(viewModel.approveAs.label)")
            Text(viewModel.approveAs.hint)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func title(for option: AdminClaimApprovalRole) -> String {
        option == claimedRole ? "\(option.label) (what they claimed)" : option.label
    }
}

// MARK: - Verdict bar

struct VerdictBar: View {
    let reviewingAction: AdminClaimReviewAction?
    /// Why Accept is off (approval would refuse), shown above it; nil when it can go ahead.
    var acceptBlockedReason: String?
    var acceptLabel = "Accept claim"
    let onAccept: () -> Void
    let onChallenge: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            if let acceptBlockedReason {
                Text(acceptBlockedReason)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("reviewClaimDetail_acceptBlocked")
            }
            VerdictButton(
                style: .accept,
                label: reviewingAction == .approve ? "Accepting…" : acceptLabel,
                icon: .checkCircle,
                isLoading: reviewingAction == .approve,
                disabled: reviewingAction != nil || acceptBlockedReason != nil,
                action: onAccept
            )
            .accessibilityIdentifier("reviewClaimDetail_accept")
            .accessibilityLabel(acceptLabel)

            HStack(spacing: Spacing.s2) {
                VerdictButton(
                    style: .challenge,
                    label: "Request info",
                    icon: .messageCircle,
                    isLoading: reviewingAction == .challenge,
                    disabled: reviewingAction != nil,
                    action: onChallenge
                )
                .accessibilityIdentifier("reviewClaimDetail_challenge")
                .accessibilityLabel("Request more information")

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
        case .accept: Theme.Color.successSolid
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
