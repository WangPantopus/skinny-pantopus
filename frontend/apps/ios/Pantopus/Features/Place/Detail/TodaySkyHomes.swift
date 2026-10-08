//
//  TodaySkyHomes.swift
//  Pantopus
//
//  The resident's own kind of home in the scene (a house, a row of
//  townhouses, a small apartment block, a mobile home), and the street
//  lighting up after dark: warm windows along the far hill, more of them as
//  more verified homes join the block. The lights follow the k-anonymous
//  density bucket, never a count, so nothing can be read back from them.
//  Parity twin of Android's `TodaySkyHomes.kt`.
//

import SwiftUI

/// The shape the scene draws for the resident's home.
enum SkyHome: Equatable {
    case house
    case townhouse
    case apartment
    case mobile

    /// From the home record's `home_type`; a house when it's unknown.
    init(_ homeType: String?) {
        switch homeType {
        case "townhouse": self = .townhouse
        case "apartment", "condo", "studio", "multi_unit": self = .apartment
        case "mobile_home", "trailer", "rv": self = .mobile
        default: self = .house
        }
    }

    /// Half the width it takes on the ground, for the bins and the trees.
    var halfWidth: Double {
        switch self {
        case .house: 25
        case .townhouse: 38
        case .apartment: 26
        case .mobile: 29
        }
    }

    var chimney: Bool {
        self == .house || self == .townhouse
    }
}

enum SkyStreet {
    /// Lights on the far hill for the block's density bucket: none, a
    /// couple, a few, many.
    static func lights(_ bucket: String?) -> Int {
        switch bucket {
        case "forming": 2
        case "few": 4
        case "growing": 7
        default: 0
        }
    }

    /// Where the lights go, in the order they appear: along the far hill's
    /// right-hand curve past the pine (how far along it), and how far below
    /// its crest, so they gather like a hillside of windows.
    static let spots: [(at: Double, drop: Double)] = [
        (0.8, 3), (0.9, 6), (0.72, 4), (0.85, 8), (0.96, 4), (0.76, 9), (0.68, 7)
    ]
}

extension TodaySkyGround {
    /// The resident's home with its door at `origin`.
    func paintHome(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        switch home {
        case .house: paintHouse(context, tones, at: origin)
        case .townhouse: paintTownhouses(context, tones, at: origin)
        case .apartment: paintApartment(context, tones, at: origin)
        case .mobile: paintMobileHome(context, tones, at: origin)
        }
    }

    /// Lamp light after dusk, one window lit late at night like the house.
    private func windowColor(lit: Bool) -> Color {
        lit ? SkyPalette.windowGlow.color : scene.sky.bottom.mixed(with: SkyPalette.white, by: 0.15).color
    }

    private var lit: Bool {
        moment.phase == .dusk || night
    }

    private func porchGlow(_ context: GraphicsContext, at origin: CGPoint, width: Double) {
        guard lit else { return }
        let halo = Gradient(colors: [SkyPalette.windowGlow.color(opacity: 0.28), SkyPalette.windowGlow.color(opacity: 0)])
        context.fill(
            Path(CGRect(x: origin.x - width, y: origin.y - 60, width: width * 2, height: 70)),
            with: .radialGradient(halo, center: CGPoint(x: origin.x, y: origin.y - 12), startRadius: 0, endRadius: 40)
        )
    }

    /// Three attached houses; the resident's is the middle one, with the
    /// chimney, and the neighbours' sit a shade darker.
    private func paintTownhouses(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let x = Double(origin.x)
        let y = Double(origin.y)
        let side = tones.house.mixed(with: SkyPalette.ink, by: 0.12)
        unit(context, center: x - 26, width: 24, ground: y, tone: side)
        unit(context, center: x + 26, width: 24, ground: y, tone: side)
        unit(context, center: x, width: 28, ground: y, tone: tones.house)
        context.fill(Path(CGRect(x: x + 8, y: y - 42, width: 5, height: 12)), with: .color(tones.house.color))
        porchGlow(context, at: origin, width: 44)
        context.fill(Path(CGRect(x: x - 10, y: y - 18, width: 7, height: 6)), with: .color(windowColor(lit: lit)))
        context.fill(Path(CGRect(x: x + 3, y: y - 18, width: 7, height: 6)), with: .color(windowColor(lit: lit && !moment.lateNight)))
        // The neighbours' windows stay dark: only the resident's home is lit.
        for center in [x - 26, x + 26] {
            context.fill(Path(CGRect(x: center - 4, y: y - 17, width: 8, height: 6)), with: .color(windowColor(lit: false)))
        }
        let door = lit ? SkyPalette.windowGlow.color(opacity: 0.55) : scene.sky.bottom.mixed(with: SkyPalette.ink, by: 0.55).color
        context.fill(Path(CGRect(x: x - 3, y: y - 10, width: 6, height: 10)), with: .color(door))
    }

