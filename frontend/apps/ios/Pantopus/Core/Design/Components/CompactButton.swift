//
//  CompactButton.swift
//  Pantopus
//
//  Two compact button geometries used inside list rows:
//
//  - `.footer` (34pt height, `Radii.lg`, full-width-of-its-flex-cell) —
//    the in-card row footer used by My bids / My tasks / Offers /
//    Review claims rows.
//  - `.inlineAction` (28pt secondary / 30pt primary) — the small pill
//    actions that sit next to a Connections row's metadata (Accept,
//    Ignore) or anywhere a 44pt PrimaryButton is too tall to belong in a
//    row.
//
//  Both share the variant palette of `PantopusButton` (primary, ghost,
//  destructive) but have their own type because feature code wants to
//  request a *size*, not a substituted style. Token-only.
//

import SwiftUI

/// Geometry variant for `CompactButton`.
public enum CompactButtonSize: Sendable, Hashable {
    /// 34pt height — in-card row footer button.
    case footer
    /// 30pt primary / 28pt secondary — inline row-trailing pill.
    case inlineAction

    public var height: CGFloat {
        switch self {
        case .footer: 34
        case .inlineAction: 30
        }
    }

    public var inlineSecondaryHeight: CGFloat {
        28
    }
}

/// Compact in-row action button.
@MainActor
public struct CompactButton: View {
    private let title: String
    private let icon: PantopusIcon?
    private let variant: CompactButtonVariant
    private let size: CompactButtonSize
    private let action: () -> Void

    public init(
        title: String,
        icon: PantopusIcon? = nil,
        variant: CompactButtonVariant = .primary,
        size: CompactButtonSize = .footer,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.variant = variant
        self.size = size
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                if let icon {
                    Icon(icon, size: 13, color: foreground)
                }
                Text(title)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(foreground)
            }
            .padding(.horizontal, paddingX)
            .frame(maxWidth: .infinity)
            .frame(height: resolvedHeight)
            .background(background)
            .overlay(border)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Resolved geometry / palette

    private var resolvedHeight: CGFloat {
        switch (size, variant) {
        case (.inlineAction, .ghost):
            // Secondary inline pill (Connections "Ignore") is 28pt.
            size.inlineSecondaryHeight
        default:
            size.height
        }
    }

    private var paddingX: CGFloat {
        switch size {
        case .footer: Spacing.s3
        case .inlineAction: Spacing.s3
        }
    }

    private var cornerRadius: CGFloat {
        switch size {
        case .footer: Radii.md
        case .inlineAction: Radii.md
        }
    }

    private var background: Color {
        switch variant {
        case .primary: Theme.Color.primary600
        case .ghost: Theme.Color.appSurface
        case .destructive: Theme.Color.appSurface
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: Theme.Color.appTextInverse
        case .ghost: Theme.Color.appTextStrong
        case .destructive: Theme.Color.error
        }
    }

    @ViewBuilder private var border: some View {
        switch variant {
        case .ghost, .destructive:
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        case .primary:
            EmptyView()
        }
    }
}

#Preview("Footer (34pt)") {
    VStack(spacing: Spacing.s2) {
        HStack(spacing: Spacing.s2) {
            CompactButton(title: "Withdraw", icon: .x, variant: .destructive) {}
            CompactButton(title: "Edit bid", icon: .check, variant: .primary) {}
        }
        HStack(spacing: Spacing.s2) {
            CompactButton(title: "Message", variant: .ghost) {}
            CompactButton(title: "Mark complete", variant: .primary) {}
        }
    }
    .padding()
    .background(Theme.Color.appSurface)
}

#Preview("Inline action (30/28pt)") {
    VStack(alignment: .leading, spacing: Spacing.s1) {
        CompactButton(title: "Accept", variant: .primary, size: .inlineAction) {}
        CompactButton(title: "Ignore", variant: .ghost, size: .inlineAction) {}
    }
    .frame(width: 120)
    .padding()
    .background(Theme.Color.appSurface)
}
