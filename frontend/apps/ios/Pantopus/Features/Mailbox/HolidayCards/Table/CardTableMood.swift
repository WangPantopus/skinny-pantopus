//
//  CardTableMood.swift
//  Pantopus
//
//  The mood follows the card (launch key `card_table`, plan Part 7). Each collection has one of three moods, mapped
//  here from the picture's number (default nostalgia), so the server needn't send it:
//  - Nostalgia: snow falling outside the window, its soft shadows drifting down through the patch of window light.
//  - Reverence (Christmas with Jesus Christ): no snow; candlelight from the lower left that breathes very slowly, one
//    slow glint across the gold lining when the flap opens, and the star stamp.
//  - Santa: the same snow, and the envelope lands with a little more bounce.
//  The effects are drawn in code, and stop with Reduce Motion or Low Power Mode, like the tilt light.
//

import SwiftUI

enum CardTableMood: Equatable {
    /// `letter`: a letter, not a card (plan Part 10): no snow, candle, glint or bounce.
    case nostalgia, reverence, santa, letter

    /// By the picture's number, as the server's collections hold them: 59-67 Christmas with Jesus Christ, 50-58
    /// Christmas with Santa, every other picture nostalgia.
    init(number: Int?) {
        switch number ?? 0 {
        case 59...67: self = .reverence
        case 50...58: self = .santa
        default: self = .nostalgia
        }
    }

    var snows: Bool {
        self == .nostalgia || self == .santa
    }
}

/// Snow outside the window: 22 soft specks of shadow, each crossing the window's patch of light in 6 to 9 seconds,
/// about 12 to 18 of them in the light at a time, 10% dark. They fade out past the window's patch of light (a soft
/// oval over the light picture's window, upper left), so they show only where it falls. Drawn in the light's frame,
/// so they move with it.
struct CardTableSnow: View {
    let size: CGSize

    private static let flakes: [Flake] = (0..<22).map { Flake(index: $0) }

    /// The window's patch of light in the light picture: full inside an oval over its upper left, fading to none.
    private static func window(x: Double, y: Double) -> Double {
        let dx = (x - 0.42) / 0.4
        let dy = (y - 0.3) / 0.32
        let distance = (dx * dx + dy * dy).squareRoot()
        return min(1, max(0, (1.25 - distance) / 0.5))
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            Canvas(rendersAsynchronously: true) { context, canvas in
                context.addFilter(.blur(radius: 2.2))
                for flake in Self.flakes {
                    let point = flake.position(at: time, in: canvas)
                    let strength = Self.window(x: point.x / canvas.width, y: point.y / canvas.height)
                    guard strength > 0.05 else { continue }
                    let rect = CGRect(
                        x: point.x - flake.radius,
                        y: point.y - flake.radius,
                        width: flake.radius * 2,
                        height: flake.radius * 2
                    )
                    context.fill(Path(ellipseIn: rect), with: .color(.black.opacity(0.1 * strength)))
                }
            }
            .frame(width: size.width, height: size.height)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// One speck: where it starts across the window, how long it takes to fall, its size and its sway.
    private struct Flake {
        let x: Double
        let period: Double
        let phase: Double
        let radius: Double
        let sway: Double

        init(index: Int) {
            /// Fixed, evenly scattered values: the same snow every time, no randomness to seed.
            func unit(_ salt: Double) -> Double {
                let value = sin(Double(index) * 12.9898 + salt * 78.233) * 43758.5453
                return value - value.rounded(.down)
            }
            x = 0.02 + unit(1) * 0.86
            period = 6 + unit(2) * 3
            phase = unit(3)
            radius = 2.5 + unit(4) * 2.5
            sway = 3 + unit(5) * 6
        }

        /// From just above the window's patch to just below it (the light's top 70%).
        func position(at time: Double, in size: CGSize) -> CGPoint {
            let progress = (time / period + phase).truncatingRemainder(dividingBy: 1)
            let y = (-0.05 + progress * 0.75) * size.height
            let drift = sin(time * 0.6 + phase * 6.28) * sway
            return CGPoint(x: x * size.width + drift, y: y)
        }
    }
}

/// Candlelight for the reverence mood: a warm glow from the lower left. It breathes very slowly (3.5 s, 85 to 100%);
/// still with Reduce Motion or Low Power Mode.
struct CardTableCandle: View {
    let size: CGSize
    let breathes: Bool

    var body: some View {
        if breathes {
            TimelineView(.animation(minimumInterval: 1 / 20)) { timeline in
                let time = timeline.date.timeIntervalSinceReferenceDate
                glow(strength: 0.85 + 0.15 * (0.5 + 0.5 * sin(time * 2 * .pi / 3.5)))
            }
        } else {
            glow(strength: 0.92)
        }
    }

    private func glow(strength: Double) -> some View {
        RadialGradient(
            stops: [
                .init(color: MailPaper.tableCandle.opacity(0.34 * strength), location: 0),
                .init(color: MailPaper.tableCandle.opacity(0.12 * strength), location: 0.45),
                .init(color: MailPaper.tableCandle.opacity(0), location: 1)
            ],
            center: UnitPoint(x: -0.08, y: 1.04),
            startRadius: 0,
            endRadius: max(size.width, size.height) * 0.85
        )
        .frame(width: size.width, height: size.height)
        .blendMode(.screen)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
