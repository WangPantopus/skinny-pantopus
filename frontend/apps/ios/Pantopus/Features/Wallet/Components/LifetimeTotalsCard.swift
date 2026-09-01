//
//  LifetimeTotalsCard.swift
//  Pantopus
//
//  A10.10 · "Lifetime" — the two lifetime figures `GET /api/wallet` returns
//  alongside the balance (`Wallet.lifetime_received` /
//  `Wallet.lifetime_withdrawals`, backend/routes/wallet.js:61-67). RN renders
//  them beside the balance as "Total Earned" / "Withdrawn"
//  (`WalletTab.tsx:150-159`); the designed hero has no room for them, so they
//  land in their own split card directly under the hero. Values arrive
//  pre-formatted from the view-model — nothing is re-derived here.
//

import SwiftUI

struct LifetimeTotalsCard: View {
    let earned: String?
    let withdrawn: String?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            cell(
                icon: .trendingUp,
                overline: "Total earned",
                value: earned,
                identifier: "walletLifetimeEarned"
            )
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(width: 1)
                .padding(.horizontal, Spacing.s3)
            cell(
                icon: .landmark,
                overline: "Withdrawn",
                value: withdrawn,
                identifier: "walletLifetimeWithdrawn"
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityIdentifier("walletLifetimeTotals")
    }

    /// A missing figure renders an em-dash rather than a fabricated `$0.00`.
    private func cell(
        icon: PantopusIcon,
        overline: String,
        value: String?,
        identifier: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 10, strokeWidth: 2.5, color: Theme.Color.appTextMuted)
                Text(overline)
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.6)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Text(value ?? "—")
                .font(.system(size: 16, weight: .bold))
                .tracking(-0.25)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }
}

#Preview("LifetimeTotalsCard") {
    VStack(spacing: Spacing.s4) {
        LifetimeTotalsCard(earned: "$4,120.00", withdrawn: "$3,272.50")
        LifetimeTotalsCard(earned: "$0.00", withdrawn: nil)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
