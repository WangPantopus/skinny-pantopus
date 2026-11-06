//
//  PlacePickerViewModel.swift
//  Pantopus
//
//  Backs `PlacePickerSheet`. Loads nearby named places (OpenStreetMap
//  venues + the enclosing locality) from `GET /api/geo/places/nearby`
//  around the active anchor — the media capture location when geotagged
//  media is attached (Instagram behavior), the device fix otherwise —
//  asking again every few seconds while the server is still gathering a
//  new area's venues, and drives the debounced place search against
//  `GET /api/geo/places/search`. Neither anchor → search-only mode.
//

import Foundation
import Observation

/// Which coordinate anchors the nearby list + search proximity.
public enum PlacePickerAnchor: String, Sendable, Hashable {
    /// Where the attached media was captured ("Photo location" chip).
    case media
    /// The device's current fix ("Near me" chip).
    case current
}

@Observable
@MainActor
public final class PlacePickerViewModel {
    /// Render state for the picker's list area.
    public enum State: Sendable, Equatable {
        case loading
        case loaded(nearby: [GeoPlace], locality: GeoPlace?)
        case searchResults([GeoPlace])
        case empty
        case error(message: String)
    }

    public private(set) var state: State = .loading

    /// A nearby reply kept for restoring the list when a search clears.
    private struct NearbyPayload {
        let places: [GeoPlace]
        let locality: GeoPlace?
        let attribution: String?
    }

    /// True when the ACTIVE anchor has no coordinate (current-location
    /// anchor with no device fix) — the sheet hides the NEARBY section
    /// and everything flows through search. Never true while the media
    /// anchor is active: media coords are always available.
    public private(set) var isSearchOnly = false

    /// True while the server is still gathering a new area's venues
    /// (`loading` on the nearby reply): the sheet shows placeholder rows
    /// under what's listed, and `load()` asks again every few seconds.
    public private(set) var isFindingPlaces = false

    /// Data credit for the venue rows on screen ("© OpenStreetMap
    /// contributors"); nil when none are listed.
    public private(set) var attribution: String?

    /// Anchor the nearby list + search proximity revolve around.
    /// Defaults to `.media` when a media capture location was supplied
    /// (Instagram behavior), `.current` otherwise.
    public private(set) var activeAnchor: PlacePickerAnchor

    /// True when geotagged media supplied a capture location — the sheet
    /// renders the "Photo location" / "Near me" anchor chips.
    public var hasMediaAnchor: Bool {
        mediaLocation != nil
    }

    public var searchText: String = "" {
        didSet { scheduleSearch() }
    }

    private let api: APIClient
    private let locationProvider: any LocationProviding
    /// Capture location of the composer's first geotagged attachment.
    /// A local anchor ONLY — it never rides an outgoing request.
    private let mediaLocation: MediaCaptureLocation?
    private var deviceCoordinate: UserCoordinate?
    /// Last successful nearby payload — restored when the search field
    /// is cleared so the NEARBY section reappears without a refetch.
    private var lastNearby: NearbyPayload?
    /// Debounced in-flight search. Internal so tests can await it.
    private(set) var searchTask: Task<Void, Never>?
    /// Monotonic load stamp — an anchor switch starts a NEW load, and a
    /// stale in-flight load must not clobber the newer anchor's state.
    private var loadGeneration = 0
    /// How often, and how many times, a nearby list still loading is asked
    /// for again (the server keeps gathering meanwhile). Internal so tests
    /// can shorten it.
    var findingPollInterval: Duration = .seconds(3)
    var maxFindingPolls = 8
    /// The pending ask-again for a list the server is still gathering. A
    /// newer load cancels it; it holds the view-model weakly, so it stops
    /// once the sheet is gone. Internal so tests can await it.
    private(set) var findingTask: Task<Void, Never>?

    /// Live wiring. Split from the injecting init instead of default
    /// args — default-arg @MainActor VM initializers SIL-crash on
    /// Xcode 16.4 / Swift 6.1.2 (known repo gotcha).
    public init(mediaLocation: MediaCaptureLocation?) {
        api = .shared
        locationProvider = DeviceLocationProvider.shared
        self.mediaLocation = mediaLocation
        activeAnchor = mediaLocation == nil ? .current : .media
    }

    /// Test seam — inject the API client + location provider explicitly.
    init(
        api: APIClient,
        locationProvider: any LocationProviding,
        mediaLocation: MediaCaptureLocation?
    ) {
        self.api = api
        self.locationProvider = locationProvider
        self.mediaLocation = mediaLocation
        activeAnchor = mediaLocation == nil ? .current : .media
    }

    // MARK: - Nearby

    /// Fetch nearby places around the active anchor. Media anchor: the
    /// capture coords are used directly — no device fix is resolved (and
    /// no permission prompt fires). Current anchor: resolve a device fix
    /// (lazy when-in-use prompt lives inside the provider); no fix →
    /// search-only mode, while a media anchor chip stays switchable. A
    /// reply that's still `loading` is shown, and asked for again in the
    /// background until the venues arrive (or `maxFindingPolls` runs out).
    public func load() async {
        loadGeneration &+= 1
        let generation = loadGeneration
        findingTask?.cancel()
        findingTask = nil
        isFindingPlaces = false
        if !hasActiveQuery {
            state = .loading
        }
        let anchor: (latitude: Double, longitude: Double)?
        if activeAnchor == .media, let media = mediaLocation {
            anchor = (media.latitude, media.longitude)
        } else {
            deviceCoordinate = await locationProvider.requestCurrent(timeoutSeconds: 4)
            // An anchor switch mid-fix started a newer load — stand down.
            guard generation == loadGeneration else { return }
            anchor = deviceCoordinate.map { ($0.latitude, $0.longitude) }
        }
        // The GPS fix + fetch can take seconds. If the user started typing
        // meanwhile, cache the payload for later restore but never clobber
        // their live search results (or error) with the nearby state.
        guard let coordinate = anchor else {
            isSearchOnly = true
            lastNearby = NearbyPayload(places: [], locality: nil, attribution: nil)
            if !hasActiveQuery {
                state = .loaded(nearby: [], locality: nil)
                attribution = nil
            }
            return
        }
        isSearchOnly = false
        await fetchNearby(
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            generation: generation,
            asked: 0
        )
    }

