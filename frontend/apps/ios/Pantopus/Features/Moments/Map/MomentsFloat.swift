//
//  MomentsFloat.swift
//  Pantopus
//
//  Part D of Moment elevation, by day (board F1, approved by the founder on
//  2026-11-13): a pin whose Moment carries an elevation floats over the map.
//  It loses its tail, its disc sits right over its spot, it is a little
//  bigger the higher it was made (a quarter bigger in flight), and its shadow
//  falls on the map where the real sun puts it now, farther and softer the
//  higher it is. Its height tag takes the side away from the shadow. A pin
//  with no elevation keeps its tail and stands on its spot, so floating
//  always means height. A chip beside the colour key says the time the
//  shadows are drawn for.
//
//  Only while the map's answer says `float_on` (the `moment_float` switch,
//  contract v3.10), the Elevation chip is on and the sun is up. Otherwise the
//  map draws today's pins. The shadows only change with the minute: nothing
//  follows the camera, so the map moves as it always has.
//

import SwiftUI

/// How a floating pin is drawn, from its elevation and the sun: the same numbers on iPhone and Android.
enum MomentsFloat {
    /// How high it floats on the map's own scale, 0 to 1: a square root of the feet up to 15,000; flights at the top.
    static func lift(_ height: MomentShownHeight) -> Double {
        height.flying ? 1 : min(1, (Double(max(height.feet, 0)) / 15000).squareRoot())
    }

    static func scale(_ height: MomentShownHeight) -> CGFloat {
        1 + 0.25 * lift(height)
    }

    /// A floating pin's shadow: where its middle is from the spot (points, screen y down), how soft its edge is and how
    /// dark it is.
    struct Shadow {
        let offset: CGSize
        let blur: CGFloat
        let opacity: Double
    }

    static func shadow(_ height: MomentShownHeight, sun: MomentSunDTO) -> Shadow {
        let lift = lift(height)
        let atThirty = 1 / tan(30 * Double.pi / 180)
        let lowSun = min(max(1 / tan(max(sun.elevationDeg, 4) * .pi / 180) / atThirty, 0.55), 1.9)
        let length = (4 + 30 * lift) * lowSun
        let away = (sun.azimuthDeg + 180) * .pi / 180
        return Shadow(
            offset: CGSize(width: sin(away) * length, height: -cos(away) * length),
            blur: 1 + 7.5 * lift,
            opacity: 0.36 - 0.14 * lift
        )
    }

    /// The sides a tag tries, in order: away from the shadow across, away from it up or down, then the other two.
    static func sides(sun: MomentSunDTO) -> [MomentsPinTag.Side] {
        let away = (sun.azimuthDeg + 180) * .pi / 180
        let across: [MomentsPinTag.Side] = sin(away) > 0 ? [.before, .after] : [.after, .before]
        let upDown: [MomentsPinTag.Side] = -cos(away) < 0 ? [.below, .above] : [.above, .below]
        return [across[0], upDown[0], across[1], upDown[1]]
    }

    /// The shadow's radius before its soft edge: the disc's own.
    static let shadowRadius: CGFloat = 31
}

/// A floating pin: today's disc with no tail, its shadow on the map beside it.
struct MomentFloatPin: View {
    let ring: MomentRingDTO
    let height: MomentShownHeight
    let sun: MomentSunDTO

    var body: some View {
        let scale = MomentsFloat.scale(height)
        let shadow = MomentsFloat.shadow(height, sun: sun)
        let edge = MomentsFloat.shadowRadius + shadow.blur
        MomentRingPin(ring: ring, tail: false)
            .scaleEffect(scale)
            .frame(width: 64 * scale, height: 64 * scale)
            .background {
                Circle()
                    .fill(RadialGradient(
                        stops: [
                            .init(color: MomentsPalette.floatShadow.opacity(shadow.opacity), location: 0),
                            .init(
                                color: MomentsPalette.floatShadow.opacity(shadow.opacity),
                                location: (MomentsFloat.shadowRadius - shadow.blur / 2) / edge
                            ),
                            .init(color: MomentsPalette.floatShadow.opacity(0), location: 1)
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: edge
                    ))
                    .frame(width: edge * 2, height: edge * 2)
                    .offset(shadow.offset)
                    .allowsHitTesting(false)
            }
    }

    /// The pin with its height tag beside, over or under the disc; laid out, so the button's tap covers the tag.
    func tagged(_ tag: MomentsPinTag?) -> some View {
        VStack(spacing: MomentRingPin.tagGapAbove) {
            if let tag, tag.side == .above { MomentsHeightTag(height: tag.height) }
            HStack(alignment: .center, spacing: MomentRingPin.tagGap) {
                if let tag, tag.side == .before { MomentsHeightTag(height: tag.height) }
                self
                if let tag, tag.side == .after { MomentsHeightTag(height: tag.height) }
            }
            if let tag, tag.side == .below { MomentsHeightTag(height: tag.height) }
        }
    }

    /// Where the disc's middle (the map spot) sits in the pin and its tag together, for the map's anchor.
    static func anchor(tagged tag: MomentsPinTag?, height: MomentShownHeight) -> UnitPoint {
        let disc = 64 * MomentsFloat.scale(height)
        guard let tag else { return .center }
        let width = MomentsHeightTag.width(for: tag.height)
        let bar = MomentsHeightTag.barHeight + MomentRingPin.tagGapAbove
        switch tag.side {
        case .after: return UnitPoint(x: disc / 2 / (disc + MomentRingPin.tagGap + width), y: 0.5)
        case .before: return UnitPoint(x: (width + MomentRingPin.tagGap + disc / 2) / (disc + MomentRingPin.tagGap + width), y: 0.5)
        case .above: return UnitPoint(x: 0.5, y: (bar + disc / 2) / (bar + disc))
        case .below: return UnitPoint(x: 0.5, y: disc / 2 / (bar + disc))
        }
    }
}

/// Beside the colour key while pins float: a sun and the time the shadows are drawn for. It takes no tap.
struct MomentsSunChip: View {
    let time: String

    var body: some View {
        HStack(spacing: 6) {
            Icon(.sun, size: 15, strokeWidth: 2.25, color: MomentsPalette.height(.mountain))
            Text(time)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: MomentsHeightsBar.chipHeight)
        .momentsGlass(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Shadows show the sun at \(time)")
        .accessibilityIdentifier("moments.sun.chip")
    }
}

extension MomentsMapViewModel {
    /// The sun while pins float: `float_on`, the Elevation chip on and the sun up; nil draws today's pins.
    var floatingSun: MomentSunDTO? {
        guard showsHeightTags, floatOn, let sun, sun.elevationDeg > 0 else { return nil }
        return sun
    }

    /// "2:10 pm" while pins float, from the map's own clock (moved each half minute).
    var sunChipTime: String? {
        guard floatingSun != nil else { return nil }
        return now.formatted(date: .omitted, time: .shortened).lowercased()
    }

    /// The map's answer: float or not, and the sun.
    func floatAnswered(_ on: Bool, sun: MomentSunDTO?) {
        if floatOn != on { floatOn = on }
        let shown = on ? sun : nil
        if self.sun != shown { self.sun = shown }
    }
}
