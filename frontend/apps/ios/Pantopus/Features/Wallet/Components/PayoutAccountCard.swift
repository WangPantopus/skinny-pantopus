//
//  PayoutAccountCard.swift
//  Pantopus
//
//  A10.10 · "Payout account" — the seller's live Stripe Connect (Express)
//  account, projected from `GET /api/payments/connect/account`. Stripe never
//  hands the platform a bank name or last-4 for an Express account, so this
//  card describes the account's capabilities and routes into Stripe's own
//  hosted dashboard (`POST /api/payments/connect/dashboard`) rather than
//  inventing bank details. While the account is still verifying, the same
//  slot resumes hosted onboarding.
//

import SwiftUI

struct PayoutAccountCard: View {
    let account: WalletPayoutAccount
    var onAction: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                iconTile
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.headline)
                        .font(.system(size: 12.5, weight: .bold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text(account.bodyText)
                        .font(.system(size: 11))
                        .foregroundStyle(
                            account.warn ? WalletPalette.amberDeep : Theme.Color.appTextSecondary
                        )
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s2)
                action
            }
            if !account.capabilities.isEmpty {
                capabilityGrid
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(account.warn ? Theme.Color.warningLight : Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("walletPayoutAccount")
    }

    /// RN `PayoutsTab`'s `detailsGrid` — one tile per Stripe capability so the
    /// account status reads as detail, not a single boolean.
    private var capabilityGrid: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(account.capabilities) { capability in
                VStack(alignment: .leading, spacing: 2) {
                    Text(capability.label)
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(capability.enabled ? "Enabled" : "Disabled")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(
                            capability.enabled ? Theme.Color.success : Theme.Color.appTextSecondary
                        )
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 10)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("walletPayoutCapability_\(capability.id)")
            }
        }
    }

    private var iconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(account.warn ? Theme.Color.warningBg : Theme.Color.successBg)
            Icon(
                account.warn ? .alertCircle : .landmark,
                size: 16,
                strokeWidth: 2.1,
                color: account.warn ? WalletPalette.amberDeep : Theme.Color.success
            )
        }
        .frame(width: 44, height: 30)
        .accessibilityHidden(true)
    }

    private var action: some View {
        Button(action: onAction) {
            HStack(spacing: Spacing.s1) {
                Icon(
                    .externalLink,
                    size: 12,
                    strokeWidth: 2.2,
                    color: account.warn ? Color.white : Theme.Color.primary600
                )
                Text(account.actionLabel)
                    .font(.system(size: 11.5, weight: account.warn ? .bold : .semibold))
                    .foregroundStyle(account.warn ? Color.white : Theme.Color.primary600)
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 30)
            .background(account.warn ? WalletPalette.amberDeep : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        // Mirrors the Android `wallet.openDashboardBtn` test tag — the only
        // reachable entry point to the seller's Stripe Express dashboard.
        .accessibilityIdentifier(account.warn ? "walletReverifyButton" : "wallet.openDashboardBtn")
    }
}

#Preview("PayoutAccountCard variants") {
    VStack(spacing: Spacing.s4) {
        PayoutAccountCard(
            account: WalletPayoutAccount(
                headline: "Stripe account connected",
                bodyText: "Payouts enabled · Card payments enabled",
                actionLabel: "Open Stripe Dashboard",
                warn: false,
                capabilities: [
                    WalletPayoutCapability(key: "cardPayments", label: "Card payments", enabled: true),
                    WalletPayoutCapability(key: "payouts", label: "Payouts", enabled: true)
                ]
            )
        )
        PayoutAccountCard(
            account: WalletPayoutAccount(
                headline: "Account verification in progress",
                bodyText: "Stripe is verifying your identity. This usually takes 1–2 business days.",
                actionLabel: "Continue setup",
                warn: true
            )
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
