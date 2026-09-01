//
//  CouponDetailLayout.swift
//  Pantopus
//
//  A17.5 — Coupon ceremonial variant of the mail item detail. Sits on
//  the shared `MailItemDetailShell` (P19); the body slot is the
//  bespoke `CouponBody` (ticket hero + fine-print + barcode-expand
//  card). The action shelf hosts the redemption-state CTA: Redeem
//  primary while the offer is live, an "Already redeemed" disabled
//  pill once flipped, and a terminal "Expired" affordance.
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

@MainActor
struct CouponDetailLayout: View {
    let content: MailDetailContent
    let coupon: CouponDetailDTO
    let redeemInFlight: Bool
    let onBack: @MainActor () -> Void
    let onRedeem: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    var onSaveToVault: @MainActor () -> Void = {}

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: makeAttachments(),
            hero: { CouponHeroCard(content: content) },
            keyFacts: { KeyFactsCard(rows: makeKeyFacts()) },
            body: { CouponBody(coupon: coupon, state: bodyState) },
            sender: { SenderCard(content: content, onOpenProfile: onOpenSenderProfile) },
            actions: {
                CouponActionsRow(
                    state: bodyState,
                    redeemInFlight: redeemInFlight,
                    onRedeem: onRedeem,
                    onSaveToVault: onSaveToVault
                )
            }
        )
        .accessibilityIdentifier("mailDetail_coupon")
    }

    private var bodyState: CouponBodyState {
        if content.isAcknowledged { return .redeemed }
        // Best-effort expiry check — backend ships `expires_at` as ISO 8601
        // or YYYY-MM-DD; either form parses through the standard
        // formatter. Falls open to `.unused` when we can't parse it.
        if let raw = coupon.expiresAt, let date = parseExpiry(raw), date < Date() {
            return .expired
        }
        return .unused
    }

    private func parseExpiry(_ raw: String) -> Date? {
        let iso = ISO8601DateFormatter()
        if let date = iso.date(from: raw) { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: raw)
    }

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Coupon",
            trust: content.detailTrust,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: .bookmark,
                accessibilityLabel: "Save to vault"
            ) { @Sendable in Task { @MainActor in onSaveToVault() } },
            overflowItems: [
                MailOverflowItem(id: "share", icon: .share, label: "Share") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "addToWallet", icon: .wallet, label: "Add to wallet") {},
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {},
                MailOverflowItem(id: "delete", icon: .trash2, label: "Delete", isDestructive: true) {}
            ]
        )
    }

    private func makeAIElf() -> AIElfStripContent? {
        let merchant = coupon.merchant ?? coupon.brandName ?? "the merchant"
        let headline: String
        let summary: String
        switch bodyState {
        case .unused:
            headline = "Saved for your next visit"
            summary = "Show this at checkout — Pantopus will mute reminders once you redeem."
        case .redeemed:
            headline = "Redeemed at \(merchant)"
            summary = "The single-use barcode is retired. We'll keep a copy in your Vault for receipts."
        case .expired:
            headline = "This offer has expired"
            summary = "You can archive this mail or move on — the barcode is no longer scannable."
        }
        return AIElfStripContent(headline: headline, summary: summary)
    }

    private func makeAttachments() -> AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(id: "att-\(index)", kind: .pdf, name: name)
        }
        return AttachmentsRowContent(title: "Fine print", items: items)
    }

    private func makeKeyFacts() -> [MailDetailKeyFact] {
        var rows: [MailDetailKeyFact] = []
        if let merchant = coupon.merchant ?? coupon.brandName {
            rows.append(MailDetailKeyFact(icon: .briefcase, label: "Merchant", value: merchant))
        }
        if let code = coupon.code {
            rows.append(MailDetailKeyFact(icon: .hash, label: "Code", value: code))
        }
        if let minimumSpend = coupon.minimumSpend {
            rows.append(MailDetailKeyFact(icon: .info, label: "Min. spend", value: minimumSpend))
        }
        if let expiresAt = coupon.expiresAt {
            rows.append(MailDetailKeyFact(icon: .clock, label: "Expires", value: expiresAt))
        }
        return rows
    }
}

// MARK: - Hero

private struct CouponHeroCard: View {
    let content: MailDetailContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                CategoryBadge(category: content.category)
                Spacer()
                if let received = content.createdAtLabel {
                    Text(received)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Text(content.senderDisplayName.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(content.title)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if let excerpt = content.excerpt, !excerpt.isEmpty {
                Text(excerpt)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(content.category.accent).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

private struct CategoryBadge: View {
    let category: MailItemCategory

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(category.icon, size: 11, color: category.accent)
            Text(category.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(category.accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(category.rowBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

// MARK: - Key facts

private struct KeyFactsCard: View {
    let rows: [MailDetailKeyFact]

    var body: some View {
        if rows.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("OFFER FACTS")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        Icon(row.icon, size: 13, color: Theme.Color.appTextStrong)
                            .frame(width: 24, height: 24)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(row.label.uppercased())
                                .font(.system(size: 11, weight: .semibold))
                                .tracking(0.4)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            Text(row.value)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    if index < rows.count - 1 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
    }
}

// MARK: - Sender

private struct SenderCard: View {
    let content: MailDetailContent
    let onOpenProfile: (@MainActor (String) -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(content.senderInitials)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(width: 44, height: 44)
                .background(content.category.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            VStack(alignment: .leading, spacing: 2) {
                Text(content.senderDisplayName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let meta = content.senderMeta {
                    Text(meta)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            if onOpenProfile != nil, content.senderUserId != nil {
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
        }
        .padding(Spacing.s3)
        .contentShape(Rectangle())
        .onTapGesture {
            if let onOpenProfile, let userId = content.senderUserId {
                onOpenProfile(userId)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

// MARK: - Redemption-state actions

private struct CouponActionsRow: View {
    let state: CouponBodyState
    let redeemInFlight: Bool
    let onRedeem: @MainActor () -> Void
    let onSaveToVault: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            primaryButton
            HStack(spacing: Spacing.s2) {
                secondary(id: "save", icon: .bookmark, label: "Save", action: onSaveToVault)
                secondary(id: "share", icon: .share, label: "Share")
                secondary(id: "directions", icon: .mapPin, label: "Get directions")
            }
        }
    }

    @ViewBuilder
    private var primaryButton: some View {
        switch state {
        case .unused:
            redeemButton
        case .redeemed:
            redeemedPill
        case .expired:
            expiredPill
        }
    }

    private var redeemButton: some View {
        Button(action: { onRedeem() }) {
            HStack(spacing: Spacing.s2) {
                Icon(.checkCircle, size: 16, color: Theme.Color.appTextInverse)
                Text("Mark redeemed")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(redeemInFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(redeemInFlight)
        .accessibilityIdentifier("mailDetail_coupon_redeem")
    }

    private var redeemedPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle, size: 16, color: Theme.Color.success)
            Text("Already redeemed")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Theme.Color.success)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.Color.successLight, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityIdentifier("mailDetail_coupon_redeemed")
    }

    private var expiredPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text("This offer has expired")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Theme.Color.error)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.Color.errorBg)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.Color.error.opacity(0.2), lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityIdentifier("mailDetail_coupon_expired")
    }

    private func secondary(
        id: String,
        icon: PantopusIcon,
        label: String,
        action: @escaping @MainActor () -> Void = {}
    ) -> some View {
        Button(action: { action() }) {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 17, color: Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailDetail_coupon_action_\(id)")
    }
}
