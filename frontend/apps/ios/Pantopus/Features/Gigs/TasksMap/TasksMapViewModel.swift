//
//  TasksMapViewModel.swift
//  Pantopus
//
//  A11.1 Tasks map view-model. `load()` hits `GET /api/gigs/in-bounds`
//  (`GigsEndpoints.inBounds`) for a ~1.3 km viewport around the anchor
//  and projects the gigs into pin↔card `TaskMapItem`s. The live
//  category filter + sheet-header sort run client-side on the fetched
//  set. Owns the pin↔card selection link, the "Search this area"
//  visibility state machine, the empty-state widen → jump-to-activity
//  ladder, and the camera requests (clusters / focus / pan) — all
//  MapKit-free via `MapListHybridRegion` so it stays unit-testable.
//
//  Previews / tests inject a `seed` (offline mode) or a stubbed
//  `APIClient`; production constructs with neither and fetches live.
//

import SwiftUI

// swiftlint:disable type_body_length

@Observable
@MainActor
public final class TasksMapViewModel {
    public private(set) var state: TasksMapState = .loading
    public private(set) var activeCategory: GigsCategory
    public private(set) var activeSort: GigsSort = .closest
    /// Mirrors the pin↔card link — the active task pulses on the map and
    /// its rail card draws the selected ring.
    public private(set) var selectedId: String?
    /// "You are here" anchor handed to the shell. Resolved from GPS in
    /// production; tests / previews may inject a fixed anchor.
    public private(set) var anchor: MapAnchor?
    /// "Search this area" pill visibility — set when the camera settles
    /// significantly away from the last-fetched region.
    public private(set) var showsSearchThisArea = false
    /// Last settled camera viewport (shell → `cameraSettled(on:)`).
    public private(set) var visibleRegion: MapListHybridRegion?
    /// Outgoing camera move — the shell applies it whenever the token
    /// changes (cluster zoom, rail pan, widen, jump, focus-on-pins).
    public private(set) var cameraTarget: MapListHybridCameraRequest?
    /// How many times the empty-state "Widen search" ran since the last
    /// populated fetch — drives the jump-to-activity ladder.
    public private(set) var widenAttempts = 0
    /// Backend recenter hint, only populated when a fetch came back with
    /// zero gigs in the viewport (gigs.js `nearest_activity_center`).
    public private(set) var nearestActivityCenter: MapAnchor?

    private let api: APIClient
    private let location: any LocationProviding
    /// Fixed anchor override for previews / tests that should not hit GPS.
    private let fixedAnchor: MapAnchor?
    /// Explicit offline fixture. When non-nil `load()` renders it directly
    /// instead of hitting the network (previews / sample / unit tests).
    private let seed: [TaskMapItem]?
    private let failWith: String?
    /// The task set currently driving the map — seeded or fetched.
    private var items: [TaskMapItem] = []
    /// Region the current `items` were fetched for — the "Search this
    /// area" comparison baseline.
    private var lastFetchedRegion: MapListHybridRegion?
    /// Set after every (re)fetch: the next camera settle adopts the
    /// camera's actual region as the baseline instead of comparing — the
    /// fetch box and the camera's fitted region differ by device aspect.
    private var awaitingBaselineSync = false
    private var cameraToken = 0

    /// ~1.3 km viewport — the design's default zoom (lon span widened
    /// for the cos-latitude correction at ~40°).
    static let defaultLatitudeSpan = 0.024
    static let defaultLongitudeSpan = 0.032
    static let fallbackAnchor = MapAnchor(latitude: 40.7484, longitude: -73.9857)

    /// Public entry point — carries no `APIClient` (the client and `.shared`
    /// are module-internal) so views / previews / sample data construct the
    /// map without referencing it.
    public convenience init(
        initialCategory: GigsCategory = .all,
        anchor: MapAnchor? = nil,
        seed: [TaskMapItem]? = nil,
        failWith: String? = nil
    ) {
        self.init(
            api: .shared,
            location: DeviceLocationProvider.shared,
            initialCategory: initialCategory,
            anchor: anchor,
            seed: seed,
            failWith: failWith
        )
    }

    /// Designated init — module-internal because `APIClient` is. Tests
    /// inject a stubbed client here.
    init(
        api: APIClient,
        location: any LocationProviding = DeviceLocationProvider.shared,
        initialCategory: GigsCategory = .all,
        anchor: MapAnchor? = nil,
        seed: [TaskMapItem]? = nil,
        failWith: String? = nil
    ) {
        self.api = api
        self.location = location
        activeCategory = initialCategory
        fixedAnchor = anchor
        self.anchor = fixedAnchor ?? location.cachedCoordinate()?.mapAnchor
        self.seed = seed
        self.failWith = failWith
    }

