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
    /// A pin; `fan` moves it sideways, in pin widths, when plans share one point.
    case pin(PlanPinDTO, fan: Double)
    case cluster(PlansCluster)

    var id: String {
        switch self {
        case let .pin(pin, _): "pin.\(pin.id)"
        case let .cluster(cluster): "cluster.\(cluster.id)"
        }
    }

    var coordinate: CLLocationCoordinate2D {
        switch self {
        case let .pin(pin, _): CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)
        case let .cluster(cluster): CLLocationCoordinate2D(latitude: cluster.latitude, longitude: cluster.longitude)
        }
    }
}

enum PlansClustering {
    /// Pins closer than this many points on screen join a cluster.
    static let clusterPoints = 44.0
    /// About how many points tall the map is (near enough for clustering).
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
    static func markers(_ pins: [PlanPinDTO], span: Double, selectedId: String?) -> [PlansMarker] {
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
                    let middle = Double(group.count - 1) / 2
                    result += group.enumerated().map { PlansMarker.pin($1, fan: Double($0) - middle) }
                } else {
                    loose += group
                }
            }
        } else {
            loose = pins
        }
        let degreesPerPoint = max(span, 0.0001) / mapPoints
        var groups: [[PlanPinDTO]] = []
        for pin in loose {
            let index = pin.id == selectedId ? nil : groups.firstIndex { group in
                guard let leader = group.first, leader.id != selectedId else { return false }
                return points(between: leader, and: pin, degreesPerPoint: degreesPerPoint) < clusterPoints
            }
            if let index {
                groups[index].append(pin)
            } else {
                groups.append([pin])
            }
        }
        for group in groups {
            if group.count == 1, let pin = group.first {
                result.append(.pin(pin, fan: 0))
            } else {
                result.append(.cluster(cluster(group)))
            }
        }
        return result.sorted { layer($0, selectedId) < layer($1, selectedId) }
    }

    /// Drawing order: pins, then clusters, then the selected pin.
    private static func layer(_ marker: PlansMarker, _ selectedId: String?) -> Int {
        switch marker {
        case let .pin(pin, _): pin.id == selectedId ? 2 : 0
        case .cluster: 1
        }
    }

    /// Where to move the camera for a tapped cluster: around its pins, close
    /// enough that they separate (or fan out, when they share one point).
    static func span(toOpen cluster: PlansCluster) -> Double {
        if cluster.isOnePoint { return fanSpan / 2 }
        return max(max(cluster.maxLatitude - cluster.minLatitude, cluster.maxLongitude - cluster.minLongitude) * 2.2, 0.003)
    }

    private static func points(between first: PlanPinDTO, and second: PlanPinDTO, degreesPerPoint: Double) -> Double {
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
