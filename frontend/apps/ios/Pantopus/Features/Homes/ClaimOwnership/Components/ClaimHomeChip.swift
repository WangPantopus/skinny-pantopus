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
    @ScaledMetric(relativeTo: .caption2) private var overlineSize = PantopusTextStyle.overline.size

    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.home, size: 11, color: Theme.Color.home)
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
