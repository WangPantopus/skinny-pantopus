//
//  TodaySkyPainter.swift
//  Pantopus
//
//  Draws the living sky for `TodaySkyHero`: sky gradient, stars, sun or
//  moon, clouds, rain, snow, fog, wind, lightning, then the hills, the
//  house and its trees. Pure drawing, no state: the same inputs always
//  give the same picture, and `still` gives the motionless one.
//  Parity twin of Android's `TodaySkyPainter.kt`; the numbers match.
//

import SwiftUI

struct TodaySkyPainter {
    let condition: WeatherConditionCode
    let moment: SkyMoment
    /// The current temperature, °F: smoke from the chimney below 50, frost at 32.
    let temperature: Double
    /// Today's note, when it has a picture: bins at the curb.
    var note: SkyNote?
    var season: SkySeason = .summer
    /// A meteor shower's peak night: shooting stars whatever the note says.
    var meteorShower = false
    let still: Bool

    private var weather: SkyPalette.Weather {
        SkyPalette.Weather(condition)
    }

    private var night: Bool {
        moment.phase == .night
    }

    func paint(_ context: GraphicsContext, size: CGSize, time: Double) {
        let scene = Scene(size: size, time: still ? 2 : time, sky: SkyPalette.sky(moment.phase, weather))
        let clear = weather == .clear || weather == .partly
        paintSky(context, scene)
        if night, clear { paintStars(context, scene) }
        if night, clear, meteorShower { paintMeteors(context, scene) }
        if night { paintMoon(context, scene) } else { paintSun(context, scene) }
        paintClouds(context, scene)
        paintRain(context, scene)
        paintSnow(context, scene)
        if condition == .wind { paintWind(context, scene) }
        if weather == .storm, !still { paintLightning(context, scene) }
        TodaySkyGround(
            scene: scene,
            weather: weather,
            moment: moment,
            condition: condition,
            cold: temperature < 50,
            still: still,
            bins: note?.bins ?? [],
            season: season
        ).paint(context)
        // Fog hugs the ground, in front of the house and below the reading.
        paintFog(context, scene)
        paintScrim(context, scene)
        if temperature <= 32 { paintFrost(context, scene) }
    }

    /// One cloud of the overcast deck: where it starts (fraction of its
    /// track), its base line, width, drift speed and which row it is in.
    private struct DeckCloud {
        let start: Double
        let y: Double
        let width: Double
        let speed: Double
        let upper: Bool
    }

    /// Geometry and time shared by every layer.
    struct Scene {
        let size: CGSize
        let time: Double
        let sky: SkyPalette.Sky

        var width: Double {
            size.width
        }

        var height: Double {
            size.height
        }

        var horizon: Double {
            size.height - 34
        }

        /// A position that drifts at `speed` points a second and wraps over `span`.
        func drift(_ base: Double, speed: Double, span: Double, still: Bool) -> Double {
            let raw = (base + (still ? 0 : time * speed)).truncatingRemainder(dividingBy: span)
            return raw < 0 ? raw + span : raw
        }
    }

    /// The day's first and last golden hour warm the horizon until dawn's or
    /// dusk's own sky takes over: 0 outside them, up to 0.5 at the handover.
    private var goldenWarmth: Double {
        guard moment.phase == .day else { return 0 }
        let evening = (moment.minutes - (moment.sunset - 60)) / 20
        let morning = (moment.sunrise + 60 - moment.minutes) / 20
        return min(max(max(evening, morning), 0), 1) * 0.5
    }

    private func paintSky(_ context: GraphicsContext, _ scene: Scene) {
        let warmth = goldenWarmth
        let gradient = Gradient(stops: [
            .init(color: scene.sky.top.color, location: 0),
            .init(color: scene.sky.mid.mixed(with: SkyPalette.sunLow, by: warmth * 0.4).color, location: 0.55),
            .init(color: scene.sky.bottom.mixed(with: SkyPalette.sunLow, by: warmth).color, location: 1)
        ])
        context.fill(
            Path(CGRect(origin: .zero, size: scene.size)),
            with: .linearGradient(gradient, startPoint: .zero, endPoint: CGPoint(x: 0, y: scene.horizon + 10))
        )
    }

