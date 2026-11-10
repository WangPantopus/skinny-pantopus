//
//  MomentsClustering.swift
//  Pantopus
//
//  Board M1's crowded spot: rings too close to tell apart at this zoom join
//  a bubble of up to three faces and "+N"; tapping it zooms in (M2) and the
//  strip shows only that spot. Rings on one point (about 30 m) never
//  separate by zooming, so close up a few of them sit round the point (a
//  fan, as Plans does); more stay a bubble and the strip lists them.
//

import CoreLocation
import Foundation

/// Rings too close to tell apart at this zoom.
struct MomentsCluster: Hashable, Identifiable {
    let id: String
    let latitude: Double
    let longitude: Double
    /// New ones first, then the newest.
    let rings: [MomentRingDTO]
    let minLatitude: Double
    let maxLatitude: Double
    let minLongitude: Double
    let maxLongitude: Double

    /// Every ring in it is on one point: zooming in never separates them.
    var isOnePoint: Bool {
        maxLatitude - minLatitude < MomentsClustering.onePoint && maxLongitude - minLongitude < MomentsClustering.onePoint
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// The place most of its rings name ("Esther Short Park").
    var placeName: String? {
        let labels = rings.map(\.placeLabel).filter { !$0.isEmpty }
        return labels.max { first, second in
            labels.filter { $0 == first }.count < labels.filter { $0 == second }.count
        }
    }
}

/// One thing on the Moments map.
enum MomentsMarker: Hashable, Identifiable {
    case ring(MomentRingDTO)
    /// Rings on one point, close up: each its own pin, round the point.
    case fan(MomentsCluster)
    case cluster(MomentsCluster)

    var id: String {
        switch self {
        case let .ring(ring): "ring.\(ring.id)"
        case let .fan(cluster): "fan.\(cluster.id)"
        case let .cluster(cluster): "cluster.\(cluster.id)"
        }
    }

    var coordinate: CLLocationCoordinate2D {
        switch self {
        case let .ring(ring): CLLocationCoordinate2D(latitude: ring.latitude, longitude: ring.longitude)
        case let .fan(cluster), let .cluster(cluster): cluster.coordinate
        }
    }
}

enum MomentsClustering {
    /// Rings closer than this many points on screen join a bubble (a pin is 64 pt wide).
    static let clusterPoints = 52.0
    /// Points closer than this many degrees count as one.
    static let onePoint = 0.0003
    /// Close up (a span under this), rings on one point sit round it.
    static let fanSpan = 0.006
    /// More rings than this on one point stay a bubble.
    static let fanLimit = 6

    /// The markers for these rings at a camera span (latitude degrees) on a
    /// map `mapPoints` tall. Bubbles come after rings so they draw on top.
    static func markers(_ rings: [MomentRingDTO], span: Double, mapPoints: Double) -> [MomentsMarker] {
        let degreesPerPoint = max(span, 0.0001) / max(mapPoints, 1)
        var groups: [[MomentRingDTO]] = []
        for ring in rings {
            if let index = groups.firstIndex(where: { group in
                guard let leader = group.first else { return false }
                return points(between: middle(of: [leader]), and: middle(of: [ring]), degreesPerPoint: degreesPerPoint) < clusterPoints
            }) {
                groups[index].append(ring)
            } else {
                groups.append([ring])
            }
        }
        mergeCrowded(&groups, degreesPerPoint: degreesPerPoint, span: span)
        var singles: [MomentsMarker] = []
        var bubbles: [MomentsMarker] = []
        for group in groups {
            if group.count == 1, let ring = group.first {
                singles.append(.ring(ring))
                continue
            }
            let crowd = cluster(group)
            bubbles.append(span < fanSpan && crowd.isOnePoint && group.count <= fanLimit ? .fan(crowd) : .cluster(crowd))
        }
        return singles + bubbles
    }

    /// Where to move the camera for a tapped bubble: around its rings, close
    /// enough that they separate.
    static func span(toOpen cluster: MomentsCluster) -> Double {
        if cluster.isOnePoint { return fanSpan / 2 }
        return max(max(cluster.maxLatitude - cluster.minLatitude, cluster.maxLongitude - cluster.minLongitude) * 2.6, 0.0025)
    }

