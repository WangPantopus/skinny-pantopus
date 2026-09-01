//
//  ExploreMapViewModel.swift
//  Pantopus
//
//  A11.2 Explore / P1-F — view-model for the cross-type discovery map.
//
//  The production path fetches live discovery results for the viewport
//  around the user from three routes and fans them into a homogeneous
//  `[ExploreEntity]`:
//    • `GET /api/gigs/in-bounds`     → `.task`  (carries price + bid count)
//    • `GET /api/listings/in-bounds` → `.item`
//    • `GET /api/posts/map`          → `.post` / `.spot` / `.home`
//      (`layers=posts,businesses,homes` — `backend/routes/posts.js:1646`)
//  Tasks stay on the gigs route rather than the map route's `tasks` layer
//  because only the former carries price + bid count for the rail card.
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

    /// Applied filter criteria. Surfaced so the view can seed the filter
    /// sheet + render the active-count badge.
    public private(set) var filters: ExploreFilterCriteria

    private let api: APIClient
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
        location: any LocationProviding = DeviceLocationProvider.shared
    ) {
        self.api = api
        self.location = location
        scenario = nil
        allEntities = []
        filters = ExploreFilterCriteria()
        userCoordinate = location.cachedCoordinate()
    }

    /// Sample/preview path — local sample entities, no network.
    public init(scenario: ExploreScenario) {
        api = .shared
        location = DeviceLocationProvider.shared
        self.scenario = scenario
        allEntities = ExploreMapSampleData.entities(for: scenario)
        filters = ExploreMapSampleData.filters(for: scenario)
        userCoordinate = ExploreMapSampleData.center
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

    /// Re-resolve GPS and re-fetch the viewport around the updated anchor.
    public func locate() async {
        userCoordinate = await location.requestCurrent(timeoutSeconds: 4)
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

    /// Build a ~1.3 km square viewport around the user (or a fallback
    /// downtown anchor) and hit both in-bounds endpoints. A total failure
    /// surfaces as `.error`; a partial failure renders what loaded.
    private func fetchAroundUser() async {
        fetchTask?.cancel()
        if userCoordinate == nil {
            userCoordinate = await location.requestCurrent(timeoutSeconds: 4)
        }
        let center = userCoordinate
            ?? UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
        let halfDegLat = 0.012
        let halfDegLon = 0.016
        let minLat = center.latitude - halfDegLat
        let maxLat = center.latitude + halfDegLat
        let minLon = center.longitude - halfDegLon
        let maxLon = center.longitude + halfDegLon

        if case .loaded = state {} else { state = .loading }

        let task = Task { @MainActor in
            async let gigsResult: GigsInBoundsResponse? = try? await api.request(
                GigsEndpoints.inBounds(minLat: minLat, minLon: minLon, maxLat: maxLat, maxLon: maxLon)
            )
            async let listingsResult: ListingsInBoundsResponse? = try? await api.request(
                ListingsEndpoints.inBounds(south: minLat, west: minLon, north: maxLat, east: maxLon)
            )
            async let markersResult: PostsMapResponse? = try? await api.request(
                PostsMapEndpoints.markers(
                    south: minLat,
                    west: minLon,
                    north: maxLat,
                    east: maxLon,
                    layers: [.posts, .businesses, .homes],
                    limit: 200
                )
            )
            let gigs = await gigsResult
            let listings = await listingsResult
            let markers = await markersResult
            if gigs == nil, listings == nil, markers == nil {
                state = .error(message: "Couldn't load the map.")
                return
            }
            allEntities = Self.project(
                gigs: gigs?.gigs ?? [],
                listings: listings?.listings ?? [],
                markers: markers?.markers ?? [],
                anchor: center
            )
            rebuild(selectedId: nil)
        }
        fetchTask = task
        _ = await task.value
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
