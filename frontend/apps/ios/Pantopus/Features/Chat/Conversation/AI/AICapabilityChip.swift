//
//  AICapabilityChip.swift
//  Pantopus
//
//  A15.3 — one capability chip in the AI welcome card grid. Tapping it
//  sends the capability as the thread's first message.
//

import SwiftUI

/// A tappable capability chip ("Price a task", "Summarize mail", …) shown
/// in the AI welcome card. Renders an icon in the primary accent plus a
/// label; the whole chip is one ≥44pt tap target.
public struct AICapabilityChip: View {
    private let chip: ChatPromptChip
    private let onTap: @MainActor () -> Void

    public init(chip: ChatPromptChip, onTap: @escaping @MainActor () -> Void) {
        self.chip = chip
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                // A15.3 `.aw-cap` — capability icon in the primary accent.
                Icon(chip.icon, size: 13, strokeWidth: 2, color: Theme.Color.primary600)
                Text(chip.label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(chip.label)
        .accessibilityIdentifier("chatAICapability_\(chip.id)")
    }
}

#Preview {
    VStack {
        AICapabilityChip(chip: ChatPromptChip(id: "price", label: "Price a task", icon: .hammer)) {}
        AICapabilityChip(chip: ChatPromptChip(id: "mail", label: "Summarize mail", icon: .mailbox)) {}
    }
    .padding()
    .background(Theme.Color.appSurfaceSunken)
}
