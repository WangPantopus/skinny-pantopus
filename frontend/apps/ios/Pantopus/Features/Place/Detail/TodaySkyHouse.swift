//
//  TodaySkyHouse.swift
//  Pantopus
//
//  The resident's house in the living sky, drawn from its county record
//  (`SkyHome`, from the Your Home section's outline): one, one and a half,
//  two or three storeys, a gable, hip or flat roof, an attached or detached
//  garage with a door per car or a carport (right of the house, clear of
//  the reading), a chimney when it has a fireplace, and a pool. With
//  nothing on record it is the scene's first house: 40 × 26 points under a
//  gable, with a chimney. All one silhouette in the horizon's colour; only
//  the windows, the door and the garage doors catch the light. Parity twin
//  of Android's `TodaySkyHouse.kt`.
//

import SwiftUI

extension TodaySkyGround {
    /// The house with its door at `origin` (the ground line).
    func paintHouse(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let x = Double(origin.x)
        let y = Double(origin.y)
        let top = y - home.wallHeight
        paintGarage(context, tones, at: origin)
        // Filled one part at a time: overlapping subpaths in one path could
        // cancel out under the non-zero rule and leave gaps.
        var parts = [Path(CGRect(x: x - home.width / 2, y: top, width: home.width, height: home.wallHeight))]
        if home.chimney {
            let chimney = home.chimneyTop(at: origin)
            parts.append(Path(CGRect(x: chimney.x, y: chimney.y, width: 6, height: home.roof == .flat ? 12 : 14)))
        }
        parts.append(Self.roof(home.roof, left: x - home.width / 2, right: x + home.width / 2, top: top, ridge: 20))
        for part in parts {
            context.fill(part, with: .color(tones.house.color))
        }
        if weather == .snow {
            paintSnow(context, along: Self.snowLine(home.roof, left: x - home.width / 2, right: x + home.width / 2, top: top, ridge: 20))
        }
        let lit = moment.phase == .dusk || night
        if lit {
            let halo = Gradient(colors: [SkyPalette.windowGlow.color(opacity: 0.28), SkyPalette.windowGlow.color(opacity: 0)])
            context.fill(
                Path(CGRect(x: x - 50, y: y - 60, width: 100, height: 70)),
                with: .radialGradient(halo, center: CGPoint(x: x, y: y - 12), startRadius: 0, endRadius: 40)
            )
        }
        paintWindows(context, at: origin, lit: lit)
        let door = lit ? SkyPalette.windowGlow.color(opacity: 0.55) : scene.sky.bottom.mixed(with: SkyPalette.ink, by: 0.55).color
        context.fill(Path(CGRect(x: x - 3, y: y - 11, width: 6, height: 11)), with: .color(door))
        if home.pool {
            let water = SkyPalette.pool.mixed(with: tones.house, by: night ? 0.7 : lit ? 0.45 : 0.25)
            context.fill(
                Path(roundedRect: CGRect(x: x - home.width / 2 - 15, y: y + 1.5, width: 16, height: 3.5), cornerRadius: 1.5),
                with: .color(water.color)
            )
        }
    }

    /// A row of windows a storey (the first house has one), lamp-lit after
    /// dusk; late at night only the top row's last window stays lit.
    private func paintWindows(_ context: GraphicsContext, at origin: CGPoint, lit: Bool) {
        let x = Double(origin.x)
        let y = Double(origin.y)
        let stories = home.stories ?? 1
        let rows = stories >= 2.5 ? 3 : stories >= 2 ? 2 : 1
        let glass = lit ? SkyPalette.windowGlow.color : scene.sky.bottom.mixed(with: SkyPalette.white, by: 0.15).color
        for row in 0..<rows {
            var columns = [x - home.width / 2 + 6, x + home.width / 2 - 14]
            // Wide upper floors get a middle window over the door.
            if row > 0, home.width >= 44 { columns.insert(x - 4, at: 1) }
            for (index, left) in columns.enumerated() {
                let keeps = row == rows - 1 && index == columns.count - 1
                if lit, moment.lateNight, !keeps { continue }
                context.fill(Path(CGRect(x: left, y: y - 18 - Double(row) * 16, width: 8, height: 7)), with: .color(glass))
            }
        }
        // A storey and a half: the attic window in the gable.
        if stories > 1, stories < 2, home.roof == .gable, !(lit && moment.lateNight) {
            context.fill(Path(CGRect(x: x - 3, y: y - home.wallHeight - 10, width: 6, height: 6)), with: .color(glass))
        }
    }

