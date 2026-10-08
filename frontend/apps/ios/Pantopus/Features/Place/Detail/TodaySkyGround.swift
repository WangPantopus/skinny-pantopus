//
//  TodaySkyGround.swift
//  Pantopus
//
//  The bottom of the living sky: two hills, the resident's house and two
//  trees as silhouettes in the horizon's own colour. Windows glow after
//  dusk (one stays lit late at night), the chimney smokes below 50°F,
//  snow caps the roof and hills, and the trees lean in the wind.
//  Parity twin of the ground in Android's `TodaySkyPainter.kt`.
//

import SwiftUI

struct TodaySkyGround {
    let scene: TodaySkyPainter.Scene
    let weather: SkyPalette.Weather
    let moment: SkyMoment
    let condition: WeatherConditionCode
    let cold: Bool
    let still: Bool

    private struct Tones {
        let backHill: SkyRGB
        let frontHill: SkyRGB
        let house: SkyRGB
    }

    private var night: Bool {
        moment.phase == .night
    }

    private var tones: Tones {
        let base = scene.sky.bottom
        if weather == .snow {
            return night
                ? Tones(backHill: SkyPalette.snowHillBackNight, frontHill: SkyPalette.snowHillFrontNight, house: SkyPalette.snowHouseNight)
                : Tones(backHill: SkyPalette.snowHillBackDay, frontHill: SkyPalette.snowHillFrontDay, house: SkyPalette.snowHouseDay)
        }
        return Tones(
            backHill: base.mixed(with: SkyPalette.ink, by: night ? 0.45 : 0.42),
            frontHill: base.mixed(with: SkyPalette.ink, by: night ? 0.62 : 0.6),
            house: base.mixed(with: SkyPalette.ink, by: night ? 0.75 : 0.72)
        )
    }

    func paint(_ context: GraphicsContext) {
        let tones = tones
        paintHills(context, tones)
        let house = CGPoint(x: scene.width * 0.7, y: scene.horizon + 7)
        paintHouse(context, tones, at: house)
        if cold, !still { paintSmoke(context, at: house) }
        paintTrees(context, tones, at: house)
    }

    private func paintHills(_ context: GraphicsContext, _ tones: Tones) {
        let w = scene.width
        let h = scene.height
        let y = scene.horizon
        var back = Path()
        back.move(to: CGPoint(x: 0, y: y + 4))
        back.addCurve(
            to: CGPoint(x: w * 0.6, y: y - 10),
            control1: CGPoint(x: w * 0.22, y: y - 16),
            control2: CGPoint(x: w * 0.42, y: y - 2)
        )
        back.addCurve(to: CGPoint(x: w, y: y - 12), control1: CGPoint(x: w * 0.78, y: y - 18), control2: CGPoint(x: w * 0.9, y: y - 6))
        back.addLine(to: CGPoint(x: w, y: h))
        back.addLine(to: CGPoint(x: 0, y: h))
        back.closeSubpath()
        context.fill(back, with: .color(tones.backHill.color))

        var front = Path()
        front.move(to: CGPoint(x: 0, y: y + 14))
        front.addCurve(
            to: CGPoint(x: w * 0.72, y: y + 6),
            control1: CGPoint(x: w * 0.25, y: y + 2),
            control2: CGPoint(x: w * 0.5, y: y + 16)
        )
        front.addCurve(to: CGPoint(x: w, y: y + 4), control1: CGPoint(x: w * 0.86, y: y), control2: CGPoint(x: w * 0.94, y: y + 8))
        front.addLine(to: CGPoint(x: w, y: h))
        front.addLine(to: CGPoint(x: 0, y: h))
        front.closeSubpath()
        context.fill(front, with: .color(tones.frontHill.color))
    }

