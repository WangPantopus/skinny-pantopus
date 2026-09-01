//
//  HeldList.swift
//  Pantopus
//
//  A14.8 active-variant "Currently held" ledger. A vertical list of
//  icon-tile + label + sub + count rows separated by hairline dividers.
//  Mirrors the `HeldList` block in `vacation-frames.jsx`.
//

import SwiftUI

@MainActor
struct HeldList: View {
    let items: [VacationHeldItem]

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HeldRow(item: item)
                if index < items.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, Spacing.s4)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("vacationHeldList")
    }
}

private struct HeldRow: View {
    let item: VacationHeldItem

    var body: some View {
        HStack(spacing: Spacing.s3) {
            iconTile
            VStack(alignment: .leading, spacing: 1) {
                Text(item.label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text(item.sub)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Text("\(item.count)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .monospacedDigit()
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.label), \(item.count), \(item.sub)")
        .accessibilityIdentifier("vacationHeldRow.\(item.id)")
    }

    private var iconTile: some View {
        Icon(item.icon.glyph, size: 16, strokeWidth: 2, color: Theme.Color.appTextStrong)
            .frame(width: 32, height: 32)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

private extension VacationHeldItem.Icon {
    var glyph: PantopusIcon {
        switch self {
        case .packages: .package
        case .mail: .mail
        case .forwarded: .arrowUpRight
        case .civic: .alertTriangle
        }
    }
}

#Preview("HeldList · active") {
    HeldList(items: VacationHoldSampleData.activeHold.heldItems)
        .padding(Spacing.s3)
        .background(Theme.Color.appBg)
}
