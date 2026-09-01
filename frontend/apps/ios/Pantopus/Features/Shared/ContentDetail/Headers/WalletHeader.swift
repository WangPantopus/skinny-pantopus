//
//  WalletHeader.swift
//  Pantopus
//
//  `wallet_header` / `earnings_wallet` hero for the Content Detail shell. A
//  sky-gradient balance card: available-to-withdraw amount, a glassy
//  pending / period split panel, and an optional payout-hold notice.
//  Replaces the former `WalletHeroStub` NotYetAvailable placeholder.
//  Mirrors the A10.10 Wallet `BalanceHero`.
//

import SwiftUI

/// One metric in the wallet hero's split panel (e.g. Pending, This month).
public struct WalletHeaderMetric: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let value: String
    public let caption: String?

    public init(
        id: String,
        icon: PantopusIcon,
        label: String,
        value: String,
        caption: String? = nil
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.caption = caption
    }
}

/// Warning notice rendered inside the wallet hero when payouts are paused.
public struct WalletHeaderHold: Sendable, Hashable {
    public let title: String
    public let subtitle: String

    public init(title: String, subtitle: String) {
        self.title = title
        self.subtitle = subtitle
    }
}

/// Wallet balance hero. The available balance sits on a sky-gradient card
/// with a glassy split panel beneath it; an optional `hold` notice warns
/// when withdrawals are paused. `amount` is passed pre-formatted (e.g.
/// "847.50") so the caller owns currency / locale formatting.
@MainActor
public struct WalletHeader: View {
    private let availableLabel: String
    private let currencySymbol: String
    private let amount: String
    private let currencyCode: String
    private let metrics: [WalletHeaderMetric]
    private let hold: WalletHeaderHold?

    public init(
        availableLabel: String = "Available to withdraw",
        currencySymbol: String = "$",
        amount: String,
        currencyCode: String = "USD",
        metrics: [WalletHeaderMetric] = [],
        hold: WalletHeaderHold? = nil
    ) {
        self.availableLabel = availableLabel
        self.currencySymbol = currencySymbol
        self.amount = amount
        self.currencyCode = currencyCode
        self.metrics = metrics
        self.hold = hold
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            topRow
            balanceRow
            if !metrics.isEmpty {
                splitPanel
            }
            if let hold {
                holdNotice(hold)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(heroGradient)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .pantopusShadow(.primary)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("contentDetail.walletHeader")
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(availableLabel), \(currencySymbol)\(amount) \(currencyCode)")
    }

    private var heroGradient: LinearGradient {
        LinearGradient(
            colors: [Theme.Color.primary800, Theme.Color.primary700, Theme.Color.primary600],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var topRow: some View {
        HStack {
            Text(availableLabel.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.primary200)
            Spacer()
            HStack(spacing: Spacing.s1) {
                Icon(.shieldCheck, size: 11, color: Theme.Color.appTextInverse)
                Text(currencyCode)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(Color.white.opacity(0.16))
            .clipShape(Capsule())
        }
    }

    private var balanceRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
            Text(currencySymbol)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.primary200)
            Text(amount)
                .font(.system(size: 44, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }

    private var splitPanel: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ForEach(shownMetrics) { metric in
                metricCell(metric)
                if metric.id != shownMetrics.last?.id {
                    Rectangle()
                        .fill(Color.white.opacity(0.16))
                        .frame(width: 1)
                }
            }
        }
        .padding(Spacing.s3)
        .background(Color.white.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
    }

    private var shownMetrics: [WalletHeaderMetric] {
        Array(metrics.prefix(2))
    }

    private func metricCell(_ metric: WalletHeaderMetric) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Spacing.s1) {
                Icon(metric.icon, size: 10, color: Theme.Color.primary200)
                Text(metric.label.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.primary200)
            }
            Text(metric.value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
            if let caption = metric.caption {
                Text(caption)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.primary200)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func holdNotice(_ hold: WalletHeaderHold) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertTriangle, size: 14, strokeWidth: 2.4, color: Theme.Color.warningLight)
            VStack(alignment: .leading, spacing: 2) {
                Text(hold.title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                Text(hold.subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.warningLight)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.warningLight.opacity(0.45), lineWidth: 1)
        )
    }
}

#Preview("Wallet header") {
    ScrollView {
        VStack(spacing: Spacing.s4) {
            WalletHeader(
                amount: "847.50",
                metrics: [
                    WalletHeaderMetric(
                        id: "pending",
                        icon: .clock,
                        label: "Pending",
                        value: "$186.00",
                        caption: "3 tasks · clears Dec 4"
                    ),
                    WalletHeaderMetric(
                        id: "month",
                        icon: .trendingUp,
                        label: "This month",
                        value: "$1,284.50",
                        caption: "8 tasks"
                    )
                ]
            )
            WalletHeader(
                amount: "847.50",
                metrics: [
                    WalletHeaderMetric(id: "pending", icon: .clock, label: "Pending", value: "$186.00")
                ],
                hold: WalletHeaderHold(
                    title: "Withdrawals paused",
                    subtitle: "Re-verify your bank to release funds."
                )
            )
        }
        .padding(.vertical, Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
