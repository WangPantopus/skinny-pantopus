//
//  EarningsRow.swift
//  Pantopus
//
//  A10.11 — the Recent-earnings card. Grouped-by-day rows, each a
//  category-tinted tile + description (+ amber "Pending" chip) + the
//  counterparty / time line + a trailing tabular-nums "+$amount" (green
//  cleared, amber on-hold). Also hosts `EarnLockedRow` — the gated
//  placeholder the empty new-earner frame shows in place of real
//  earnings (and reused by the gated Taxes row).
//

import SwiftUI

/// Recent-earnings card — grouped-by-day rows inside a single surface.
struct EarnEarningsList: View {
    let items: [EarnEarning]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index == 0 || items[index - 1].day != item.day {
                    Text(item.day)
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.7)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, 14)
                        .padding(.top, index == 0 ? Spacing.s2 : Spacing.s3)
                        .padding(.bottom, Spacing.s1)
                        .overlay(alignment: .top) {
                            if index != 0 {
                                Rectangle()
                                    .fill(Theme.Color.appBorderSubtle)
                                    .frame(height: 1)
                            }
                        }
                }
                EarnEarningRow(item: item, isLast: index == items.count - 1)
            }
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
}

private struct EarnEarningRow: View {
    let item: EarnEarning
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
                    if isPending {
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
                Text("+$\(item.amount)")
                    .font(.system(size: 13.5, weight: .bold))
                    .tracking(-0.2)
                    .monospacedDigit()
                    .foregroundStyle(isPending ? WalletPalette.amberDeep : Theme.Color.success)
                Text(isPending ? "On hold" : "Paid")
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
        .accessibilityIdentifier("earnEarningRow-\(item.id)")
    }

    private var isPending: Bool {
        if case .pending = item.status { return true }
        return false
    }

    private var categoryTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                .fill(EarnCategoryPalette.background(for: item.category))
            Icon(
                EarnCategoryPalette.icon(for: item.category),
                size: 16,
                strokeWidth: 2,
                color: EarnCategoryPalette.foreground(for: item.category)
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

    private var accessibilityText: String {
        "\(item.description). \(subtext). plus $\(item.amount). \(isPending ? "On hold" : "Paid")."
    }
}

/// Gated placeholder shown in the empty new-earner frame in place of a
/// real Recent-earnings list (and reused for the gated Taxes row). A
/// muted lock tile + headline + subcopy, non-interactive.
struct EarnLockedRow: View {
    let title: String
    let subcopy: String
    var identifier: String = "earnLockedRow"

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                Icon(.lock, size: 16, strokeWidth: 2, color: Theme.Color.appTextMuted)
            }
            .frame(width: 34, height: 34)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(subcopy)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
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
        .accessibilityLabel("\(title). \(subcopy)")
        .accessibilityIdentifier(identifier)
    }
}

/// Category-tinted palette for earnings rows — the money-in subset of
/// the Wallet activity palette, reusing the same tokens so the two
/// surfaces read as siblings.
enum EarnCategoryPalette {
    static func background(for category: EarnCategory?) -> Color {
        switch category {
        case .cleaning: Theme.Color.homeBg
        case .childCare: Theme.Color.warmAmberBg
        case .handyman: Theme.Color.handyman.opacity(0.18)
        case .petCare: Theme.Color.errorLight
        case nil: Theme.Color.appSurfaceSunken
        }
    }

    static func foreground(for category: EarnCategory?) -> Color {
        switch category {
        case .cleaning: Theme.Color.homeDark
        case .childCare: Theme.Color.warmAmber
        case .handyman: Theme.Color.handyman
        case .petCare: Theme.Color.error
        case nil: Theme.Color.appTextSecondary
        }
    }

    static func icon(for category: EarnCategory?) -> PantopusIcon {
        switch category {
        case .cleaning: .sparkles
        case .childCare: .baby
        case .handyman: .wrench
        case .petCare: .dog
        case nil: .mailOpen
        }
    }
}

#Preview("Recent earnings") {
    VStack(spacing: Spacing.s4) {
        EarnEarningsList(items: EarnSampleData.populated.earnings)
        EarnLockedRow(
            title: "No earnings yet",
            subcopy: "Your paid tasks land here — your first one unlocks cash out."
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
