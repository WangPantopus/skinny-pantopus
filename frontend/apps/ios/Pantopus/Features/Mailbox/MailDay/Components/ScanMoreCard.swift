//
//  ScanMoreCard.swift
//  Pantopus
//
//  A13.16 — mid-day "scan more" prompt above the Needs-a-call section.
//  Light primary fill, 1.5pt dashed border, leading 40pt scanner disc,
//  trailing camera glyph. Tapping it opens the scanner.
//

import SwiftUI

struct ScanMoreCard: View {
    let lastScanLabel: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.primary600)
                        .frame(width: 40, height: 40)
                        .shadow(color: Theme.Color.primary600.opacity(0.25), radius: 5, x: 0, y: 4)
                    Icon(.scanLine, size: 18, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Scan more mail")
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                    Text("Last scan \(lastScanLabel)")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.primary700.opacity(0.75))
                }
                Spacer(minLength: Spacing.s0)
                Icon(.camera, size: 18, strokeWidth: 2.2, color: Theme.Color.primary600)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.primary50)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        Theme.Color.primary300,
                        style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Scan more mail. Last scan \(lastScanLabel).")
        .accessibilityIdentifier("mailDayScanMore")
    }
}
