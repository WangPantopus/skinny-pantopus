//
//  MomentsMapViewModel.swift
//  Pantopus
//
//  The Moments map (boards M1–M3, P5). It opens on the person, or on their
//  home while location is off, at about neighborhood zoom; the rings follow
//  the visible area. The strip lists the faces in view, new ones first, then
//  nearest; a tapped bubble zooms in and the strip shows only that spot
//  (M2). A Moment leaves the map the minute it ends, between reads too.
//
//  Current location only centers the map; it is never sent anywhere but the
//  map's own box, and never shown to anyone.
//

import CoreLocation
import Foundation
import MapKit
import Observation
import SwiftUI

/// The box the map asks for rings in.
struct MomentsViewport: Equatable {
    let south: Double
    let west: Double
    let north: Double
    let east: Double
    let zoom: Int

    var endpoint: Endpoint {
        MomentsEndpoints.map(south: south, west: west, north: north, east: east, zoom: zoom)
    }
}

extension MomentsViewport {
    /// About two miles around a point: the map's first read, and the box the tab's dot counts in.
    init(around center: UserCoordinate) {
        self.init(
            south: center.latitude - 0.015,
            west: center.longitude - 0.02,
            north: center.latitude + 0.015,
            east: center.longitude + 0.02,
            zoom: 14
        )
    }
}

/// Board M2: a crowded spot, zoomed in.
struct MomentsFocus: Equatable {
    /// "Esther Short Park".
    let title: String
    let ringIds: Set<String>
    /// Where the map was before, for the back pill.
    let previousCamera: MapCamera?
    /// The spot itself: on the iPhone Duo a fold keeps it in view (the middle of the left half open sideways, the
    /// middle of the map otherwise).
    var latitude = 0.0
    var longitude = 0.0
}

/// One face in the strip: a person, with every spot they have a Moment at.
struct MomentsStripPerson: Identifiable {
    /// Their spots, nearest first: the order they play in.
    let rings: [MomentRingDTO]
    /// What the face draws: one ring with all their Moments, so its segments and its "new" count every spot.
    let face: MomentRingDTO

    var id: String {
        face.author.id
    }

    init?(rings: [MomentRingDTO]) {
        guard var face = rings.first else { return nil }
        face.moments = rings.flatMap(\.moments)
        self.rings = rings
        self.face = face
    }
}

@Observable
@MainActor
final class MomentsMapViewModel {
    enum Phase: Equatable {
        /// Finding where the viewer is.
        case locating
        /// No location and no home: the map asks for location.
        case needsLocation
        case ready
    }

    enum CenterSource: Equatable {
        case gps, home
    }

    private(set) var phase: Phase = .locating
    private(set) var center: UserCoordinate?
    private(set) var centerSource: CenterSource?
    private(set) var homeCenter: UserCoordinate?
    /// "Downtown Vancouver", for the area pill.
    private(set) var areaName: String?
    /// What the spot you're at reads as ("Esther Short Park"), for the empty card.
    private(set) var herePlace: String?
    private(set) var rings: [MomentRingDTO] = []
    private(set) var loaded = false
    private(set) var loadFailed = false
    /// "Use my location" was refused or found no fix.
    private(set) var locationUnavailable = false
    private(set) var focus: MomentsFocus?
    /// Bumped to ask the view to move the camera to `center`.
    private(set) var recenterRequest = 0
    /// A place the viewer asked for (the place under a Moment's name, tapped): the view moves the camera there.
    private(set) var placeRequest: MomentsPlaceRequest?
    /// The clock the end times are read against; moved on each read and each minute.
    private(set) var now = Date()
    /// Where the camera last settled.
    @ObservationIgnored private(set) var lastRegion: MKCoordinateRegion?
    @ObservationIgnored private(set) var lastCamera: MapCamera?
    /// The height on screen of the part of the map `cameraChanged` is told about, so rings join bubbles at
    /// the same distance on every phone.
    var mapPoints = 600.0

    private var span = 0.025
    @ObservationIgnored private var viewport: MomentsViewport?
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var nameTask: Task<Void, Never>?
    @ObservationIgnored private var namedAt: CLLocation?
    /// Moments watched here since the last read, and people muted or blocked: the map shows them so at once.
    @ObservationIgnored private var watched: Set<String> = []
    /// Hidden at once, by when: a read begun after that already has the server's answer, so the id is dropped then
    /// (an unmute in Settings shows them again at the next read).
    @ObservationIgnored private var hiddenAuthors: [String: Date] = [:]
    private let api: APIClient
    private let store: ScreenStore
    private let location: any LocationProviding

