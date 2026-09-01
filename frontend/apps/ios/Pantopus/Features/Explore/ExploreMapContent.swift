//
//  ExploreMapContent.swift
//  Pantopus
//
//  A11.2 Explore — content models for the cross-type discovery map.
//  Unlike the Nearby map (gig / listing only) the Explore surface mixes
//  four entity kinds — task / item / post / spot — each with its own pin
//  glyph, accent color, and per-type badge (bids / "New" / replies /
//  rating). The view-model projects sample rows into a homogeneous
//  `ExploreEntity` so the map / sheet vocabulary stays unified.
//

import CoreLocation
import Foundation
import SwiftUI

/// Coordinate target used when another surface asks Explore to open a saved
/// place on the map.
public struct ExploreMapFocus: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    public let label: String

    public init(latitude: Double, longitude: Double, label: String) {
        self.latitude = latitude
        self.longitude = longitude
        self.label = label
    }

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// The discovery entity kinds the Explore map mixes. Each carries its
/// accent color (token-only), pin glyph, and pin shape.
///
/// `task` / `item` come from the gig + listing in-bounds routes; `post`,
/// `spot` (business), and `home` come from the multi-layer viewport route
/// `GET /api/posts/map` (`backend/routes/posts.js:1646`).
public enum ExploreKind: String, CaseIterable, Sendable, Hashable, Identifiable {
    case task
    case item
    case post
    case spot
    case home

    public var id: String {
        rawValue
    }

    /// Plural label for the type toggle + the filter sheet chips.
    public var pluralLabel: String {
        switch self {
        case .task: "Tasks"
        case .item: "Items"
        case .post: "Posts"
        case .spot: "Spots"
        case .home: "Homes"
        }
    }

    /// Singular label for the per-card type tag.
    public var singularLabel: String {
        switch self {
        case .task: "Task"
        case .item: "Item"
        case .post: "Post"
        case .spot: "Spot"
        case .home: "Home"
        }
    }

    /// Accent color. Sourced from the design's category palette mapped to
    /// existing tokens: task → gigs orange, item → business violet, post →
    /// primary-500 sky, spot → home green, home → home-dark green. (No new
    /// tokens introduced.)
    public var color: Color {
        switch self {
        case .task: Theme.Color.gigs
        case .item: Theme.Color.business
        case .post: Theme.Color.primary500
        case .spot: Theme.Color.home
        case .home: Theme.Color.homeDark
        }
    }

    /// White glyph rendered inside the pin and on the rail-card tile.
    /// `store` has no token in our Lucide set — `building2` stands in for
    /// the "spot" (local place) kind.
    public var glyph: PantopusIcon {
        switch self {
        case .task: .hammer
        case .item: .tag
        case .post: .messageCircle
        case .spot: .building2
        case .home: .home
        }
    }

    /// Items render as a rounded square; the other kinds render as discs
    /// (matches the design's `isSquare` treatment).
    public var isSquarePin: Bool {
        self == .item
    }
}

/// Per-pin lifecycle state. Drives the pin treatment — confirmed gets a
/// white ring, pending dashes its accent outline, active runs the pulse
/// halo (mirrors the Nearby map's `MapEntityState`).
public enum ExploreEntityState: Sendable, Hashable {
    case confirmed
    case pending
}

/// Per-type badge shown on the rail card / list row. The tone resolves to
/// a token color pair at render time (no hardcoded hex).
public struct ExploreBadge: Sendable, Hashable {
    public enum Tone: Sendable, Hashable {
        case bids // amber — task "4 bids"
        case new // green — item "New"
        case replies // sky — post "8 replies"
        case rating // amber — spot "4.8★"
    }

    public let text: String
    public let tone: Tone

    public init(text: String, tone: Tone) {
        self.text = text
        self.tone = tone
    }
}

