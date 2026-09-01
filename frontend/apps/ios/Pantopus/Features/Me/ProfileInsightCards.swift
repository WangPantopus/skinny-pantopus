//
//  ProfileInsightCards.swift
//  Pantopus
//
//  Two profile-tab cards RN ships and native was missing:
//
//  * Monthly Receipt — earnings / spending / neighbors helped / posts, an
//    expandable detail block, and a share sheet. Auto-expands when the
//    profile is opened from the `monthly_receipt` push.
//    Mirrors RN `components/profile/MonthlyReceiptCard.tsx`.
//  * Invite progress — referral count against the unlock tiers, unlocked
//    feature chips, next unlock, and a share CTA carrying the invite code.
//    Mirrors RN `components/profile/InviteProgressCard.tsx`.
//

// swiftlint:disable function_parameter_count

import SwiftUI

// MARK: - Invite tiers

/// The unlock ladder, verbatim from `backend/services/inviteRewardService.js:19`.
/// The server also returns the label on `next_unlock`; this table backs the
/// milestone dots and the unlocked-feature chip labels.
public enum InviteFeatureTier: String, CaseIterable, Sendable {
    case activityMap = "activity_map"
    case neighborhoodInsights = "neighborhood_insights"
    case priorityMatching = "priority_matching"
    case foundingBadge = "founding_badge"

    public var threshold: Int {
        switch self {
        case .activityMap: 1
        case .neighborhoodInsights: 3
        case .priorityMatching: 5
        case .foundingBadge: 10
        }
    }

    public var label: String {
        switch self {
        case .activityMap: "Neighborhood Activity Map"
        case .neighborhoodInsights: "Neighborhood Insights"
        case .priorityMatching: "Priority Matching"
        case .foundingBadge: "Founding Neighbor Badge"
        }
    }

    /// Server keys we don't know fall back to the raw key rather than
    /// being dropped, so a new backend tier still renders.
    public static func label(forKey key: String) -> String {
        InviteFeatureTier(rawValue: key)?.label ?? key
    }

    public static var maxThreshold: Int {
        allCases.map(\.threshold).max() ?? 1
    }
}

// MARK: - Monthly receipt card

public struct MonthlyReceiptCard: View {
    private let receipt: MonthlyReceiptDTO
    private let onShare: @MainActor () -> Void
    @State private var isExpanded: Bool

    public init(
        receipt: MonthlyReceiptDTO,
        startExpanded: Bool = false,
        onShare: @escaping @MainActor () -> Void = {}
    ) {
        self.receipt = receipt
        self.onShare = onShare
        _isExpanded = State(initialValue: startExpanded)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            header
            if let highlight = receipt.highlight, !highlight.isEmpty {
                Text(highlight)
                    .pantopusTextStyle(.small)
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            statsGrid
            if isExpanded { details }
            shareButton
        }
        .padding(Spacing.s4)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("monthlyReceiptCard")
    }

    private var header: some View {
        Button { isExpanded.toggle() } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.barChart3, size: 18, color: Theme.Color.primary600)
                Text("\(receipt.period.label) Summary")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
                Icon(
                    isExpanded ? .chevronUp : .chevronDown,
                    size: 20,
                    color: Theme.Color.appTextMuted
                )
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("monthlyReceipt.toggle")
    }

    private var statsGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: Spacing.s2),
                GridItem(.flexible(), spacing: Spacing.s2)
            ],
            spacing: Spacing.s2
        ) {
            statBox(
                icon: .briefcase,
                tint: Theme.Color.success,
                background: Theme.Color.successBg,
                value: Self.dollars(receipt.earnings.totalCents),
                label: "Earned",
                identifier: "monthlyReceipt.earned"
            )
            statBox(
                icon: .creditCard,
                tint: Theme.Color.primary600,
                background: Theme.Color.primary50,
                value: Self.dollars(receipt.spending.totalCents),
                label: "Spent",
                identifier: "monthlyReceipt.spent"
            )
            statBox(
                icon: .users,
                tint: Theme.Color.business,
                background: Theme.Color.appSurfaceSunken,
                value: "\(receipt.community.neighborsHelped)",
                label: "Neighbors helped",
                identifier: "monthlyReceipt.neighborsHelped"
            )
            statBox(
                icon: .file,
                tint: Theme.Color.warning,
                background: Theme.Color.appSurfaceSunken,
                value: "\(receipt.community.postsCreated)",
                label: "Posts",
                identifier: "monthlyReceipt.posts"
            )
        }
    }

    private func statBox(
        icon: PantopusIcon,
        tint: Color,
        background: Color,
        value: String,
        label: String,
        identifier: String
    ) -> some View {
        VStack(spacing: Spacing.s1) {
            Icon(icon, size: 18, color: tint)
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(tint)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(background)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            detailSection("Marketplace", rows: [
                ("Listings sold", "\(receipt.marketplace.listingsSold)"),
                ("Listings bought", "\(receipt.marketplace.listingsBought)"),
                ("Free items claimed", "\(receipt.marketplace.freeItemsClaimed)")
            ])
            detailSection("Earnings breakdown", rows: [
                ("Gigs completed (as worker)", "\(receipt.earnings.gigCount)"),
                ("Top category", receipt.earnings.topCategory ?? "N/A")
            ])
            detailSection("Community", rows: [
                ("Connections made", "\(receipt.community.connectionsMade)")
            ])
            detailSection("Reputation", rows: [
                ("Current rating", Self.rating(receipt.reputation.currentRating)),
                ("Reviews received", "\(receipt.reputation.reviewsReceived)"),
                ("Rating change", Self.signedRating(receipt.reputation.ratingChange))
            ])
        }
        .accessibilityIdentifier("monthlyReceipt.details")
    }

    private func detailSection(_ title: String, rows: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextMuted)
            ForEach(rows, id: \.0) { row in
                HStack {
                    Text(row.0)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer(minLength: Spacing.s2)
                    Text(row.1)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
            }
        }
    }

    private var shareButton: some View {
        Button(action: onShare) {
            HStack(spacing: Spacing.s2) {
                Icon(.share, size: 16, color: Theme.Color.primary600)
                Text("Share your month")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.primary600, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("monthlyReceipt.share")
    }

    // MARK: Formatting — the server owns the numbers; we only format.

    static func dollars(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100)
    }

    static func rating(_ value: Double?) -> String {
        guard let value, value > 0 else { return "N/A" }
        return String(format: "%.1f", value)
    }

    static func signedRating(_ value: Double?) -> String {
        guard let value else { return "N/A" }
        return (value >= 0 ? "+" : "") + String(format: "%.2f", value)
    }

    /// The message RN's `handleShareReceipt` composes.
    static func shareMessage(_ receipt: MonthlyReceiptDTO) -> String {
        let earned = String(format: "%.2f", Double(receipt.earnings.totalCents) / 100)
        let highlight = receipt.highlight.map { "\($0) " } ?? ""
        return "My \(receipt.period.label) on Pantopus: \(highlight)"
            + "I earned $\(earned) and helped \(receipt.community.neighborsHelped) neighbors."
    }
}

