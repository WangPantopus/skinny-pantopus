//
//  FeedMapViewModel.swift
//  Pantopus
//
//  Backs the Pulse feed's Map mode (the List / Map toggle in the feed
//  header). Mirrors RN `src/hooks/feed/useFeedMap.ts`: a viewport-driven
//  fetch against `GET /api/posts/map` (`backend/routes/posts.js:1646`),
//  a debounced "viewport dirty" flag that surfaces the "Search this area"
//  pill, and a recenter action that returns to the viewing location.
//
//  Pin/cluster geometry is *not* rebuilt here — the Explore map's
//  clusterer and pin views are reused verbatim so Pulse and Explore
//  share one map stack.
//

import CoreLocation
import Foundation
import Observation

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

    public init(
        entities: [ExploreEntity],
        markers: [ExploreMarker],
        userCoordinate: UserCoordinate?,
        selectedId: String? = nil,
        nearestActivityCenter: FeedMapRegion? = nil
    ) {
        self.entities = entities
        self.markers = markers
        self.userCoordinate = userCoordinate
        self.selectedId = selectedId
        self.nearestActivityCenter = nearestActivityCenter
    }

    public var isEmpty: Bool {
        entities.isEmpty
    }
}

/// Pulse map-mode view model.
@Observable
@MainActor
public final class FeedMapViewModel {
    /// Debounce applied to camera-driven refetches. Matches RN's
    /// `REGION_DEBOUNCE_MS` (`src/hooks/feed/useFeedMap.ts:13`).
    static let regionDebounceNanoseconds: UInt64 = 350_000_000

    public private(set) var state: FeedMapState = .loading

    /// Current camera viewport. The view mirrors this into `MapCameraPosition`.
    public private(set) var region: FeedMapRegion = .fallback

    /// True once the camera moved off the last fetched viewport — drives
    /// the floating "Search this area" pill.
    public private(set) var viewportDirty = false

    /// Set after the first successful viewport fetch.
    public private(set) var isReady = false

    private let api: APIClient
    private let locationProvider: any LocationProviding
    private var query: FeedMapQuery
    private var userCoordinate: UserCoordinate?
    private var pendingRegion: FeedMapRegion?
    private var debounceTask: Task<Void, Never>?
    private var fetchTask: Task<Void, Never>?

    init(
        api: APIClient = .shared,
        surface: FeedSurface = .pulse,
        locationProvider: any LocationProviding = DeviceLocationProvider.shared
    ) {
        self.api = api
        query = FeedMapQuery(surface: surface, postType: nil)
        self.locationProvider = locationProvider
        userCoordinate = locationProvider.cachedCoordinate()
    }

    // MARK: - Lifecycle

    /// Entering Map mode, or the surface / chip-row filter changed while
    /// it is showing. Resolves the viewing location on first use and
    /// re-requests the current viewport thereafter (RN
    /// `useFeedMap.ts:104`).
    public func activate(query: FeedMapQuery) async {
        let changed = query != self.query
        self.query = query
        guard isReady else {
            await initializeMap()
            return
        }
        guard changed else { return }
        await fetchMarkers(for: pendingRegion ?? region)
    }

    public func refresh() async {
        await fetchMarkers(for: pendingRegion ?? region)
    }

    private func initializeMap() async {
        if userCoordinate == nil {
            userCoordinate = await locationProvider.requestCurrent(timeoutSeconds: 4)
        }
        if let coordinate = userCoordinate {
            region = FeedMapRegion(
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                latitudeDelta: FeedMapRegion.fallback.latitudeDelta,
                longitudeDelta: FeedMapRegion.fallback.longitudeDelta
            )
        }
        await fetchMarkers(for: region)
        isReady = true
    }

    // MARK: - Camera

