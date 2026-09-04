//
//  PantopusMark.swift
//  Pantopus
//
//  The brand mark — "the perforation mark". A postage-stamp body with a
//  knocked-out window and a verification check: mail, what is shown, and
//  proof. This file is the ONLY place the geometry lives; every brand
//  surface (doorway screens, splash, About, the Place launch header) draws
//  it through `PantopusMark` / `PantopusLockup`.
//
//  Canonical geometry, in a 64×64 design space scaled to `size`:
//    body          rounded rect 4,4 56×56 r13
//    perforations  8 circles r4.5 punched OUT at (23.5, 4) (40.5, 4)
//                  (23.5, 60) (40.5, 60) (4, 23.5) (4, 40.5)
//                  (60, 23.5) (60, 40.5)
//    window        rounded rect 20,20 24×24 r4, also punched OUT — a
//                  KNOCKOUT, never a fill. Whatever sits behind the mark
//                  shows through it, which is what makes the all-white
//                  `.reverse` build read on a coloured tile.
//    check         M26 32.4 L30.2 36.6 L38.2 26.8, stroke 4.4, round
//                  cap/join, drawn on top of the body inside the window.
//
//  The knockouts are genuine transparency: the stencil is a `Path` boolean
//  subtraction used as a mask, so no ground colour is baked in. At or below
//  20pt the check is illegible, so it is swapped for a solid plug (12×12 r3)
//  in the body colour.
//
//  PERF: vector, static, one composited masked layer — nothing to animate
//  and nothing to gate behind reduce-motion.
//

import SwiftUI
import UIKit

// MARK: - PantopusMark

/// The Pantopus brand mark at `size` points square.
///
/// Labelled for assistive tech by default (it stands alone at most call
/// sites). Where it sits beside a "Pantopus" wordmark it is decorative —
/// `PantopusLockup` hides it and lets the text carry the name; hand-rolled
/// lockups should apply `.accessibilityHidden(true)` themselves.
///
/// - Parameters:
///   - size: Edge length in points. Minimum 16.
///   - variant: `.auto` resolves body colour from the colour scheme;
///     `.reverse` is the all-white build for coloured grounds.
public struct PantopusMark: View {
    /// Colour build. `.auto` follows the theme; `.reverse` is white-on-colour.
    public enum Variant {
        /// Primary-600 body in light, primary-400 in dark; home-green check.
        case auto
        /// White body and white check, for coloured grounds (app-icon tile,
        /// ceremonial banners). The window knockout lets the ground read
        /// through — do not "fix" this to a coloured check.
        case reverse
    }

    private let size: CGFloat
    private let variant: Variant

    @Environment(\.colorScheme) private var colorScheme

    /// At or below this size the check reads as a smudge, so the mark
    /// substitutes the solid plug baked into `PantopusMarkStencil`.
    private static let plugThreshold: CGFloat = 20

    public init(size: CGFloat, variant: Variant = .auto) {
        self.size = size
        self.variant = variant
    }

