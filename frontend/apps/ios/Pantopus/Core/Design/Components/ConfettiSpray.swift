//
//  ConfettiSpray.swift
//  Pantopus
//
//  Decorative confetti overlay used on celebration heroes (A17.9 Party,
//  A18.2 Approved). Sixty seed-deterministic dots in six brand-adjacent
//  colors. Static when reduce-motion is on or the caller passes
//  `isAnimating: false`; otherwise a gentle y-drift runs continuously.
//
//  Design reference: `docs/designs/A17/party.jsx` (Confetti) and
//  `docs/new-design-parity.md` § A17.9.
//

import SwiftUI

/// A 200×140 decorative dot pattern for celebration heroes.
@MainActor
public struct ConfettiSpray: View {
    private let seed: UInt64
    private let dotCount: Int
    private let isAnimating: Bool?

    public init(
        seed: UInt64 = 42,
        dotCount: Int = 60,
        isAnimating: Bool? = nil
    ) {
        self.seed = seed
        self.dotCount = dotCount
        self.isAnimating = isAnimating
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public var body: some View {
        let active = resolvedIsAnimating
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !active)) { context in
            let time = active
                ? context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 4.0) / 4.0
                : 0
            Canvas { ctx, _ in
                draw(in: ctx, phase: time)
            }
        }
        .frame(width: 200, height: 140)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var resolvedIsAnimating: Bool {
        if let isAnimating { return isAnimating }
        return !reduceMotion
    }

    private func draw(in context: GraphicsContext, phase: Double) {
        var rng = SeededRandom(seed: seed)
        let palette = Self.palette
        for _ in 0..<dotCount {
            let baseX = rng.next() * 200
            let baseY = rng.next() * 140
            let radius = 1.0 + rng.next() * 2.5
            let colorIndex = Int(rng.next() * Double(palette.count)) % palette.count
            let dotPhase = rng.next()
            let driftAmplitude = 6.0
            let drift = sin((phase + dotPhase) * 2.0 * .pi) * driftAmplitude
            let rect = CGRect(
                x: baseX - radius,
                y: baseY - radius + drift,
                width: radius * 2,
                height: radius * 2
            )
            context.fill(Path(ellipseIn: rect), with: .color(palette[colorIndex]))
        }
    }

    /// Six brand-adjacent confetti hues. Spec: rose · warning · success ·
    /// primary500 · magicBg · business.
    static let palette: [Color] = [
        confettiRose,
        Theme.Color.warning,
        Theme.Color.success,
        Theme.Color.primary500,
        Theme.Color.magicBg,
        Theme.Color.business
    ]

    /// Rose `#DB2777` — confetti-specific accent without a global token
    /// (deferred to category-party / category-records work; see
    /// `docs/new-design-parity.md` open question 4).
    static let confettiRose = Color(red: 0.859, green: 0.153, blue: 0.467)
}

/// Tiny deterministic linear-congruential RNG used to place the dots.
/// Wholly self-contained so snapshot tests are byte-stable across runs.
private struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) {
        state = seed | 1
    }

    /// Returns a uniform `Double` in `[0, 1)`. The top 31 bits of the
    /// LCG state are mapped onto the range by dividing by `2^31` so the
    /// stream covers the full canvas, not just the lower half.
    mutating func next() -> Double {
        state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return Double(state >> 33) / 2_147_483_648.0
    }
}

#Preview("ConfettiSpray") {
    VStack(spacing: Spacing.s4) {
        ConfettiSpray()
            .background(Theme.Color.appBg)
        ConfettiSpray(seed: 99, isAnimating: false)
            .background(Theme.Color.primary50)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appSurface)
}
