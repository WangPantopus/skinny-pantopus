//
//  InsightTiles.swift
//  Pantopus
//
//  A10.7 — the owner's "This week" insight strip: a bordered card with a
//  header row ("This week" + an "Insights" link) over equal-width Views /
//  Saves / Contacts tiles, each a value with an optional week-over-week
//  delta pill. Sample-driven in B3.2 (no analytics backend); the "Insights"
//  link is wired to the host's deep-dive.
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`
//  (InsightsStrip). The design's sky `primary` accent renders as business
//  violet here, matching the A10.6 render (B3.1).
//

import SwiftUI

@MainActor
struct InsightTiles: View {
    let insights: [OwnerInsightTile]
    let onOpenInsights: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            tiles
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("businessOwner.insights")
    }

    private var header: some View {
        HStack {
            Text("This week")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.3)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Button { onOpenInsights() } label: {
                HStack(spacing: 3) {
                    Text("Insights")
                        .font(.system(size: 11.5, weight: .semibold))
                    Icon(.chevronRight, size: 12, color: Theme.Color.business)
                }
                .foregroundStyle(Theme.Color.business)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessOwner.openInsights")
        }
        .padding(.horizontal, 14)
        .padding(.top, 9)
        .padding(.bottom, 7)
    }

    private var tiles: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(insights.enumerated()), id: \.element.id) { index, tile in
                if index > 0 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
                metric(tile)
                    .frame(maxWidth: .infinity)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func metric(_ tile: OwnerInsightTile) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: Spacing.s1) {
                Icon(tile.icon, size: 13, strokeWidth: 2, color: Theme.Color.business)
                Text(tile.value)
                    .font(.system(size: 15, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(Theme.Color.appText)
                    .monospacedDigit()
            }
            HStack(spacing: Spacing.s1) {
                Text(tile.label.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.3)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let delta = tile.delta {
                    HStack(spacing: Spacing.s0) {
                        Icon(.arrowUp, size: 9, strokeWidth: 3, color: Theme.Color.success)
                        Text(delta)
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundStyle(Theme.Color.success)
                    }
                    .accessibilityLabel("up \(delta)")
                }
            }
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 11)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(metricLabel(tile))
    }

    private func metricLabel(_ tile: OwnerInsightTile) -> String {
        var label = "\(tile.value) \(tile.label)"
        if let delta = tile.delta { label += ", up \(delta)" }
        return label
    }
}

#Preview("InsightTiles") {
    InsightTiles(
        insights: [
            OwnerInsightTile(id: "views", icon: .eye, value: "1.2k", label: "Views", delta: "18%"),
            OwnerInsightTile(id: "saves", icon: .bookmark, value: "84", label: "Saves", delta: "6%"),
            OwnerInsightTile(id: "contacts", icon: .messageCircle, value: "23", label: "Contacts")
        ]
    ) {}
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
