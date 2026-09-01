//
//  VerifiedBadge.swift
//  Pantopus
//
//  Small green-check badge pinned to an avatar corner.
//

import SwiftUI

/// Circular check badge pinned to an avatar corner.
///
/// - Parameters:
///   - size: Outer diameter; defaults to 16pt.
///   - tint: Disc fill. Defaults to `success` green (the app-wide "verified"
///     language); the Pulse / Beacons feed passes `primary600` to match the
///     A03 design's sky check disc.
@MainActor
public struct VerifiedBadge: View {
    private let size: CGFloat
    private let tint: Color

    public init(size: CGFloat = 16, tint: Color = Theme.Color.success) {
        self.size = size
        self.tint = tint
    }

    public var body: some View {
        ZStack {
            Circle().fill(tint)
            Icon(.check, size: size * 0.6, color: Theme.Color.appTextInverse)
        }
        .frame(width: size, height: size)
        .overlay(
            Circle().stroke(Theme.Color.appSurface, lineWidth: 1.5)
        )
        .accessibilityLabel("Verified")
    }
}

#Preview {
    HStack(spacing: Spacing.s3) {
        VerifiedBadge()
        VerifiedBadge(size: 20)
        VerifiedBadge(size: 28)
    }
    .padding()
}
