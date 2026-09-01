//
//  PlacePickerViewModel.swift
//  Pantopus
//
//  Backs `PlacePickerSheet`. Loads nearby named places (POIs + the
//  enclosing locality) from `GET /api/geo/places/nearby` around the
//  active anchor — the media capture location when geotagged media is
//  attached (Instagram behavior), the device fix otherwise — and
//  drives the debounced place search against
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

    /// True when the ACTIVE anchor has no coordinate (current-location
    /// anchor with no device fix) — the sheet hides the NEARBY section
    /// and everything flows through search. Never true while the media
    /// anchor is active: media coords are always available.
    public private(set) var isSearchOnly = false

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
    private var lastNearby: (places: [GeoPlace], locality: GeoPlace?)?
    /// Debounced in-flight search. Internal so tests can await it.
    private(set) var searchTask: Task<Void, Never>?
    /// Monotonic load stamp — an anchor switch starts a NEW load, and a
    /// stale in-flight load must not clobber the newer anchor's state.
    private var loadGeneration = 0

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
    /// search-only mode, while a media anchor chip stays switchable.
    public func load() async {
        loadGeneration &+= 1
        let generation = loadGeneration
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
            lastNearby = ([], nil)
            if !hasActiveQuery {
                state = .loaded(nearby: [], locality: nil)
            }
            return
        }
        isSearchOnly = false
        do {
            let response: GeoNearbyPlacesResponse = try await api.request(
                GeoEndpoints.nearbyPlaces(
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude
                )
            )
            guard generation == loadGeneration else { return }
            lastNearby = (response.places, response.locality)
            if !hasActiveQuery {
                state = .loaded(nearby: response.places, locality: response.locality)
            }
        } catch {
            guard generation == loadGeneration else { return }
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
        } catch {
            guard !Task.isCancelled, query == trimmedQuery else { return }
            let message = (error as? APIError)?.errorDescription
                ?? "Couldn't search places. Try again."
            state = .error(message: message)
        }
    }
}
