//
//  PlanButtons.swift
//  Pantopus
//
//  The Plans boards' buttons (board P2 "Buttons · PantopusButton"): the
//  shared button's colors and radius, at the boards' sizes (50 pt, 40 pt
//  small), with a glyph where the board shows one, and the tonal, text and
//  stacked kinds the shared button doesn't have. One primary action per
//  screen, in the sticky footer.
//

import SwiftUI

struct PlanButtonStyle: ButtonStyle {
    enum Kind {
        /// Sky fill, white text.
        case primary
        /// Surface with a strong border.
        case secondary
        /// Sunken fill.
        case tonal
        /// Solid red.
        case danger
        /// Link-colored text, no fill.
        case text
        /// Red text, no fill.
        case textDanger

        /// The text and glyph color.
        var foreground: Color {
            switch self {
            case .primary, .danger: Theme.Color.appTextInverse
            case .secondary, .tonal: Theme.Color.appText
            case .text: Theme.Color.primaryInk
            case .textDanger: Theme.Color.error
            }
        }
    }

    enum Size {
        /// 50 pt.
        case regular
        /// 40 pt.
        case small
        /// 36 pt, content width (inside notifications and banners).
        case extraSmall
        /// 64 pt, glyph over a short label.
        case stack
    }

    let kind: Kind
    var size: Size = .regular
    /// At the accessibility text sizes the label wraps instead of truncating (opt-in; Crew Day's buttons).
    var wrapsAtLargeText = false
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var typeSize

    private var wraps: Bool {
        wrapsAtLargeText && typeSize.isAccessibilitySize
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .planFont(size == .regular ? .bodyStrong : size == .stack ? .label : .buttonSmall)
            .foregroundStyle(kind.foreground)
            .lineLimit(wraps ? 4 : size == .stack ? 2 : 1)
            .minimumScaleFactor(wraps ? 1 : 0.85)
            .fixedSize(horizontal: false, vertical: wraps)
            .multilineTextAlignment(.center)
            .padding(.horizontal, size == .extraSmall ? 14 : Spacing.s3)
            .padding(.vertical, wraps ? Spacing.s2 : size == .stack ? Spacing.s2 : 0)
            .frame(maxWidth: size == .extraSmall ? nil : .infinity, minHeight: height)
            .background(background)
            .overlay(border)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .shadow(color: kind == .primary ? Theme.Color.primary600.opacity(0.18) : .clear, radius: 8, x: 0, y: 6)
            .opacity(configuration.isPressed ? 0.85 : isEnabled ? 1 : 0.5)
            .contentShape(Rectangle())
    }

    private var height: CGFloat {
        switch size {
        case .regular: 50
        case .small: 40
        case .extraSmall: 36
        case .stack: 64
        }
    }

    private var radius: CGFloat {
        switch size {
        case .regular: Radii.lg
        case .small, .extraSmall: 10
        case .stack: 14
        }
    }

    @ViewBuilder private var background: some View {
        switch kind {
        case .primary: Theme.Color.primarySolid
        case .secondary: Theme.Color.appSurface
        case .tonal: Theme.Color.appSurfaceSunken
        case .danger: Theme.Color.errorSolid
        case .text, .textDanger: Color.clear
        }
    }

    @ViewBuilder private var border: some View {
        if kind == .secondary {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
        }
    }
}

/// A button label with an optional leading glyph (18 pt), or a glyph over the
/// label for the stacked kind.
struct PlanButtonLabel: View {
    let title: String
    var icon: PantopusIcon?
    /// The button's kind, for the glyph's color.
    var kind: PlanButtonStyle.Kind = .primary
    var stacked = false
    var isLoading = false

    var body: some View {
        ZStack {
            content.opacity(isLoading ? 0 : 1)
            if isLoading { ProgressView().tint(kind.foreground) }
        }
    }

    @ViewBuilder private var content: some View {
        if stacked {
            VStack(spacing: Spacing.s1) {
                if let icon { Icon(icon, size: 20, color: kind.foreground) }
                Text(title)
            }
        } else {
            HStack(spacing: Spacing.s2) {
                if let icon { Icon(icon, size: 18, color: kind.foreground) }
                Text(title)
            }
        }
    }
}

extension View {
    func planButton(_ kind: PlanButtonStyle.Kind, size: PlanButtonStyle.Size = .regular) -> some View {
        buttonStyle(PlanButtonStyle(kind: kind, size: size))
    }

    /// A Plans button whose label wraps at the accessibility text sizes (Crew Day: nothing truncates there).
    func crewDayButton(_ kind: PlanButtonStyle.Kind, size: PlanButtonStyle.Size = .regular) -> some View {
        buttonStyle(PlanButtonStyle(kind: kind, size: size, wrapsAtLargeText: true))
    }
}