    public var body: some View {
        ZStack {
            bodyColor
                .mask {
                    PantopusMarkStencil(plugged: isPlugged)
                        .fill(Color.black)
                }
            if !isPlugged {
                PantopusMarkCheck()
                    .stroke(
                        checkColor,
                        style: StrokeStyle(lineWidth: 4.4 * scale, lineCap: .round, lineJoin: .round)
                    )
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel("Pantopus")
        .accessibilityIdentifier("pantopusMark")
    }

    /// Design-space unit → points.
    private var scale: CGFloat {
        size / 64
    }

    private var isPlugged: Bool {
        size <= Self.plugThreshold
    }

    private var bodyColor: Color {
        switch variant {
        case .auto: colorScheme == .dark ? Theme.Color.primary400 : Theme.Color.primary600
        case .reverse: .white
        }
    }

    private var checkColor: Color {
        switch variant {
        case .auto: Theme.Color.brandCheck
        case .reverse: .white
        }
    }
}

// MARK: - Stencil

/// The stamp body with its perforations and window subtracted — and, when
/// `plugged`, the small-size plug added back inside the window. Filled as a
/// mask, so every subtracted region is truly transparent.
struct PantopusMarkStencil: Shape {
    var plugged: Bool = false

    /// Perforation centres in the 64×64 design space.
    static let perforations: [CGPoint] = [
        CGPoint(x: 23.5, y: 4), CGPoint(x: 40.5, y: 4),
        CGPoint(x: 23.5, y: 60), CGPoint(x: 40.5, y: 60),
        CGPoint(x: 4, y: 23.5), CGPoint(x: 4, y: 40.5),
        CGPoint(x: 60, y: 23.5), CGPoint(x: 60, y: 40.5),
    ]

    static let perforationRadius: CGFloat = 4.5

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 64
        func scaled(_ value: CGFloat) -> CGFloat { value * scale }
        func box(x: CGFloat, y: CGFloat, size: CGFloat) -> CGRect {
            CGRect(
                x: rect.minX + scaled(x),
                y: rect.minY + scaled(y),
                width: scaled(size),
                height: scaled(size)
            )
        }

        var path = Path(
            roundedRect: box(x: 4, y: 4, size: 56),
            cornerRadius: scaled(13),
            style: .circular
        )

        for centre in Self.perforations {
            let diameter = Self.perforationRadius * 2
            let hole = box(
                x: centre.x - Self.perforationRadius,
                y: centre.y - Self.perforationRadius,
                size: diameter
            )
            path = path.subtracting(Path(ellipseIn: hole))
        }

        path = path.subtracting(
            Path(roundedRect: box(x: 20, y: 20, size: 24), cornerRadius: scaled(4), style: .circular)
        )

        if plugged {
            path = path.union(
                Path(roundedRect: box(x: 26, y: 26, size: 12), cornerRadius: scaled(3), style: .circular)
            )
        }

        return path
    }
}

// MARK: - Check

/// The verification check, sitting inside the window knockout. Stroked by
/// the caller so the width can scale with the mark.
struct PantopusMarkCheck: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 64
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * scale, y: rect.minY + y * scale)
        }

        var path = Path()
        path.move(to: point(26, 32.4))
        path.addLine(to: point(30.2, 36.6))
        path.addLine(to: point(38.2, 26.8))
        return path
    }
}

// MARK: - PantopusLockup

/// The mark plus the "Pantopus" wordmark, laid out to the brand lockup
/// rule: gap = 1/3 of the mark height, wordmark = 0.83 × mark height at
/// weight 700 with −0.02em tracking, optically centred on the wordmark's
/// x-height rather than its glyph box.
public struct PantopusLockup: View {
    private let size: CGFloat
    private let variant: PantopusMark.Variant

    public init(size: CGFloat, variant: PantopusMark.Variant = .auto) {
        self.size = size
        self.variant = variant
    }

    public var body: some View {
        HStack(spacing: size / 3) {
            PantopusMark(size: size, variant: variant)
                .accessibilityHidden(true)
            Text("Pantopus")
                .font(.system(size: wordmarkSize, weight: .bold))
                .kerning(-0.02 * wordmarkSize)
                .foregroundStyle(wordmarkColor)
                .alignmentGuide(VerticalAlignment.center) { _ in
                    // Distance from the text box's top edge to the middle of
                    // the x-height band — the optical centre of a lowercase
                    // wordmark.
                    let font = UIFont.systemFont(ofSize: wordmarkSize, weight: .bold)
                    return font.ascender - font.xHeight / 2
                }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pantopus")
        .accessibilityIdentifier("pantopusLockup")
    }

    private var wordmarkSize: CGFloat {
        size * 0.83
    }

    private var wordmarkColor: Color {
        switch variant {
        case .auto: Theme.Color.appText
        case .reverse: .white
        }
    }
}

// MARK: - Preview

#Preview("Mark — sizes and variants") {
    VStack(spacing: Spacing.s5) {
        HStack(alignment: .bottom, spacing: Spacing.s4) {
            PantopusMark(size: 16)
            PantopusMark(size: 20)
            PantopusMark(size: 28)
            PantopusMark(size: 48)
            PantopusMark(size: 64)
        }
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Theme.Color.primary600)
                .frame(width: 96, height: 96)
            PantopusMark(size: 56, variant: .reverse)
        }
        PantopusLockup(size: 28)
        PantopusLockup(size: 48)
    }
    .padding(Spacing.s5)
    .background(Theme.Color.appBg)
}
