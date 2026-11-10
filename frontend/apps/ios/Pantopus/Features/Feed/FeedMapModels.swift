//
//  FeedMapModels.swift
//  Pantopus
//
//  The Pulse map's values: the List / Map mode, what a read asks for and
//  its state, the viewport posts are read for, a successful read, the
//  camera moves the view model asks for, and the settled 3D camera it
//  keeps so Map mode comes back to the same view.
//

import Foundation

/// A viewport as the map reports it — centre plus span, mirroring RN's
/// `Region`.
public struct FeedMapRegion: Sendable, Hashable {
    public var latitude: Double
    public var longitude: Double
    public var latitudeDelta: Double
    public var longitudeDelta: Double

    public init(latitude: Double, longitude: Double, latitudeDelta: Double, longitudeDelta: Double) {
        self.latitude = latitude
        self.longitude = longitude
        self.latitudeDelta = latitudeDelta
        self.longitudeDelta = longitudeDelta
    }

    /// RN default region (`src/constants/feed.ts` `DEFAULT_REGION`).
    public static let fallback = FeedMapRegion(
        latitude: 40.7484,
        longitude: -73.9857,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12
    )

    /// South / west / north / east — the four params `/api/posts/map`
    /// requires (`backend/routes/posts.js:1652`). A named box rather than a
    /// 4-tuple so the edges cannot be transposed at the call site.
    public struct Bounds: Sendable, Equatable {
        public let south: Double
        public let west: Double
        public let north: Double
        public let east: Double
    }

    public var bounds: Bounds {
        Bounds(
            south: latitude - latitudeDelta / 2,
            west: longitude - longitudeDelta / 2,
            north: latitude + latitudeDelta / 2,
            east: longitude + longitudeDelta / 2
        )
    }

    /// RN's `regionChangedSignificantly` — ignore sub-10% jitter so a
    /// settling camera doesn't spam the endpoint.
    public func changedSignificantly(from other: FeedMapRegion) -> Bool {
        let latThreshold = max(other.latitudeDelta * 0.1, 0.0005)
        let lonThreshold = max(other.longitudeDelta * 0.1, 0.0005)
        return abs(latitude - other.latitude) > latThreshold
            || abs(longitude - other.longitude) > lonThreshold
            || abs(latitudeDelta - other.latitudeDelta) > latThreshold
            || abs(longitudeDelta - other.longitudeDelta) > lonThreshold
    }

    /// Whether this viewport lies inside `other`, give or take 10% of
    /// `other`'s span: posts read for `other` cover what this one shows.
    public func isCovered(by other: FeedMapRegion) -> Bool {
        let mine = bounds
        let theirs = other.bounds
        let latSlack = other.latitudeDelta * 0.1
        let lonSlack = other.longitudeDelta * 0.1
        return mine.south >= theirs.south - latSlack
            && mine.north <= theirs.north + latSlack
            && mine.west >= theirs.west - lonSlack
            && mine.east <= theirs.east + lonSlack
    }

    /// MapKit fits a requested region to the map's shape: the centre and one
    /// side of the span stay, the other side widens. True when this settled
    /// viewport is `requested` fitted that way (within the same 10% jitter),
    /// so nobody moved the map.
    public func isMapFit(of requested: FeedMapRegion) -> Bool {
        let latThreshold = max(requested.latitudeDelta * 0.1, 0.0005)
        let lonThreshold = max(requested.longitudeDelta * 0.1, 0.0005)
        let keepsLatitude = abs(latitudeDelta - requested.latitudeDelta) <= latThreshold
        let keepsLongitude = abs(longitudeDelta - requested.longitudeDelta) <= lonThreshold
        return abs(latitude - requested.latitude) <= latThreshold
            && abs(longitude - requested.longitude) <= lonThreshold
            && latitudeDelta >= requested.latitudeDelta - latThreshold
            && longitudeDelta >= requested.longitudeDelta - lonThreshold
            && (keepsLatitude || keepsLongitude)
    }
}

/// Which half of the feed header's List / Map toggle is active.
public enum FeedViewMode: String, Sendable, Hashable, CaseIterable {
    case list
    case map

    /// Segment label.
    public var label: String {
        switch self {
        case .list: "List"
        case .map: "Map"
        }
    }

    /// Segment glyph.
    public var icon: PantopusIcon {
        switch self {
        case .list: .list
        case .map: .map
        }
    }
}

/// The two request dimensions the map mode re-fetches on: which feed
/// surface is active (`place` / `connections`) and which chip-row intent
/// is selected. Used as the `.task(id:)` key so a change re-requests the
/// current viewport.
public struct FeedMapQuery: Sendable, Hashable {
    public let surface: FeedSurface
    public let postType: String?