    private func paintStars(_ context: GraphicsContext, _ scene: Scene) {
        var random = SkyRandom(seed: 7)
        for _ in 0..<46 {
            let x = random.next() * scene.width
            let y = random.next() * scene.horizon * 0.8
            let radius = 0.5 + random.next() * 1.1
            let speed = 0.6 + random.next() * 1.6
            let offset = random.next() * 6.28
            let twinkle = still ? 0.75 : 0.45 + 0.55 * (0.5 + 0.5 * sin(scene.time * speed + offset))
            context.fill(Self.circle(x, y, radius), with: .color(SkyPalette.white.color(opacity: 0.85 * twinkle)))
        }
    }

    private func paintSun(_ context: GraphicsContext, _ scene: Scene) {
        // The sun rides the right half of the sky: low at dawn and dusk, high at noon.
        let fraction = moment.dayFraction
        let x = scene.width * (0.56 + 0.32 * fraction)
        let y = scene.horizon - 18 - sin(.pi * fraction) * (scene.horizon - 58)
        let core = moment.phase == .dawn || moment.phase == .dusk ? SkyPalette.sunLow : SkyPalette.sunHigh
        let veiled = weather != .clear && weather != .partly
        glow(context, scene, Glow(center: CGPoint(x: x, y: y), radius: 78, color: core, opacity: veiled ? 0.22 : 0.45))
        guard !veiled else { return }
        var rays = context
        rays.translateBy(x: x, y: y)
        rays.rotate(by: .radians(still ? 0 : scene.time * 0.12))
        var path = Path()
        for index in 0..<12 {
            let angle = Double(index) / 12 * 2 * .pi
            let pulse = still ? 0 : sin(scene.time * 1.4 + Double(index)) * 2
            path.move(to: CGPoint(x: cos(angle) * 25, y: sin(angle) * 25))
            path.addLine(to: CGPoint(x: cos(angle) * (33 + pulse), y: sin(angle) * (33 + pulse)))
        }
        rays.stroke(path, with: .color(core.color(opacity: 0.55)), style: StrokeStyle(lineWidth: 2, lineCap: .round))
        context.fill(Self.circle(x, y, 18), with: .color(core.color))
        context.fill(Self.circle(x - 5, y - 5, 8), with: .color(SkyPalette.white.color(opacity: 0.35)))
    }

    private func paintMoon(_ context: GraphicsContext, _ scene: Scene) {
        guard weather != .wet, weather != .snow, weather != .storm else { return }
        let x = scene.width * 0.8
        let y = 50.0
        let veiled = weather == .overcast || weather == .fog
        // A full moon lights up more of the sky.
        let full = abs(moment.moonPhase - 0.5) < 0.034
        let light = Glow(
            center: CGPoint(x: x, y: y),
            radius: full ? 92 : 70,
            color: SkyPalette.moonGlow,
            opacity: veiled ? 0.12 : (full ? 0.3 : 0.22)
        )
        glow(context, scene, light)
        guard !veiled else { return }
        context.fill(Self.circle(x, y, 17), with: .color(SkyPalette.moonShadow.color(opacity: 0.13)))
        let disc = Self.moonPath(center: CGPoint(x: x, y: y), radius: 17, phase: moment.moonPhase)
        context.fill(disc, with: .color(SkyPalette.moon.color))
        // Faint maria on the lit part, so it reads as the moon and not a lamp.
        var maria = context
        maria.clip(to: disc)
        for spot in [[-5.0, -4.0, 4.5], [4.0, 2.0, 3.5], [-1.0, 7.0, 2.8], [6.0, -6.0, 2.0]] {
            maria.fill(Self.circle(x + spot[0], y + spot[1], spot[2]), with: .color(SkyPalette.moonShadow.color(opacity: 0.45)))
        }
    }