/// One pin / one card / one row, rolled up. The view-model never hands
/// raw DTOs to the view.
public struct ExploreEntity: Identifiable, Sendable, Hashable {
    public let id: String
    public let kind: ExploreKind
    public let state: ExploreEntityState
    public let latitude: Double
    public let longitude: Double
    public let title: String
    /// Leading meta token — kind-specific ("$60", "$420", "Asked 2h ago",
    /// "Open"). Rendered as "<metaLead> · <distanceLabel>".
    public let metaLead: String
    public let distanceLabel: String
    /// Numeric distance (miles) used by the distance-radius filter.
    public let distanceMiles: Double
    public let badge: ExploreBadge?
    public let city: String?
    public let stateName: String?
    public let geocodePlaceId: String?
    public let sourceId: String?
    /// Honoured by the "Verified only" filter toggle.
    public let verified: Bool
    /// Honoured by the "Open now" filter toggle.
    public let openNow: Bool

    public init(
        id: String,
        kind: ExploreKind,
        state: ExploreEntityState,
        latitude: Double,
        longitude: Double,
        title: String,
        metaLead: String,
        distanceLabel: String,
        distanceMiles: Double,
        badge: ExploreBadge?,
        city: String? = nil,
        stateName: String? = nil,
        geocodePlaceId: String? = nil,
        sourceId: String? = nil,
        verified: Bool,
        openNow: Bool
    ) {
        self.id = id
        self.kind = kind
        self.state = state
        self.latitude = latitude
        self.longitude = longitude
        self.title = title
        self.metaLead = metaLead
        self.distanceLabel = distanceLabel
        self.distanceMiles = distanceMiles
        self.badge = badge
        self.city = city
        self.stateName = stateName
        self.geocodePlaceId = geocodePlaceId
        self.sourceId = sourceId
        self.verified = verified
        self.openNow = openNow
    }

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// Sort applied to the sheet body. Explore is cross-type so the gig-only
/// "highest pay" / "fewest bids" dimensions don't apply.
public enum ExploreSort: String, CaseIterable, Sendable, Hashable, Identifiable {
    case closest
    case newest

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .closest: "Closest"
        case .newest: "Newest"
        }
    }
}

/// Bottom-sheet snap stop — mirrors the Nearby map's three positions.
public enum ExploreSheetStop: CaseIterable, Sendable, Hashable {
    case collapsed
    case standard
    case expanded

    public var heightFraction: CGFloat {
        switch self {
        case .collapsed: 0.20
        case .standard: 0.40
        case .expanded: 0.70
        }
    }
}

/// A clustered group of ≥2 entities. Tap zooms the camera to the
/// cluster's bounding box.
public struct ExploreCluster: Sendable, Hashable, Identifiable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    /// Accent kind — the most common kind in the bucket (drives color).
    public let kind: ExploreKind
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
        kind: ExploreKind,
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
        self.kind = kind
        self.count = count
        self.entityIds = entityIds
        self.minLatitude = minLatitude
        self.maxLatitude = maxLatitude
        self.minLongitude = minLongitude
        self.maxLongitude = maxLongitude
    }
}

/// One drawable marker — a single typed pin or a cluster glyph.
public enum ExploreMarker: Identifiable, Sendable, Hashable {
    case entity(ExploreEntity)
    case cluster(ExploreCluster)

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

/// Successful load. `entities` is the flat (filtered + sorted) list the
/// sheet renders; `markers` is the clustered projection used by the map.
/// `selectedId` mirrors the pin↔card link. When `entities` is empty the
/// sheet renders the designed empty hero (the map keeps its chrome +
/// the dashed search-radius ring).
public struct ExploreMapLoaded: Sendable, Hashable {
    public let entities: [ExploreEntity]
    public let markers: [ExploreMarker]
    public let userCoordinate: UserCoordinate?
    public let selectedId: String?

    public init(
        entities: [ExploreEntity],
        markers: [ExploreMarker],
        userCoordinate: UserCoordinate?,
        selectedId: String? = nil
    ) {
        self.entities = entities
        self.markers = markers
        self.userCoordinate = userCoordinate
        self.selectedId = selectedId
    }

    /// Designed empty state — a successful load that the active filters
    /// narrowed to zero results.
    public var isEmpty: Bool {
        entities.isEmpty
    }
}

/// Render state for the Explore map screen.
public enum ExploreMapState: Sendable {
    case loading
    case loaded(ExploreMapLoaded)
    case error(message: String)
}
