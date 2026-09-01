//
//  PreviewBar.swift
//  Pantopus
//
//  A10.7 — the dark bar pinned above the public render while the owner is
//  "previewing as a neighbor". Mirrors the design's dark `PreviewBar` slot:
//  an eye glyph, a two-line label, and an Exit button that pops back to the
//  owner / edit frame. Uses `appText` for the dark chrome, the same token
//  `StealthBanner` uses for its near-black slate.
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`
//  (PreviewBar).
//

import SwiftUI

@MainActor
struct PreviewBar: View {
    let onExit: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.eye, size: 15, color: Theme.Color.appTextInverse)
            VStack(alignment: .leading, spacing: 1) {
                Text("Previewing as a neighbor")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appTextInverse)
                Text("This is exactly what the public sees")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextInverse.opacity(0.65))
            }
            Spacer(minLength: Spacing.s2)
            Button { onExit() } label: {
                Text("Exit")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(
                        Theme.Color.appTextInverse.opacity(0.16),
                        in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessOwner.exitPreview")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appText)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Previewing as a neighbor. This is exactly what the public sees.")
        .accessibilityIdentifier("businessOwner.previewBar")
    }
}

#Preview("PreviewBar") {
    VStack(spacing: Spacing.s0) {
        PreviewBar {}
        Spacer()
    }
    .background(Theme.Color.appBg)
}
