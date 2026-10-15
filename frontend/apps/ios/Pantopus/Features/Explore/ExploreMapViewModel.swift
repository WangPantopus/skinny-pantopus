//
//  ExploreMapViewModel.swift
//  Pantopus
//
//  A11.2 Explore / P1-F — view-model for the cross-type discovery map.
//
//  The launch path fetches public posts and private Homes independently
//  from `GET /api/posts/map`. Home access always rechecks without a protocol
//  cache; only public post projections survive a pause in this view-model.
//  Filtering, sorting, and clustering run locally over the fetched window
//  (mirrors `NearbyMapViewModel`). Previews / snapshots / tests seed
//  deterministic content via `init(scenario:)`, bypassing the network.
//

// swiftlint:disable file_length type_body_length

import CoreLocation
import Foundation
import Observation

@Observable
@MainActor
public final class ExploreMapViewModel {
    public private(set) var state: ExploreMapState = .loading

    /// Active type-toggle selection. `nil` == "All".
    public private(set) var activeKind: ExploreKind?

    /// Sort applied to the sheet body (local, no refetch).
    public private(set) var activeSort: ExploreSort = .closest

    /// Current sheet stop. Driven by drag-release in the view.
    public var sheetStop: ExploreSheetStop = .standard

    /// Last user coordinate — drives the "you are here" disc.
    public private(set) var userCoordinate: UserCoordinate?
    /// Query/camera area; a saved or explicit area never impersonates device location.
    public private(set) var viewingCenter: UserCoordinate?
    private var explicitCenter: UserCoordinate?
    private var configuredFocus: ExploreMapFocus?
    private var hasConfiguredFocus = false
    private var fetchGeneration = 0

    /// Applied filter criteria. Surfaced so the view can seed the filter
    /// sheet + render the active-count badge.
    public private(set) var filters: ExploreFilterCriteria

    public private(set) var homeCheckMessage: String?
    public private(set) var isCheckingHomes = false
    public private(set) var isCheckingPosts = false
    public private(set) var postsFailureMessage: String?
    private let api: APIClient
    private let store: ScreenStore
    private let sessionScope: HomeClaimSessionScope
    private var contentCacheGeneration: Int
    private let location: any LocationProviding
    /// Non-nil for the sample/preview path; nil for the live path.
    private let scenario: ExploreScenario?
    private var allEntities: [ExploreEntity]
    private var fetchTask: Task<Void, Never>?
    /// Grid-bucket cluster radius (~0.005° ≈ 500 m at NYC latitude).
    private var clusterRadiusDegrees: Double = 0.005

    /// Production initializer — live discovery. Public-safe: it takes no
    /// `APIClient` parameter (the client type + `.shared` are module-internal),
    /// so the public `ExploreMapView.init` default argument stays valid.
    public convenience init() {
        self.init(api: .shared)
    }

    /// Designated live initializer. `api` + `location` are injectable for
    /// tests; internal because `APIClient` is module-internal.
    init(
        api: APIClient,
        location: any LocationProviding = DeviceLocationProvider.shared,
        identity: (() -> String?)? = nil
    ) {
        self.api = api
        store = ScreenStore.store(for: api)
        sessionScope = HomeClaimSessionScope(api: api, identity: identity)
        contentCacheGeneration = store.generation
        self.location = location
        scenario = nil
        allEntities = []
        filters = ExploreFilterCriteria()
        userCoordinate = location.cachedCoordinate()
    }

    /// Sample/preview path — local sample entities, no network.
    public init(scenario: ExploreScenario) {
        api = .shared
        store = .shared
        sessionScope = HomeClaimSessionScope(api: .shared)
        contentCacheGeneration = store.generation
        location = DeviceLocationProvider.shared
        self.scenario = scenario
        allEntities = ExploreMapSampleData.entities(for: scenario)
        filters = ExploreMapSampleData.filters(for: scenario)
        userCoordinate = ExploreMapSampleData.center
        viewingCenter = ExploreMapSampleData.center
    }

