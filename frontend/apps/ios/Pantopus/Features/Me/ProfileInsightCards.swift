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
//  * Invite progress — confirmed referral joins and a share CTA carrying
//    the invite code. No feature-access promises from the legacy reward ladder.
//    Mirrors RN `components/profile/InviteProgressCard.tsx`.
//

// swiftlint:disable function_parameter_count

import SwiftUI

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
                Icon(.barChart3, size: 18, color: Theme.Color.primaryInk)
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
            // Launch cut #3 (Marketplace): no listing stats.
            if LaunchFeatures.marketplace {
                detailSection("Marketplace", rows: [
                    ("Listings sold", "\(receipt.marketplace.listingsSold)"),
                    ("Listings bought", "\(receipt.marketplace.listingsBought)"),
                    ("Free items claimed", "\(receipt.marketplace.freeItemsClaimed)")
                ])
            }
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
                Icon(.share, size: 16, color: Theme.Color.primaryInk)
                Text("Share your month")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
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
    /// Nil hides "Invite a neighbor" (no invite code to share yet).
    private let onShare: (@MainActor () -> Void)?

    public init(progress: InviteProgressDTO, onShare: (@MainActor () -> Void)? = {}) {
        self.progress = progress
        self.onShare = onShare
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Invite neighbors")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(joinedText)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("inviteProgress.joined")
            Text("Share your invite link to help neighbors find each other.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextMuted)
            if let onShare {
                shareButton(onShare)
            }
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

    private var joinedText: String {
        let joined = max(0, progress.totalConverted)
        if joined == 0 { return "No neighbors have joined through your invites yet." }
        return "\(joined) neighbor\(joined == 1 ? " has" : "s have") joined through your invites."
    }

    private func shareButton(_ onShare: @escaping @MainActor () -> Void) -> some View {
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
                    .fill(Theme.Color.primarySolid)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("inviteProgress.share")
    }
}
