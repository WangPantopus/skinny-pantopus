//
//  Shimmer.swift
//  Pantopus
//
//  Animated placeholder block. Renders a sliding gradient sweep on a
//  neutral base; collapses to a flat fill when Reduce Motion is enabled.
//

import SwiftUI

/// 1.4-second linear-gradient shimmer. Decorative — always hidden from
/// assistive tech.
///
/// - Parameters:
///   - width: Fixed width of the block (omit for `.infinity`).
///   - height: Fixed height of the block.
///   - cornerRadius: Defaults to `Radii.sm` (6pt).
@MainActor
public struct Shimmer: View {
    private let width: CGFloat?
    private let height: CGFloat
    private let cornerRadius: CGFloat

    public init(width: CGFloat? = nil, height: CGFloat = 16, cornerRadius: CGFloat = Radii.sm) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    public var body: some View {
        GeometryReader { geo in
            let rect = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            rect.fill(Self.base)
                .overlay {
                    if !reduceMotion {
                        rect
                            .fill(Self.sweepGradient(width: geo.size.width, phase: phase))
                            .blendMode(.plusLighter)
                            .animation(
                                .linear(duration: 1.4).repeatForever(autoreverses: false),
                                value: phase
                            )
                    }
                }
                .onAppear {
                    guard !reduceMotion else { return }
                    phase = 2
                }
                .accessibilityHidden(true)
        }
        .frame(width: width, height: height)
    }

    private static let base = Color(red: 0.933, green: 0.941, blue: 0.953) // #eef0f3
    private static let highlight = Color(red: 0.965, green: 0.969, blue: 0.976) // #f6f7f9

    private static func sweepGradient(width _: CGFloat, phase: CGFloat) -> LinearGradient {
        LinearGradient(
            stops: [
                .init(color: base.opacity(0), location: 0),
                .init(color: highlight, location: 0.5),
                .init(color: base.opacity(0), location: 1)
            ],
            startPoint: UnitPoint(x: phase - 1, y: 0.5),
            endPoint: UnitPoint(x: phase, y: 0.5)
        )
    }
}

#Preview("Sizes") {
    VStack(alignment: .leading, spacing: Spacing.s3) {
        Shimmer(width: 200, height: 16)
        Shimmer(width: 140, height: 12, cornerRadius: Radii.xs)
        Shimmer(height: 56, cornerRadius: Radii.md)
    }
    .padding()
}