    /// Camera settled on a new viewport. Marks the viewport dirty (so the
    /// "Search this area" pill appears) and debounces the follow-up
    /// region commit — the refetch itself waits for the explicit tap,
    /// matching RN.
    public func cameraDidSettle(on next: FeedMapRegion) {
        guard next.changedSignificantly(from: pendingRegion ?? region) else { return }
        pendingRegion = next
        viewportDirty = true
        clearSelection()
        debounceTask?.cancel()
        debounceTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: FeedMapViewModel.regionDebounceNanoseconds)
            guard !Task.isCancelled else { return }
            self?.commitPendingRegion()
        }
    }

    private func commitPendingRegion() {
        guard let pendingRegion else { return }
        region = pendingRegion
    }

    /// "Search this area" — re-request the viewport the user dragged to.
    public func searchThisArea() async {
        debounceTask?.cancel()
        debounceTask = nil
        let target = pendingRegion ?? region
        region = target
        await fetchMarkers(for: target)
        pendingRegion = nil
        viewportDirty = false
    }

    /// Recenter — re-resolve the device location, move the camera back,
    /// and refetch (RN `useFeedMap.ts:160`).
    public func recenter() async {
        if let fresh = await locationProvider.requestCurrent(timeoutSeconds: 4) {
            userCoordinate = fresh
        }
        guard let coordinate = userCoordinate else { return }
        let next = FeedMapRegion(
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta
        )
        region = next
        pendingRegion = nil
        viewportDirty = false
        await fetchMarkers(for: next)
    }

    /// Jump to the backend's nearest-activity hint when the viewport came
    /// back empty.
    public func jumpToNearestActivity() async {
        guard case let .loaded(loaded) = state, let center = loaded.nearestActivityCenter else { return }
        let next = FeedMapRegion(
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta
        )
        region = next
        pendingRegion = nil
        viewportDirty = false
        await fetchMarkers(for: next)
    }

    // MARK: - Selection

    public func selectEntity(_ id: String?) {
        guard case let .loaded(loaded) = state else { return }
        state = .loaded(FeedMapLoaded(
            entities: loaded.entities,
            markers: loaded.markers,
            userCoordinate: loaded.userCoordinate,
            selectedId: id,
            nearestActivityCenter: loaded.nearestActivityCenter
        ))
    }

    /// Currently selected pin, if any.
    public var selectedEntity: ExploreEntity? {
        guard case let .loaded(loaded) = state, let id = loaded.selectedId else { return nil }
        return loaded.entities.first { $0.id == id }
    }

    private func clearSelection() {
        selectEntity(nil)
    }

    /// Widen the cluster radius as the camera zooms out and vice versa.
    public func clusterRadius(for region: FeedMapRegion) -> Double {
        max(0.0005, min(region.latitudeDelta * 0.08, 0.05))
    }

    // MARK: - Fetch

    private func fetchMarkers(for target: FeedMapRegion) async {
        fetchTask?.cancel()
        if case .loaded = state {} else { state = .loading }
        let bounds = target.bounds
        let anchor = userCoordinate
            ?? UserCoordinate(latitude: target.latitude, longitude: target.longitude, accuracyMeters: 0)
        let surfaceValue = query.surface.backendSurface
        let postTypeValue = query.postType
        let task = Task { @MainActor in
            do {
                let response: PostsMapResponse = try await api.request(
                    PostsMapEndpoints.markers(
                        south: bounds.south,
                        west: bounds.west,
                        north: bounds.north,
                        east: bounds.east,
                        layers: [.posts],
                        postType: postTypeValue,
                        surface: surfaceValue,
                        limit: 200
                    )
                )
                guard !Task.isCancelled else { return }
                // RN filters the response down to `layer_type === 'post'`
                // (`src/hooks/feed/useFeedMap.ts:60`); the shared projector
                // does the same by ignoring every other layer.
                let entities = ExploreMapViewModel.projectMarkers(response.markers, anchor: anchor)
                    .filter { $0.kind == .post }
                let hint = response.nearestActivityCenter.map {
                    FeedMapRegion(
                        latitude: $0.latitude,
                        longitude: $0.longitude,
                        latitudeDelta: target.latitudeDelta,
                        longitudeDelta: target.longitudeDelta
                    )
                }
                state = .loaded(FeedMapLoaded(
                    entities: entities.sorted { $0.distanceMiles < $1.distanceMiles },
                    markers: ExploreMapViewModel.cluster(
                        entities: entities,
                        radiusDegrees: clusterRadius(for: target)
                    ),
                    userCoordinate: userCoordinate,
                    selectedId: nil,
                    nearestActivityCenter: hint
                ))
            } catch {
                guard !Task.isCancelled else { return }
                state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load the map.")
            }
        }
        fetchTask = task
        _ = await task.value
    }
}
