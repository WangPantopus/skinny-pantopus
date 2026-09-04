//
//  Typography.swift
//  Pantopus
//
//  Type-ramp tokens. Call sites MUST use `.pantopusTextStyle(.h1)` rather
//  than `.font(.system(...))` so tracking, line-height, and casing stay
//  consistent with the design system — except for roles that specify casing
//  (`.overline`), which are built with `Text(copy, style: .overline)` so the
//  role can upper-case the source string.
//

import SwiftUI

/// A semantic type-ramp role. Use with `Text.pantopusTextStyle(_:)`, or with
/// `Text(_:style:)` when the role carries casing.
public enum PantopusTextStyle: Sendable {
    case h1
    case h2
    case h3
    case body
    case small
    case caption
    case overline

    /// Font point size.
    public var size: CGFloat {
        switch self {
        case .h1: 30
        case .h2: 24
        case .h3: 20
        case .body: 16
        case .small: 14
        case .caption: 12
        case .overline: 11
        }
    }

    /// Target line height, in points.
    public var lineHeight: CGFloat {
        switch self {
        case .h1: 36
        case .h2: 32
        case .h3: 28
        case .body: 24
        case .small: 20
        case .caption: 16
        case .overline: 16
        }
    }

    /// Font weight.
    public var weight: Font.Weight {
        switch self {
        case .h1: .bold
        case .h2, .h3, .overline: .semibold
        case .body, .small, .caption: .regular
        }
    }

    /// Letter-spacing in points (CSS `em` × size).
    public var tracking: CGFloat {
        switch self {
        case .h1: -0.020 * 30
        case .h2: -0.015 * 24
        case .h3: 0
        case .body: 0
        case .small: 0
        case .caption: 0
        case .overline: 0.06 * 11
        }
    }

    /// Whether the role renders in upper case — `.overline`, per the shared
    /// `typography.overline.textTransform` token that web and Android build on.
    ///
    /// `Text` cannot read back its own string, so the casing has to be applied
    /// to the source string *before* the `Text` exists. That is what
    /// `Text.init(_:style:)` is for; chaining `.pantopusTextStyle(.overline)`
    /// onto an existing `Text` cannot upper-case it, and `verify-tokens.sh`
    /// rejects that form.
    public var isUppercased: Bool {
        self == .overline
    }

    /// `string` with this role's casing applied.
    public func cased(_ string: String) -> String {
        isUppercased ? string.uppercased() : string
    }
}

public extension Theme.Font {
    /// `h1` — 30/36, bold, -0.020em.
    static let h1 = Font.system(size: PantopusTextStyle.h1.size, weight: .bold, design: .default)
    /// `h2` — 24/32, semibold, -0.015em.
    static let h2 = Font.system(size: PantopusTextStyle.h2.size, weight: .semibold, design: .default)
    /// `h3` — 20/28, semibold.
    static let h3 = Font.system(size: PantopusTextStyle.h3.size, weight: .semibold, design: .default)
    /// `body` — 16/24, regular.
    static let body = Font.system(size: PantopusTextStyle.body.size, weight: .regular, design: .default)
    /// `small` — 14/20, regular.
    static let small = Font.system(size: PantopusTextStyle.small.size, weight: .regular, design: .default)
    /// `caption` — 12/16, regular.
    static let caption = Font.system(size: PantopusTextStyle.caption.size, weight: .regular, design: .default)
    /// `overline` — 11/16, semibold, +0.06em, UPPERCASE.
    static let overline = Font.system(size: PantopusTextStyle.overline.size, weight: .semibold, design: .default)

    /// Resolve the system `Font` for a given role.
    static func role(_ role: PantopusTextStyle) -> Font {
        switch role {
        case .h1: h1
        case .h2: h2
        case .h3: h3
        case .body: body
        case .small: small
        case .caption: caption
        case .overline: overline
        }
    }
}

public extension Text {
    /// Design-system text: applies the role's casing, font, and tracking.
    ///
    /// Write the copy in natural case — the role does the shouting, the same
    /// way web writes `overline="Assign to"` and lets `text-transform` cap it.
    /// Roles that specify casing (`.overline`) MUST be built this way rather
    /// than with `Text(...).pantopusTextStyle(...)`, which can only reach the
    /// font and tracking.
    ///
    /// Casing runs on the string as given, so this takes a `String` rather
    /// than a `LocalizedStringKey`; localized copy would need resolving first.
    init(_ content: String, style: PantopusTextStyle) {
        self = Text(verbatim: style.cased(content)).pantopusTextStyle(style)
    }

    /// Apply a design-system role's font and tracking to existing `Text`.
    ///
    /// This deliberately does not touch casing — a built `Text` cannot be
    /// re-cased. Use `Text(_:style:)` for `.overline`. Pair with
    /// `.pantopusLineHeight(_:)` on the surrounding `View` if you need the
    /// line-height spec — `Text` alone cannot set line spacing.
    func pantopusTextStyle(_ style: PantopusTextStyle) -> Text {
        font(Theme.Font.role(style))
            .tracking(style.tracking)
    }
}

public extension View {
    /// Apply line spacing that approximates the role's CSS line-height
    /// (`lineHeight - size`). Apply on the `View` wrapping the `Text`.
    func pantopusLineHeight(_ style: PantopusTextStyle) -> some View {
        lineSpacing(style.lineHeight - style.size)
    }
}
