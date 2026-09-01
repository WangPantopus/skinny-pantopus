//
//  PayoutMethodCard.swift
//  Pantopus
//
//  A10.10 — debit-card-shaped tile (44×30) with "CHASE" 8pt white text
//  + bank label + last4 mono + meta line. The default state shows a
//  green flash icon + "Instant payout · 1–3 minutes" and a text
//  `Manage` button; the warn state recolors the card amber, swaps the
//  meta line to "Verification expired …", and surfaces a dark-amber
//  `Re-verify` button.
//

import SwiftUI

struct PayoutMethodCard: View {
    let method: WalletPayoutMethod
    var onManage: () -> Void = {}
    var onReverify: () -> Void = {}

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            chaseTile
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: Spacing.s1 + 2) {
                    Text(method.bankLabel)
                        .font(.system(size: 12.5, weight: .bold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text("•••• \(method.last4)")
                        .font(.system(size: 12.5, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                HStack(spacing: Spacing.s1) {
                    Icon(
                        method.warn ? .alertCircle : .zap,
                        size: 11,
                        strokeWidth: 2.3,
                        color: method.warn ? WalletPalette.amberDeep : Theme.Color.home
                    )
                    Text(method.bodyText)
                        .font(.system(size: 11))
                        .foregroundStyle(method.warn ? WalletPalette.amberDeep : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            trailing
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(borderColor, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("walletPayoutMethod")
    }

    private var borderColor: Color {
        method.warn ? Theme.Color.warningLight : Theme.Color.appBorder
    }

    private var chaseTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(
                    method.warn
                        ? LinearGradient(
                            stops: [
                                .init(color: Theme.Color.warningBg, location: 0),
                                .init(color: Theme.Color.warningLight, location: 1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        : LinearGradient(
                            stops: [
                                .init(color: WalletPalette.chaseBlueDark, location: 0),
                                .init(color: WalletPalette.chaseBlueLight, location: 1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                )
            Text("CHASE")
                .font(.system(size: 8.5, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(method.warn ? WalletPalette.amberDeep : .white)
        }
        .frame(width: 44, height: 30)
        .accessibilityHidden(true)
    }

    @ViewBuilder private var trailing: some View {
        if method.warn {
            Button(action: onReverify) {
                Text("Re-verify")
                    .font(.system(size: 11.5, weight: .bold))
                    .tracking(-0.05)
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 10)
                    .frame(height: 30)
                    .background(WalletPalette.amberDeep)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("walletReverifyButton")
        } else {
            Button(action: onManage) {
                Text("Manage")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .padding(.horizontal, Spacing.s1)
                    .frame(minHeight: 30)
            }
            .buttonStyle(.plain)
            // Block 3C — "Manage" opens the seller's Stripe Express dashboard.
            .accessibilityIdentifier("wallet.openDashboardBtn")
        }
    }
}

#Preview("PayoutMethodCard variants") {
    VStack(spacing: Spacing.s4) {
        PayoutMethodCard(method: WalletSampleData.payoutMethodSample)
        PayoutMethodCard(method: WalletSampleData.payoutMethodHoldSample)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
