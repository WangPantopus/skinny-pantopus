//
//  ActivityRow.swift
//  Pantopus
//
//  A10.10 — single Recent-activity row. 34pt category-tinted icon
//  tile + description + counterparty/date + trailing amount + status
//  label. Composed inside an `ActivityList` card with grouped-by-day
//  headers.
//

import SwiftUI

/// Single recent-activity row.
struct WalletActivityRow: View {
    let item: WalletActivityItem
    let isLast: Bool

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            categoryTile
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: Spacing.s1 + 2) {
                    Text(item.description)
                        .font(.system(size: 12.5, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if case .pending = item.status {
                        pendingChip
                    }
                    Spacer(minLength: Spacing.s0)
                }
                Text(subtext)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            VStack(alignment: .trailing, spacing: 1) {
                Text(amountText)
                    .font(.system(size: 13.5, weight: .bold))
                    .tracking(-0.2)
                    .monospacedDigit()
                    .foregroundStyle(amountColor)
                Text(trailingLabel)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .overlay(alignment: .bottom) {
            if !isLast {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
                    .padding(.leading, 14)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("walletActivityRow-\(item.id)")
    }

    private var categoryTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                .fill(ActivityCategoryPalette.background(for: item.category))
            Icon(
                ActivityCategoryPalette.icon(for: item.category),
                size: 16,
                strokeWidth: 2,
                color: ActivityCategoryPalette.foreground(for: item.category)
            )
        }
        .frame(width: 34, height: 34)
        .accessibilityHidden(true)
    }

    private var pendingChip: some View {
        Text("Pending")
            .font(.system(size: 9, weight: .bold))
            .tracking(0.4)
            .textCase(.uppercase)
            .foregroundStyle(WalletPalette.amberDeep)
            .padding(.horizontal, Spacing.s1 + 2)
            .padding(.vertical, 1)
            .background(Theme.Color.warmAmberBg)
            .clipShape(Capsule())
    }

    private var subtext: String {
        if case let .pending(clears) = item.status {
            return "\(item.counterparty) · \(item.dateLabel) · clears \(clears)"
        }
        return "\(item.counterparty) · \(item.dateLabel)"
    }

    private var amountText: String {
        let sign = item.direction == .out ? "−" : "+"
        return "\(sign)$\(item.amount)"
    }

    private var amountColor: Color {
        if item.direction == .out { return Theme.Color.appTextStrong }
        if case .pending = item.status { return WalletPalette.amberDeep }
        return Theme.Color.success
    }

    private var trailingLabel: String {
        if item.isFee { return "Fee" }
        switch (item.direction, item.status) {
        case (.out, _): return "Payout"
        case (.in, .pending): return "On hold"
        case (.in, _): return "Cleared"
        }
    }

    private var accessibilityText: String {
        let amountSpoken = amountText
            .replacingOccurrences(of: "−", with: "minus ")
            .replacingOccurrences(of: "+", with: "plus ")
        return "\(item.description). \(subtext). \(amountSpoken). \(trailingLabel)."
    }
}

/// Category-tinted palette for activity rows. Backgrounds reuse
/// existing tokens where they exist; rows whose design tints diverge
/// from the canonical palette get a tone-tinted background derived
/// from the category accent's `opacity(0.18)`.
enum ActivityCategoryPalette {
    static func background(for category: WalletActivityCategory) -> Color {
        switch category {
        case .cleaning: Theme.Color.homeBg
        case .childCare: Theme.Color.warmAmberBg
        case .handyman: Theme.Color.handyman.opacity(0.18)
        case .petCare: Theme.Color.errorLight
        case .bank: Theme.Color.personalBg
        case .fee: Theme.Color.appSurfaceSunken
        }
    }

    static func foreground(for category: WalletActivityCategory) -> Color {
        switch category {
        case .cleaning: Theme.Color.homeDark
        case .childCare: Theme.Color.warmAmber
        case .handyman: Theme.Color.handyman
        case .petCare: Theme.Color.error
        case .bank: Theme.Color.business
        case .fee: Theme.Color.appTextSecondary
        }
    }

    static func icon(for category: WalletActivityCategory) -> PantopusIcon {
        switch category {
        case .cleaning: .sparkles
        case .childCare: .baby
        case .handyman: .wrench
        case .petCare: .dog
        case .bank: .building2
        case .fee: .receipt
        }
    }
}

#Preview("WalletActivityRow variants") {
    VStack(spacing: Spacing.s0) {
        WalletActivityRow(
            item: WalletSampleData.populated.activity[0],
            isLast: false
        )
        WalletActivityRow(
            item: WalletSampleData.populated.activity[1],
            isLast: false
        )
        WalletActivityRow(
            item: WalletSampleData.populated.activity[3],
            isLast: false
        )
        WalletActivityRow(
            item: WalletSampleData.populated.activity[6],
            isLast: true
        )
    }
    .background(Theme.Color.appSurface)
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
