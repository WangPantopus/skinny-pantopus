//
//  NearbyMapContent.swift
//  Pantopus
//
//  Content models the Nearby map view consumes. The view-model
//  projects backend gig/listing rows into a homogeneous
//  `MapEntity` so the map / sheet vocabulary stays unified.
//

import CoreLocation
import Foundation

/// Entity kind discriminator. Drives the detail-screen routing and
/// keeps the per-platform pin geometry uniform.
public enum MapEntityKind: String, Sendable, Hashable, Codable {
    case gig
    case listing
}

/// Per-pin lifecycle state. Drives the visual treatment described in
/// the design — confirmed gets a white ring, pending dashes its color
/// outline, active runs the 1.6s pulse halo.
public enum MapEntityState: Sendable, Hashable {
    case confirmed
    case pending
}

/// One pin / one card / one row, all rolled up. The view-model never
/// hands raw DTOs to the view.
public struct MapEntity: Identifiable, Sendable, Hashable {
    public let id: String
    public let kind: MapEntityKind
    public let category: GigsCategory
    public let state: MapEntityState
    public let latitude: Double
    public let longitude: Double
    public let title: String
    public let summary: String?
    /// Free-form price string ("$60", "$22 / walk", "$180"). Listings
    /// reuse this for their sale price.
    public let price: String?
    public let distanceLabel: String?
    public let bidCount: Int

    public init(
        id: String,
        kind: MapEntityKind,
        category: GigsCategory,
        state: MapEntityState,
        latitude: Double,
        longitude: Double,
        title: String,
        summary: String?,
        price: String?,
        distanceLabel: String?,
        bidCount: Int
    ) {
        self.id = id
        self.kind = kind
        self.category = category
        self.state = state
        self.latitude = latitude
        self.longitude = longitude
        self.title = title
        self.summary = summary
        self.price = price
        self.distanceLabel = distanceLabel
        self.bidCount = bidCount
    }

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// Bottom-sheet snap stop. The three positions follow the design:
/// ~20% collapsed (header + prompt), ~40% rail of cards, ~70% full
/// vertical list.
public enum SheetStop: CaseIterable, Sendable, Hashable {
    case collapsed
    case standard
    case expanded

    /// Fraction of the screen height the sheet occupies at this stop.
    public var heightFraction: CGFloat {
        switch self {
        case .collapsed: 0.20
        case .standard: 0.40
        case .expanded: 0.70
        }
    }
}

/// Render state for the Nearby map screen.
public enum NearbyMapState: Sendable {
    case loading
    case loaded(NearbyMapLoaded)
    case error(message: String)
}

/// One drawable marker on the map. Either a single entity pin or a
/// cluster glyph standing in for ≥2 entities that fall inside the
/// current cluster radius.
public enum MapMarker: Identifiable, Sendable, Hashable {
    case entity(MapEntity)
    case cluster(MapCluster)

    public var id: String {
        switch self {
        case let .entity(entity): "entity_\(entity.id)"
        case let .cluster(cluster): "cluster_\(cluster.id)"
        }
    }

    public var latitude: Double {
        switch self {
        case let .entity(entity): entity.latitude
        case let .cluster(cluster): cluster.latitude
        }
    }

    public var longitude: Double {
        switch self {
        case let .entity(entity): entity.longitude
        case let .cluster(cluster): cluster.longitude
        }
    }

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// A clustered group of ≥2 entities. Tap zooms the camera to the
/// cluster's bounding box.
public struct MapCluster: Sendable, Hashable, Identifiable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let category: GigsCategory
    public let count: Int
    public let entityIds: [String]
    public let minLatitude: Double
    public let maxLatitude: Double
    public let minLongitude: Double
    public let maxLongitude: Double

    public init(
        id: String,
        latitude: Double,
        longitude: Double,
        category: GigsCategory,
        count: Int,
        entityIds: [String],
        minLatitude: Double,
        maxLatitude: Double,
        minLongitude: Double,
        maxLongitude: Double
    ) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.category = category
        self.count = count
        self.entityIds = entityIds
        self.minLatitude = minLatitude
        self.maxLatitude = maxLatitude
        self.minLongitude = minLongitude
        self.maxLongitude = maxLongitude
    }
}

/// Successful load — splits the entities into the ordered list the
/// sheet renders and keeps the user's anchor coordinate so the "you
/// are here" disc lands in the right spot. `selectedId` mirrors the
/// pin↔card link. `markers` is the clustered projection of `entities`
/// used by the map layer (the sheet uses the flat entities list).
public struct NearbyMapLoaded: Sendable, Hashable {
    public let entities: [MapEntity]
    public let markers: [MapMarker]
    public let userCoordinate: UserCoordinate?
    public let selectedId: String?

    public init(
        entities: [MapEntity],
        markers: [MapMarker],
        userCoordinate: UserCoordinate?,
        selectedId: String? = nil
    ) {
        self.entities = entities
        self.markers = markers
        self.userCoordinate = userCoordinate
        self.selectedId = selectedId
    }
}
