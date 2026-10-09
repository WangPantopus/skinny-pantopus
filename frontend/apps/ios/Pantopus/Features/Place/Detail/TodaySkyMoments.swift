//
//  TodaySkyMoments.swift
//  Pantopus
//
//  The sky's rarer pictures, each drawn only when it's true: shooting stars
//  on a meteor shower's peak night, frost creeping in from the card's
//  corners when it's freezing, and a veil of wildfire smoke. Parity twin of
//  Android's `TodaySkyMoments.kt`.
//

import SwiftUI

extension TodaySkyPainter {
    /// One shooting star every few seconds across the upper right of the sky;
    /// with motion off, a single faint streak holds still.
    func paintMeteors(_ context: GraphicsContext, _ scene: Scene) {
        let period = 4.5
        let cycle = still ? 0 : (scene.time / period).rounded(.down)
        var random = SkyRandom(seed: UInt32(truncatingIfNeeded: 500 + Int(cycle)))
        let start = 0.3 + random.next() * 1.5
        // A streak lasts 0.8 s.
        let progress = still ? 0.6 : (scene.time - cycle * period - start) / 0.8
        guard progress >= 0, progress <= 1 else { return }
        let x = scene.width * (0.38 + random.next() * 0.34)
        let y = 10 + random.next() * scene.horizon * 0.3
        // Heading down and to the right, away from the reading.
        let angle = Double.pi * (0.12 + random.next() * 0.1)
        let travel = 110 * progress
        let head = CGPoint(x: x + cos(angle) * travel, y: y + sin(angle) * travel)
        let tail = CGPoint(x: x + cos(angle) * (travel - 46), y: y + sin(angle) * (travel - 46))
        let fade = sin(Double.pi * progress) * (still ? 0.6 : 1)
        var streak = Path()
        streak.move(to: tail)
        streak.addLine(to: head)
        let gradient = Gradient(colors: [SkyPalette.white.color(opacity: 0), SkyPalette.white.color(opacity: 0.9 * fade)])
        context.stroke(
            streak,
            with: .linearGradient(gradient, startPoint: tail, endPoint: head),
            style: StrokeStyle(lineWidth: 1.6, lineCap: .round)
        )
        context.fill(Self.circle(Double(head.x), Double(head.y), 1.6), with: .color(SkyPalette.white.color(opacity: fade)))
    }

    /// Wildfire smoke: a veil over the whole sky, thickest toward the horizon.
    func paintSmoke(_ context: GraphicsContext, _ scene: Scene) {
        let haze = moment.phase == .night ? SkyPalette.smokeHazeNight : SkyPalette.smokeHaze
        let gradient = Gradient(colors: [haze.color(opacity: smoke * 0.45), haze.color(opacity: smoke * 0.85)])
        context.fill(
            Path(CGRect(origin: .zero, size: scene.size)),
            with: .linearGradient(gradient, startPoint: .zero, endPoint: CGPoint(x: 0, y: scene.horizon + 10))
        )
    }

    /// Frost from three corners (never the top left, where the reading sits):
    /// a pale haze and a few crystals with side shoots.
    func paintFrost(_ context: GraphicsContext, _ scene: Scene) {
        let corners: [(x: Double, y: Double)] = [(scene.width, 0), (0, scene.height), (scene.width, scene.height)]
        var random = SkyRandom(seed: 41)
        let haze = Gradient(colors: [SkyPalette.frost.color(opacity: 0.38), SkyPalette.frost.color(opacity: 0)])
        var crystals = Path()
        for corner in corners {
            context.fill(
                Path(CGRect(origin: .zero, size: scene.size)),
                with: .radialGradient(haze, center: CGPoint(x: corner.x, y: corner.y), startRadius: 0, endRadius: 64)
            )
            let inward = atan2(scene.height / 2 - corner.y, scene.width / 2 - corner.x)
            for _ in 0..<7 {
                let angle = inward + (random.next() - 0.5) * 1.4
                let length = 18 + random.next() * 26
                let offset = random.next() * 8
                let startX = corner.x + cos(angle) * offset
                let startY = corner.y + sin(angle) * offset
                crystals.move(to: CGPoint(x: startX, y: startY))
                crystals.addLine(to: CGPoint(x: startX + cos(angle) * length, y: startY + sin(angle) * length))
                let midX = startX + cos(angle) * length * 0.55
                let midY = startY + sin(angle) * length * 0.55
                for side in [-0.6, 0.6] {
                    crystals.move(to: CGPoint(x: midX, y: midY))
                    crystals.addLine(to: CGPoint(x: midX + cos(angle + side) * length * 0.35, y: midY + sin(angle + side) * length * 0.35))
                }
            }
        }
        context.stroke(crystals, with: .color(SkyPalette.frost.color(opacity: 0.55)), style: StrokeStyle(lineWidth: 0.9, lineCap: .round))
    }
}
