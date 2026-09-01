//
//  ActionChip.swift
//  Pantopus
//
//  36pt filled chip with icon + label. Two variants: active (primary filled)
//  and inactive (neutral surface).
//

import SwiftUI

/// Pill-shaped action chip.
///
/// - Parameters:
///   - icon: Leading Pantopus icon.
///   - label: Trailing text.
///   - isActive: True = filled primary; false = neutral surface with border.
///   - action: Tap handler.
@MainActor
public struct ActionChip: View {
    private let icon: PantopusIcon
    private let label: String
    private let isActive: Bool
    private let action: () -> Void

    public init(
        icon: PantopusIcon,
        label: String,
        isActive: Bool = false,
        action: @escaping () -> Void = {}
    ) {
        self.icon = icon
        self.label = label
        self.isActive = isActive
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 16, color: foreground)
                Text(label)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(foreground)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 36)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(isActive ? .clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(isActive ? .primary : .sm)
        }
        .buttonStyle(.plain)
        .frame(minWidth: 44, minHeight: 44)
        .accessibilityLabel(label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private var foreground: Color {
        isActive ? Theme.Color.appTextInverse : Theme.Color.appText
    }

    private var background: Color {
        isActive ? Theme.Color.primary600 : Theme.Color.appSurface
    }
}

#Preview("Active + Inactive") {
    HStack {
        ActionChip(icon: .plusCircle, label: "Post gig", isActive: true)
        ActionChip(icon: .search, label: "Search")
    }
    .padding()
    .background(Theme.Color.appBg)
}