    // MARK: - Lifecycle

    public func load() async {
        guard let scenario else {
            await fetchAroundUser()
            return
        }
        switch scenario {
        case .loading:
            state = .loading
        case .error:
            state = .error(message: "Couldn't load the map.")
        case .populated, .empty:
            rebuild(selectedId: nil)
        }
    }

    public func refresh() async {
        await load()
    }

    public func configureFocus(_ focus: ExploreMapFocus?) {
        guard scenario == nil else { return }
        guard !hasConfiguredFocus || focus != configuredFocus else { return }
        hasConfiguredFocus = true
        configuredFocus = focus
        let next = focus.map { UserCoordinate(latitude: $0.latitude, longitude: $0.longitude, accuracyMeters: 0) }
        suspend()
        allEntities = []
        viewingCenter = nil
        explicitCenter = next
        rebuild(selectedId: nil)
    }

    /// A locate action explicitly requests the actual device area.
    public func locate() async {
        suspend()
        let generation = fetchGeneration
        let cache = store.generation
        let coordinate = await location.requestCurrent(timeoutSeconds: 4)
        guard isCurrentRead(generation, cache: cache) else { return }
        guard let coordinate else {
            state = .error(message: "Turn on location to find your current area.")
            return
        }
        userCoordinate = coordinate
        explicitCenter = coordinate
        allEntities = []
        await fetchAroundUser()
    }

    // MARK: - Type toggle

    public func selectKind(_ kind: ExploreKind?) {
        guard kind != activeKind else { return }
        activeKind = kind
        rebuild(selectedId: keptSelection())
    }

    // MARK: - Sort

    public func selectSort(_ sort: ExploreSort) {
        guard sort != activeSort else { return }
        activeSort = sort
        rebuild(selectedId: currentSelectedId())
    }

    // MARK: - Filters

    /// Apply structured filters from the filter sheet. Re-projects pins +
    /// rail immediately and drops the selection if it no longer survives.
    public func applyFilters(_ criteria: ExploreFilterCriteria) {
        filters = criteria
        rebuild(selectedId: keptSelection())
    }

    /// Empty-state "Clear filters" — resets every dimension (including the
    /// type toggle) so the full neighborhood reappears.
    public func clearFilters() {
        filters = ExploreFilterCriteria()
        activeKind = nil
        rebuild(selectedId: nil)
    }

    /// Empty-state "Widen area" — opens the distance radius to the widest
    /// stop so neighbors a little further out surface, leaving the other
    /// dimensions intact.
    public func widenArea() {
        filters.distanceUpper = ExploreFilterCriteria.distanceStops[ExploreFilterCriteria.distanceDefaultIndex]
        rebuild(selectedId: currentSelectedId())
    }

    // MARK: - Selection

    /// Pin tap or rail-card tap — both feed the same selection so the
    /// pulse halo and the rail highlight stay tied.
    public func selectEntity(_ id: String?) {
        guard case let .loaded(loaded) = state else { return }
        state = .loaded(ExploreMapLoaded(
            entities: loaded.entities,
            markers: loaded.markers,
            userCoordinate: loaded.userCoordinate,
            selectedId: id
        ))
    }

    public func setSheetStop(_ stop: ExploreSheetStop) {
        sheetStop = stop
    }

    /// Reduce the cluster radius (camera zoom-in) and rebuild markers.
    public func setClusterRadius(_ radiusDegrees: Double) {
        let clamped = max(0.0005, min(radiusDegrees, 0.05))
        guard abs(clamped - clusterRadiusDegrees) > 1e-6 else { return }
        clusterRadiusDegrees = clamped
        if case let .loaded(loaded) = state {
            rebuild(selectedId: loaded.selectedId)
        }
    }

    // MARK: - Live fetch