// MARK: - Invite progress card

public struct InviteProgressCard: View {
    private let progress: InviteProgressDTO
    private let onShare: @MainActor () -> Void

    public init(progress: InviteProgressDTO, onShare: @escaping @MainActor () -> Void = {}) {
        self.progress = progress
        self.onShare = onShare
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Invite neighbors, unlock features")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            progressTrack
            if !progress.unlockedFeatures.isEmpty {
                unlockedChips
            }
            if let next = progress.nextUnlock {
                nextUnlockRow(next)
            }
            shareButton
        }
        .padding(Spacing.s4)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("inviteProgressCard")
    }

    private var fraction: Double {
        let maxThreshold = Double(InviteFeatureTier.maxThreshold)
        guard maxThreshold > 0 else { return 0 }
        return min(Double(progress.totalConverted) / maxThreshold, 1)
    }

    private var progressTrack: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.appSurfaceSunken)
                    Capsule()
                        .fill(Theme.Color.primary600)
                        .frame(width: max(0, geo.size.width * fraction))
                }
            }
            .frame(height: 6)
            HStack {
                ForEach(InviteFeatureTier.allCases, id: \.self) { tier in
                    let unlocked = progress.totalConverted >= tier.threshold
                    Text("\(tier.threshold)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(
                            unlocked ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
                        )
                        .frame(width: 22, height: 22)
                        .background(
                            Circle().fill(
                                unlocked ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken
                            )
                        )
                        .accessibilityIdentifier("inviteProgress.tier.\(tier.rawValue)")
                    if tier != InviteFeatureTier.allCases.last {
                        Spacer(minLength: Spacing.s1)
                    }
                }
            }
        }
        .accessibilityIdentifier("inviteProgress.track")
    }

    private var unlockedChips: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(progress.unlockedFeatures, id: \.self) { key in
                HStack(spacing: Spacing.s1) {
                    Icon(.checkCircle, size: 13, color: Theme.Color.success)
                    Text(InviteFeatureTier.label(forKey: key))
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.success)
                        .lineLimit(1)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(Capsule().fill(Theme.Color.successBg))
            }
        }
        .accessibilityIdentifier("inviteProgress.unlocked")
    }

    private func nextUnlockRow(_ next: InviteProgressDTO.NextUnlock) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.lock, size: 13, color: Theme.Color.appTextMuted)
            Text(Self.nextUnlockText(next))
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityIdentifier("inviteProgress.nextUnlock")
    }

    private var shareButton: some View {
        Button(action: onShare) {
            HStack(spacing: Spacing.s2) {
                Icon(.send, size: 16, color: Theme.Color.appTextInverse)
                Text("Invite a neighbor")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.primary600)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("inviteProgress.share")
    }

    static func nextUnlockText(_ next: InviteProgressDTO.NextUnlock) -> String {
        let remaining = max(0, next.invitesRemaining)
        let label = next.label ?? InviteFeatureTier.label(forKey: next.feature)
        return "Invite \(remaining) more neighbor\(remaining == 1 ? "" : "s") to unlock \(label)"
    }
}
