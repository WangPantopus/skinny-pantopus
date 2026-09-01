//
//  MapPreview.swift
//  Pantopus
//
//  Static, tappable map tile with an identity-tinted location pin and an
//  optional service-area ring. Backs the "Service area" card on A10.6
//  Business profile and A10.7 owner view.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (AddressMap) and
//  `docs/new-design-parity-batch2.md` § A10.6.
//
//  The backdrop is the same stylised street-grid canvas used by `FuzzMap` —
//  no map SDK, no tile fetch, no live network. Callers open the real maps
//  surface from `onTap`. Static in snapshots and well within
//  `docs/perf_budgets.md` (a grid stroke + two shapes).
//

import SwiftUI

/// Static map tile with an identity-tinted pin.
///
/// - Parameters:
///   - identity: Pin / service-area tint (defaults to `.business`).
///   - height: Tile height; defaults to 124pt.
///   - serviceAreaRadius: Optional translucent ring radius (points). `nil`
///     draws just the pin.
///   - pinGlyph: Optional center glyph inside the pin head; `nil` draws a
///     plain white dot.
///   - onTap: Opens the maps surface. `nil` makes the tile inert.
@MainActor
public struct MapPreview: View {
    private let identity: IdentityPillar
    private let height: CGFloat
    private let serviceAreaRadius: CGFloat?
    private let pinGlyph: PantopusIcon?
    private let onTap: (() -> Void)?

    private static let gridLineCount = 8

    public init(
        identity: IdentityPillar = .business,
        height: CGFloat = 124,
        serviceAreaRadius: CGFloat? = nil,
        pinGlyph: PantopusIcon? = nil,
        onTap: (() -> Void)? = nil
    ) {
        self.identity = identity
        self.height = height
        self.serviceAreaRadius = serviceAreaRadius
        self.pinGlyph = pinGlyph
        self.onTap = onTap
    }

    public var body: some View {
        ZStack {
            Theme.Color.appSurfaceRaised
            StreetGrid(lineCount: Self.gridLineCount)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            markerStack
                .offset(y: -6)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .onTapGesture { onTap?() }
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(onTap == nil ? [] : .isButton)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("mapPreview")
    }

    private var markerStack: some View {
        ZStack {
            if let radius = serviceAreaRadius {
                Circle()
                    .fill(identity.color.opacity(0.15))
                    .overlay(Circle().stroke(identity.color.opacity(0.5), lineWidth: 1.5))
                    .frame(width: radius * 2, height: radius * 2)
            }
            pin
        }
    }

    private var pin: some View {
        ZStack {
            DownTriangle()
                .fill(identity.color)
                .frame(width: 14, height: 9)
                .offset(y: 13)
            Circle()
                .fill(identity.color)
                .frame(width: 28, height: 28)
                .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
                .shadow(color: Color.black.opacity(0.25), radius: 4, y: 2)
            pinGlyphView
        }
    }

    @ViewBuilder private var pinGlyphView: some View {
        if let pinGlyph {
            Icon(pinGlyph, size: 13, strokeWidth: 2, color: Theme.Color.appTextInverse)
        } else {
            Circle()
                .fill(Theme.Color.appTextInverse)
                .frame(width: 8, height: 8)
        }
    }

    private var accessibilityLabel: String {
        serviceAreaRadius == nil ? "Map preview" : "Map preview with service area"
    }
}

// MARK: - Backdrop grid

/// Faint evenly-spaced street hairlines — mirrors `FuzzMap`'s canvas so the
/// two map primitives read as the same family.
private struct StreetGrid: Shape {
    let lineCount: Int

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard lineCount > 0 else { return path }
        let total = CGFloat(lineCount + 1)
        for i in 1...lineCount {
            let y = (CGFloat(i) / total) * rect.height
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: rect.width, y: y))
            let x = (CGFloat(i) / total) * rect.width
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: rect.height))
        }
        return path
    }
}

// MARK: - Pin tail

private struct DownTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

#Preview("MapPreview variants") {
    VStack(spacing: Spacing.s4) {
        MapPreview(identity: .business, serviceAreaRadius: 56)
        MapPreview(identity: .home)
        MapPreview(identity: .personal, serviceAreaRadius: 40)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
