//
//  MomentsHeightTag.swift
//  Pantopus
//
//  How high a Moment was made, beside its pin on the Moments map (board H2):
//  a dot in the height band's colour and "4,390 ft", or a small plane for a
//  Moment posted in flight. The pin's ring keeps its own meaning (sky to
//  green while new, grey once watched), so the band's colour is on the tag,
//  always with the number. Only a single pin carries one: crowded spots and
//  rings round one point don't yet.
//
//  The tag is part of the pin's own button, so a tap on it plays the ring as
//  a tap on the pin does, and its width is worked out from its words so the
//  tail's tip stays on the map point. It sits after the ring, or before it
//  or over it where that place is taken or runs off the map (board F1 draws
//  them on either side); with no room anywhere it waits until the map is
//  zoomed in, as a map's own labels do (`MomentsHeightTagPlan.swift`).
//

import SwiftUI
import UIKit

/// The pill: a band-coloured dot (a plane in flight) and the number.
struct MomentsHeightTag: View {
    let height: MomentShownHeight

    static let barHeight: CGFloat = 24
    private static let fontSize: CGFloat = 12.5
    private static let mark: CGFloat = 8
    private static let plane: CGFloat = 11
    private static let inset: CGFloat = 8
    private static let gap: CGFloat = 5

    /// As wide as its words need, so the pin beside it can be placed exactly.
    static func width(for height: MomentShownHeight) -> CGFloat {
        let font = UIFont.systemFont(ofSize: fontSize, weight: .semibold)
        let words = (height.text as NSString).size(withAttributes: [.font: font]).width
        return (inset + (height.flying ? plane : mark) + gap + words + inset + 1).rounded(.up)
    }

    var body: some View {
        HStack(spacing: Self.gap) {
            if height.flying {
                Icon(.plane, size: Self.plane, strokeWidth: 2.5, color: MomentsPalette.height(.flying))
            } else {
                Circle()
                    .fill(MomentsPalette.height(height.band))
                    .frame(width: Self.mark, height: Self.mark)
            }
            Text(height.text)
                .font(.system(size: Self.fontSize, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .fixedSize()
        }
        .frame(width: Self.width(for: height), height: Self.barHeight)
        .background(Capsule().fill(MomentsPalette.pinSurface))
        .compositingGroup()
        .shadow(color: .black.opacity(0.22), radius: 1.5, x: 0, y: 1)
    }
}

/// A pin's tag: the height, and where round the ring it sits.
struct MomentsPinTag: Hashable {
    /// After the ring, before it, or over it: whichever has room, in that order (`MomentsHeightTagPlan.swift`).
    enum Side: Hashable {
        case after, before, above
    }

    let height: MomentShownHeight
    let side: Side
}

extension MomentRingPin {
    /// Between the disc and a tag beside it, and between the disc and a tag over it.
    static let tagGap: CGFloat = 3
    static let tagGapAbove: CGFloat = 2

    /// The pin with its height by the disc. The tag is laid out, not floated, so the button's tap covers it.
    func tagged(_ tag: MomentsPinTag?) -> some View {
        VStack(spacing: Self.tagGapAbove) {
            if let tag, tag.side == .above { MomentsHeightTag(height: tag.height) }
            HStack(alignment: .top, spacing: Self.tagGap) {
                if let tag, tag.side == .before { Self.beside(tag) }
                self
                if let tag, tag.side == .after { Self.beside(tag) }
            }
        }
    }

    /// Level with the middle of the disc (the top 64 pt of the pin; the tail is below).
    private static func beside(_ tag: MomentsPinTag) -> some View {
        MomentsHeightTag(height: tag.height)
            .frame(height: size.width)
    }

    /// Where the tail's tip sits in the pin and its tag together, for the map's anchor.
    static func anchor(tagged tag: MomentsPinTag?) -> UnitPoint {
        guard let tag else { return anchor }
        let width = MomentsHeightTag.width(for: tag.height)
        switch tag.side {
        case .after:
            return UnitPoint(x: size.width / 2 / (size.width + tagGap + width), y: anchor.y)
        case .before:
            return UnitPoint(x: (tagGap + width + size.width / 2) / (size.width + tagGap + width), y: anchor.y)
        case .above:
            // The pin stays in the middle, whichever is wider; the tag only adds height over it.
            let over = MomentsHeightTag.barHeight + tagGapAbove
            return UnitPoint(x: 0.5, y: (over + size.height * anchor.y) / (over + size.height))
        }
    }
}

extension MomentsMapView {
    /// The tag a ring's pin carries: none while "Elevation" is off, none where it has no room, and none on the ring
    /// playing in the card beside the map (the open iPhone Duo draws that pin bigger, in a halo).
    func heightTag(for ring: MomentRingDTO, plan: MomentsHeightTagPlan) -> MomentsPinTag? {
        guard let side = plan.sides[ring.id], !isPlaying(ring), let height = ring.shownHeight else { return nil }
        return MomentsPinTag(height: height, side: side)
    }
}
