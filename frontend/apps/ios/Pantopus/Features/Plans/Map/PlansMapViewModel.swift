//
//  PlansMapViewModel.swift
//  Pantopus
//
//  Nearby on the map (boards F1 to F5). The map centers on the viewer's
//  current location, or on their home when they choose it (F5); the pins
//  follow the visible area, the list under the map and "Your plans" follow
//  the center. Everything reads through the screen store (`nearby` kind):
//  the copy shows at once and refreshes quietly when out of date.
//
//  Current location only centers the map and tells the server where "near"
//  is; it is never shown to anyone (decision D2).
//

import CoreLocation
import Foundation
import MapKit
import Observation

/// Board P3 "The sheet": peek (about a third), half and full (92%).
enum PlansSheetStop: CaseIterable, Hashable {
    case peek, half, full

    var fraction: CGFloat {
        switch self {
        case .peek: 0.36
        case .half: 0.56
        case .full: 0.92
        }
    }
}

/// What the map is centered on.
enum PlansCenterSource: String {
    case gps, home
}

@Observable
@MainActor
final class PlansMapViewModel {
    enum Phase: Equatable {
        /// Finding where the viewer is.
        case locating
        /// No location yet (F5).
        case needsLocation
        case ready
    }

    private(set) var phase: Phase = .locating
    private(set) var center: UserCoordinate?
    private(set) var centerSource: PlansCenterSource?
    /// "Camas", for the area pill and the list's title.
    private(set) var areaName: String?
    private(set) var window: PlansWindow = .week
    /// nil is "All".
    private(set) var kindFilter: PlanKind?
    private(set) var pins: [PlanPinDTO] = []
    private(set) var cards: [PlanCardDTO] = []
    private(set) var listLoaded = false
    /// The closest town with plans, when none are near (F4).
    private(set) var nearestElsewhere: PlansNearestElsewhere?
    /// Bumped to ask the view to zoom out to about 15 miles.
    private(set) var widenRequest = 0
    private(set) var listError: String?
    private(set) var mine: MyPlansResponse?
    private(set) var games: [PlanGameOptionDTO] = []
    private(set) var selectedId: String?
    private(set) var selectedCard: PlanCardDTO?
    private(set) var selectedFailed = false
    /// The tapped pin's card, measured: its sheet takes this height, up to half (board F3).
    var cardHeight: CGFloat = 0
    /// The viewer's home, for "Use my home instead".
    private(set) var homeCenter: UserCoordinate?
    /// "Use my location" was refused or found no fix.
    private(set) var locationUnavailable = false
    var sheetStop: PlansSheetStop = .peek
    /// Bumped to ask the view to move the camera to `center`.
    private(set) var recenterRequest = 0
    /// Where the camera last settled.
    @ObservationIgnored private(set) var lastRegion: MKCoordinateRegion?

    private var span: Double = 0.06
    /// The map's height on screen, so pins join clusters at the same distance on every phone.
    var mapPoints = PlansClustering.mapPoints
    private var viewport: PlansViewport?
    private var pinsTask: Task<Void, Never>?
    private let api: APIClient
    private let store: ScreenStore
    private let location: any LocationProviding
    private let defaults: UserDefaults

    init(
        api: APIClient = .shared,
        location: any LocationProviding = DeviceLocationProvider.shared,
        defaults: UserDefaults = .standard
    ) {
        self.api = api
        store = ScreenStore.store(for: api)
        self.location = location
        self.defaults = defaults
        mine = PlansStoreReads.peekMine(store: store)
    }

    // MARK: - Starting

    /// First appearance: find the center, then read everything. Coming back
    /// later only re-reads what went out of date.
    func start() async {
        if phase == .ready {
            await loadAll(force: false)
            return
        }
        homeCenter = await Self.homeCoordinate(store: store)
        if location.canLocateWithoutAsking, let fix = await location.requestCurrent(timeoutSeconds: 4) {
            await use(fix, source: .gps)
        } else if prefersHome, let homeCenter {
            await use(homeCenter, source: .home)
        } else {
            phase = .needsLocation
        }
    }