    public func load() async {
        state = .loading
        if let failWith {
            state = .error(message: failWith)
            return
        }
        if let seed {
            items = seed
            // Seed mode still participates in the search-this-area
            // state machine — baseline the default viewport.
            lastFetchedRegion = defaultRegion(around: anchor ?? Self.fallbackAnchor)
            recompute()
            return
        }
        await resolveLocation(refresh: false)
        await fetchInBounds(region: defaultRegion(around: anchor ?? Self.fallbackAnchor))
    }

    public func refresh() async {
        await load()
    }

    /// Re-resolve GPS and re-fetch the viewport around the updated anchor.
    public func locate() async {
        guard seed == nil, failWith == nil else { return }
        await resolveLocation(refresh: true)
        await fetchInBounds(region: defaultRegion(around: anchor ?? Self.fallbackAnchor))
    }

    public func selectCategory(_ category: GigsCategory) {
        guard category != activeCategory else { return }
        activeCategory = category
        recompute()
    }

    public func selectSort(_ sort: GigsSort) {
        guard sort != activeSort else { return }
        activeSort = sort
        recompute()
    }

    /// P2 follow-up — structured criteria from the layers sheet, applied
    /// client-side to the fetched pins. The filters badge rides
    /// `filterCriteria.activeCount`.
    public private(set) var filterCriteria = GigFilterCriteria()

    public func applyFilters(_ criteria: GigFilterCriteria) {
        guard criteria != filterCriteria else { return }
        filterCriteria = criteria
        recompute()
    }

    /// Pin↔card link — the shell fires this on pin tap; the view also
    /// snaps the sheet to `.standard` and scrolls the rail so the
    /// matching card surfaces. No camera move (the pin is on screen).
    public func select(_ id: String) {
        selectedId = id
    }

    // MARK: - Pin↔card sync

    /// Tasks currently on the map / in the sheet (populated state only).
    public var visibleItems: [TaskMapItem] {
        if case let .populated(items) = state { return items }
        return []
    }

    /// Rail-page index of the selection — drives the pagination dots and
    /// the rail's scroll-to-card sync.
    public var selectedIndex: Int? {
        visibleItems.firstIndex { $0.id == selectedId }
    }

    /// Rail page change → select that pin + pan the camera to it (span
    /// preserved). Counterpart of `select(_:)` for the card → pin
    /// direction of the sync.
    public func selectIndex(_ index: Int) {
        let items = visibleItems
        guard items.indices.contains(index) else { return }
        let item = items[index]
        guard item.id != selectedId else { return }
        selectedId = item.id
        requestCamera(currentRegion().recentered(latitude: item.latitude, longitude: item.longitude))
    }

    // MARK: - Clustering

    /// Individually rendered pins after the clustering pass at the
    /// current zoom.
    public var mapPins: [MapPin] {
        clusteredPins.singles
    }

    /// Cluster markers replacing dense pin groups at low zoom.
    public var mapClusters: [MapClusterPin] {
        clusteredPins.clusters
    }

    private var clusteredPins: TasksMapGeometry.ClusteredPins {
        TasksMapGeometry.buildClusteredPins(
            pins: visibleItems.map(\.pin),
            span: (visibleRegion ?? lastFetchedRegion)?.longitudeSpan ?? Self.defaultLongitudeSpan
        )
    }

    /// Cluster tap → zoom one step (halve the span) centered on it.
    public func tapCluster(id: String) {
        guard let cluster = mapClusters.first(where: { $0.id == id }) else { return }
        let zoomed = currentRegion()
            .recentered(latitude: cluster.latitude, longitude: cluster.longitude)
            .scaled(by: 0.5)
        visibleRegion = zoomed
        requestCamera(zoomed)
    }

    /// Fit the camera to every loaded pin with padding (the maximize
    /// map control).
    public func focusOnPins() {
        guard let region = TasksMapGeometry.fittingRegion(pins: visibleItems.map(\.pin)) else { return }
        requestCamera(region)
    }

    // MARK: - Search this area

