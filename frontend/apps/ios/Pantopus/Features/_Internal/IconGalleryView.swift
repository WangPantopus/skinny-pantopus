//
//  IconGalleryView.swift
//  Pantopus
//
//  Debug-only grid of every `PantopusIcon`. Reachable from the token
//  gallery; no production navigation entry.
//

#if DEBUG

import SwiftUI

/// Grid rendering of every `PantopusIcon` with its raw Lucide name beneath.
public struct IconGalleryView: View {
    private let columns: [GridItem] = Array(
        repeating: GridItem(.flexible(), spacing: Spacing.s3),
        count: 4
    )

    public init() {}

    public var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: Spacing.s4) {
                ForEach(PantopusIcon.allCases, id: \.rawValue) { icon in
                    VStack(spacing: Spacing.s2) {
                        Icon(icon, size: 28, color: Theme.Color.appText)
                            .frame(width: 48, height: 48)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                        Text(icon.rawValue)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(icon.rawValue)
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Icons")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        IconGalleryView()
    }
}

#endif