    init(api: APIClient = .shared, location: any LocationProviding = DeviceLocationProvider.shared) {
        self.api = api
        store = ScreenStore.store(for: api)
        self.location = location
    }

    // MARK: - Starting

    /// First appearance: find the center, then read the rings. Coming back re-reads them.
    func start() async {
        if phase == .ready {
            await load()
            return
        }
        homeCenter = await Self.homeCoordinate(store: store)
        if location.canLocateWithoutAsking {
            if let fix = await location.requestCurrent(timeoutSeconds: passiveLocationTimeoutSeconds) {
                use(fix, source: .gps)
            } else if let homeCenter {
                use(homeCenter, source: .home)
            } else if let fix = await location.requestCurrent(timeoutSeconds: 4) {
                use(fix, source: .gps)
            } else {
                phase = .needsLocation
            }
        } else if let homeCenter {
            // Location off: the map opens on the home.
            use(homeCenter, source: .home)
        } else {
            phase = .needsLocation
        }
    }

    /// "Use my location" and "Show my location": asks for permission when it hasn't been asked.
    func locate() async {
        locationUnavailable = false
        if let fix = await location.requestCurrent(timeoutSeconds: 6) {
            use(fix, source: .gps)
        } else if let homeCenter {
            use(homeCenter, source: .home)
            locationUnavailable = true
        } else {
            locationUnavailable = true
        }
    }

    /// "Your home", from the area pill.
    func useHome() async {
        if homeCenter == nil { homeCenter = await Self.homeCoordinate(store: store) }
        guard let homeCenter else { return }
        use(homeCenter, source: .home)
    }

    private func use(_ coordinate: UserCoordinate, source: CenterSource) {
        center = coordinate
        centerSource = source
        phase = .ready
        focus = nil
        recenterRequest += 1
        herePlace = nil
        guard source == .gps else { return }
        // What this spot reads as, for the empty card ("Share what's happening at Esther Short Park.").
        Task { [weak self] in
            let endpoint = MomentsEndpoints.placePreview(latitude: coordinate.latitude, longitude: coordinate.longitude)
            let preview: MomentPlacePreviewDTO? = try? await MomentsAPI.send(endpoint)
            guard let self, center == coordinate else { return }
            herePlace = preview?.placeLabel
        }
    }

    /// The empty card's line: the place where you are while the map shows it, else "around here".
    var emptyLine: String {
        if centerSource == .gps, let center, let herePlace, !herePlace.isEmpty, let region = lastRegion,
           abs(region.center.latitude - center.latitude) < region.span.latitudeDelta / 2,
           abs(region.center.longitude - center.longitude) < region.span.longitudeDelta / 2 {
            return "Share what's happening at \(herePlace)."
        }
        return "Share what's happening around here."
    }

    // MARK: - Reading

