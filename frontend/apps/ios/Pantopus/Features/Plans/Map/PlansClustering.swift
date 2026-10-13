//
//  PlansClustering.swift
//  Pantopus
//
//  Board P1 "Cluster and you": pins too close to tell apart at this zoom
//  join a cluster that counts them and shows their colors; tapping one
//  zooms in. Plans whose areas snap to the same point never separate by
//  zooming in, so close up they sit side by side instead, and past a
//  handful the list shows them.
//

import CoreLocation
import Foundation

/// A group of pins too close to tell apart at this zoom.
struct PlansCluster: Hashable, Identifiable {
    let id: String
    let latitude: Double
    let longitude: Double
    let count: Int
    let kinds: [PlanKind]
    let minLatitude: Double
    let maxLatitude: Double
    let minLongitude: Double
    let maxLongitude: Double
    /// Your own standing on a plan in it (hosting, in, asked), so a cluster never hides it.
    let badge: PlanPinLook.Badge?

    /// Every plan in it sits on one point (about 30 m): zooming in never separates them.
    var isOnePoint: Bool {
        maxLatitude - minLatitude < PlansClustering.onePoint && maxLongitude - minLongitude < PlansClustering.onePoint
    }
}

/// One thing on the map.
enum PlansMarker: Hashable, Identifiable {
    case pin(PlanPinDTO)
    /// Plans sharing one point, side by side with the point between them. One
    /// marker, so each pin takes its own taps.
    case fan([PlanPinDTO])
    case cluster(PlansCluster)

    var id: String {
        switch self {
        case let .pin(pin): "pin.\(pin.id)"
        case let .fan(pins): "fan.\(pins.first?.id ?? "")"
        case let .cluster(cluster): "cluster.\(cluster.id)"
        }
    }

    var coordinate: CLLocationCoordinate2D {
        switch self {
        case let .pin(pin): CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)
        case let .fan(pins): CLLocationCoordinate2D(latitude: pins.first?.latitude ?? 0, longitude: pins.first?.longitude ?? 0)
        case let .cluster(cluster): CLLocationCoordinate2D(latitude: cluster.latitude, longitude: cluster.longitude)
        }
    }
}

enum PlansClustering {
    /// Pins closer than this many points on screen join a cluster.
    static let clusterPoints = 44.0
    /// How many points tall the map is, until it's measured.
    static let mapPoints = 800.0
    /// Close up (a span under this), plans sharing one point sit side by side.
    static let fanSpan = 0.012
    /// More plans than this on one point stay a cluster.
    static let fanLimit = 4
    /// Points closer than this many degrees count as one.
    static let onePoint = 0.0003
    /// How far apart fanned-out pins sit, in points.
    static let fanStep = 56.0

    /// The markers for these pins at a camera span (latitude degrees). The
    /// selected pin never hides in a cluster; a cluster holding a plan you host,
    /// are in or asked to join carries that badge. Clusters come after pins and
    /// the selected pin last, so they draw (and take taps) on top.
    static func markers(_ pins: [PlanPinDTO], span: Double, mapPoints: Double = mapPoints, selectedId: String?) -> [PlansMarker] {
        var result: [PlansMarker] = []
        var loose: [PlanPinDTO] = []
        if span < fanSpan {
            var byPoint: [String: [PlanPinDTO]] = [:]
            var points: [String] = []
            for pin in pins {
                let key = pointKey(pin)
                if byPoint[key] == nil { points.append(key) }
                byPoint[key, default: []].append(pin)
            }
            for key in points {
                guard let group = byPoint[key] else { continue }
                if group.count > 1, group.count <= fanLimit {
                    result.append(.fan(group))
                } else {
                    loose += group
                }
            }
        } else {
            loose = pins
        }
        let degreesPerPoint = max(span, 0.0001) / max(mapPoints, 1)
        var groups: [[PlanPinDTO]] = []
        for pin in loose {
            let index = pin.id == selectedId ? nil : groups.firstIndex { group in
                guard let leader = group.first, leader.id != selectedId else { return false }
                return points(between: middle(of: [leader]), and: middle(of: [pin]), degreesPerPoint: degreesPerPoint) < clusterPoints
            }
            if let index {
                groups[index].append(pin)
            } else {
                groups.append([pin])
            }
        }
        mergeCrowded(&groups, selectedId: selectedId, degreesPerPoint: degreesPerPoint)
        for group in groups {
            if group.count == 1, let pin = group.first {
                result.append(.pin(pin))
            } else {
                result.append(.cluster(cluster(group)))
            }
        }
        return result.sorted { layer($0, selectedId) < layer($1, selectedId) }
    }

    /// Drawing order: pins, then clusters, then the selected pin.
    private static func layer(_ marker: PlansMarker, _ selectedId: String?) -> Int {
        switch marker {
        case let .pin(pin): pin.id == selectedId ? 2 : 0
        case let .fan(pins): pins.contains { $0.id == selectedId } ? 2 : 0
        case .cluster: 1
        }
    }

    /// Where to move the camera for a tapped cluster: around its pins, close
    /// enough that they separate (or fan out, when they share one point).
    static func span(toOpen cluster: PlansCluster) -> Double {
        if cluster.isOnePoint { return fanSpan / 2 }
        return max(max(cluster.maxLatitude - cluster.minLatitude, cluster.maxLongitude - cluster.minLongitude) * 2.2, 0.003)
    }

    /// A cluster sits at the middle of its pins, which can land on another
    /// cluster or pin: groups whose middles are too close merge, until none are.
    private static func mergeCrowded(_ groups: inout [[PlanPinDTO]], selectedId: String?, degreesPerPoint: Double) {
        var merging = true
        while merging {
            merging = false
            search: for first in groups.indices {
                guard !groups[first].contains(where: { $0.id == selectedId }) else { continue }
                for second in groups.indices where second > first {
                    guard !groups[second].contains(where: { $0.id == selectedId }) else { continue }
                    let gap = points(between: middle(of: groups[first]), and: middle(of: groups[second]), degreesPerPoint: degreesPerPoint)
                    if gap < clusterPoints {
                        groups[first] += groups[second]
                        groups.remove(at: second)
                        merging = true
                        break search
                    }
                }
            }
        }
    }

    private static func middle(of group: [PlanPinDTO]) -> CLLocationCoordinate2D {
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

    private static func pointKey(_ pin: PlanPinDTO) -> String {
        "\(Int((pin.latitude / onePoint).rounded())):\(Int((pin.longitude / onePoint).rounded()))"
    }

    private static func cluster(_ group: [PlanPinDTO]) -> PlansCluster {
        let lats = group.map(\.latitude)
        let lons = group.map(\.longitude)
        var kinds: [PlanKind] = []
        for pin in group where !kinds.contains(pin.kind) {
            kinds.append(pin.kind)
        }
        let badge: PlanPinLook.Badge? = if group.contains(where: \.isHosting) {
            .hosting
        } else if group.contains(where: \.isIn) {
            .going
        } else if group.contains(where: { $0.viewerRequestStatus == .pending || $0.viewerRequestStatus == .waitlisted }) {
            .waiting
        } else {
            nil
        }
        return PlansCluster(
            id: group.first?.id ?? UUID().uuidString,
            latitude: lats.reduce(0, +) / Double(lats.count),
            longitude: lons.reduce(0, +) / Double(lons.count),
            count: group.count,
            kinds: kinds,
            minLatitude: lats.min() ?? 0,
            maxLatitude: lats.max() ?? 0,
            minLongitude: lons.min() ?? 0,
            maxLongitude: lons.max() ?? 0,
            badge: badge
        )
    }
}