    /// Where each pin of a fan sits from the point, in points: round it, the first at the top.
    static func fanOffset(index: Int, of count: Int) -> CGSize {
        let radius = 36.0 + 6.0 * Double(count)
        let angle = -Double.pi / 2 + 2 * Double.pi * Double(index) / Double(max(count, 1))
        return CGSize(width: radius * cos(angle), height: radius * sin(angle))
    }

    /// A bubble sits at the middle of its rings, which can land on another
    /// bubble or ring: groups whose drawn shapes would overlap merge, until none do.
    private static func mergeCrowded(_ groups: inout [[MomentRingDTO]], degreesPerPoint: Double, span: Double) {
        var merging = true
        while merging {
            merging = false
            search: for first in groups.indices {
                for second in groups.indices where second > first {
                    if overlap(groups[first], groups[second], degreesPerPoint: degreesPerPoint, span: span) {
                        groups[first] += groups[second]
                        groups.remove(at: second)
                        merging = true
                        break search
                    }
                }
            }
        }
    }

    /// Two pins overlap when their centers are closer than `clusterPoints`. A bubble is wider than a pin
    /// (three faces and "+N" are about 136 pt) and a fan wider still, so with one of those it's the drawn
    /// widths that decide, with the same 12 pt of give two pins get.
    private static func overlap(_ first: [MomentRingDTO], _ second: [MomentRingDTO], degreesPerPoint: Double, span: Double) -> Bool {
        let one = middle(of: first)
        let other = middle(of: second)
        if first.count == 1, second.count == 1 {
            return points(between: one, and: other, degreesPerPoint: degreesPerPoint) < clusterPoints
        }
        let dy = abs(one.latitude - other.latitude) / degreesPerPoint
        let dx = abs(one.longitude - other.longitude) * cos(one.latitude * .pi / 180) / degreesPerPoint
        let reach = halfWidth(of: first, span: span) + halfWidth(of: second, span: span) - 12
        let fans = isFan(first, span: span) || isFan(second, span: span)
        return dx < reach && dy < (fans ? reach : clusterPoints)
    }

    /// Half the drawn width of a group's marker: a pin, a bubble by its faces, or a fan by its circle.
    private static func halfWidth(of group: [MomentRingDTO], span: Double) -> Double {
        if isFan(group, span: span) { return 36.0 + 6.0 * Double(group.count) + 32.0 }
        switch group.count {
        case ...1: return 32
        case 2: return 37
        case 3: return 49
        default: return 68
        }
    }

    private static func isFan(_ group: [MomentRingDTO], span: Double) -> Bool {
        guard group.count > 1, group.count <= fanLimit, span < fanSpan else { return false }
        let lats = group.map(\.latitude)
        let lons = group.map(\.longitude)
        return (lats.max() ?? 0) - (lats.min() ?? 0) < onePoint && (lons.max() ?? 0) - (lons.min() ?? 0) < onePoint
    }

    private static func middle(of group: [MomentRingDTO]) -> CLLocationCoordinate2D {
        let count = Double(max(group.count, 1))
        return CLLocationCoordinate2D(
            latitude: group.map(\.latitude).reduce(0, +) / count,
            longitude: group.map(\.longitude).reduce(0, +) / count
        )
    }

    private static func points(
        between first: CLLocationCoordinate2D,
        and second: CLLocationCoordinate2D,
        degreesPerPoint: Double
    ) -> Double {
        let dy = (first.latitude - second.latitude) / degreesPerPoint
        let dx = (first.longitude - second.longitude) * cos(first.latitude * .pi / 180) / degreesPerPoint
        return (dx * dx + dy * dy).squareRoot()
    }

    private static func cluster(_ group: [MomentRingDTO]) -> MomentsCluster {
        let lats = group.map(\.latitude)
        let lons = group.map(\.longitude)
        let ordered = group.sorted { first, second in
            if first.mine != second.mine { return first.mine }
            if first.isNew != second.isNew { return first.isNew }
            return (first.newestAt ?? "") > (second.newestAt ?? "")
        }
        return MomentsCluster(
            id: ordered.map(\.id).sorted().joined(separator: "|"),
            latitude: lats.reduce(0, +) / Double(lats.count),
            longitude: lons.reduce(0, +) / Double(lons.count),
            rings: ordered,
            minLatitude: lats.min() ?? 0,
            maxLatitude: lats.max() ?? 0,
            minLongitude: lons.min() ?? 0,
            maxLongitude: lons.max() ?? 0
        )
    }
}
