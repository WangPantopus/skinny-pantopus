//
//  TodaySkyWind.swift
//  Pantopus
//
//  The wind in the living sky. The forecast's sustained speed sets how hard
//  it blows: the trees lean and sway, the chimney smoke bends, the clouds
//  drift, rain and snow slant, and from 12 mph streaks of air (from 20 a few
//  leaves too) cross the sky. Under 5 mph it's calm, and none of that moves.
//  With motion off the trees hold a still lean. The scene looks south (the
//  sun rises on the left), so a west wind blows to the left. Shared with the
//  widget extension (see `project.yml`). Parity twin of Android's
//  `TodaySkyWind.kt`; the numbers match.
//

import SwiftUI

/// How hard and which way the wind blows in the picture.
struct SkyWind: Equatable {
    /// Sustained wind, mph, as the picture draws it.
    let mph: Double
    /// 1 when it blows toward the right of the picture (an east wind), -1 toward the left.
    let toward: Double

    /// A forecast without a speed reads as a light breeze, and a "windy" one blows at 20 or more.
    init(mph: Double?, from direction: String?, condition: WeatherConditionCode) {
        let known: Double = mph ?? (condition == .wind ? 20 : 10)
        self.mph = condition == .wind ? max(known, 20) : max(known, 0)
        toward = Self.toward(direction)
    }

    /// The 16 compass points, clockwise from north.
    private static let points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]

    /// From the west side (SSW to NNW) the wind blows east, to the left; due north,
    /// due south or unknown it blows to the right, the way the clouds always drifted.
    static func toward(_ direction: String?) -> Double {
        guard let direction, let index = points.firstIndex(of: direction.uppercased()) else { return 1 }
        return index >= 9 ? -1 : 1
    }

    /// Under 5 mph: nothing leans, drifts or slants.
    var calm: Bool {
        mph < 5
    }

    /// 0 when calm, 1 from 35 mph.
    var strength: Double {
        min(max((mph - 5) / 30, 0), 1)
    }

    /// How fast the clouds drift, as a share of a 10 mph breeze's pace.
    var cloudPace: Double {
        calm ? 0 : mph / 10
    }

    /// How far rain and snow move sideways for each point they fall.
    var slant: Double {
        calm ? 0 : min(mph, 40) * 0.022
    }

    /// Streaks of air from 12 mph: two, then one more every 6 mph, up to five.
    var streaks: Int {
        guard mph >= 12 else { return 0 }
        return min(5, 2 + Int((mph - 10) / 6))
    }

    /// How far the two fair-weather clouds sway either side, in points.
    var sway: Double {
        calm ? 0 : min(4 + mph * 0.8, 20)
    }

    /// How quickly they sway: faster in a stronger wind.
    var swayPace: Double {
        0.18 * max(1, mph / 10)
    }

    /// The trees' lean in radians, toward where the wind blows: a still lean, or
    /// a lean that gusts a little further and back.
    func lean(at time: Double, still: Bool) -> Double {
        let bend = toward * strength
        guard !still else { return bend * 0.2 }
        let pace = 1.4 + 1.2 * strength
        let quick = sin(time * pace)
        let slow = sin(time * pace * 0.43 + 1.3)
        let gust = 0.6 * quick + 0.4 * slow
        return bend * (0.2 + 0.045 * gust)
    }

    /// The chip under the reading from 15 mph, as shown and as VoiceOver says
    /// it: "Wind 18 mph", "wind 18 miles per hour".
    static func chip(_ mph: Double?) -> (text: String, spoken: String)? {
        guard let mph, mph.rounded() >= 15 else { return nil }
        let speed = Int(mph.rounded())
        return ("Wind \(speed) mph", "wind \(speed) miles per hour")
    }
}

extension TodaySkyPainter {
    /// The wind this scene draws.
    var wind: SkyWind {
        SkyWind(mph: windMph, from: windFrom, condition: condition)
    }

    /// Streaks of air crossing the sky, more and faster in a stronger wind,
    /// and from 20 mph a few leaves (none from the bare winter tree).
    func paintWind(_ context: GraphicsContext, _ scene: Scene) {
        let wind = wind
        let night = moment.phase == .night
        let moving = still ? 0 : scene.time
        if wind.mph >= 20, season != .winter {
            var random = SkyRandom(seed: 31)
            let color = night ? SkyPalette.leafNight.color(opacity: 0.7) : SkyPalette.leafDay.color(opacity: 0.85)
            for _ in 0..<4 {
                let span = scene.width + 60
                let speed = wind.mph + 35 + random.next() * 35
                let base = 40 + random.next() * 90
                let phase = random.next() * 6.28
                let along = scene.drift(random.next() * span, speed: speed, span: span, still: still) - 30
                var leaf = context
                leaf.translateBy(x: across(along, scene, wind), y: base + sin(moving * 2 + phase) * 8)
                leaf.rotate(by: .radians(wind.toward * (moving * 3 + phase)))
                leaf.fill(Path(ellipseIn: CGRect(x: -4, y: -2, width: 8, height: 4)), with: .color(color))
            }
        }
        var streaks = Path()
        let span = scene.width + 160
        for index in 0..<wind.streaks {
            let lane = Double(index)
            let speed = 40 + wind.mph * 2.5 + lane * 12
            let tail = scene.drift(lane * 0.27 * span, speed: speed, span: span, still: still) - 120
            let y = 36 + lane * 23
            streaks.move(to: CGPoint(x: across(tail, scene, wind), y: y))
            streaks.addCurve(
                to: CGPoint(x: across(tail + 110, scene, wind), y: y),
                control1: CGPoint(x: across(tail + 40, scene, wind), y: y - 6),
                control2: CGPoint(x: across(tail + 70, scene, wind), y: y + 6)
            )
        }
        let opacity = (night ? 0.28 : 0.5) * (0.55 + 0.45 * wind.strength)
        context.stroke(streaks, with: .color(SkyPalette.white.color(opacity: opacity)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
    }

    /// A position along the wind, as x in the picture: mirrored when it blows to the left.
    private func across(_ along: Double, _ scene: Scene, _ wind: SkyWind) -> Double {
        wind.toward < 0 ? scene.width - along : along
    }
}