    private func paintClouds(_ context: GraphicsContext, _ scene: Scene) {
        if weather == .partly {
            // Two puffs near the sun or moon; they sway rather than cross the reading.
            let tint: SkyRGB = switch moment.phase {
            case .night: SkyPalette.cloudNight
            case .dawn: SkyPalette.cloudDawn
            case .dusk: SkyPalette.cloudDusk
            case .day: SkyPalette.white
            }
            let sway = { (offset: Double) in still ? 0 : sin(scene.time * 0.18 + offset) * 12 }
            cloud(context, Puff(x: scene.width * 0.5 + sway(0), y: 70, width: 96, color: tint, opacity: night ? 0.9 : 0.88))
            cloud(context, Puff(x: scene.width * 0.74 + sway(2), y: 92, width: 120, color: tint, opacity: night ? 0.95 : 0.97))
        } else if weather != .clear {
            // A deck across the top, close to the sky's own colour so the reading stays legible.
            let storm = weather == .storm
            let deck = storm ? scene.sky.top.mixed(with: SkyPalette.black, by: 0.1)
                : scene.sky.top.mixed(with: SkyPalette.white, by: night ? 0.08 : 0.16)
            let lower = storm ? scene.sky.mid.mixed(with: SkyPalette.black, by: 0.05)
                : scene.sky.mid.mixed(with: SkyPalette.white, by: night ? 0.06 : 0.2)
            let layers = [
                DeckCloud(start: 0, y: 24, width: 150, speed: 5, upper: true),
                DeckCloud(start: 0.3, y: 18, width: 170, speed: 5, upper: true),
                DeckCloud(start: 0.62, y: 26, width: 160, speed: 5, upper: true),
                DeckCloud(start: 0.9, y: 20, width: 140, speed: 5, upper: true),
                DeckCloud(start: 0.12, y: 52, width: 130, speed: 9, upper: false),
                DeckCloud(start: 0.5, y: 60, width: 150, speed: 9, upper: false),
                DeckCloud(start: 0.82, y: 50, width: 120, speed: 9, upper: false)
            ]
            for layer in layers {
                let span = scene.width + layer.width
                let x = scene.drift(layer.start * span, speed: layer.speed, span: span, still: still) - layer.width
                cloud(
                    context,
                    Puff(x: x, y: layer.y, width: layer.width, color: layer.upper ? deck : lower, opacity: layer.upper ? 0.95 : 0.9)
                )
            }
        }
    }

