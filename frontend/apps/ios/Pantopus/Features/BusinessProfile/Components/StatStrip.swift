//
//  StatStrip.swift
//  Pantopus
//
//  A10.6 — the full-width stat band under the business banner: rating ·
//  jobs done · followers / "New". Each cell is value (with an optional
//  leading star) over a small uppercase label, divided by hairlines.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (StatStrip).
//

import SwiftUI

@MainActor
struct StatStrip: View {
    let stats: [BusinessStatCell]

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                if index > 0 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
                cell(stat)
                    .frame(maxWidth: .infinity)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("businessProfile.stats")
    }

    private func cell(_ stat: BusinessStatCell) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 3) {
                if stat.leadingStar {
                    StarShape()
                        .fill(valueColor(stat.tint))
                        .frame(width: 12, height: 12)
                }
                Text(stat.value)
                    .font(.system(size: 15, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(valueColor(stat.tint))
                    .monospacedDigit()
            }
            Text(stat.label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stat.value) \(stat.label)")
    }

    private func valueColor(_ tint: BusinessStatTint) -> Color {
        switch tint {
        case .standard: Theme.Color.appText
        case .star: Theme.Color.star
        case .business: Theme.Color.business
        case .muted: Theme.Color.appTextMuted
        }
    }
}

#Preview("StatStrip") {
    VStack(spacing: Spacing.s4) {
        StatStrip(stats: [
            BusinessStatCell(id: "rating", value: "4.9", label: "128 reviews", leadingStar: true, tint: .star),
            BusinessStatCell(id: "jobs", value: "340", label: "Jobs done"),
            BusinessStatCell(id: "response", value: "~20m", label: "Response")
        ])
        StatStrip(stats: [
            BusinessStatCell(id: "rating", value: "—", label: "No reviews yet", leadingStar: true, tint: .muted),
            BusinessStatCell(id: "jobs", value: "0", label: "Jobs done"),
            BusinessStatCell(id: "new", value: "New", label: "On Pantopus", tint: .business)
        ])
    }
    .background(Theme.Color.appBg)
}
