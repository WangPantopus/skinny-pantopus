//
//  FallbackRow.swift
//  Pantopus
//
//  A13.15 Disambiguate — one row of the unclear-frame "Or resolve another way"
//  card: a tinted icon tile + title + sub + chevron. Destructive rows (Mark as
//  junk) use an error-tinted tile. Mirrors the Android `FallbackRow`.
//

import SwiftUI

/// A single fallback-resolution row inside the unclear-frame card.
@MainActor
struct FallbackRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    /// Error-tinted icon tile for destructive rows (Mark as junk).
    var isDestructive: Bool = false
    /// Hairline divider below the row (omitted on the last row).
    var showsDivider: Bool = true
    var identifier: String?
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(
            action: { onTap() },
            label: {
                VStack(spacing: Spacing.s0) {
                    HStack(spacing: Spacing.s3) {
                        iconTile
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Text(subtitle)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: Spacing.s2)
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .padding(Spacing.s3)
                    if showsDivider {
                        Rectangle()
                            .fill(Theme.Color.appBorderSubtle)
                            .frame(height: 1)
                    }
                }
            }
        )
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(subtitle)")
        .modifier(OptionalIdentifier(identifier: identifier))
    }

    private var iconTile: some View {
        Icon(icon, size: 17, color: isDestructive ? Theme.Color.error : Theme.Color.appTextStrong)
            .frame(width: 36, height: 36)
            .background(isDestructive ? Theme.Color.errorBg : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

/// Applies an `accessibilityIdentifier` only when one is provided.
private struct OptionalIdentifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("Fallback rows") {
    VStack(spacing: Spacing.s0) {
        FallbackRow(
            icon: .scanLine,
            title: "Re-scan envelope",
            subtitle: "Hold under brighter light. Most-used fix."
        ) {}
        FallbackRow(
            icon: .trash2,
            title: "Mark as junk",
            subtitle: "Skip routing. Sender added to junk filter.",
            isDestructive: true,
            showsDivider: false
        ) {}
    }
    .background(Theme.Color.appSurface)
    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