    /// A 40 × 26 point house with its door at `at` (the ground line).
    private func paintHouse(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let x = origin.x
        let y = origin.y
        // Filled one part at a time: overlapping subpaths in one path could
        // cancel out under the non-zero rule and leave gaps.
        var roof = Path()
        roof.move(to: CGPoint(x: x - 25, y: y - 25))
        roof.addLine(to: CGPoint(x: x, y: y - 46))
        roof.addLine(to: CGPoint(x: x + 25, y: y - 25))
        roof.closeSubpath()
        let walls = Path(CGRect(x: x - 20, y: y - 26, width: 40, height: 26))
        let chimney = Path(CGRect(x: x + 8, y: y - 44, width: 6, height: 14))
        for part in [walls, chimney, roof] {
            context.fill(part, with: .color(tones.house.color))
        }
        if weather == .snow {
            var snow = Path()
            snow.move(to: CGPoint(x: x - 24, y: y - 26))
            snow.addLine(to: CGPoint(x: x, y: y - 45))
            snow.addLine(to: CGPoint(x: x + 24, y: y - 26))
            let style = StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
            context.stroke(snow, with: .color(SkyPalette.white.color), style: style)
        }
        let lit = moment.phase == .dusk || night
        if lit {
            let halo = Gradient(colors: [SkyPalette.windowGlow.color(opacity: 0.28), SkyPalette.windowGlow.color(opacity: 0)])
            context.fill(
                Path(CGRect(x: x - 50, y: y - 60, width: 100, height: 70)),
                with: .radialGradient(halo, center: CGPoint(x: x, y: y - 12), startRadius: 0, endRadius: 40)
            )
        }
        let window = lit ? SkyPalette.windowGlow.color : scene.sky.bottom.mixed(with: SkyPalette.white, by: 0.15).color
        if !(lit && moment.lateNight) {
            context.fill(Path(CGRect(x: x - 14, y: y - 18, width: 8, height: 7)), with: .color(window))
        }
        context.fill(Path(CGRect(x: x + 6, y: y - 18, width: 8, height: 7)), with: .color(window))
        let door = lit ? SkyPalette.windowGlow.color(opacity: 0.55) : scene.sky.bottom.mixed(with: SkyPalette.ink, by: 0.55).color
        context.fill(Path(CGRect(x: x - 3, y: y - 11, width: 6, height: 11)), with: .color(door))
    }

    /// Three puffs rising from the chimney on a loop.
    private func paintSmoke(_ context: GraphicsContext, at origin: CGPoint) {
        for index in 0..<3 {
            let progress = (scene.time * 0.35 + Double(index) / 3).truncatingRemainder(dividingBy: 1)
            let x = Double(origin.x) + 11 + sin(progress * 5 + Double(index)) * 3 + progress * 10
            let y = Double(origin.y) - 46 - progress * 34
            let puff = TodaySkyPainter.circle(x, y, 3 + progress * 6)
            context.fill(puff, with: .color(SkyPalette.smoke.color(opacity: 0.35 * (1 - progress))))
        }
    }

    /// A round tree and a pine to the right of the house; both lean in the wind.
    private func paintTrees(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let lean = condition == .wind && !still ? sin(scene.time * 2.2) * 0.08 : 0
        var round = context
        round.translateBy(x: origin.x + 36, y: origin.y + 2)
        round.rotate(by: .radians(lean))
        round.fill(Path(CGRect(x: -1.5, y: -12, width: 3, height: 12)), with: .color(tones.house.color))
        round.fill(Path(ellipseIn: CGRect(x: -11, y: -31, width: 22, height: 22)), with: .color(tones.house.color))

        var pine = context
        pine.translateBy(x: origin.x + 60, y: origin.y + 3)
        pine.rotate(by: .radians(lean * 0.7))
        var needles = Path()
        needles.move(to: CGPoint(x: -9, y: -6))
        needles.addLine(to: CGPoint(x: 0, y: -34))
        needles.addLine(to: CGPoint(x: 9, y: -6))
        needles.closeSubpath()
        pine.fill(Path(CGRect(x: -1.5, y: -7, width: 3, height: 8)), with: .color(tones.house.color))
        pine.fill(needles, with: .color(tones.house.color))
    }
}
