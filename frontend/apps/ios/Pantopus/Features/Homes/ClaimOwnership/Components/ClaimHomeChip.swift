//
//  ClaimHomeChip.swift
//  Pantopus
//
//  Home identity chip ("Home · 412 Elm St") shown at the top of the
//  claim-ownership wizard steps. Shared by the Start and Evidence steps.
//

import SwiftUI

/// Green home-pillar pill identifying the home being claimed.
struct ClaimHomeChip: View {
    let label: String

    var body: some View {
        // The Home is the step's context: its capitals stop growing at the first accessibility size instead of
        // filling a phone's screen at the largest, and a long press shows them large.
        ClaimHomeChipPill(label: label)
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .accessibilityShowsLargeContentViewer {
                Icon(.home, size: 22)
                Text("Home · \(label)")
            }
    }
}

/// The pill, sized for the text size it's given.
private struct ClaimHomeChipPill: View {
    @ScaledMetric(relativeTo: .caption2) private var overlineSize = PantopusTextStyle.overline.size
    @ScaledMetric(relativeTo: .caption2) private var iconSize = 11.0

    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.home, size: iconSize, color: Theme.Color.home)
            Text("Home · \(label)", style: .overline, font: .system(size: overlineSize, weight: .semibold))
                .fixedSize(horizontal: false, vertical: true)
                .foregroundStyle(Theme.Color.home)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.homeBg)
        // Keep the pill at one line without clipping the corners of wrapped home labels.
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Home, \(label)")
        .accessibilityIdentifier("claimOwnershipHomeChip")
    }
}

#Preview {
    ClaimHomeChip(label: "412 Elm St")
        .padding()
        .background(Theme.Color.appBg)
}