    /// Camera settle hook — the shell forwards `.onMapCameraChange(.onEnd)`
    /// (MapKit's settle event stands in for the design's ~350 ms debounce).
    public func cameraSettled(on region: MapListHybridRegion) {
        visibleRegion = region
        if awaitingBaselineSync {
            lastFetchedRegion = region
            awaitingBaselineSync = false
            showsSearchThisArea = false
            return
        }
        guard let baseline = lastFetchedRegion else {
            lastFetchedRegion = region
            return
        }
        showsSearchThisArea = TasksMapGeometry.regionChangedSignificantly(from: baseline, to: region)
    }

    /// "Search this area" tap — refetch in-bounds for the settled
    /// viewport and hide the pill. Keeps the current content on screen
    /// while the refetch is in flight (no skeleton flash on the map).
    public func searchThisArea() async {
        guard let region = visibleRegion else { return }
        showsSearchThisArea = false
        guard seed == nil, failWith == nil else {
            lastFetchedRegion = region
            return
        }
        await fetchInBounds(region: region)
    }

    // MARK: - Empty-state ladder

    /// Which secondary CTA the empty sheet offers (see
    /// `TasksMapEmptyAction`).
    public var emptyAction: TasksMapEmptyAction {
        if widenAttempts > 0, let center = nearestActivityCenter {
            return .jumpToActivity(latitude: center.latitude, longitude: center.longitude)
        }
        return .widen
    }

    /// "Widen search" — zoom the camera out (span ×2.5) and refetch the
    /// widened viewport. Attempts accumulate until a fetch comes back
    /// populated.
    public func widenSearch() async {
        widenAttempts += 1
        let widened = currentRegion().scaled(by: 2.5)
        visibleRegion = widened
        requestCamera(widened)
        guard seed == nil, failWith == nil else {
            lastFetchedRegion = widened
            return
        }
        await fetchInBounds(region: widened)
    }

    /// "Jump to activity" — animate the camera to the backend's nearest
    /// activity center and refetch around it.
    public func jumpToActivity() async {
        guard let center = nearestActivityCenter else { return }
        let region = defaultRegion(around: center)
        visibleRegion = region
        requestCamera(region)
        guard seed == nil, failWith == nil else {
            lastFetchedRegion = region
            return
        }
        await fetchInBounds(region: region)
    }

    // MARK: - Location

    private func resolveLocation(refresh: Bool) async {
        if fixedAnchor != nil {
            anchor = fixedAnchor
            return
        }
        if !refresh, anchor != nil { return }
        if let coordinate = await location.requestCurrent(timeoutSeconds: 4) {
            anchor = coordinate.mapAnchor
        }
    }

    // MARK: - Camera

    private func defaultRegion(around center: MapAnchor) -> MapListHybridRegion {
        MapListHybridRegion(
            centerLatitude: center.latitude,
            centerLongitude: center.longitude,
            latitudeSpan: Self.defaultLatitudeSpan,
            longitudeSpan: Self.defaultLongitudeSpan
        )
    }

    private func currentRegion() -> MapListHybridRegion {
        visibleRegion ?? lastFetchedRegion ?? defaultRegion(around: anchor ?? Self.fallbackAnchor)
    }

    private func requestCamera(_ region: MapListHybridRegion) {
        cameraToken += 1
        cameraTarget = MapListHybridCameraRequest(token: cameraToken, region: region)
    }

    // MARK: - Fetch

    /// Hit `GET /api/gigs/in-bounds` for *all* categories in the given
    /// viewport. The category chips are an instant client-side filter
    /// (`recompute`), so an initial category scope can widen back to
    /// "All" without a re-fetch.
    private func fetchInBounds(region: MapListHybridRegion) async {
        do {
            let response: GigsInBoundsResponse = try await api.request(
                GigsEndpoints.inBounds(
                    minLat: region.minLatitude,
                    minLon: region.minLongitude,
                    maxLat: region.maxLatitude,
                    maxLon: region.maxLongitude
                )
            )
            let center = anchor
                ?? MapAnchor(latitude: region.centerLatitude, longitude: region.centerLongitude)
            items = response.gigs.compactMap { Self.project($0, anchor: center) }
            nearestActivityCenter = response.nearestActivityCenter.flatMap { hint in
                guard let lat = hint.latitude, let lon = hint.longitude else { return nil }
                return MapAnchor(latitude: lat, longitude: lon)
            }
            lastFetchedRegion = region
            awaitingBaselineSync = true
            showsSearchThisArea = false
            if !items.isEmpty {
                // Populated fetch resets the empty-state ladder.
                widenAttempts = 0
                nearestActivityCenter = nil
            }
            recompute()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load tasks."
            state = .error(message: message)
        }
    }

