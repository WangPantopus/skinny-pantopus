//
//  TodaySkyGround.swift
//  Pantopus
//
//  The bottom of the living sky: two hills, the resident's house and two
//  trees as silhouettes in the horizon's own colour. Windows glow after
//  dusk (one stays lit late at night), the chimney smokes below 50°F,
//  snow caps the roof and hills, the trees lean in the wind and the round
//  one follows the season, and on a pickup evening the bins wait at the curb.
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
    /// Bins at the curb, in order: "garbage", "recycling", "yard_waste".
    var bins: [String] = []
    var season: SkySeason = .summer
    /// The resident's kind of home (`TodaySkyHomes.swift`).
    var home: SkyHome = .house
    /// Lights on the far hill after dusk, from the block's density bucket.
    var streetLights = 0

    struct Tones {
        let backHill: SkyRGB
        let frontHill: SkyRGB
        let house: SkyRGB
    }

    var night: Bool {
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
        if streetLights > 0, moment.phase == .dusk || night { paintStreetLights(context) }
        let house = CGPoint(x: scene.width * 0.7, y: scene.horizon + 7)
        paintHome(context, tones, at: house)
        if !bins.isEmpty { paintBins(context, tones, at: house) }
        if cold, !still, home.chimney { paintSmoke(context, at: house) }
        paintTrees(context, tones, at: house)
    }

    /// Where the bins stand in a card of `size`, for the button over them.
    static func binsCenter(in size: CGSize, count: Int, home: SkyHome = .house) -> CGPoint {
        let right = Double(size.width) * 0.7 - home.halfWidth - 2
        // Horizon (34 above the bottom), down 7 to the house's ground line and 8 more to the curb,
        // then up 5 to the bins' middle.
        return CGPoint(x: right - (Double(count) * 9 - 2) / 2, y: Double(size.height) - 34 + 7 + 8 - 5)
    }

    /// Bins at the curb left of the house, a little in front of it, lit by
    /// the porch after dark.
    private func paintBins(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let lit = moment.phase == .dusk || night
        let right = Double(origin.x) - home.halfWidth - 2
        let base = Double(origin.y) + 8
        if lit {
            let width = Double(bins.count) * 9 + 12
            let glow = Gradient(colors: [SkyPalette.windowGlow.color(opacity: 0.22), SkyPalette.windowGlow.color(opacity: 0)])
            context.fill(
                Path(CGRect(x: right - width, y: base - 22, width: width + 6, height: 26)),
                with: .radialGradient(glow, center: CGPoint(x: right - width / 2 + 3, y: base - 5), startRadius: 0, endRadius: 18)
            )
        }
        for (index, kind) in bins.reversed().enumerated() {
            let colour: SkyRGB = switch kind {
            case "recycling": SkyPalette.binRecycling
            case "yard_waste": SkyPalette.binYard
            default: SkyPalette.binGarbage
            }
            let tint = colour.mixed(with: tones.house, by: night ? 0.55 : 0.35).color
            let x = right - Double(index + 1) * 9 + 2
            context.fill(Path(roundedRect: CGRect(x: x, y: base - 9, width: 7, height: 9), cornerRadius: 1.2), with: .color(tint))
            context.fill(
                Path(roundedRect: CGRect(x: x - 0.6, y: base - 10.6, width: 8.2, height: 2), cornerRadius: 0.8),
                with: .color(tint)
            )
        }
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
    func paintHouse(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
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
    /// The round tree blossoms in spring, turns in autumn and is bare in winter.
    private func paintTrees(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let lean = condition == .wind && !still ? sin(scene.time * 2.2) * 0.08 : 0
        var round = context
        // Beside the home, however wide it is.
        round.translateBy(x: origin.x + 11 + home.halfWidth, y: origin.y + 2)
        round.rotate(by: .radians(lean))
        round.fill(Path(CGRect(x: -1.5, y: -12, width: 3, height: 12)), with: .color(tones.house.color))
        if season == .winter {
            paintBareBranches(round, tones)
        } else {
            paintCanopy(round, tones)
            if season == .spring { paintBlossom(round) }
            if season == .autumn, !still { paintFallingLeaves(round) }
        }

        var pine = context
        pine.translateBy(x: origin.x + 35 + home.halfWidth, y: origin.y + 3)
        pine.rotate(by: .radians(lean * 0.7))
        var needles = Path()
        needles.move(to: CGPoint(x: -9, y: -6))
        needles.addLine(to: CGPoint(x: 0, y: -34))
        needles.addLine(to: CGPoint(x: 9, y: -6))
        needles.closeSubpath()
        pine.fill(Path(CGRect(x: -1.5, y: -7, width: 3, height: 8)), with: .color(tones.house.color))
        pine.fill(needles, with: .color(tones.house.mixed(with: SkyPalette.pine, by: night ? 0.12 : 0.4).color))
    }

    /// A leafy crown lit from the upper left over its darker shade side,
    /// which turns deep red in autumn.
    private func paintCanopy(_ tree: GraphicsContext, _ tones: Tones) {
        let leaf: SkyRGB = switch season {
        case .spring: SkyPalette.treeSpring
        case .autumn: SkyPalette.treeAutumn
        default: SkyPalette.treeSummer
        }
        let amount = night ? 0.22 : 0.62
        let shade = season == .autumn
            ? tones.house.mixed(with: SkyPalette.treeAutumnDeep, by: night ? 0.2 : 0.6)
            : tones.house.mixed(with: leaf, by: amount * 0.6)
        tree.fill(Path(ellipseIn: CGRect(x: -10, y: -30, width: 22, height: 21)), with: .color(shade.color))
        tree.fill(
            Path(ellipseIn: CGRect(x: -11, y: -31.5, width: 17, height: 16)),
            with: .color(tones.house.mixed(with: leaf, by: amount).color)
        )
    }

    private func paintBareBranches(_ tree: GraphicsContext, _ tones: Tones) {
        var branches = Path()
        branches.move(to: CGPoint(x: 0, y: -10))
        branches.addLine(to: CGPoint(x: 0, y: -30))
        // Each twig: where it leaves the trunk, and its tip.
        for twig in [[-16.0, -9.0, -27.0], [-19.0, 8.0, -29.0], [-24.0, -5.0, -33.0], [-25.0, 5.0, -34.0]] {
            branches.move(to: CGPoint(x: 0, y: twig[0]))
            branches.addLine(to: CGPoint(x: twig[1], y: twig[2]))
        }
        tree.stroke(branches, with: .color(tones.house.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
    }

    private func paintBlossom(_ tree: GraphicsContext) {
        let tint = SkyPalette.blossom.color(opacity: night ? 0.35 : 0.9)
        for (x, y) in [(-6.0, -26.0), (3.0, -28.0), (7.0, -22.0), (-3.0, -19.0), (-8.0, -20.0), (2.0, -16.0)] {
            tree.fill(TodaySkyPainter.circle(x, y, 1.5), with: .color(tint))
        }
    }

    /// Two leaves drifting down from the canopy on a loop.
    private func paintFallingLeaves(_ tree: GraphicsContext) {
        let tint = SkyPalette.treeAutumn.color(opacity: night ? 0.4 : 0.85)
        for index in 0..<2 {
            let progress = (scene.time * 0.22 + Double(index) * 0.5).truncatingRemainder(dividingBy: 1)
            var leaf = tree
            leaf.translateBy(x: 6 - Double(index) * 12 + sin(progress * 9 + Double(index)) * 4, y: -20 + progress * 22)
            leaf.rotate(by: .radians(progress * 6 + Double(index)))
            leaf.fill(Path(ellipseIn: CGRect(x: -2, y: -1, width: 4, height: 2)), with: .color(tint.opacity(1 - progress * 0.7)))
        }
    }
}