    /// Posts and Homes have independent reads: a slow or refused Home check
    /// must neither hide public posts nor make an unchecked Home layer look empty.
    private func fetchAroundUser() async {
        suspend()
        guard sessionScope.isCurrent else { return }
        let generation = fetchGeneration
        let cache = store.generation
        homeCheckMessage = "Checking Home access…"
        isCheckingHomes = true
        isCheckingPosts = true
        let center: UserCoordinate
        do {
            guard let resolved = try await resolveCenter() else {
                throw APIError.invalidResponse
            }
            try requireCurrentRead(generation, cache: cache)
            center = resolved
        } catch {
            guard isCurrentRead(generation, cache: cache) else { return }
            isCheckingHomes = false
            isCheckingPosts = false
            homeCheckMessage = "Couldn't check Home access. Try again."
            if allEntities.isEmpty {
                state = .error(message: "Choose an area or turn on location, then try again.")
            }
            return
        }
        viewingCenter = center
        let task = Task { @MainActor in
            async let posts: Void = fetchLayer(.posts, center: center, generation: generation, cache: cache)
            async let homes: Void = fetchLayer(.homes, center: center, generation: generation, cache: cache)
            _ = await (posts, homes)
        }
        fetchTask = task
        await task.value
    }

    private func fetchLayer(_ layer: PostsMapLayer, center: UserCoordinate, generation: Int, cache: Int) async {
        let kind: ExploreKind = layer == .homes ? .home : .post
        let route = PostsMapEndpoints.markers(
            south: center.latitude - 0.012,
            west: center.longitude - 0.016,
            north: center.latitude + 0.012,
            east: center.longitude + 0.016,
            layers: [layer],
            limit: 200
        )
        // Never reuse or retain a mixed/private protocol-cache response. The
        // view-model alone keeps public post projections for this visit.
        let endpoint = Endpoint(
            method: route.method,
            path: route.path,
            query: route.query,
            headers: ["Cache-Control": "no-store"],
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        ) { [weak self] in
            guard let self else { throw CancellationError() }
            try requireCurrentRead(generation, cache: cache)
        }
        do {
            try requireCurrentRead(generation, cache: cache)
            let result: PostsMapResponse = try await api.request(endpoint)
            try requireCurrentRead(generation, cache: cache)
            allEntities.removeAll { $0.kind == kind }
            allEntities += Self.projectMarkers(result.markers, anchor: center).filter { $0.kind == kind }
            if layer == .homes {
                homeCheckMessage = nil
                isCheckingHomes = false
            } else {
                postsFailureMessage = nil
                isCheckingPosts = false
            }
            rebuild(selectedId: keptSelection())
        } catch {
            guard isCurrentRead(generation, cache: cache), !(error is CancellationError) else { return }
            if layer == .homes {
                allEntities.removeAll { $0.kind == .home }
                homeCheckMessage = "Couldn't check Home access. Try again."
                isCheckingHomes = false
            } else {
                if ScreenStore.isRefusal(error) { allEntities.removeAll { $0.kind == .post } }
                postsFailureMessage = "Couldn't refresh posts. Try again."
                isCheckingPosts = false
            }
            rebuild(selectedId: keptSelection())
        }
    }

    private func isCurrentRead(_ generation: Int, cache: Int) -> Bool {
        generation == fetchGeneration && cache == store.generation && sessionScope.isCurrent && !Task.isCancelled
    }

    private func requireCurrentRead(_ generation: Int, cache: Int) throws {
        guard isCurrentRead(generation, cache: cache) else { throw CancellationError() }
    }

    /// Drop private markers, addresses, clusters and selections before leaving
    /// the screen or taking the app snapshot, and retire every outstanding read.
    public func suspend() {
        guard scenario == nil else { return }
        fetchGeneration += 1
        fetchTask?.cancel()
        fetchTask = nil
        allEntities.removeAll { $0.kind != .post }
        if !sessionScope.isCurrent || contentCacheGeneration != store.generation {
            allEntities = []
            userCoordinate = nil
            viewingCenter = nil
            explicitCenter = nil
            hasConfiguredFocus = false
        }
        contentCacheGeneration = store.generation
        isCheckingHomes = false
        isCheckingPosts = false
        homeCheckMessage = "Home access needs to be checked."
        rebuild(selectedId: keptSelection())
    }

