//
//  UniversalSearchViewModel.swift
//  Pantopus
//
//  S2 — Universal search across five backend surfaces. Mirrors RN
//  `src/app/discover.tsx:93-294`:
//
//  • query is debounced 300ms and the in-flight fetch is cancelled on
//    every keystroke,
//  • a query shorter than 2 characters returns to the idle prompt and
//    issues no request (the backend 400s below 2 characters anyway),
//  • the "All" tab fans out to all five sources concurrently with
//    `limit=5` and each source fails independently (RN uses
//    `Promise.allSettled`); a single-kind tab hits one source with
//    `limit=20`.
//
//  The Beacons source (`GET /api/identity/search`) sits behind the
//  Identity Firewall feature gate in `backend/app.js:357`. A 404 there
//  means "not mounted on this deployment", which must not blank the
//  screen — it is reported as `unavailable`, not as a failure.
//

import Foundation
import Observation

/// Render state for the universal-search surface.
public enum UniversalSearchState: Sendable, Equatable {
    /// No query yet (or under the 2-character threshold) — RN's
    /// "Search Pantopus" prompt.
    case idle
    /// A fetch is in flight.
    case loading
    /// At least one section came back with rows.
    case loaded([UniversalSearchSection])
    /// Every source answered, none matched.
    case empty
    /// Every source failed (or the only source on a single-kind tab did).
    case error(message: String)
}

/// Universal-search view-model.
@Observable
@MainActor
public final class UniversalSearchViewModel {
    /// Minimum characters before a request is issued. The backend
    /// handlers reject anything shorter with a 400.
    public static let minimumQueryLength = 2

    /// Debounce window before the query is committed, in nanoseconds.
    /// Matches RN `src/app/discover.tsx:270`.
    private static let debounceNanoseconds: UInt64 = 300_000_000

    /// Per-source cap on the "All" tab, matching RN's `limit: 5`.
    private static let fanOutLimit = 5

    /// Per-source cap on a single-kind tab, matching RN's `limit: 20`.
    private static let singleTabLimit = 20

    /// Current render state.
    public private(set) var state: UniversalSearchState = .idle

    /// Live search text — bound to the field.
    public var query: String = ""

    /// Active tab chip.
    public private(set) var activeTab: UniversalSearchTab = .all

    /// Sources that failed on the last "All" fan-out while others
    /// succeeded. Rendered as inline notices above the results so a
    /// partial outage is visible without hiding what did load.
    public private(set) var failedSources: [UniversalSearchKind] = []

    /// True when the last attempt to reach the Beacons source came back
    /// 404 — the Identity Firewall gate is off on this deployment.
    public private(set) var beaconsUnavailable: Bool = false

    private let api: APIClient
    private var searchTask: Task<Void, Never>?

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Derived view state

    /// Trimmed query — the value actually sent to the backend.
    public var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// "Type N more characters to search." — mirrors RN's
    /// `formatThresholdHint` (`src/utils/inputThreshold.ts`). `nil` once
    /// the threshold is met, and while the field is untouched.
    public var thresholdHint: String? {
        let count = trimmedQuery.count
        guard count > 0, count < Self.minimumQueryLength else { return nil }
        let remaining = Self.minimumQueryLength - count
        let unit = remaining == 1 ? "character" : "characters"
        return "Type \(remaining) more \(unit) to search."
    }

    /// Only the "All" tab renders section headers.
    public var showsSectionHeaders: Bool {
        activeTab == .all
    }

    // MARK: - Intent

