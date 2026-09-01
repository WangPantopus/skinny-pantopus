//
//  FuzzMap.swift
//  Pantopus
//
//  Animated concentric-circle privacy fuzz preview used on A14.7 Privacy.
//  A stylised street-grid canvas with a primary-tinted concentric ring
//  that grows in five discrete stops — exact → block → quarter mile →
//  half mile (default) → neighborhood. The label uppercases into a mono
//  corner tag. The radius transition runs through `Motion.componentState`
//  (extended to 300ms per spec) and honours `reduceMotion`.
//

import SwiftUI

/// Discrete fuzz radius for the privacy slider on A14.7.
public enum FuzzStop: String, Sendable, Hashable, CaseIterable {
    case exact
    case block
    case quarterMile
    case halfMile
    case neighborhood

    /// Ring radius (points) at this stop. `exact` collapses to 0 so the
    /// only visible mark is the centre pin.
    public var radius: CGFloat {
        switch self {
        case .exact: 0
        case .block: 18
        case .quarterMile: 42
        case .halfMile: 62
        case .neighborhood: 110
        }
    }

    /// Human-readable label used for the mono corner tag and a11y.
    public var label: String {
        switch self {
        case .exact: "Exact"
        case .block: "Block"
        case .quarterMile: "Quarter mile"
        case .halfMile: "Half mile"
        case .neighborhood: "Neighborhood"
        }
    }
}

/// Animated concentric-circle privacy fuzz preview.
///
/// - Parameter stop: The current fuzz level. Drives the ring radius —
///   change the binding to animate.
@MainActor
public struct FuzzMap: View {
    private let stop: FuzzStop
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Canvas dimensions per the prompt — 280pt wide × 140pt tall.
    public static let canvasWidth: CGFloat = 280
    public static let canvasHeight: CGFloat = 140

    /// Centre-pin dot diameter — 8pt per the prompt.
    private static let pinDiameter: CGFloat = 8

    /// Number of grid hairlines per axis — 12 each, per the prompt.
    private static let gridLineCount: Int = 12

    public init(stop: FuzzStop) {
        self.stop = stop
    }

    public var body: some View {
        ZStack {
            // Stylised map background — `appSurfaceRaised` keeps the canvas
            // distinct from both the surrounding `appSurface` and the
            // `appBorderSubtle` grid hairlines drawn on top.
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurfaceRaised)

            // Faint street grid.
            StreetGrid(lineCount: Self.gridLineCount)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)

            // Concentric fuzz ring — animates between stops.
            FuzzRing(radius: stop.radius)
                .animation(
                    reduceMotion ? Motion.reducedMotion : .easeInOut(duration: 0.3),
                    value: stop.radius
                )

            // Centre pin.
            Circle()
                .fill(Theme.Color.primary600)
                .frame(width: Self.pinDiameter, height: Self.pinDiameter)
                .overlay(
                    Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 1.5)
                )

            // Mono corner tag.
            cornerTag
        }
        .frame(width: Self.canvasWidth, height: Self.canvasHeight)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement()
        .accessibilityLabel("Location fuzz: \(stop.label)")
        .accessibilityIdentifier("fuzzMap")
    }

    private var cornerTag: some View {
        Text(stop.label.uppercased())
            .font(.system(size: PantopusTextStyle.overline.size, weight: .bold, design: .monospaced))
            .tracking(0.6)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(Theme.Color.appSurface.opacity(0.85))
            )
            .padding(Spacing.s2)
            .frame(
                maxWidth: .infinity,
                maxHeight: .infinity,
                alignment: .topLeading
            )
            .accessibilityHidden(true)
    }
}

// MARK: - Grid

private struct StreetGrid: Shape {
    let lineCount: Int

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard lineCount > 0 else { return path }
        let total = CGFloat(lineCount + 1)
        // Horizontal hairlines (evenly inside the rect).
        for i in 1...lineCount {
            let y = (CGFloat(i) / total) * rect.height
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: rect.width, y: y))
        }
        // Vertical hairlines.
        for i in 1...lineCount {
            let x = (CGFloat(i) / total) * rect.width
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: rect.height))
        }
        return path
    }
}

// MARK: - Fuzz ring

private struct FuzzRing: View {
    let radius: CGFloat

    var body: some View {
        // Circle scaled to `radius * 2` diameter (rendering only when r > 0).
        ZStack {
            Circle()
                .fill(Theme.Color.primary600.opacity(0.18))
            Circle()
                .strokeBorder(Theme.Color.primary600, lineWidth: 1.5)
        }
        .frame(width: max(radius * 2, 0), height: max(radius * 2, 0))
        .opacity(radius > 0 ? 1 : 0)
    }
}

// MARK: - Preview

#Preview("All fuzz stops") {
    VStack(spacing: Spacing.s3) {
        ForEach(FuzzStop.allCases, id: \.self) { stop in
            FuzzMap(stop: stop)
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
