//
//  HomeClaimReviewComponents.swift
//  Pantopus
//
//  H6 — Presentation atoms for the per-home owner claim-review screen.
//  Geometry follows the A08 "Review claims" card frame (16pt radius card,
//  40pt avatar, pill chips, full-width action row) and the A13.3 "Review
//  Claim" verdict palette (green accept / red reject / amber flag).
//

// swiftlint:disable file_length function_parameter_count

import SwiftUI

// MARK: - Tab strip

/// One entry in the claim-review tab strip.
struct HomeClaimReviewTabItem: Identifiable, Hashable {
    let tab: HomeClaimReviewTab
    let title: String

    var id: HomeClaimReviewTab {
        tab
    }
}

/// Underlined tab strip matching the A08 `TabStrip` frame (52pt bar,
/// 2pt primary underline on the active tab).
struct HomeClaimReviewTabStrip: View {
    let tabs: [HomeClaimReviewTabItem]
    @Binding var selection: HomeClaimReviewTab

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(tabs) { entry in
                Button {
                    selection = entry.tab
                } label: {
                    VStack(spacing: Spacing.s2) {
                        Text(entry.title)
                            .font(.system(size: 13, weight: selection == entry.tab ? .semibold : .medium))
                            .foregroundStyle(
                                selection == entry.tab
                                    ? Theme.Color.primary600
                                    : Theme.Color.appTextSecondary
                            )
                        Rectangle()
                            .fill(
                                selection == entry.tab
                                    ? Theme.Color.primary600
                                    : Color.clear
                            )
                            .frame(height: 2)
                    }
                    .padding(.top, Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homeClaimReview_tab_\(entry.tab.rawValue)")
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
    }
}

// MARK: - Small atoms

/// Neutral pill used for claim metadata (claim type / strength / route).
struct HomeClaimMetaChip: View {
    let text: String
    var background: Color = Theme.Color.appSurfaceSunken
    var foreground: Color = Theme.Color.appTextSecondary

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(foreground)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

/// Initials avatar. The ownership list endpoint masks claimants, so a
/// photo is frequently unavailable — initials are the canonical fallback.
struct HomeClaimAvatar: View {
    let initials: String
    var size: CGFloat = 40
    var tint: Color = Theme.Color.primary600

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(tint.opacity(0.14))
            Text(initials)
                .font(.system(size: size * 0.33, weight: .bold))
                .foregroundStyle(tint)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Amber notice shown on claims that have moved onto the challenge path.
struct HomeClaimChallengeNotice: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.shield, size: 16, color: Theme.Color.warning)
            Text("This claim is in the challenge path and should go through admin review.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        }
    }
}

// MARK: - Action buttons

/// A13.3 verdict-button palette.
enum HomeClaimActionTone {
    case accept
    case reject
    case neutral
    case flag
}

struct HomeClaimActionButton: View {
    let title: String?
    let icon: PantopusIcon
    let tone: HomeClaimActionTone
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 16, color: foreground)
                if let title {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(foreground)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: title == nil ? 40 : .infinity)
            .frame(height: 40)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(border, lineWidth: border == .clear ? 0 : 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(title ?? identifier)
    }

    private var foreground: Color {
        switch tone {
        case .accept: Theme.Color.appTextInverse
        case .reject: Theme.Color.error
        case .neutral: Theme.Color.appText
        case .flag: Theme.Color.warning
        }
    }

    private var background: Color {
        switch tone {
        case .accept: Theme.Color.success
        case .reject: Theme.Color.errorBg
        case .neutral: Theme.Color.appSurface
        case .flag: Theme.Color.warningBg
        }
    }

    private var border: Color {
        switch tone {
        case .accept: .clear
        case .reject: Theme.Color.errorLight
        case .neutral: Theme.Color.appBorder
        case .flag: Theme.Color.warningLight
        }
    }
}

// MARK: - Cards

/// One pending ownership claim + its action row.
struct HomeClaimOwnershipCard: View {
    let item: HomeClaimReviewOwnershipItem
    let isBusy: Bool
    let onVerdict: (HomeClaimReviewVerdict) -> Void
    let onRelationship: (HomeClaimRelationshipAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                HomeClaimAvatar(initials: item.initials)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(item.displayName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let subtitle = item.subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    signalRow
                }
                Spacer(minLength: Spacing.s0)
                if let submitted = item.submittedLabel {
                    Text(submitted)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }

            if !item.metaChips.isEmpty {
                HomeClaimChipFlow(chips: item.metaChips)
            }

            if item.isChallenged {
                HomeClaimChallengeNotice()
            }

            if isBusy {
                HStack {
                    Spacer()
                    ProgressView()
                        .accessibilityIdentifier("homeClaimReview_ownershipBusy")
                    Spacer()
                }
                .frame(height: 40)
            } else {
                actionRow
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("homeClaimReview_ownershipCard")
    }

    private var signalRow: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(signals, id: \.self) { signal in
                Text(signal)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    private var signals: [String] {
        [item.accountAgeLabel, item.methodLabel, item.riskLabel, item.evidenceLabel]
            .compactMap { $0 }
    }

    @ViewBuilder
    private var actionRow: some View {
        switch item.actionMode {
        case .relationship:
            HStack(spacing: Spacing.s2) {
                HomeClaimActionButton(
                    title: item.inviteTitle,
                    icon: .userPlus,
                    tone: .accept,
                    identifier: "homeClaimReview_invite"
                ) { onRelationship(.inviteToHousehold) }
                HomeClaimActionButton(
                    title: "Continue review",
                    icon: .clock,
                    tone: .neutral,
                    identifier: "homeClaimReview_continueReview"
                ) { onRelationship(.declineRelationship) }
                HomeClaimActionButton(
                    title: nil,
                    icon: .flag,
                    tone: .flag,
                    identifier: "homeClaimReview_flagUnknown"
                ) { onRelationship(.flagUnknownPerson) }
            }
        case .adminReviewRequired:
            HStack(spacing: Spacing.s1) {
                Icon(.gavel, size: 14, color: Theme.Color.appTextSecondary)
                Text("Admin review required")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .accessibilityIdentifier("homeClaimReview_adminRequired")
        case .verdict:
            HStack(spacing: Spacing.s2) {
                HomeClaimActionButton(
                    title: "Approve",
                    icon: .check,
                    tone: .accept,
                    identifier: "homeClaimReview_approve"
                ) { onVerdict(.approve) }
                HomeClaimActionButton(
                    title: "Reject",
                    icon: .x,
                    tone: .reject,
                    identifier: "homeClaimReview_reject"
                ) { onVerdict(.reject) }
                HomeClaimActionButton(
                    title: nil,
                    icon: .flag,
                    tone: .flag,
                    identifier: "homeClaimReview_flag"
                ) { onVerdict(.flag) }
            }
        }
    }
}

/// One pending residency claim + approve / deny.
struct HomeClaimResidencyCard: View {
    let item: HomeClaimReviewResidencyItem
    let isBusy: Bool
    let onApprove: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                HomeClaimAvatar(initials: item.initials, size: 36, tint: Theme.Color.home)
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.displayName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(item.roleLabel)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                if let age = item.ageLabel {
                    Text(age)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            if let address = item.addressLabel {
                Text(address)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            if isBusy {
                HStack {
                    Spacer()
                    ProgressView()
                        .accessibilityIdentifier("homeClaimReview_residencyBusy")
                    Spacer()
                }
                .frame(height: 40)
            } else {
                HStack(spacing: Spacing.s2) {
                    HomeClaimActionButton(
                        title: "Approve",
                        icon: .check,
                        tone: .accept,
                        identifier: "homeClaimReview_residencyApprove",
                        action: onApprove
                    )
                    HomeClaimActionButton(
                        title: "Deny",
                        icon: .x,
                        tone: .reject,
                        identifier: "homeClaimReview_residencyReject",
                        action: onReject
                    )
                }
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("homeClaimReview_residencyCard")
    }
}

// MARK: - Compare

/// Side-by-side incumbent-vs-challenger panel backed by
/// `GET /api/homes/:id/ownership-claims/compare`.
struct HomeClaimComparePanel: View {
    let comparison: HomeClaimReviewComparison

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(comparison.homeTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: Spacing.s2) {
                    HomeClaimMetaChip(
                        text: comparison.hasVerifiedOwner
                            ? "Verified owner on record"
                            : "No verified owner",
                        background: comparison.hasVerifiedOwner
                            ? Theme.Color.successBg
                            : Theme.Color.warningBg,
                        foreground: comparison.hasVerifiedOwner
                            ? Theme.Color.success
                            : Theme.Color.warning
                    )
                    if let resolution = comparison.resolutionLabel {
                        HomeClaimMetaChip(text: resolution)
                    }
                }
            }

            HStack(alignment: .top, spacing: Spacing.s3) {
                column(
                    title: "Owners of record",
                    icon: .shieldCheck,
                    tint: Theme.Color.success,
                    cards: comparison.incumbents,
                    emptyCopy: "No verified owner yet.",
                    identifier: "homeClaimReview_compareIncumbents"
                )
                column(
                    title: "Challengers",
                    icon: .userPlus,
                    tint: Theme.Color.primary600,
                    cards: comparison.challengers,
                    emptyCopy: "No active claims.",
                    identifier: "homeClaimReview_compareChallengers"
                )
            }
        }
        .accessibilityIdentifier("homeClaimReview_comparePanel")
    }

    private func column(
        title: String,
        icon: PantopusIcon,
        tint: Color,
        cards: [HomeClaimReviewPartyCard],
        emptyCopy: String,
        identifier: String
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 14, color: tint)
                Text(title)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if cards.isEmpty {
                Text(emptyCopy)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            } else {
                ForEach(cards) { card in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        HStack(spacing: Spacing.s2) {
                            HomeClaimAvatar(initials: card.initials, size: 28, tint: tint)
                            Text(card.name)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                                .lineLimit(1)
                        }
                        ForEach(card.lines, id: \.self) { line in
                            Text(line)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Chip flow + skeleton

/// Wrapping chip row — `metaChips` can overflow one line on small
/// devices, matching the RN `flexWrap` behaviour.
struct HomeClaimChipFlow: View {
    let chips: [String]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(chips, id: \.self) { HomeClaimMetaChip(text: $0) }
            }
        }
    }
}

/// Loading skeleton that mirrors the loaded card geometry.
struct HomeClaimReviewSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    HStack(spacing: Spacing.s3) {
                        Shimmer(width: 40, height: 40, cornerRadius: Radii.md)
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            Shimmer(width: 140, height: 14)
                            Shimmer(width: 96, height: 11)
                        }
                        Spacer()
                    }
                    Shimmer(height: 40, cornerRadius: Radii.md)
                }
                .padding(Spacing.s4)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                }
            }
        }
        .accessibilityIdentifier("homeClaimReview_skeleton")
    }
}
