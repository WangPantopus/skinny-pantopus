//
//  QuickActionChip.swift
//  Pantopus
//
//  A13.15 Disambiguate — 44pt "Who is this for?" shortcut chip. The primary
//  variant (sky) backs "This is me"; the neutral variant backs "Route to…".
//  Mirrors the Android `QuickActionChip`.
//

import SwiftUI

/// Full-width-sharing shortcut chip rendered above the candidate list.
@MainActor
struct QuickActionChip: View {
    let icon: PantopusIcon
    let label: String
    /// `true` → sky-tinted primary chip; `false` → neutral surface chip.
    let isPrimary: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button(
            action: { action() },
            label: {
                HStack(spacing: Spacing.s1) {
                    Icon(icon, size: 15, color: foreground)
                    Text(label)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(foreground)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(border, lineWidth: 1)
                )
            }
        )
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var foreground: Color {
        isPrimary ? Theme.Color.primary700 : Theme.Color.appTextStrong
    }

    private var background: Color {
        isPrimary ? Theme.Color.primary50 : Theme.Color.appSurface
    }

    private var border: Color {
        isPrimary ? Theme.Color.primary200 : Theme.Color.appBorder
    }
}

#Preview("Quick action chips") {
    HStack(spacing: Spacing.s2) {
        QuickActionChip(icon: .userCheck, label: "This is me", isPrimary: true) {}
        QuickActionChip(icon: .forward, label: "Route to…", isPrimary: false) {}
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