    private func paintRain(_ context: GraphicsContext, _ scene: Scene) {
        guard weather == .wet || weather == .storm else { return }
        var random = SkyRandom(seed: 11)
        let count = weather == .storm ? 90 : condition == .sleet ? 40 : 70
        var path = Path()
        for _ in 0..<count {
            let start = random.next() * (scene.width + 40)
            let speed = 380 + random.next() * 160
            let length = 9 + random.next() * 7
            let offset = random.next() * scene.height
            let span = scene.height + length
            let fall = (offset + (still ? 0 : scene.time * speed)).truncatingRemainder(dividingBy: span)
            let y = fall - length
            let x = start - (y + length) * 0.22
            path.move(to: CGPoint(x: x, y: y))
            path.addLine(to: CGPoint(x: x - length * 0.22, y: y + length))
        }
        let color = night ? SkyPalette.rainNight.color(opacity: 0.45) : SkyPalette.rainDay.color(opacity: 0.55)
        context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: 1.2, lineCap: .round))
    }

    private func paintSnow(_ context: GraphicsContext, _ scene: Scene) {
        guard weather == .snow || condition == .sleet else { return }
        var random = SkyRandom(seed: 23)
        let count = condition == .sleet ? 26 : 55
        for _ in 0..<count {
            let start = random.next() * scene.width
            let speed = 18 + random.next() * 24
            let radius = 1 + random.next() * 1.7
            let offset = random.next() * scene.height
            let amplitude = 5 + random.next() * 9
            let frequency = 0.5 + random.next() * 0.8
            let phase = random.next() * 6.28
            let opacity = 0.65 + random.next() * 0.3
            let moving = still ? 0 : scene.time
            let y = (offset + moving * speed).truncatingRemainder(dividingBy: scene.height + 8) - 4
            let x = start + sin(moving * frequency + phase) * amplitude
            context.fill(Self.circle(x, y, radius), with: .color(SkyPalette.white.color(opacity: opacity)))
        }
    }

    /// Soft puffs of fog drifting along the ground, in front of the house and
    /// below the reading: stretched radial glows, so no band ever shows an edge.
    private func paintFog(_ context: GraphicsContext, _ scene: Scene) {
        guard weather == .fog else { return }
        let tint = night ? SkyPalette.fogNight : SkyPalette.fogDay
        let glow = Gradient(colors: [tint.color(opacity: night ? 0.22 : 0.45), tint.color(opacity: 0)])
        let span = scene.width * 1.6
        for index in 0..<6 {
            let speed: Double = index.isMultiple(of: 2) ? 7 : -5
            let x = scene.drift(Double(index) * span / 6, speed: speed, span: span, still: still) - scene.width * 0.3
            var puff = context
            puff.translateBy(x: x, y: scene.horizon - 12 + Double(index % 3) * 12)
            puff.scaleBy(x: 9, y: 1)
            puff.fill(Self.circle(0, 0, 13), with: .radialGradient(glow, center: .zero, startRadius: 0, endRadius: 13))
        }
    }

    private func paintWind(_ context: GraphicsContext, _ scene: Scene) {
        var random = SkyRandom(seed: 31)
        let moving = still ? 0 : scene.time
        for _ in 0..<4 {
            let span = scene.width + 60
            let speed = 55 + random.next() * 35
            let base = 40 + random.next() * 90
            let phase = random.next() * 6.28
            let x = scene.drift(random.next() * span, speed: speed, span: span, still: still) - 30
            var leaf = context
            leaf.translateBy(x: x, y: base + sin(moving * 2 + phase) * 8)
            leaf.rotate(by: .radians(moving * 3 + phase))
            let color = night ? SkyPalette.leafNight.color(opacity: 0.7) : SkyPalette.leafDay.color(opacity: 0.85)
            leaf.fill(Path(ellipseIn: CGRect(x: -4, y: -2, width: 8, height: 4)), with: .color(color))
        }
        var streaks = Path()
        for index in 0..<4 {
            let span = scene.width + 160
            let x = scene.drift(Double(index) * 0.27 * span, speed: 70 + Double(index) * 12, span: span, still: still) - 120
            let y = 40 + Double(index) * 26
            streaks.move(to: CGPoint(x: x, y: y))
            streaks.addCurve(
                to: CGPoint(x: x + 110, y: y),
                control1: CGPoint(x: x + 40, y: y - 6),
                control2: CGPoint(x: x + 70, y: y + 6)
            )
        }
        let color = SkyPalette.white.color(opacity: night ? 0.28 : 0.5)
        context.stroke(streaks, with: .color(color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
    }

    /// A soft double flash about every seven seconds: well under the three
    /// flashes a second that photosensitivity guidance allows, and never
    /// drawn with Reduce Motion (the painter is `still` then).
    private func paintLightning(_ context: GraphicsContext, _ scene: Scene) {
        let period = 7.0
        let cycle = (scene.time / period).rounded(.down)
        let local = scene.time - cycle * period
        var random = SkyRandom(seed: UInt32(truncatingIfNeeded: 100 + Int(cycle)))
        let strike = 1 + random.next() * 4
        let since = local - strike
        let opacity: Double = if since >= 0, since < 0.09 { 0.28 } else if since >= 0.17, since < 0.25 { 0.18 } else { 0 }
        guard opacity > 0 else { return }
        context.fill(Path(CGRect(origin: .zero, size: scene.size)), with: .color(SkyPalette.lightning.color(opacity: opacity)))
        let x = scene.width * (0.35 + random.next() * 0.5)
        var bolt = Path()
        bolt.move(to: CGPoint(x: x, y: 40))
        bolt.addLine(to: CGPoint(x: x - 8, y: 70))
        bolt.addLine(to: CGPoint(x: x + 4, y: 72))
        bolt.addLine(to: CGPoint(x: x - 6, y: scene.horizon - 20))
        context.stroke(bolt, with: .color(SkyPalette.bolt.color(opacity: 0.9)), lineWidth: 2)
    }

    /// Darkens the left of the sky so the white reading keeps its contrast:
    /// with it every scene gives the temperature and condition (large text)
    /// at least 3:1 and "NOW" 4.5:1; the chips carry their own backing.
    private func paintScrim(_ context: GraphicsContext, _ scene: Scene) {
        let gradient = Gradient(colors: [SkyPalette.scrim.color(opacity: 0.4), SkyPalette.scrim.color(opacity: 0)])
        context.fill(
            Path(CGRect(x: 0, y: 0, width: scene.width * 0.8, height: scene.horizon)),
            with: .linearGradient(gradient, startPoint: .zero, endPoint: CGPoint(x: scene.width * 0.8, y: 0))
        )
    }
}

// MARK: - Shapes

extension TodaySkyPainter {
    static func circle(_ x: Double, _ y: Double, _ radius: Double) -> Path {
        Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
    }

    /// A soft light around the sun or moon.
    private struct Glow {
        let center: CGPoint
        let radius: Double
        let color: SkyRGB
        let opacity: Double
    }

    private func glow(_ context: GraphicsContext, _ scene: Scene, _ glow: Glow) {
        let gradient = Gradient(colors: [glow.color.color(opacity: glow.opacity), glow.color.color(opacity: 0)])
        context.fill(
            Path(CGRect(origin: .zero, size: scene.size)),
            with: .radialGradient(gradient, center: glow.center, startRadius: 0, endRadius: glow.radius)
        )
    }

    /// One cloud: its base line's left end, width, colour and opacity.
    private struct Puff {
        let x: Double
        let y: Double
        let width: Double
        let color: SkyRGB
        let opacity: Double
    }

    private func cloud(_ context: GraphicsContext, _ puff: Puff) {
        let path = Self.unitCloud.applying(CGAffineTransform(translationX: puff.x, y: puff.y).scaledBy(x: puff.width, y: puff.width))
        // Lit from above: a lighter crown fading to the cloud's own colour at its base.
        let gradient = Gradient(colors: [
            puff.color.mixed(with: SkyPalette.white, by: 0.22).color(opacity: puff.opacity),
            puff.color.color(opacity: puff.opacity)
        ])
        context.fill(
            path,
            with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: puff.y - 0.56 * puff.width), endPoint: CGPoint(x: 0, y: puff.y))
        )
    }

    /// A cloud one point wide sitting on a flat base at y = 0: four puffs and a base bar, unioned once.
    private static let unitCloud: Path = {
        let puffs: [(Double, Double)] = [(0.2, 0.2), (0.45, 0.28), (0.7, 0.22), (0.86, 0.14)]
        var shape = Path(CGRect(x: 0.2, y: -0.14, width: 0.66, height: 0.14))
        for (center, radius) in puffs {
            shape = shape.union(Path(ellipseIn: CGRect(x: center - radius, y: -2 * radius, width: 2 * radius, height: 2 * radius)))
        }
        return shape
    }()

    /// The lit part of the moon for a phase (0 new → 0.5 full → 1 new), as
    /// seen from the northern hemisphere: waxing lights the right side.
    static func moonPath(center: CGPoint, radius: Double, phase: Double) -> Path {
        let terminator = cos(2 * .pi * phase)
        let waxing = phase < 0.5
        let steps = 40
        var path = Path()
        for step in 0...steps {
            let y = -radius + 2 * radius * Double(step) / Double(steps)
            let edge = (radius * radius - y * y).squareRoot()
            let point = CGPoint(x: center.x + (waxing ? edge : -edge), y: center.y + y)
            if step == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        for step in stride(from: steps, through: 0, by: -1) {
            let y = -radius + 2 * radius * Double(step) / Double(steps)
            let edge = (radius * radius - y * y).squareRoot()
            path.addLine(to: CGPoint(x: center.x + (waxing ? terminator : -terminator) * edge, y: center.y + y))
        }
        path.closeSubpath()
        return path
    }
}

/// The scene's deterministic random numbers, so stars and raindrops keep their places.
struct SkyRandom {
    private var state: UInt32

    init(seed: UInt32) {
        state = seed
    }

    mutating func next() -> Double {
        state = state &* 1_664_525 &+ 1_013_904_223
        return Double(state) / 4_294_967_296
    }
}