    /// The camera settled: read the rings for the visible box (debounced) and name the area.
    func cameraChanged(_ region: MKCoordinateRegion, camera: MapCamera?) {
        lastRegion = region
        if let camera { lastCamera = camera }
        span = max(region.span.latitudeDelta, 0.0008)
        let zoom = Int(log2(360 / max(region.span.longitudeDelta, 0.0001)).rounded())
        viewport = MomentsViewport(
            south: region.center.latitude - region.span.latitudeDelta / 2,
            west: region.center.longitude - region.span.longitudeDelta / 2,
            north: region.center.latitude + region.span.latitudeDelta / 2,
            east: region.center.longitude + region.span.longitudeDelta / 2,
            zoom: min(max(zoom, 1), 20)
        )
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await self?.load()
        }
        nameArea(at: region.center)
        if let focus, !visibleRings.contains(where: { focus.ringIds.contains($0.id) }) { self.focus = nil }
    }

    /// Reads the rings in view now (pull, a Moment posted, back from watching).
    func load() async {
        guard let box = viewport ?? centerBox else { return }
        let started = Date()
        do {
            let reply: MomentsMapResponse = try await MomentsAPI.send(box.endpoint, api: api)
            guard !Task.isCancelled else { return }
            now = Date()
            hiddenAuthors = hiddenAuthors.filter { $0.value > started }
            // What the server says is seen now wins; what was watched since stays watched.
            // Connections' Moments with no location ride along (flagged `noLocation`): the strip shows them, the map doesn't.
            let all = reply.rings + reply.unplaced
            watched = watched.filter { id in all.contains { ring in ring.moments.contains { $0.id == id && !$0.seen } } }
            rings = all
            loaded = true
            loadFailed = false
        } catch is CancellationError {
            return
        } catch {
            if !loaded { loadFailed = true }
        }
    }

    /// The minute moved on: Moments whose time is up leave the map.
    func tick() {
        now = Date()
    }

    /// About two miles around the center, before the camera reports its box.
    private var centerBox: MomentsViewport? {
        center.map { MomentsViewport(around: $0) }
    }

    // MARK: - What shows

    /// Every ring read, with what was watched or hidden since, and only Moments still running.
    var currentRings: [MomentRingDTO] {
        rings.compactMap { ring in
            guard hiddenAuthors[ring.author.id] == nil else { return nil }
            var ring = ring
            ring.moments = ring.moments.compactMap { moment in
                if let end = moment.expiresAtDate, end <= now { return nil }
                var moment = moment
                if watched.contains(moment.id) { moment.seen = true }
                return moment
            }
            return ring.moments.isEmpty ? nil : ring
        }
    }

    /// The rings inside the visible map, and the Moments with no location (they show wherever the map is).
    var visibleRings: [MomentRingDTO] {
        guard let region = lastRegion else { return currentRings }
        let latitudes = (region.center.latitude - region.span.latitudeDelta / 2)...(region.center.latitude + region.span.latitudeDelta / 2)
        let longitudes = (region.center.longitude - region.span.longitudeDelta / 2)...(region.center.longitude + region.span
            .longitudeDelta / 2)
        return currentRings.filter { $0.noLocation || (latitudes.contains($0.latitude) && longitudes.contains($0.longitude)) }
    }

    /// The map's rings and bubbles at this zoom (never a Moment with no location).
    var markers: [MomentsMarker] {
        MomentsClustering.markers(currentRings.filter { !$0.noLocation }, span: span, mapPoints: mapPoints)
    }

    /// The strip: the spot zoomed into (M2), or every ring in view; you first, then new ones, then nearest.
    var stripRings: [MomentRingDTO] {
        let shown = focus.map { focus in currentRings.filter { focus.ringIds.contains($0.id) } } ?? visibleRings
        let origin = distanceOrigin
        return shown.sorted { first, second in
            if first.mine != second.mine { return first.mine }
            // Connections' Moments with no location first: the strip is the only place they show.
            if first.noLocation != second.noLocation { return first.noLocation }
            if first.isNew != second.isNew { return first.isNew }
            return origin.distance(from: first.location) < origin.distance(from: second.location)
        }
    }

    /// The strip's faces: one per person, in the strip's order. Someone with Moments at several spots is one
    /// face, and their spots play one after another, nearest first.
    var stripPeople: [MomentsStripPerson] {
        let origin = distanceOrigin
        var order: [String] = []
        var spots: [String: [MomentRingDTO]] = [:]
        for ring in stripRings {
            if spots[ring.author.id] == nil { order.append(ring.author.id) }
            spots[ring.author.id, default: []].append(ring)
        }
        return order.compactMap { author in
            // Their Moments with no location first (the strip is the only place they show), then the nearest spot.
            let rings = (spots[author] ?? []).sorted { first, second in
                if first.noLocation != second.noLocation { return first.noLocation }
                return origin.distance(from: first.location) < origin.distance(from: second.location)
            }
            return MomentsStripPerson(rings: rings)
        }
    }

    /// What plays after a tapped face: that person's spots, then the others as after a tapped ring.
    func watchQueue(from person: MomentsStripPerson) -> [MomentRingDTO] {
        guard let first = person.rings.first else { return [] }
        let theirs = Set(person.rings.map(\.id))
        return person.rings + watchQueue(from: first).filter { !theirs.contains($0.id) }
    }

    /// What plays after a tapped ring: that ring, then the others shown, new
    /// before watched, nearest to the tapped one first.
    func watchQueue(from tapped: MomentRingDTO) -> [MomentRingDTO] {
        let origin = tapped.location
        let others = stripRings.filter { $0.id != tapped.id }.sorted { first, second in
            if first.isNew != second.isNew { return first.isNew }
            return origin.distance(from: first.location) < origin.distance(from: second.location)
        }
        return [tapped] + others
    }

    /// "8 new near you" counts people with something new, never yourself.
    nonisolated static func newPeople(in rings: [MomentRingDTO]) -> Int {
        Set(rings.filter { $0.isNew && !$0.mine }.map(\.author.id)).count
    }

    nonisolated static func people(in rings: [MomentRingDTO]) -> Int {
        Set(rings.map(\.author.id)).count
    }

    /// "Nearest first" from you when the map shows where you are, else from the map's middle.
    private var distanceOrigin: CLLocation {
        if let center, centerSource == .gps { return CLLocation(latitude: center.latitude, longitude: center.longitude) }
        if let region = lastRegion { return CLLocation(latitude: region.center.latitude, longitude: region.center.longitude) }
        if let center { return CLLocation(latitude: center.latitude, longitude: center.longitude) }
        return CLLocation(latitude: 0, longitude: 0)
    }

    /// Nothing in view: board M3.
    var isEmpty: Bool {
        loaded && visibleRings.isEmpty
    }

    // MARK: - Crowded spots

    /// Board M2: the strip shows only this spot, and the pill takes you back.
    /// `camera`: where back goes, when it isn't where the map is now (the open Duo's card had moved it).
    func focus(on cluster: MomentsCluster, from camera: MapCamera? = nil) {
        let title = cluster.placeName ?? areaName ?? "This spot"
        focus = MomentsFocus(
            title: title,
            ringIds: Set(cluster.rings.map(\.id)),
            previousCamera: camera ?? lastCamera,
            latitude: cluster.coordinate.latitude,
            longitude: cluster.coordinate.longitude
        )
    }

    func showPlace(latitude: Double, longitude: Double) {
        focus = nil
        placeRequest = MomentsPlaceRequest(latitude: latitude, longitude: longitude)
    }

    /// Back to the area: the camera the spot was opened from.
    func clearFocus() -> MapCamera? {
        let previous = focus?.previousCamera
        focus = nil
        return previous
    }

    // MARK: - After watching

    /// Watched Moments turn grey at once; the server keeps them watched.
    func markWatched(_ ids: Set<String>) {
        guard !ids.isEmpty else { return }
        watched.formUnion(ids)
        now = Date()
    }

    /// A person muted or blocked: their rings go at once.
    func hide(authorId: String) {
        hiddenAuthors[authorId] = Date()
        now = Date()
    }

    func unhide(authorId: String) {
        hiddenAuthors.removeValue(forKey: authorId)
        now = Date()
    }

    // MARK: - The area's name

    private func nameArea(at coordinate: CLLocationCoordinate2D) {
        let point = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        if let namedAt, namedAt.distance(from: point) < 250, areaName != nil { return }
        nameTask?.cancel()
        nameTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            let name = await Self.areaName(at: point)
            guard !Task.isCancelled, let self else { return }
            namedAt = point
            if let name { areaName = name }
        }
    }

    /// "Downtown Vancouver": the neighborhood and the town, or the town alone.
    private static func areaName(at point: CLLocation) async -> String? {
        guard let placemark = try? await CLGeocoder().reverseGeocodeLocation(point).first else { return nil }
        let town = placemark.locality ?? placemark.subAdministrativeArea
        // A long neighborhood name from the geocoder reads badly in the pill: the town alone then.
        guard let neighborhood = placemark.subLocality, neighborhood.count <= 20 else { return town }
        if let town, !neighborhood.contains(town) { return "\(neighborhood) \(town)" }
        return neighborhood
    }

    static func homeCoordinate(store: ScreenStore) async -> UserCoordinate? {
        guard let homes = try? await HomesStoreReads.myHomes(store: store).value.homes else { return nil }
        return homes.lazy.compactMap(\.location).first.map {
            UserCoordinate(latitude: $0.latitude, longitude: $0.longitude, accuracyMeters: 50)
        }
    }
}

extension MomentRingDTO {
    var location: CLLocation {
        CLLocation(latitude: latitude, longitude: longitude)
    }
}