    /// An attached or detached garage right of the house with a door per car,
    /// under a roof like the house's; or a carport, a roof on two posts.
    private func paintGarage(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let x = Double(origin.x)
        let y = Double(origin.y)
        let color = tones.house.color
        switch home.garage {
        case .none:
            return
        case .carport:
            let left = x + home.width / 2 - 1
            context.fill(Path(CGRect(x: left, y: y - 17, width: 21, height: 2.5)), with: .color(color))
            for post in [left + 9, left + 18] {
                context.fill(Path(CGRect(x: post, y: y - 15, width: 1.6, height: 15)), with: .color(color))
            }
        case .attached, .detached:
            let width = home.garageWidth
            let attached = home.garage == .attached
            let left = x + home.width / 2 + (attached ? 0 : 5)
            let top = y - 18
            // An attached garage tucks under the house's wall, so no seam shows.
            let walls = CGRect(x: left - (attached ? 2 : 0), y: top, width: width + (attached ? 2 : 0), height: 18)
            context.fill(Path(walls), with: .color(color))
            context.fill(Self.roof(home.roof, left: left, right: left + width, top: top, ridge: 9), with: .color(color))
            if weather == .snow {
                paintSnow(context, along: Self.snowLine(home.roof, left: left, right: left + width, top: top, ridge: 9))
            }
            let doors = home.garageSpaces
            let doorWidth = doors == 1 ? 10.0 : 9.0
            let span = Double(doors) * doorWidth + Double(doors - 1) * 2
            let panel = tones.house.mixed(with: scene.sky.bottom, by: 0.18).color
            for index in 0..<doors {
                let door = CGRect(x: left + (width - span) / 2 + Double(index) * (doorWidth + 2), y: y - 11, width: doorWidth, height: 11)
                context.fill(Path(door), with: .color(panel))
            }
        }
    }

    /// The roof over walls from `left` to `right` whose top is at `top`: a
    /// gable `ridge` points high, a lower hip, or a flat slab.
    static func roof(_ roof: SkyHome.Roof, left: Double, right: Double, top: Double, ridge: Double) -> Path {
        var path = Path()
        guard roof != .flat else {
            path.addRect(CGRect(x: left - 2, y: top - 3, width: right - left + 4, height: 4))
            return path
        }
        path.addLines(roofLine(roof, left: left - 5, right: right + 5, top: top + 1, ridge: ridge))
        path.closeSubpath()
        return path
    }

    /// The roof's top edge from eave to eave: up to the ridge (a gable) or
    /// to a short flat top 14 points in from each eave (a hip, 0.65 as high).
    private static func roofLine(_ roof: SkyHome.Roof, left: Double, right: Double, top: Double, ridge: Double) -> [CGPoint] {
        if roof == .hip {
            let rise = (ridge * 0.65).rounded()
            let inset = min(14, (right - left) / 2 - 2)
            return [
                CGPoint(x: left, y: top), CGPoint(x: left + inset, y: top - rise),
                CGPoint(x: right - inset, y: top - rise), CGPoint(x: right, y: top)
            ]
        }
        return [CGPoint(x: left, y: top), CGPoint(x: (left + right) / 2, y: top - ridge - 1), CGPoint(x: right, y: top)]
    }

    /// Where snow lies on the roof over walls from `left` to `right`: along its top edge.
    static func snowLine(_ roof: SkyHome.Roof, left: Double, right: Double, top: Double, ridge: Double) -> [CGPoint] {
        guard roof != .flat else { return [CGPoint(x: left - 1, y: top - 3), CGPoint(x: right + 1, y: top - 3)] }
        return roofLine(roof, left: left - 4, right: right + 4, top: top, ridge: ridge - 2)
    }

    private func paintSnow(_ context: GraphicsContext, along line: [CGPoint]) {
        var snow = Path()
        snow.addLines(line)
        let style = StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
        context.stroke(snow, with: .color(SkyPalette.white.color), style: style)
    }
}
