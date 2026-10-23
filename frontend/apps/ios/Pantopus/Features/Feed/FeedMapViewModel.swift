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

/// Pulse map-mode view model.
@Observable
@MainActor
public final class FeedMapViewModel {
    /// Debounce applied to camera-driven refetches. Matches RN's
    /// `REGION_DEBOUNCE_MS` (`src/hooks/feed/useFeedMap.ts:13`).
    static let regionDebounceNanoseconds: UInt64 = 350_000_000

    public private(set) var state: FeedMapState = .loading

    /// The viewport posts are read for: where the camera settled, or where
    /// the view model sent it.
    public private(set) var region: FeedMapRegion = .fallback

    /// The latest camera move asked of the view (`FeedMapView` follows it).
    public private(set) var cameraRequest: FeedMapCameraRequest?

    /// Where the camera last settled; nil until it first does.
    public private(set) var lastCamera: FeedMapCamera?

    /// True once the camera moved off the last fetched viewport — drives
    /// the floating "Search this area" pill.
    public private(set) var viewportDirty = false

    /// Set after the first successful viewport fetch.
    public private(set) var isReady = false

    private let api: APIClient
    /// The area chosen in the Pulse chip is read through the screen store,
    /// so the map shares the copy the Pulse list read.
    private let store: ScreenStore
    private let locationProvider: any LocationProviding
    private var query: FeedMapQuery
    private var userCoordinate: UserCoordinate?
    /// The chosen area the camera last moved to; another pick moves it again.
    private var shownArea: ViewingLocationDTO?
    private var pendingRegion: FeedMapRegion?
    private var debounceTask: Task<Void, Never>?
    private var fetchTask: Task<Void, Never>?
    private var cameraRequestCount = 0
    /// The viewport the shown posts were read for.
    private var fetchedRegion: FeedMapRegion?
    /// The latitude span a straight-down map would show around the camera's
    /// centre. Pins are spaced by it: a tilted map's region reaches much
    /// further than its foreground, which would cluster near pins too eagerly.
    private var clusterLatitudeDelta: Double?

    init(
        api: APIClient = .shared,
        surface: FeedSurface = .pulse,
        locationProvider: any LocationProviding = DeviceLocationProvider.shared
    ) {
        self.api = api
        store = ScreenStore.store(for: api)
        query = FeedMapQuery(surface: surface, postType: nil)
        self.locationProvider = locationProvider
        userCoordinate = locationProvider.cachedCoordinate()
    }

    // MARK: - Lifecycle

    /// Entering Map mode, or the surface / chip-row filter changed while
    /// it is showing. Resolves the viewing location on first use; after
    /// that, moves to a newly chosen area or re-requests the current
    /// viewport (RN `useFeedMap.ts:104`).
    public func activate(query: FeedMapQuery) async {
        let changed = query != self.query
        self.query = query
        guard isReady else {
            await initializeMap()
            return
        }
        if await followChosenArea() { return }
        guard changed else { return }
        await fetchMarkers(for: pendingRegion ?? region)
    }

    public func refresh() async {
        guard isReady else {
            await initializeMap()
            return
        }
        await fetchMarkers(for: pendingRegion ?? region)
    }

    /// The area in the Pulse chip changed since the map last moved to it:
    /// move there and read its posts, as the list does. Returns whether it moved.
    @discardableResult
    public func followChosenArea() async -> Bool {
        guard isReady,
              let area = try? await viewingLocation().viewingLocation,
              area.latitude != shownArea?.latitude || area.longitude != shownArea?.longitude
        else { return false }
        shownArea = area
        let next = FeedMapRegion(
            latitude: area.latitude,
            longitude: area.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta
        )
        moveCamera(to: next)
        await fetchMarkers(for: next)
        return true
    }

