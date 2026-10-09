//
//  PlaceDetailViewModel.swift
//  Pantopus
//
//  Container VM for a Place group-detail page (W2.3). Fetches the home's
//  PlaceIntelligence (the same payload the dashboard uses — a warm cache
//  hit on tap-through) and exposes the four render states; the view
//  extracts the page's group sections via `PlaceDetailGroup`.
//

import SwiftUI

@Observable
@MainActor
final class PlaceDetailViewModel {
    enum State {
        case loading
        case loaded(PlaceIntelligence)
        case error(message: String)
    }

    private(set) var state: State = .loading
    /// The error is the server refusing this account the place (403): a
    /// retry can't change it, so the views drop their Try again.
    private(set) var accessDenied = false
    /// When the shown copy was fetched.
    private(set) var loadedAt: Date?
    /// Set when a pull to refresh fails while the content stays on screen.
    var refreshFailureMessage: String?
    /// Today's fresh window (Instant Screens contract §4): coming back
    /// within it sends no request.
    static let todayFreshFor: TimeInterval = 10 * 60
    let homeId: String
    let savedPlaceId: String?
    var calendarHomeId: String? {
        savedPlaceId == nil ? homeId : nil
    }

    let group: PlaceDetailGroup
    /// The host's real verification flows (the dashboard's verify sheet doors).
    let onStartVerify: ((PlaceVerifyMethod) -> Void)?
    /// A locked section's "Verify address" shows the verify sheet.
    var showVerify = false

    private(set) var fallbackCalendar: PlaceAddressCalendarData?
    private var fallbackRequested = false
    private let sessionScope: HomeClaimSessionScope
    private let api: APIClient

    init(
        homeId: String,
        group: PlaceDetailGroup,
        api: APIClient = .shared,
        savedPlaceId: String? = nil,
        onStartVerify: ((PlaceVerifyMethod) -> Void)? = nil
    ) {
        self.homeId = homeId
        self.savedPlaceId = savedPlaceId
        self.group = group
        self.api = api
        sessionScope = HomeClaimSessionScope(api: api)
        self.onStartVerify = onStartVerify
    }

    /// Guests and service providers can't verify this address (server `verify_available`).
    var nonResidentViewer: Bool {
        if case let .loaded(intel) = state { return intel.tier == .t3 && intel.verifyAvailable == false }
        return false
    }

    /// The viewer set this Home up and hasn't verified it (T1): every lock is the verify step.
    var verifiesFirst: Bool {
        if case let .loaded(intel) = state { return intel.verifiesFirst }
        return false
    }

    /// The tap for a locked section's "Verify address"; nil where no flow is wired
    /// or the viewer can't verify this address.
    var verifyAction: (() -> Void)? {
        guard onStartVerify != nil, !nonResidentViewer else { return nil }
        return { [weak self] in self?.showVerify = true }
    }

    func load() async {
        if case .loaded = state { return }
        await fetch(quietly: false)
    }

    /// Coming back: the shown copy stays and is fetched again quietly once
    /// it is older than `freshFor`.
    func refreshIfStale(freshFor: TimeInterval) async {
        guard case .loaded = state, let loadedAt else {
            await load()
            return
        }
        guard Date().timeIntervalSince(loadedAt) >= freshFor else { return }
        await fetch(quietly: true)
    }

    /// Pull to refresh and Try again: always fetches now.
    func refresh() async {
        await fetch(quietly: false)
    }

    /// A failed fetch keeps loaded content on screen (a pull to refresh says
    /// so in a toast). A refusal (403 or 404) replaces it with the server's
    /// answer, and with nothing loaded the error shows.
    private func fetch(quietly: Bool) async {
        let hadFallback = fallbackCalendar != nil
        do {
            let intelligence: PlaceIntelligence = try await api.request(
                savedPlaceId.map { SavedPlacesEndpoints.today(id: $0) }
                    ?? PlaceEndpoints.intelligence(homeId: homeId)
            )
            try Task.checkCancellation()
            accessDenied = false
            refreshFailureMessage = nil
            loadedAt = Date()
            state = .loaded(intelligence)
            // A refresh asks for the fallback calendar again; the shown one
            // stays until the new one arrives.
            if !quietly {
                fallbackRequested = false
                if hadFallback { await loadFallbackCalendar() }
            }
        } catch is CancellationError {
            return
        } catch {
            let apiError = error as? APIError
            if case .loaded = state, !Self.isRefusal(apiError) {
                if !quietly { refreshFailureMessage = "Couldn't refresh. Pull down to try again." }
                return
            }
            if case .forbidden = apiError { accessDenied = true } else { accessDenied = false }
            fallbackRequested = false
            fallbackCalendar = nil
            loadedAt = nil
            state = .error(message: apiError?.errorDescription ?? "Couldn't load this section.")
        }
    }

    private static func isRefusal(_ error: APIError?) -> Bool {
        switch error {
        case .forbidden, .notFound: true
        default: false
        }
    }

    func loadFallbackCalendar() async {
        guard let id = calendarHomeId, !fallbackRequested else { return }
        fallbackRequested = true
        do {
            try sessionScope.requireCurrent()
            let response: AddressCalendarResponse = try await api.request(AddressCalendarEndpoints.calendar(homeId: id))
            try Task.checkCancellation()
            try sessionScope.requireCurrent()
            fallbackCalendar = response.calendar
        } catch {
            // A failed refresh keeps the shown calendar; another account never sees it.
            if !sessionScope.isCurrent { fallbackCalendar = nil }
        }
    }

    /// The sections that belong to this detail page, in contract order.
    func sections(in intel: PlaceIntelligence) -> [PlaceSectionEnvelope] {
        let groups = Set(group.groups)
        return intel.groups
            .filter { groups.contains($0.group) }
            .flatMap(\.sections)
    }

    /// Find a single section across the payload (for bespoke detail cards).
    func section(_ id: PlaceSectionID, in intel: PlaceIntelligence) -> PlaceSectionEnvelope? {
        for g in intel.groups {
            for s in g.sections where s.id == id {
                return s
            }
        }
        return nil
    }
}
