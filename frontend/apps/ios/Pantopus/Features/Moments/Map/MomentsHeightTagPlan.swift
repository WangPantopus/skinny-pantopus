//
//  MomentsHeightTagPlan.swift
//  Pantopus
//
//  Where round its ring each pin's height tag goes (`MomentsHeightTag.swift`).
//  Tags are laid out like a map's own labels: each takes the place after its
//  ring if nothing is there, else before it, else over it, and where none of
//  the three has room (another pin, another tag, the edge of the map) it
//  isn't drawn until the map is zoomed in. So tags never sit on a pin or on
//  each other. VoiceOver reads the height either way.
//
//  The plan is worked out each time the map settles, from where the pins
//  were then; while a finger moves the map the tags travel with their pins.
//

import CoreLocation
import MapKit

/// The visible map when the camera last settled, for laying the tags out in points.
struct MomentsHeightFrame: Equatable {
    let west: Double
    let north: Double
    /// Points per degree of latitude, and per degree of longitude at this latitude.
    let perLatitude: Double
    let perLongitude: Double
    /// How wide the map is, in points.
    let width: Double

    init(region: MKCoordinateRegion, heightInPoints: Double) {
        west = region.center.longitude - region.span.longitudeDelta / 2
        north = region.center.latitude + region.span.latitudeDelta / 2
        perLatitude = heightInPoints / max(region.span.latitudeDelta, 0.000_001)
        perLongitude = perLatitude * cos(region.center.latitude * .pi / 180)
        width = region.span.longitudeDelta * perLongitude
    }

    /// Where a coordinate's pin stands: its tail's tip.
    func point(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
        CGPoint(x: (coordinate.longitude - west) * perLongitude, y: (north - coordinate.latitude) * perLatitude)
    }
}

/// What the map's pins need to know about height tags, read once each time the map is built. The map builds each
/// pin later, where a change to the view model isn't seen: reading it there left the tags as they were until
/// something else redrew the map.
struct MomentsHeightTagPlan: Equatable {
    /// "Elevation" is on.
    let shown: Bool
    /// The rings that carry a tag, and where round the ring it sits.
    let sides: [String: MomentsPinTag.Side]

    static let off = MomentsHeightTagPlan(shown: false, sides: [:])

    /// What VoiceOver adds to a ring: its height while "Elevation" is on, drawn or not.
    func spoken(_ ring: MomentRingDTO) -> MomentShownHeight? {
        shown ? ring.shownHeight : nil
    }
}

extension MomentsMapViewModel {
    /// The map's rings and bubbles, and its pins' height tags, read together each time the map is built.
    var pinsOnMap: (markers: [MomentsMarker], tags: MomentsHeightTagPlan) {
        let markers = markers
        guard showsHeightTags else { return (markers, .off) }
        return (markers, MomentsHeightTagPlan(shown: true, sides: Self.tagSides(for: markers, in: heightTagsFrame)))
    }

    /// The camera settled: the tags are laid out on the map as it is now.
    func placeHeightTags(in region: MKCoordinateRegion) {
        let frame = MomentsHeightFrame(region: region, heightInPoints: mapPoints)
        if heightTagsFrame != frame { heightTagsFrame = frame }
    }

    /// Each single pin's place, taken in the map's own order so a pin keeps its place from one read to the next.
    /// Before the camera has settled once there is nothing to measure against: every tag goes after its ring.
    nonisolated static func tagSides(for markers: [MomentsMarker], in frame: MomentsHeightFrame?) -> [String: MomentsPinTag.Side] {
        var sides: [String: MomentsPinTag.Side] = [:]
        guard let frame else {
            for case let .ring(ring) in markers where ring.shownHeight != nil {
                sides[ring.id] = .after
            }
            return sides
        }
        let taken = markers.map { ($0.id, footprint(of: $0, at: frame.point($0.coordinate))) }
        var tags: [CGRect] = []
        for case let .ring(ring) in markers {
            guard let height = ring.shownHeight else { continue }
            let tip = frame.point(CLLocationCoordinate2D(latitude: ring.latitude, longitude: ring.longitude))
            let width = MomentsHeightTag.width(for: height)
            let reach = MomentRingPin.size.width / 2 + MomentRingPin.tagGap
            // Level with the middle of the disc, which is 39 pt above the tail's tip.
            let bar = MomentsHeightTag.barHeight
            let after = CGRect(x: tip.x + reach, y: tip.y - 39 - bar / 2, width: width, height: bar)
            let before = after.offsetBy(dx: -2 * reach - width, dy: 0)
            let above = CGRect(x: tip.x - width / 2, y: tip.y - 71 - MomentRingPin.tagGapAbove - bar, width: width, height: bar)
            let own = "ring.\(ring.id)"
            let places: [(MomentsPinTag.Side, CGRect)] = [(.after, after), (.before, before), (.above, above)]
            let free = places.first { _, tag in
                let room = tag.insetBy(dx: -tagSpace, dy: -tagSpace)
                return tag.minX >= edge && tag.maxX <= frame.width - edge
                    && !taken.contains { $0.0 != own && $0.1.intersects(room) }
                    && !tags.contains { $0.intersects(room) }
            }
            guard let free else { continue }
            tags.append(free.1)
            sides[ring.id] = free.0
        }
        return sides
    }

    /// Kept clear round a tag, and between a tag and the map's edge.
    private static let tagSpace: CGFloat = 1
    private static let edge: CGFloat = 6

    /// What a marker covers, from where its point is: a pin stands on its tip, a bubble too, a fan sits round it.
    private nonisolated static func footprint(of marker: MomentsMarker, at point: CGPoint) -> CGRect {
        switch marker {
        case .ring:
            return CGRect(x: point.x - 32, y: point.y - 71, width: 64, height: 72)
        case let .fan(cluster):
            let reach = 36 + 6 * CGFloat(cluster.rings.count) + 40
            return CGRect(x: point.x - reach, y: point.y - reach - 36, width: reach * 2, height: reach * 2 + 36)
        case let .cluster(cluster):
            let width: CGFloat = cluster.rings.count > 3 ? 132 : CGFloat(min(cluster.rings.count, 3)) * 24 + 26
            return CGRect(x: point.x - width / 2, y: point.y - 60, width: width, height: 60)
        }
    }
}