    /// One nearby request. A reply still `loading` is shown, and asked for
    /// again after `findingPollInterval` in `findingTask`.
    private func fetchNearby(latitude: Double, longitude: Double, generation: Int, asked: Int) async {
        do {
            let response: GeoNearbyPlacesResponse = try await api.request(
                GeoEndpoints.nearbyPlaces(latitude: latitude, longitude: longitude)
            )
            guard generation == loadGeneration else { return }
            lastNearby = NearbyPayload(
                places: response.places,
                locality: response.locality,
                attribution: response.attribution
            )
            let stillFinding = response.loading == true && asked < maxFindingPolls
            isFindingPlaces = stillFinding
            if !hasActiveQuery {
                state = .loaded(nearby: response.places, locality: response.locality)
                attribution = response.attribution
            }
            guard stillFinding else { return }
            let interval = findingPollInterval
            findingTask = Task { [weak self] in
                try? await Task.sleep(for: interval)
                guard !Task.isCancelled, let self, generation == loadGeneration else { return }
                await fetchNearby(
                    latitude: latitude,
                    longitude: longitude,
                    generation: generation,
                    asked: asked + 1
                )
            }
        } catch {
            guard generation == loadGeneration else { return }
            isFindingPlaces = false
            let message = (error as? APIError)?.errorDescription
                ?? "Couldn't load nearby places. Try again."
            if !hasActiveQuery {
                state = .error(message: message)
            } else {
                // A failed reload behind a live search must not leave the
                // PREVIOUS anchor's payload restorable under the newly
                // active chip — drop the cache so clearing the query can't
                // resurrect a mislabeled nearby list.
                lastNearby = nil
            }
        }
    }

    /// Switch the nearby / proximity anchor and reload around it. The
    /// reload refreshes the nearby cache but only replaces the visible
    /// state when no >=2-char search is live — the same `hasActiveQuery`
    /// guard the initial load uses. A live search is then RE-RUN around
    /// the new anchor (spec: search proximity always uses the ACTIVE
    /// anchor's coords), mirroring Android's `selectAnchor`.
    public func selectAnchor(_ anchor: PlacePickerAnchor) async {
        guard anchor != activeAnchor else { return }
        if anchor == .media, mediaLocation == nil { return }
        activeAnchor = anchor
        await load()
        if hasActiveQuery {
            // Route through `searchTask` so a second chip tap (or fresh
            // typing) cancels this re-run the same way it cancels a
            // debounced search.
            searchTask?.cancel()
            let query = trimmedQuery
            searchTask = Task { [weak self] in
                guard !Task.isCancelled, let self else { return }
                await performSearch(query)
            }
            await searchTask?.value
        }
    }

    /// Retry CTA — re-runs whatever the current context is (an active
    /// search when the query is live, the nearby load otherwise).
    public func refresh() async {
        let query = trimmedQuery
        if query.count >= 2 {
            await performSearch(query)
        } else {
            await load()
        }
    }

    // MARK: - Search (debounced)

    private var trimmedQuery: String {
        searchText.trimmingCharacters(in: .whitespaces)
    }

    /// True while the query is long enough to own the list area — a live
    /// search (or its result/error) must not be overwritten by `load()`.
    private var hasActiveQuery: Bool {
        trimmedQuery.count >= 2
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let query = trimmedQuery
        guard query.count >= 2 else {
            // Cleared / too short — restore the nearby list.
            if let nearby = lastNearby {
                state = .loaded(nearby: nearby.places, locality: nearby.locality)
                attribution = nearby.attribution
            }
            return
        }
        searchTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled, let self else { return }
            await performSearch(query)
        }
    }

    /// Proximity bias for the place search — always the ACTIVE anchor's
    /// coords (media capture point when the photo chip is selected, the
    /// device fix otherwise).
    private var searchProximity: (latitude: Double?, longitude: Double?) {
        if activeAnchor == .media, let media = mediaLocation {
            return (media.latitude, media.longitude)
        }
        return (deviceCoordinate?.latitude, deviceCoordinate?.longitude)
    }

    private func performSearch(_ query: String) async {
        let proximity = searchProximity
        do {
            let response: GeoPlaceSearchResponse = try await api.request(
                GeoEndpoints.searchPlaces(
                    query: query,
                    latitude: proximity.latitude,
                    longitude: proximity.longitude
                )
            )
            guard !Task.isCancelled, query == trimmedQuery else { return }
            state = response.places.isEmpty ? .empty : .searchResults(response.places)
            attribution = response.places.isEmpty ? nil : response.attribution
        } catch {
            guard !Task.isCancelled, query == trimmedQuery else { return }
            let message = (error as? APIError)?.errorDescription
                ?? "Couldn't search places. Try again."
            state = .error(message: message)
        }
    }
}
