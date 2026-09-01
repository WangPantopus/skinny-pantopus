//
//  PayoutSettingsCard.swift
//  Pantopus
//
//  A10.11 — payout settings. Two stacked rows: the linked Chase
//  debit-card tile + "Manage", and the "Auto cash out · Every Friday ·
//  cleared balance" recurring-payout row with a green toggle. The empty
//  new-earner frame swaps this for `EarnPayoutNudge` — a dashed "Add a
//  payout method" card with an "Add bank" button. Real Stripe Connect
//  wiring is out of scope; `Manage` / `Add bank` deep-link to the
//  existing Payments surface.
//

import SwiftUI

/// Linked-payout settings card — bank method + auto-cash-out toggle.
struct EarnPayoutSettingsCard: View {
    let method: EarnPayoutMethod
    let autoCashOut: EarnAutoCashOut
    var onManage: () -> Void = {}

    var body: some View {
        VStack(spacing: Spacing.s0) {
            methodRow
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, 14)
                }
            autoCashOutRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
    }

    private var methodRow: some View {
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
                    Icon(.zap, size: 11, strokeWidth: 2.3, color: Theme.Color.home)
                    Text(method.bodyText)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onManage) {
                Text("Manage")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .padding(.horizontal, Spacing.s1)
                    .frame(minHeight: 30)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("earnManagePayoutButton")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
    }

    private var autoCashOutRow: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                Icon(.arrowsRepeat, size: 16, strokeWidth: 2, color: Theme.Color.appTextStrong)
            }
            .frame(width: 34, height: 34)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(autoCashOut.title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                Text(autoCashOut.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            EarnToggle(isOn: autoCashOut.isOn)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(autoCashOut.title). \(autoCashOut.detail). \(autoCashOut.isOn ? "On" : "Off")")
    }

    private var chaseTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(
                    LinearGradient(
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
                .foregroundStyle(.white)
        }
        .frame(width: 44, height: 30)
        .accessibilityHidden(true)
    }
}

/// Decorative recurring-payout toggle. The real auto-cash-out switch
/// lands with the Connect integration; here it reflects the seeded
/// state only (non-interactive).
private struct EarnToggle: View {
    let isOn: Bool

    var body: some View {
        Capsule()
            .fill(isOn ? Theme.Color.success : Theme.Color.appBorder)
            .frame(width: 38, height: 23)
            .overlay(alignment: isOn ? .trailing : .leading) {
                Circle()
                    .fill(.white)
                    .frame(width: 19, height: 19)
                    .pantopusShadow(.sm)
                    .padding(2)
            }
            .accessibilityHidden(true)
    }
}

/// Empty new-earner nudge — dashed "Add a payout method" card with an
/// "Add bank" button. Shown in place of `EarnPayoutSettingsCard`.
struct EarnPayoutNudge: View {
    var onAddBank: () -> Void = {}

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                Icon(.building2, size: 17, strokeWidth: 2, color: Theme.Color.appTextSecondary)
            }
            .frame(width: 34, height: 34)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text("Add a payout method")
                    .font(.system(size: 12.5, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                Text("Link a bank so you can cash out later")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onAddBank) {
                Text("Add bank")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 30)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("earnAddBankButton")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Add a payout method. Link a bank so you can cash out later.")
    }
}

#Preview("Payout settings") {
    VStack(spacing: Spacing.s4) {
        if let method = EarnSampleData.populated.payoutMethod,
           let autoCashOut = EarnSampleData.populated.autoCashOut {
            EarnPayoutSettingsCard(method: method, autoCashOut: autoCashOut)
        }
        EarnPayoutNudge()
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