    /// F5 "Use my location": asks for permission when it hasn't been asked.
    func useMyLocation() async {
        locationUnavailable = false
        guard let fix = await location.requestCurrent(timeoutSeconds: 6) else {
            locationUnavailable = true
            return
        }
        prefersHome = false
        await use(fix, source: .gps)
    }

    /// F5 "Use my home instead".
    func useHome() async {
        if homeCenter == nil { homeCenter = await Self.homeCoordinate(store: store) }
        guard let homeCenter else { return }
        prefersHome = true
        await use(homeCenter, source: .home)
    }

    /// "Show my location": back to the device's area.
    func locate() async {
        if let fix = await location.requestCurrent(timeoutSeconds: 4) {
            prefersHome = false
            await use(fix, source: .gps)
        } else if let homeCenter {
            await use(homeCenter, source: .home)
        } else {
            locationUnavailable = true
        }
    }

    func refresh() async {
        await loadAll(force: true)
    }

    private func use(_ coordinate: UserCoordinate, source: PlansCenterSource) async {
        center = coordinate
        centerSource = source
        PlansStoreReads.lastCenter = coordinate
        if source == .gps { PlansStoreReads.lastFix = (coordinate, Date()) }
        phase = .ready
        recenterRequest += 1
        async let name: Void = loadAreaName(for: coordinate)
        async let everything: Void = loadAll(force: false)
        _ = await (name, everything)
    }

    // MARK: - Filters

    func setKind(_ kind: PlanKind?) {
        guard kind != kindFilter else { return }
        kindFilter = kind
        if let selectedId, let pin = pins.first(where: { $0.id == selectedId }), let kind, pin.kind != kind {
            clearSelection()
        }
    }

    func setWindow(_ newWindow: PlansWindow) async {
        guard newWindow != window else { return }
        window = newWindow
        clearSelection()
        await loadAll(force: false)
    }

    // MARK: - Reading

    private func loadAll(force: Bool) async {
        guard let center else { return }
        async let list: Void = loadList(center: center, force: force)
        async let yours: Void = loadMine(force: force)
        async let pinsRead: Void = loadPins(force: force)
        async let gameList: Void = loadGames()
        _ = await (list, yours, pinsRead, gameList)
    }

    private func loadList(center: UserCoordinate, force: Bool) async {
        do {
            let snapshot = try await PlansStoreReads.list(
                latitude: center.latitude,
                longitude: center.longitude,
                window: window,
                kinds: [],
                store: store,
                force: force
            )
            cards = snapshot.value.items
            nearestElsewhere = snapshot.value.nearestElsewhere
            listLoaded = true
            listError = nil
        } catch is CancellationError {
            return
        } catch {
            // A list on screen stays; a first read that fails says so.
            if !listLoaded { listError = "We couldn't load plans near you." }
        }
    }

    private func loadMine(force: Bool) async {
        if let snapshot = try? await PlansStoreReads.mine(store: store, force: force) {
            mine = snapshot.value
        }
    }

    private func loadGames() async {
        guard games.isEmpty else { return }
        if let reply = try? await store.load(PlansEndpoints.games(), as: PlanGamesResponse.self, kind: .publicPlace).value {
            games = reply.games
        }
    }

    private func loadAreaName(for coordinate: UserCoordinate) async {
        if let reply: GeoReverseResponse = try? await api.request(
            GeoEndpoints.reverse(latitude: coordinate.latitude, longitude: coordinate.longitude)
        ), let city = reply.normalized.city, !city.isEmpty {
            areaName = city
        }
    }

