//
//  MomentsFloatPlan.swift
//  Pantopus
//
//  Where each floating pin's height tag goes (part D, `MomentsFloat.swift`).
//  As with today's tags (`MomentsHeightTagPlan.swift`) a tag takes the first
//  side with room and waits for a zoom-in where none has, but a floating pin
//  is a disc over its spot, a little bigger the higher it is, so the room is
//  measured round the disc, and the sides are tried away from the shadow
//  first, so a number never sits on a shadow.
//

import CoreLocation
import MapKit

extension MomentsMapViewModel {
    nonisolated static func floatTagSides(
        for markers: [MomentsMarker],
        in frame: MomentsHeightFrame?,
        sun: MomentSunDTO
    ) -> [String: MomentsPinTag.Side] {
        let order = MomentsFloat.sides(sun: sun)
        var sides: [String: MomentsPinTag.Side] = [:]
        guard let frame else {
            for case let .ring(ring) in markers where ring.shownHeight != nil {
                sides[ring.id] = order[0]
            }
            return sides
        }
        let taken = markers.map { marker in (marker.id, floatFootprint(of: marker, at: frame.point(marker.coordinate))) }
        var tags: [CGRect] = []
        for case let .ring(ring) in markers {
            guard let height = ring.shownHeight else { continue }
            let spot = frame.point(CLLocationCoordinate2D(latitude: ring.latitude, longitude: ring.longitude))
            let radius = 32 * MomentsFloat.scale(height)
            let width = MomentsHeightTag.width(for: height)
            let bar = MomentsHeightTag.barHeight
            let reach = radius + MomentRingPin.tagGap
            let gap = radius + MomentRingPin.tagGapAbove
            let places: [MomentsPinTag.Side: CGRect] = [
                .after: CGRect(x: spot.x + reach, y: spot.y - bar / 2, width: width, height: bar),
                .before: CGRect(x: spot.x - reach - width, y: spot.y - bar / 2, width: width, height: bar),
                .above: CGRect(x: spot.x - width / 2, y: spot.y - gap - bar, width: width, height: bar),
                .below: CGRect(x: spot.x - width / 2, y: spot.y + gap, width: width, height: bar)
            ]
            let own = "ring.\(ring.id)"
            let free = order.first { side in
                guard let tag = places[side] else { return false }
                let room = tag.insetBy(dx: -tagSpace, dy: -tagSpace)
                return tag.minX >= edge && tag.maxX <= frame.width - edge
                    && !taken.contains { $0.0 != own && $0.1.intersects(room) }
                    && !tags.contains { $0.intersects(room) }
            }
            guard let free, let tag = places[free] else { continue }
            tags.append(tag)
            sides[ring.id] = free
        }
        return sides
    }

    /// A floating pin covers its disc round its spot; every other marker covers what it does today.
    private nonisolated static func floatFootprint(of marker: MomentsMarker, at point: CGPoint) -> CGRect {
        if case let .ring(ring) = marker, let height = ring.shownHeight {
            let radius = 32 * MomentsFloat.scale(height)
            return CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
        }
        return footprint(of: marker, at: point)
    }
}
