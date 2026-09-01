//
//  HoldBanner.swift
//  Pantopus
//
//  A10.10 — amber "bank verification expired" card pinned above the
//  BalanceHero in the hold variant. Shield-alert disc + bold headline
//  + 3-line reassurance body ("earnings keep landing — they're safe").
//

import SwiftUI

struct HoldBanner: View {
    let headline: String
    let bodyText: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                    .fill(Theme.Color.warning)
                Icon(.shieldAlert, size: 17, strokeWidth: 2.3, color: .white)
            }
            .frame(width: 32, height: 32)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(headline)
                    .font(.system(size: 13.5, weight: .bold))
                    .tracking(-0.15)
                    .foregroundStyle(WalletPalette.amberDeep)
                Text(bodyText)
                    .font(.system(size: 11.5))
                    .foregroundStyle(WalletPalette.amberDeep.opacity(0.92))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.warmAmberBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(headline). \(bodyText)")
        .accessibilityIdentifier("walletHoldBanner")
    }
}

#Preview("HoldBanner") {
    HoldBanner(
        headline: "Bank verification expired",
        bodyText: "Chase asks us to re-confirm your account every 12 months. A 2-minute "
            + "micro-deposit check unlocks payouts again. Earnings keep landing in "
            + "your wallet — they're safe."
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