    var hasUnresolvedRead: Bool {
        (activeKind != .post && homeCheckMessage != nil)
            || (activeKind != .home && (isCheckingPosts || postsFailureMessage != nil))
    }

    func isAffected(by note: Notification) -> Bool {
        if note.names(topic: ScreenTopic.homes, kind: .homes) || note.names(topic: ScreenTopic.posts) { return true }
        let topics = note.userInfo?["topics"] as? Set<String> ?? []
        return topics.contains { $0.hasPrefix("home:") || $0.hasPrefix("post:") }
    }

    private func resolveCenter() async throws -> UserCoordinate? {
        userCoordinate = location.cachedCoordinate()
        if let explicitCenter { return explicitCenter }
        // Retain the chosen viewport within this visit, including while offline.
        if let viewingCenter { return viewingCenter }
        let payload: SetViewingLocationResponse = try await api.request(ViewingLocationEndpoints.resolve())
        if let selected = payload.viewingLocation {
            return UserCoordinate(latitude: selected.latitude, longitude: selected.longitude, accuracyMeters: 0)
        }
        if userCoordinate == nil { userCoordinate = await location.requestCurrent(timeoutSeconds: 4) }
        return userCoordinate
    }

    // MARK: - Projection

    private func currentSelectedId() -> String? {
        if case let .loaded(loaded) = state { return loaded.selectedId }
        return nil
    }

    /// Keep the current selection only if it survives the new filter.
    private func keptSelection() -> String? {
        let prior = currentSelectedId()
        return filtered().contains { $0.id == prior } ? prior : nil
    }

    private func filtered() -> [ExploreEntity] {
        allEntities.filter { entity in
            // Launch cuts #4 / #3 / #6: task, listing and business pins are hidden.
            guard entity.kind.isAvailableAtLaunch else { return false }
            if let activeKind, entity.kind != activeKind { return false }
            return filters.matches(entity)
        }
    }

    private func sorted(_ source: [ExploreEntity]) -> [ExploreEntity] {
        switch activeSort {
        case .closest:
            source.sorted { $0.distanceMiles < $1.distanceMiles }
        case .newest:
            source
        }
    }

    private func rebuild(selectedId: String?) {
        let entities = sorted(filtered())
        state = .loaded(ExploreMapLoaded(
            entities: entities,
            markers: Self.cluster(entities: entities, radiusDegrees: clusterRadiusDegrees),
            userCoordinate: userCoordinate,
            selectedId: selectedId
        ))
    }

    /// Map live gigs + listings + multi-layer markers into the unified
    /// entity vocabulary. Gigs → `.task`, listings → `.item`, and
    /// `/api/posts/map` rows → `.post` / `.spot` / `.home` by
    /// `layer_type`. Rows without resolvable coordinates are dropped
    /// (privacy-redacted remote items can't be placed on the map).
    static func project(
        gigs: [GigDTO],
        listings: [ListingDTO],
        markers: [PostsMapMarkerDTO] = [],
        anchor: UserCoordinate
    ) -> [ExploreEntity] {
        var out: [ExploreEntity] = []
        out.reserveCapacity(gigs.count + listings.count)
        for gig in gigs {
            guard let coord = coordinate(of: gig) else { continue }
            let miles = distanceMiles(from: anchor, to: coord)
            let bids = gig.bidCount ?? 0
            out.append(ExploreEntity(
                id: gig.id,
                kind: .task,
                state: gig.status == "pending" || gig.status == "draft" ? .pending : .confirmed,
                latitude: coord.latitude,
                longitude: coord.longitude,
                title: gig.title,
                metaLead: priceLabel(gig.price) ?? "Open",
                distanceLabel: distanceLabel(miles),
                distanceMiles: miles,
                badge: bids > 0 ? ExploreBadge(text: "\(bids) bids", tone: .bids) : nil,
                city: gig.approxLocation?.label,
                sourceId: gig.id,
                verified: false,
                openNow: gig.status == "open"
            ))
        }
        for listing in listings {
            guard let coord = coordinate(of: listing) else { continue }
            let miles = distanceMiles(from: anchor, to: coord)
            out.append(ExploreEntity(
                id: listing.id,
                kind: .item,
                state: .confirmed,
                latitude: coord.latitude,
                longitude: coord.longitude,
                title: listing.title ?? "Listing",
                metaLead: priceLabel(listing.price) ?? "Free",
                distanceLabel: distanceLabel(miles),
                distanceMiles: miles,
                badge: nil,
                city: listing.locationName ?? listing.approxLocation?.label,
                sourceId: listing.id,
                verified: false,
                openNow: true
            ))
        }
        out.append(contentsOf: projectMarkers(markers, anchor: anchor))
        return out
    }