    // MARK: - Projection

    /// `GigDTO` → pin↔card `TaskMapItem`. Drops gigs without coordinates —
    /// they can't be placed on the map. Distance is computed client-side
    /// from the anchor because `in-bounds` doesn't project `distance_miles`.
    ///
    /// Pin state semantic (A11.1): the design's "confirmed" treatment
    /// (white ring) marks a *verified poster* — `creator.verified` or the
    /// `verified_resident` badge. Everyone else renders the dashed
    /// "pending" outline.
    static func project(_ gig: GigDTO, anchor: MapAnchor) -> TaskMapItem? {
        let lat = gig.latitude ?? gig.approxLocation?.latitude
        let lon = gig.longitude ?? gig.approxLocation?.longitude
        guard let lat, let lon else { return nil }
        let miles = distanceMiles(fromLat: anchor.latitude, lon: anchor.longitude, toLat: lat, lon: lon)
        return TaskMapItem(
            id: gig.id,
            category: GigsCategory.from(backendKey: gig.category),
            state: gig.creator?.resolvedVerified == true ? .confirmed : .pending,
            latitude: lat,
            longitude: lon,
            title: gig.title,
            body: gig.description ?? "",
            price: priceLabel(price: gig.price, payType: gig.payType),
            distanceLabel: String(format: "%.1f mi", miles),
            bidCount: gig.bidCount ?? 0,
            priceValue: gig.price,
            scheduleType: gig.scheduleType,
            acceptedBy: gig.acceptedBy,
            createdAt: gig.createdAt
        )
    }

    private static func priceLabel(price: Double?, payType: String?) -> String {
        guard let price else { return "—" }
        let formatted = price.truncatingRemainder(dividingBy: 1) == 0
            ? "$\(Int(price))"
            : String(format: "$%.2f", price)
        switch payType {
        case "hourly": return "\(formatted)/hr"
        case "per_session": return "\(formatted)/session"
        case "per_walk": return "\(formatted)/walk"
        case "per_visit": return "\(formatted)/visit"
        default: return formatted
        }
    }

    /// Equirectangular-corrected great-circle distance in miles.
    private static func distanceMiles(fromLat: Double, lon fromLon: Double, toLat: Double, lon toLon: Double) -> Double {
        let earthRadiusMiles = 3958.8
        let dLat = (toLat - fromLat) * .pi / 180
        let dLon = (toLon - fromLon) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(fromLat * .pi / 180) * cos(toLat * .pi / 180) * sin(dLon / 2) * sin(dLon / 2)
        return earthRadiusMiles * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    /// Recompute the visible window. Empty either because the area has no
    /// tasks or the active filter excludes them — both render the in-sheet
    /// empty hero.
    private func recompute() {
        let visible = filteredSorted()
        guard !visible.isEmpty else {
            selectedId = nil
            state = .empty
            return
        }
        // Keep the selection if it survives the filter, else pick the first
        // visible task so exactly one pin pulses (design default).
        if selectedId == nil || !visible.contains(where: { $0.id == selectedId }) {
            selectedId = visible.first?.id
        }
        state = .populated(visible)
    }

    private func filteredSorted() -> [TaskMapItem] {
        let now = Date()
        let filtered = items
            .filter { activeCategory == .all || $0.category == activeCategory }
            .filter {
                filterCriteria.matches(
                    category: $0.category,
                    price: $0.priceValue,
                    scheduleType: $0.scheduleType,
                    acceptedBy: $0.acceptedBy,
                    createdAt: $0.createdAt,
                    now: now
                )
            }
        switch activeSort {
        case .newest, .urgency:
            return filtered // backend returns newest-first (urgency has no local signal)
        case .closest:
            return filtered.sorted { Self.distanceMiles($0.distanceLabel) < Self.distanceMiles($1.distanceLabel) }
        case .highestPay:
            return filtered.sorted { Self.priceValue($0.price) > Self.priceValue($1.price) }
        case .fewestBids:
            return filtered.sorted { $0.bidCount < $1.bidCount }
        }
    }

    private static func distanceMiles(_ label: String) -> Double {
        Double(label.split(separator: " ").first ?? "") ?? .greatestFiniteMagnitude
    }

    private static func priceValue(_ price: String) -> Double {
        Double(price.filter { $0.isNumber || $0 == "." }) ?? 0
    }
}

private extension UserCoordinate {
    var mapAnchor: MapAnchor {
        MapAnchor(latitude: latitude, longitude: longitude)
    }
}
