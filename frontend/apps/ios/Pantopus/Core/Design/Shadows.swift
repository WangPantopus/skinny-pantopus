//
//  Shadows.swift
//  Pantopus
//
//  Design-system shadow tokens. Apply via `.pantopusShadow(.md)`.
//

import SwiftUI

/// A design-system shadow definition. Mirrors the CSS `box-shadow` spec
/// — `rgba(r,g,b,alpha)` becomes `color.opacity(alpha)`, and SwiftUI's
/// `radius` maps to the CSS blur radius.
public struct PantopusShadow: Equatable, Sendable {
    /// The RGB base of the shadow color, before opacity is applied.
    public let color: Color
    /// Shadow opacity in `0...1`.
    public let opacity: Double
    /// Blur radius, in points.
    public let radius: CGFloat
    /// Horizontal offset, in points.
    public let x: CGFloat
    /// Vertical offset, in points.
    public let y: CGFloat

    /// Create a shadow. Intended for the static tokens below; downstream
    /// code should refer to those tokens, not build its own instances.
    public init(color: Color, opacity: Double, radius: CGFloat, x: CGFloat, y: CGFloat) {
        self.color = color
        self.opacity = opacity
        self.radius = radius
        self.x = x
        self.y = y
    }

    /// `0 1px 3px rgba(0,0,0,0.04)`.
    public static let sm = PantopusShadow(color: .black, opacity: 0.04, radius: 3, x: 0, y: 1)
    /// `0 2px 6px rgba(0,0,0,0.06)`.
    public static let md = PantopusShadow(color: .black, opacity: 0.06, radius: 6, x: 0, y: 2)
    /// `0 4px 12px rgba(0,0,0,0.08)`.
    public static let lg = PantopusShadow(color: .black, opacity: 0.08, radius: 12, x: 0, y: 4)
    /// `0 8px 24px rgba(0,0,0,0.10)`.
    public static let xl = PantopusShadow(color: .black, opacity: 0.10, radius: 24, x: 0, y: 8)
    /// `0 6px 16px rgba(2,132,199,0.18)` — the primary-tinted shadow.
    public static let primary = PantopusShadow(
        color: Theme.Color.primary600,
        opacity: 0.18,
        radius: 16,
        x: 0,
        y: 6
    )

    /// `0 6px 16px rgba(2,132,199,0.28)` — the deeper primary-tinted lift the
    /// Add-to-calendar frames hardcode on the native / multi-calendar confirm
    /// CTAs (`add-calendar-frames.jsx`). Same geometry as `.primary`, +0.10
    /// opacity. Scoped to those CTAs so the global `.primary` token keeps
    /// mirroring the `--shadow-primary` CSS var.
    public static let primaryDeep = PantopusShadow(
        color: Theme.Color.primary600,
        opacity: 0.28,
        radius: 16,
        x: 0,
        y: 6
    )
}

public extension View {
    /// Apply a design-system shadow token.
    ///
    /// Usage: `.pantopusShadow(.md)`. Do not call `.shadow()` directly in
    /// feature code — tokens guarantee consistent elevation across screens.
    func pantopusShadow(_ shadow: PantopusShadow) -> some View {
        self.shadow(
            color: shadow.color.opacity(shadow.opacity),
            radius: shadow.radius,
            x: shadow.x,
            y: shadow.y
        )
    }
}