    /// Fan `/api/posts/map` markers onto the entity vocabulary. Task /
    /// offer layers are skipped here — the gigs in-bounds route already
    /// supplies richer task rows, and double-projecting would duplicate
    /// pins.
    static func projectMarkers(
        _ markers: [PostsMapMarkerDTO],
        anchor: UserCoordinate
    ) -> [ExploreEntity] {
        var out: [ExploreEntity] = []
        out.reserveCapacity(markers.count)
        for marker in markers {
            guard let lat = marker.latitude, let lon = marker.longitude else { continue }
            let miles = distanceMiles(from: anchor, to: (lat, lon))
            switch marker.layerType {
            case "post":
                let replies = marker.commentCount ?? 0
                out.append(ExploreEntity(
                    id: marker.id,
                    kind: .post,
                    state: .confirmed,
                    latitude: lat,
                    longitude: lon,
                    title: marker.title ?? marker.content ?? "Neighborhood post",
                    metaLead: postMetaLead(marker),
                    distanceLabel: distanceLabel(miles),
                    distanceMiles: miles,
                    badge: replies > 0
                        ? ExploreBadge(text: "\(replies) replies", tone: .replies)
                        : nil,
                    city: marker.locationName,
                    sourceId: marker.id,
                    verified: false,
                    openNow: true
                ))
            case "business":
                out.append(ExploreEntity(
                    id: marker.id,
                    kind: .spot,
                    state: .confirmed,
                    latitude: lat,
                    longitude: lon,
                    title: marker.businessName ?? "Local business",
                    metaLead: marker.category ?? "Open",
                    distanceLabel: distanceLabel(miles),
                    distanceMiles: miles,
                    badge: marker.isVerified == true
                        ? ExploreBadge(text: "Verified", tone: .rating)
                        : nil,
                    city: marker.address,
                    sourceId: marker.id,
                    verified: marker.isVerified ?? false,
                    openNow: true
                ))
            case "home":
                let locality = [marker.city, marker.state]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: ", ")
                out.append(ExploreEntity(
                    id: marker.id,
                    kind: .home,
                    state: .confirmed,
                    latitude: lat,
                    longitude: lon,
                    title: marker.address ?? "Home",
                    metaLead: marker.homeType?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Home",
                    distanceLabel: distanceLabel(miles),
                    distanceMiles: miles,
                    badge: nil,
                    city: locality.isEmpty ? nil : locality,
                    stateName: marker.state,
                    sourceId: marker.id,
                    verified: false,
                    openNow: true
                ))
            default:
                continue
            }
        }
        return out
    }

    /// Post rail-card lead — "Asked 2h ago" style, falling back to the
    /// post type when the timestamp is unusable.
    private static func postMetaLead(_ marker: PostsMapMarkerDTO) -> String {
        let kind = (marker.postType ?? "post").replacingOccurrences(of: "_", with: " ").capitalized
        guard let createdAt = marker.createdAt else { return kind }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: createdAt) ?? ISO8601DateFormatter().date(from: createdAt) else {
            return kind
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return "\(kind) · \(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    // MARK: - Coordinate / distance helpers

    private static func coordinate(of gig: GigDTO) -> (latitude: Double, longitude: Double)? {
        if let lat = gig.latitude, let lon = gig.longitude { return (lat, lon) }
        if let approx = gig.approxLocation, let lat = approx.latitude, let lon = approx.longitude {
            return (lat, lon)
        }
        return nil
    }

    private static func coordinate(of listing: ListingDTO) -> (latitude: Double, longitude: Double)? {
        if let lat = listing.latitude, let lon = listing.longitude { return (lat, lon) }
        if let approx = listing.approxLocation, let lat = approx.latitude, let lon = approx.longitude {
            return (lat, lon)
        }
        return nil
    }

    static func distanceMiles(from origin: UserCoordinate, to coord: (latitude: Double, longitude: Double)) -> Double {
        let earthRadiusMiles = 3958.8
        let dLat = (coord.latitude - origin.latitude) * .pi / 180
        let dLon = (coord.longitude - origin.longitude) * .pi / 180
        let lat1 = origin.latitude * .pi / 180
        let lat2 = coord.latitude * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + sin(dLon / 2) * sin(dLon / 2) * cos(lat1) * cos(lat2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadiusMiles * c
    }

    private static func distanceLabel(_ miles: Double) -> String {
        if miles < 0.1 { return "< 0.1 mi" }
        if miles < 10 { return String(format: "%.1f mi", miles) }
        return "\(Int(miles)) mi"
    }

    private static func priceLabel(_ price: Double?) -> String? {
        guard let price, price > 0 else { return nil }
        if price.truncatingRemainder(dividingBy: 1) == 0 { return "$\(Int(price))" }
        return String(format: "$%.2f", price)
    }

    // MARK: - Clustering

    /// Grid-bucket clusterer. Snaps each entity to a `radiusDegrees` grid;
    /// buckets of size 1 stay as `.entity` markers, buckets of size ≥2
    /// collapse into a `.cluster`. Order is stable (sorted by bucket key).
    static func cluster(entities: [ExploreEntity], radiusDegrees: Double) -> [ExploreMarker] {
        guard radiusDegrees > 0 else { return entities.map(ExploreMarker.entity) }
        var buckets: [String: [ExploreEntity]] = [:]
        for entity in entities {
            let key = bucketKey(latitude: entity.latitude, longitude: entity.longitude, radius: radiusDegrees)
            buckets[key, default: []].append(entity)
        }
        return buckets.keys.sorted().compactMap { key -> ExploreMarker? in
            guard let group = buckets[key] else { return nil }
            if group.count == 1 { return .entity(group[0]) }
            let lats = group.map(\.latitude)
            let lons = group.map(\.longitude)
            let centerLat = lats.reduce(0, +) / Double(group.count)
            let centerLon = lons.reduce(0, +) / Double(group.count)
            let representative = group
                .reduce(into: [:]) { (counts: inout [ExploreKind: Int], entity: ExploreEntity) in
                    counts[entity.kind, default: 0] += 1
                }
                .max { $0.value < $1.value }?.key ?? group[0].kind
            return .cluster(ExploreCluster(
                id: key,
                latitude: centerLat,
                longitude: centerLon,
                kind: representative,
                count: group.count,
                entityIds: group.map(\.id),
                minLatitude: lats.min() ?? centerLat,
                maxLatitude: lats.max() ?? centerLat,
                minLongitude: lons.min() ?? centerLon,
                maxLongitude: lons.max() ?? centerLon
            ))
        }
    }

    private static func bucketKey(latitude: Double, longitude: Double, radius: Double) -> String {
        let latBucket = Int((latitude / radius).rounded(.down))
        let lonBucket = Int((longitude / radius).rounded(.down))
        return "\(latBucket)_\(lonBucket)"
    }
}