    /// The camera settled: read the pins for the visible box (debounced).
    func cameraChanged(_ region: MKCoordinateRegion) {
        lastRegion = region
        span = max(region.span.latitudeDelta, 0.002)
        viewport = PlansViewport(
            south: region.center.latitude - region.span.latitudeDelta / 2,
            west: region.center.longitude - region.span.longitudeDelta / 2,
            north: region.center.latitude + region.span.latitudeDelta / 2,
            east: region.center.longitude + region.span.longitudeDelta / 2
        )
        pinsTask?.cancel()
        pinsTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await self?.loadPins(force: false)
        }
    }

    private func loadPins(force: Bool) async {
        guard let viewport = viewport ?? centerViewport else { return }
        do {
            let snapshot = try await PlansStoreReads.pins(viewport, kinds: [], window: window, store: store, force: force)
            pins = snapshot.value.markers
            if let selectedId, !pins.contains(where: { $0.id == selectedId }), selectedCard == nil { clearSelection() }
        } catch {
            // Pins on screen stay; the list explains a failed read.
        }
    }

    /// About 5 miles around the center, before the camera reports its box.
    private var centerViewport: PlansViewport? {
        guard let center else { return nil }
        return PlansViewport(
            south: center.latitude - 0.08,
            west: center.longitude - 0.11,
            north: center.latitude + 0.08,
            east: center.longitude + 0.11
        )
    }

    /// F4 "Show": zoom out so the nearest town's plans come into view.
    func showElsewhere() {
        widenRequest += 1
    }

    // MARK: - What shows

    /// Pins after the type filter, clustered at this zoom (board P1).
    var markers: [PlansMarker] {
        PlansClustering.markers(
            pins.filter { kindFilter == nil || $0.kind == kindFilter },
            span: span,
            mapPoints: mapPoints,
            selectedId: selectedId
        )
    }

    /// The list after the type filter.
    var visibleCards: [PlanCardDTO] {
        cards.filter { kindFilter == nil || $0.kind == kindFilter }
    }

    /// Nothing planned this week (F4): no pins, no plans near you, none of yours.
    var isEmpty: Bool {
        listLoaded && cards.isEmpty && pins.isEmpty && (mine?.isEmpty ?? true)
    }

    /// The stop the sheet shows: "Nothing planned yet" (F4) and "See plans near
    /// you" (F5) hold a message and its buttons, so they never sit below half.
    var shownStop: PlansSheetStop {
        let isMessage = phase == .needsLocation || (phase == .ready && selectedId == nil && isEmpty)
        return sheetStop == .peek && isMessage ? .half : sheetStop
    }

    /// Your plans, hosting first.
    var yourPlans: [PlanCardDTO] {
        guard let mine else { return [] }
        return mine.hosting + mine.going + mine.asked + mine.waitlisted
    }

    // MARK: - Selection

    func select(_ pin: PlanPinDTO) {
        selectedId = pin.id
        selectedFailed = false
        selectedCard = cards.first { $0.id == pin.id } ?? yourPlans.first { $0.id == pin.id }
        sheetStop = .half
        guard selectedCard == nil else { return }
        Task { await loadSelected(pin.id) }
    }

    func clearSelection() {
        selectedId = nil
        selectedCard = nil
        selectedFailed = false
        if sheetStop == .half { sheetStop = .peek }
    }

    private func loadSelected(_ id: String) async {
        do {
            let detail = try await PlansStoreReads.detail(id: id, store: store)
            guard selectedId == id else { return }
            selectedCard = detail.card
        } catch {
            guard selectedId == id else { return }
            selectedFailed = true
        }
    }

    /// The pin for a card, for its look on the map.
    func pin(for id: String) -> PlanPinDTO? {
        pins.first { $0.id == id }
    }

    // MARK: - Helpers

    private var prefersHome: Bool {
        get { defaults.string(forKey: centerKey) == PlansCenterSource.home.rawValue }
        set { defaults.set(newValue ? PlansCenterSource.home.rawValue : nil, forKey: centerKey) }
    }

    private var centerKey: String {
        "pantopus.plans.center.\(ScreenStore.accountKey)"
    }

    /// Show the "Playdate" filter only to someone who can see playdates.
    var showsPlaydateFilter: Bool {
        mine?.viewer?.seesPlaydates ?? false
    }

    private static func homeCoordinate(store: ScreenStore) async -> UserCoordinate? {
        guard let homes = try? await HomesStoreReads.myHomes(store: store).value.homes else { return nil }
        return homes.lazy.compactMap(\.location).first.map {
            UserCoordinate(latitude: $0.latitude, longitude: $0.longitude, accuracyMeters: 50)
        }
    }
}