    /// Where the map opens: the area chosen in the Pulse chip, which the list
    /// uses too; else the device; else the first home, then the newest saved
    /// place, as the server does for a list sent without coordinates; else the
    /// default region. Android's `FeedMapViewModel` opens in the same order.
    private func initializeMap() async {
        state = .loading
        guard let payload = try? await viewingLocation() else {
            if !Task.isCancelled { state = .error(message: "Couldn't load your selected area.") }
            return
        }
        shownArea = payload.viewingLocation
        if let area = shownArea {
            moveCamera(to: openingRegion(latitude: area.latitude, longitude: area.longitude))
        }
        if userCoordinate == nil {
            userCoordinate = locationProvider.cachedCoordinate()
        }
        // With an area chosen, opening the map doesn't ask for location; where
        // it's allowed, a fix still marks where you are.
        if userCoordinate == nil, shownArea == nil || locationProvider.canLocateWithoutAsking {
            userCoordinate = await locationProvider.requestCurrent(timeoutSeconds: 4)
        }
        if shownArea == nil, let center = await fallbackCenter(homes: payload.homes) {
            moveCamera(to: openingRegion(latitude: center.latitude, longitude: center.longitude))
        }
        await fetchMarkers(for: region)
        isReady = true
    }

    /// Sends the camera to `next` (the view follows `cameraRequest`) and
    /// makes it the viewport, with nothing left to search.
    private func moveCamera(to next: FeedMapRegion) {
        region = next
        pendingRegion = nil
        viewportDirty = false
        cameraRequestCount += 1
        cameraRequest = FeedMapCameraRequest(id: cameraRequestCount, region: next)
    }

    /// `GET /api/location`, read the way the Pulse list reads it.
    private func viewingLocation() async throws -> ViewingLocationPayload {
        try await store.load(
            ViewingLocationEndpoints.current(),
            as: ViewingLocationPayload.self,
            kind: .you,
            topics: [ScreenTopic.profileMe]
        ).value
    }

    /// No area chosen: the device, then the first home, then the newest saved place.
    private func fallbackCenter(homes: [HomeLocationDTO]) async -> (latitude: Double, longitude: Double)? {
        if let userCoordinate {
            return (userCoordinate.latitude, userCoordinate.longitude)
        }
        for home in homes {
            if let latitude = home.latitude, let longitude = home.longitude {
                return (latitude, longitude)
            }
        }
        guard let place = try? await HomesStoreReads.savedPlaces(store: store).value.savedPlaces.first else {
            return nil
        }
        return (place.latitude, place.longitude)
    }

    private func openingRegion(latitude: Double, longitude: Double) -> FeedMapRegion {
        FeedMapRegion(
            latitude: latitude,
            longitude: longitude,
            latitudeDelta: FeedMapRegion.fallback.latitudeDelta,
            longitudeDelta: FeedMapRegion.fallback.longitudeDelta
        )
    }

    // MARK: - Camera