    public init(surface: FeedSurface, postType: String?) {
        self.surface = surface
        self.postType = postType
    }
}

/// Render state for the Pulse map mode.
public enum FeedMapState: Sendable {
    case loading
    case loaded(FeedMapLoaded)
    case error(message: String)
}

/// A successful viewport fetch.
public struct FeedMapLoaded: Sendable, Hashable {
    public let entities: [ExploreEntity]
    public let markers: [ExploreMarker]
    public let userCoordinate: UserCoordinate?
    public let selectedId: String?
    /// Backend hint offered when the viewport was empty
    /// (`backend/routes/posts.js:1854`).
    public let nearestActivityCenter: FeedMapRegion?
    /// Posts of the tapped cluster shown as a list (one zooming can't split).
    public let clusterPostIds: Set<String>
    /// Each post's pin style, by post id.
    public let pinStyles: [String: FeedMapPinStyle]
    /// Connections' posts with no place (no pin), newest first: the bar under
    /// the map counts them and opens them as a list.
    public let unplacedPosts: [ExploreEntity]
    /// The server holds more posts with no place than `unplacedPosts`.
    public let unplacedMore: Bool
    /// The posts with no place are shown as a list.
    public let showsUnplaced: Bool

    public init(
        entities: [ExploreEntity],
        markers: [ExploreMarker],
        userCoordinate: UserCoordinate?,
        selectedId: String? = nil,
        nearestActivityCenter: FeedMapRegion? = nil,
        clusterPostIds: Set<String> = [],
        pinStyles: [String: FeedMapPinStyle] = [:],
        unplacedPosts: [ExploreEntity] = [],
        unplacedMore: Bool = false,
        showsUnplaced: Bool = false
    ) {
        self.entities = entities
        self.markers = markers
        self.userCoordinate = userCoordinate
        self.selectedId = selectedId
        self.nearestActivityCenter = nearestActivityCenter
        self.clusterPostIds = clusterPostIds
        self.pinStyles = pinStyles
        self.unplacedPosts = unplacedPosts
        self.unplacedMore = unplacedMore
        self.showsUnplaced = showsUnplaced
    }

    public var isEmpty: Bool {
        entities.isEmpty
    }

    /// The listed cluster's posts, nearest first.
    public var clusterPosts: [ExploreEntity] {
        entities.filter { clusterPostIds.contains($0.id) }
    }

    /// "3 posts with no place", "50+" when the server holds more.
    public var unplacedLabel: String {
        let count = unplacedMore ? "\(unplacedPosts.count)+" : "\(unplacedPosts.count)"
        return unplacedPosts.count == 1 && !unplacedMore ? "1 post with no place" : "\(count) posts with no place"
    }

    /// A copy with other entities, markers, selection, cluster list or list
    /// of posts with no place.
    func with(
        entities: [ExploreEntity]? = nil,
        markers: [ExploreMarker]? = nil,
        selectedId: String?,
        clusterPostIds: Set<String> = [],
        unplacedPosts: [ExploreEntity]? = nil,
        showsUnplaced: Bool = false
    ) -> FeedMapLoaded {
        FeedMapLoaded(
            entities: entities ?? self.entities,
            markers: markers ?? self.markers,
            userCoordinate: userCoordinate,
            selectedId: selectedId,
            nearestActivityCenter: nearestActivityCenter,
            clusterPostIds: clusterPostIds,
            pinStyles: pinStyles,
            unplacedPosts: unplacedPosts ?? self.unplacedPosts,
            unplacedMore: unplacedMore,
            showsUnplaced: showsUnplaced
        )
    }
}

/// A camera move the view model asks for (opening the map, Recenter, a new
/// area, the nearest activity): the view moves the camera's centre there and
/// keeps its tilt and height. The person's own pans never make one. `id`
/// tells two requests for the same place apart.
public struct FeedMapCameraRequest: Sendable, Hashable {
    public let id: Int
    public let region: FeedMapRegion
}

/// A settled 3D camera: what it looks at, from how far, turned and tilted
/// how much. Kept so Map mode comes back to the same view.
public struct FeedMapCamera: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    /// Metres from the camera to the point it looks at.
    public let distance: Double
    public let heading: Double
    public let pitch: Double

    public init(latitude: Double, longitude: Double, distance: Double, heading: Double, pitch: Double) {
        self.latitude = latitude
        self.longitude = longitude
        self.distance = distance
        self.heading = heading
        self.pitch = pitch
    }
}
