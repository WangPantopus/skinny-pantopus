//
//  WaysToEarnRow.swift
//  Pantopus
//
//  A10.11 — the `Ways to earn` card: a 3-row launcher (Browse open tasks
//  / Refer a neighbor / Offer a service). The featured first row lifts
//  onto a `primary50` surface with a filled `primary600` icon tile; the
//  rest carry an accent-tinted glyph on a sunken tile. Identical in the
//  populated and empty frames — it's the engine that makes money.
//

import SwiftUI

/// The `Ways to earn` launcher card. Taps dispatch by `EarnWayKind` so
/// the host can route Browse → tasks, Refer / Offer → their surfaces.
struct EarnWaysToEarnCard: View {
    let items: [EarnWayToEarn]
    var onSelect: (EarnWayKind) -> Void = { _ in }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                WaysToEarnRow(item: item, isLast: index == items.count - 1) {
                    onSelect(item.kind)
                }
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

private struct WaysToEarnRow: View {
    let item: EarnWayToEarn
    let isLast: Bool
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                iconTile
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.title)
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(item.meta)
                        .font(.system(size: 11, weight: item.featured ? .semibold : .regular))
                        .foregroundStyle(item.featured ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(item.featured ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                if !isLast {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("earnWayToEarn-\(item.kind.rawValue)")
        .accessibilityLabel("\(item.title). \(item.meta)")
    }

    private var iconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                .fill(item.featured ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
            Icon(
                glyph,
                size: 17,
                strokeWidth: 2,
                color: item.featured ? .white : accentColor
            )
        }
        .frame(width: 36, height: 36)
        .accessibilityHidden(true)
    }

    private var glyph: PantopusIcon {
        switch item.kind {
        case .browse: .search
        case .refer: .gift
        case .offer: .briefcase
        }
    }

    private var accentColor: Color {
        switch item.accent {
        case .primary: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }
}

#Preview("Ways to earn") {
    EarnWaysToEarnCard(items: EarnSampleData.waysToEarn)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