    /// Camera settled on a new viewport. Marks the viewport dirty (so the
    /// "Search this area" pill appears) and debounces the follow-up
    /// region commit — the refetch itself waits for the explicit tap,
    /// matching RN. With nothing pending, settling on `region` as MapKit
    /// fitted it to the map's shape isn't a move. The pins regroup for the
    /// new zoom straight away, so zooming in splits a cluster.
    ///
    /// `byUser` false is the settle of a move the view made itself (opening
    /// and tilting the map, a `cameraRequest`): not a move by the person. A
    /// tilted camera sees further than the region asked for, so its region
    /// becomes the viewport, read again when it reaches past what was read.
    /// `clusterLatitudeDelta` is the span a straight-down map would show at
    /// the camera's centre.
    public func cameraDidSettle(
        on next: FeedMapRegion,
        camera: FeedMapCamera? = nil,
        clusterLatitudeDelta: Double? = nil,
        byUser: Bool = true
    ) {
        if let camera { lastCamera = camera }
        if let clusterLatitudeDelta { self.clusterLatitudeDelta = clusterLatitudeDelta }
        guard byUser else {
            adoptSettledRegion(next)
            return
        }
        if let pendingRegion {
            guard next.changedSignificantly(from: pendingRegion) else {
                regroupPins(keepingSelection: true)
                return
            }
        } else if next.isMapFit(of: region) {
            regroupPins(keepingSelection: true)
            return
        }
        pendingRegion = next
        viewportDirty = true
        regroupPins(keepingSelection: false)
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

    /// The view's own move settled. Its region is the viewport now; posts
    /// are read again only when it shows more than was read.
    private func adoptSettledRegion(_ next: FeedMapRegion) {
        guard isReady, pendingRegion == nil else { return }
        region = next
        regroupPins(keepingSelection: true)
        if let fetchedRegion, next.isCovered(by: fetchedRegion) { return }
        Task { await fetchMarkers(for: next) }
    }

    /// Regroups the loaded pins for the camera's zoom. A move by the person
    /// closes the preview card and the cluster list, as it always has.
    private func regroupPins(keepingSelection: Bool) {
        guard case let .loaded(loaded) = state else { return }
        let markers = ExploreMapViewModel.cluster(
            entities: loaded.entities,
            radiusDegrees: clusterRadius(latitudeDelta: clusterLatitudeDelta ?? region.latitudeDelta)
        )
        state = .loaded(loaded.with(
            markers: markers,
            selectedId: keepingSelection ? loaded.selectedId : nil,
            clusterPostIds: keepingSelection ? loaded.clusterPostIds : []
        ))
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
        moveCamera(to: next)
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
        moveCamera(to: next)
        await fetchMarkers(for: next)
    }

    // MARK: - Selection

    /// Shows a pin's preview card, or none for nil, or (with `clusterPostIds`)
    /// a tapped cluster's posts as a list in its place.
    public func selectEntity(_ id: String?, clusterPostIds: Set<String> = []) {
        guard case let .loaded(loaded) = state else { return }
        state = .loaded(loaded.with(selectedId: id, clusterPostIds: clusterPostIds))
    }

    /// Lists `cluster`'s posts in the preview card's place.
    public func showClusterPosts(_ cluster: ExploreCluster) {
        selectEntity(nil, clusterPostIds: Set(cluster.entityIds))
    }

    /// Currently selected pin, if any.
    public var selectedEntity: ExploreEntity? {
        guard case let .loaded(loaded) = state, let id = loaded.selectedId else { return nil }
        return loaded.entities.first { $0.id == id }
    }

    /// The smallest cluster radius, in degrees, however far the map zooms in.
    static let minClusterRadius = 0.0005

    /// Widen the cluster radius as the camera zooms out and vice versa:
    /// about an eighth of the view's height, so neighbouring cluster bubbles
    /// (up to 60 pt) don't overlap.
    public func clusterRadius(for region: FeedMapRegion) -> Double {
        clusterRadius(latitudeDelta: region.latitudeDelta)
    }

    private func clusterRadius(latitudeDelta: Double) -> Double {
        max(Self.minClusterRadius, min(latitudeDelta * 0.12, 0.05))
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
                let now = Date()
                var pinStyles: [String: FeedMapPinStyle] = [:]
                for marker in response.markers where marker.layerType == "post" {
                    pinStyles[marker.id] = FeedMapPinStyle.of(marker, now: now)
                }
                fetchedRegion = target
                state = .loaded(FeedMapLoaded(
                    entities: entities.sorted { $0.distanceMiles < $1.distanceMiles },
                    markers: ExploreMapViewModel.cluster(
                        entities: entities,
                        radiusDegrees: clusterRadius(latitudeDelta: clusterLatitudeDelta ?? target.latitudeDelta)
                    ),
                    userCoordinate: userCoordinate,
                    selectedId: nil,
                    nearestActivityCenter: hint,
                    pinStyles: pinStyles
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