    /// Debounced search kicked on every keystroke. Cancels the in-flight
    /// request first so a stale response can never overwrite a newer one.
    public func onQueryChanged() {
        searchTask?.cancel()
        guard trimmedQuery.count >= Self.minimumQueryLength else {
            resetToIdle()
            return
        }
        state = .loading
        let snapshot = trimmedQuery
        let tab = activeTab
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.debounceNanoseconds)
            guard !Task.isCancelled else { return }
            await self?.performSearch(query: snapshot, tab: tab)
        }
    }

    /// Tab chip tap. Re-issues immediately (no debounce) when the query
    /// already clears the threshold, matching RN's `handleTabChange`.
    public func selectTab(_ tab: UniversalSearchTab) {
        guard tab != activeTab else { return }
        searchTask?.cancel()
        activeTab = tab
        guard trimmedQuery.count >= Self.minimumQueryLength else {
            resetToIdle()
            return
        }
        state = .loading
        let snapshot = trimmedQuery
        searchTask = Task { [weak self] in
            await self?.performSearch(query: snapshot, tab: tab)
        }
    }

    /// Clear button — empties the field and returns to the idle prompt.
    public func clearQuery() {
        searchTask?.cancel()
        query = ""
        resetToIdle()
    }

    /// Retry wired to the error state's CTA.
    public func refresh() async {
        searchTask?.cancel()
        guard trimmedQuery.count >= Self.minimumQueryLength else {
            resetToIdle()
            return
        }
        state = .loading
        await performSearch(query: trimmedQuery, tab: activeTab)
    }

    private func resetToIdle() {
        state = .idle
        failedSources = []
        beaconsUnavailable = false
    }

    // MARK: - Fetch

    /// Outcome of one source. `unavailable` is reserved for a 404 on a
    /// feature-gated route — the surface simply doesn't exist here.
    private enum SourceOutcome {
        case results([UniversalSearchResult])
        case failed(message: String)
        case unavailable
    }

    private func performSearch(query text: String, tab: UniversalSearchTab) async {
        if let kind = tab.kind {
            await performSingleKindSearch(query: text, kind: kind)
        } else {
            await performFanOutSearch(query: text)
        }
    }

    private func performSingleKindSearch(query text: String, kind: UniversalSearchKind) async {
        let outcome = await fetch(kind: kind, query: text, limit: Self.singleTabLimit)
        guard !Task.isCancelled else { return }
        failedSources = []
        beaconsUnavailable = false
        switch outcome {
        case let .results(rows):
            state = rows.isEmpty ? .empty : .loaded([UniversalSearchSection(kind: kind, results: rows)])
        case .unavailable:
            beaconsUnavailable = kind == .beacon
            state = .empty
        case let .failed(message):
            state = .error(message: message)
        }
    }

    private func performFanOutSearch(query text: String) async {
        let limit = Self.fanOutLimit
        async let tasksOutcome = fetch(kind: .task, query: text, limit: limit)
        async let peopleOutcome = fetch(kind: .person, query: text, limit: limit)
        async let beaconsOutcome = fetch(kind: .beacon, query: text, limit: limit)
        async let businessesOutcome = fetch(kind: .business, query: text, limit: limit)
        async let homesOutcome = fetch(kind: .home, query: text, limit: limit)

        let outcomes: [(UniversalSearchKind, SourceOutcome)] = await [
            (.task, tasksOutcome),
            (.person, peopleOutcome),
            (.beacon, beaconsOutcome),
            (.business, businessesOutcome),
            (.home, homesOutcome)
        ]
        guard !Task.isCancelled else { return }

        var sections: [UniversalSearchSection] = []
        var failed: [UniversalSearchKind] = []
        var unavailable: [UniversalSearchKind] = []
        var lastFailureMessage: String?

        for (kind, outcome) in outcomes {
            switch outcome {
            case let .results(rows):
                if !rows.isEmpty {
                    sections.append(UniversalSearchSection(kind: kind, results: rows))
                }
            case let .failed(message):
                failed.append(kind)
                lastFailureMessage = message
            case .unavailable:
                unavailable.append(kind)
            }
        }

        beaconsUnavailable = unavailable.contains(.beacon)

        // Every reachable source failed → the screen is genuinely broken.
        if sections.isEmpty, failed.count == outcomes.count - unavailable.count, !failed.isEmpty {
            failedSources = []
            state = .error(message: lastFailureMessage ?? "Couldn't search right now.")
            return
        }

        failedSources = failed
        state = sections.isEmpty ? .empty : .loaded(sections)
    }

    private func fetch(
        kind: UniversalSearchKind,
        query text: String,
        limit: Int
    ) async -> SourceOutcome {
        do {
            let rows: [UniversalSearchResult] = switch kind {
            case .task: try await fetchTasks(query: text, limit: limit)
            case .person: try await fetchPeople(query: text, limit: limit)
            case .beacon: try await fetchBeacons(query: text, limit: limit)
            case .business: try await fetchBusinesses(query: text, limit: limit)
            case .home: try await fetchHomes(query: text, limit: limit)
            }
            return .results(rows)
        } catch let error as APIError {
            // A feature-gated route that isn't mounted answers 404. That
            // is "unavailable", not "broken" — never surface it as an
            // error banner over the sources that did answer.
            if case .notFound = error { return .unavailable }
            return .failed(message: error.errorDescription ?? "Couldn't search right now.")
        } catch {
            return .failed(message: "Couldn't search right now.")
        }
    }

    // MARK: - Per-source projections

    private func fetchTasks(query text: String, limit: Int) async throws -> [UniversalSearchResult] {
        let response: UniversalSearchGigsResponse = try await api.request(
            UniversalSearchEndpoints.gigs(query: text, limit: limit)
        )
        return response.gigs.map { gig in
            UniversalSearchResult(
                id: gig.id,
                kind: .task,
                title: gig.title?.nonEmpty ?? "Untitled Task",
                subtitle: gig.category?.nonEmpty,
                meta: Self.priceLabel(gig.price),
                imageURL: gig.posterProfilePictureURL.flatMap(URL.init(string:)),
                destination: .task(gigId: gig.id)
            )
        }
    }

    private func fetchPeople(query text: String, limit: Int) async throws -> [UniversalSearchResult] {
        let response: UniversalSearchPeopleResponse = try await api.request(
            UniversalSearchEndpoints.people(query: text, limit: limit)
        )
        return response.users.map { user in
            let name = user.name?.nonEmpty ?? user.username?.nonEmpty ?? "Neighbor"
            return UniversalSearchResult(
                id: user.id,
                kind: .person,
                title: name,
                subtitle: user.username?.nonEmpty.map { "@\($0)" },
                meta: Self.locality(city: user.city, state: user.state),
                imageURL: user.profilePicture.flatMap(URL.init(string:)),
                destination: .person(userId: user.id)
            )
        }
    }

    private func fetchBeacons(query text: String, limit: Int) async throws -> [UniversalSearchResult] {
        let response: UniversalSearchProfilesResponse = try await api.request(
            UniversalSearchEndpoints.profiles(query: text, limit: limit)
        )
        return response.results
            // RN `src/app/discover.tsx:151` drops non-Beacon rows.
            .filter { $0.type == "public_profile" }
            .map { profile in
                UniversalSearchResult(
                    id: profile.id,
                    kind: .beacon,
                    title: profile.title?.nonEmpty ?? "Beacon",
                    subtitle: profile.subtitle?.nonEmpty,
                    meta: profile.meta?.nonEmpty,
                    imageURL: profile.imageUrl.flatMap(URL.init(string:)),
                    destination: .beacon(handle: Self.beaconHandle(for: profile))
                )
            }
    }

    private func fetchBusinesses(query text: String, limit: Int) async throws -> [UniversalSearchResult] {
        let response: UniversalSearchBusinessesResponse = try await api.request(
            UniversalSearchEndpoints.businesses(query: text, limit: limit)
        )
        return response.businesses.map { business in
            UniversalSearchResult(
                id: business.id,
                kind: .business,
                title: business.name?.nonEmpty ?? business.username?.nonEmpty ?? "Business",
                subtitle: business.businessType?.nonEmpty,
                meta: Self.locality(city: business.city, state: business.state),
                imageURL: business.profilePictureURL.flatMap(URL.init(string:)),
                destination: .business(businessId: business.id)
            )
        }
    }

    private func fetchHomes(query text: String, limit: Int) async throws -> [UniversalSearchResult] {
        let response: UniversalSearchHomesResponse = try await api.request(
            UniversalSearchEndpoints.homes(query: text, limit: limit)
        )
        return response.homes.map { home in
            let ownerAvatar: String? = home.owner?.profilePictureURL
            return UniversalSearchResult(
                id: home.id,
                kind: .home,
                title: home.name?.nonEmpty ?? home.address?.nonEmpty ?? "Home",
                subtitle: home.homeType?.nonEmpty,
                meta: Self.locality(city: home.city, state: home.state),
                imageURL: ownerAvatar.flatMap(URL.init(string:)),
                destination: .home(homeId: home.id)
            )
        }
    }

    // MARK: - Helpers

    /// `"City, ST"` — nil when neither half is present.
    static func locality(city: String?, state: String?) -> String? {
        [city?.nonEmpty, state?.nonEmpty]
            .compactMap { $0 }
            .joined(separator: ", ")
            .nonEmpty
    }

    /// `$80` — RN renders `$${Number(price).toFixed(0)}`.
    static func priceLabel(_ price: Double?) -> String? {
        guard let price else { return nil }
        return "$\(Int(price.rounded()))"
    }

    /// Pull the Beacon handle out of the profile row's `href`, falling
    /// back to the `@handle` subtitle then the row id. Mirrors RN
    /// `beaconRouteFromProfile` (`src/app/discover.tsx:44`).
    static func beaconHandle(for profile: UniversalSearchProfileDTO) -> String {
        let href = profile.href ?? ""
        if href.hasPrefix("/@") {
            let handle = href.dropFirst(2).prefix { $0 != "/" && $0 != "?" && $0 != "#" }
            if !handle.isEmpty { return String(handle) }
        }
        if href.hasPrefix("/persona/") {
            let handle = href.dropFirst("/persona/".count).prefix { $0 != "/" && $0 != "?" && $0 != "#" }
            if !handle.isEmpty { return String(handle) }
        }
        let fromSubtitle = (profile.subtitle ?? "").hasPrefix("@")
            ? String((profile.subtitle ?? "").dropFirst())
            : (profile.subtitle ?? "")
        if !fromSubtitle.isEmpty { return fromSubtitle }
        return profile.id
    }
}

private extension String {
    /// `nil` when the string is empty or whitespace-only.
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
