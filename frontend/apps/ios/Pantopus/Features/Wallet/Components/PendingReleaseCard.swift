//
//  PendingReleaseCard.swift
//  Pantopus
//
//  A10.10 · "Pending release" — the escrow breakdown behind the hero's
//  single Pending figure. `GET /api/wallet/pending-release`
//  (`backend/routes/wallet.js:160`) returns `in_review_cents` and
//  `releasing_soon_cents` separately; RN renders both as named dollar
//  lines (`WalletTab.tsx:161-173`) so a seller can tell money still inside
//  the cooling-off window from money already queued for transfer. The
//  amounts are the server's own cents, formatted — never re-derived.
//
//  Mirrors the Android `PendingReleaseCard`.
//

import SwiftUI

struct PendingReleaseCard: View {
    let breakdown: WalletPendingBreakdown

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            line(
                label: "In review",
                caption: caption(count: breakdown.inReviewCount, releasing: false),
                amount: breakdown.inReview,
                identifier: "walletPendingInReview"
            )
            Rectangle()
                .fill(Theme.Color.successLight)
                .frame(height: 1)
            line(
                label: "Releasing soon",
                caption: caption(count: breakdown.releasingSoonCount, releasing: true),
                amount: breakdown.releasingSoon,
                identifier: "walletPendingReleasingSoon"
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("walletPendingRelease")
    }

    private func line(
        label: String,
        caption: String?,
        amount: String,
        identifier: String
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let caption {
                    Text(caption)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s2)
            Text(amount)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    /// "2 payments · clears after review" / "· transfer queued". Counts come
    /// from the same payload; zero renders no caption.
    private func caption(count: Int, releasing: Bool) -> String? {
        guard count > 0 else { return nil }
        let noun = count == 1 ? "payment" : "payments"
        return releasing
            ? "\(count) \(noun) · transfer queued"
            : "\(count) \(noun) · clears after review"
    }
}

#Preview("PendingReleaseCard") {
    PendingReleaseCard(
        breakdown: WalletPendingBreakdown(
            inReview: "$120.00",
            releasingSoon: "$66.00",
            inReviewCount: 2,
            releasingSoonCount: 1
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