    /// One house of the row: walls and a gable.
    private func unit(_ context: GraphicsContext, center: Double, width: Double, ground y: Double, tone: SkyRGB) {
        var roof = Path()
        roof.move(to: CGPoint(x: center - width / 2 - 2, y: y - 24))
        roof.addLine(to: CGPoint(x: center, y: y - 40))
        roof.addLine(to: CGPoint(x: center + width / 2 + 2, y: y - 24))
        roof.closeSubpath()
        context.fill(Path(CGRect(x: center - width / 2, y: y - 25, width: width, height: 25)), with: .color(tone.color))
        context.fill(roof, with: .color(tone.color))
    }

    /// A small three-storey block with a flat roof; the resident's window is
    /// the warm one, a few others glow dimmer after dusk.
    private func paintApartment(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let x = Double(origin.x)
        let y = Double(origin.y)
        context.fill(Path(CGRect(x: x - 26, y: y - 50, width: 52, height: 50)), with: .color(tones.house.color))
        context.fill(Path(CGRect(x: x - 28, y: y - 52, width: 56, height: 3)), with: .color(tones.house.color))
        porchGlow(context, at: origin, width: 48)
        var random = SkyRandom(seed: 77)
        for row in 0..<3 {
            for column in 0..<4 {
                let rect = CGRect(x: x - 21 + Double(column) * 11, y: y - 44 + Double(row) * 12, width: 7, height: 6)
                // Draw the dice for every window, so the lit ones never move.
                let neighbour = random.next() < 0.35
                if row == 1, column == 1 {
                    context.fill(Path(rect), with: .color(windowColor(lit: lit)))
                } else {
                    context.fill(
                        Path(rect),
                        with: .color(lit && neighbour ? SkyPalette.windowGlow.color(opacity: 0.45) : windowColor(lit: false))
                    )
                }
            }
        }
        let door = lit ? SkyPalette.windowGlow.color(opacity: 0.55) : scene.sky.bottom.mixed(with: SkyPalette.ink, by: 0.55).color
        context.fill(Path(CGRect(x: x - 4, y: y - 9, width: 8, height: 9)), with: .color(door))
    }

    /// A long, low home on a skirt.
    private func paintMobileHome(_ context: GraphicsContext, _ tones: Tones, at origin: CGPoint) {
        let x = Double(origin.x)
        let y = Double(origin.y)
        context.fill(
            Path(roundedRect: CGRect(x: x - 29, y: y - 20, width: 58, height: 17), cornerRadius: 3),
            with: .color(tones.house.color)
        )
        context.fill(
            Path(CGRect(x: x - 26, y: y - 3, width: 52, height: 3)),
            with: .color(tones.house.mixed(with: SkyPalette.ink, by: 0.2).color)
        )
        porchGlow(context, at: origin, width: 46)
        for (index, left) in [x - 22, x - 8, x + 12].enumerated() {
            let late = index == 0 && moment.lateNight
            context.fill(Path(CGRect(x: left, y: y - 15, width: 8, height: 5)), with: .color(windowColor(lit: lit && !late)))
        }
        let door = lit ? SkyPalette.windowGlow.color(opacity: 0.55) : scene.sky.bottom.mixed(with: SkyPalette.ink, by: 0.55).color
        context.fill(Path(CGRect(x: x + 3, y: y - 15, width: 6, height: 12)), with: .color(door))
    }

    /// A cubic Bézier through four control values, at `t` in 0...1.
    private static func bezier(_ v: [Double], at t: Double) -> Double {
        let u = 1 - t
        let a = u * u * u * v[0]
        let b = 3 * u * u * t * v[1]
        let c = 3 * u * t * t * v[2]
        return a + b + c + t * t * t * v[3]
    }

    /// After dusk, warm windows along the far hill: the verified homes on
    /// the block, as many as the density bucket allows.
    func paintStreetLights(_ context: GraphicsContext) {
        let w = scene.width
        let y = scene.horizon
        // The far hill's right-hand curve, as drawn in `paintHills`: its four
        // control points' x and y.
        let xs: [Double] = [w * 0.6, w * 0.78, w * 0.9, w]
        let ys: [Double] = [y - 10, y - 18, y - 6, y - 12]
        let glow = Gradient(colors: [SkyPalette.windowGlow.color(opacity: 0.3), SkyPalette.windowGlow.color(opacity: 0)])
        for spot in SkyStreet.spots.prefix(streetLights) {
            let center = CGPoint(x: Self.bezier(xs, at: spot.at), y: Self.bezier(ys, at: spot.at) + spot.drop)
            context.fill(
                Path(CGRect(x: center.x - 6, y: center.y - 6, width: 12, height: 12)),
                with: .radialGradient(glow, center: center, startRadius: 0, endRadius: 6)
            )
            context.fill(Path(CGRect(x: center.x - 1.2, y: center.y - 1, width: 2.4, height: 2)), with: .color(SkyPalette.windowGlow.color))
        }
    }
}
