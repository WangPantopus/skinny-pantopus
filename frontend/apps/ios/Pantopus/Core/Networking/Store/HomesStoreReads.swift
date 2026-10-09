//
//  HomesStoreReads.swift
//  Pantopus
//
//  My Homes and saved places through the screen store, so every screen that
//  needs "which homes do I have" (Today, You, the Place switcher, My Homes)
//  shares one copy and one request (Instant Screens contract section 6).
//

import Foundation

@MainActor
enum HomesStoreReads {
    /// `GET /api/homes/my-homes`. The copy shows before the re-check only when
    /// every home on it is an owner's or household member's with open-ended
    /// access (founder decision 3, 2026-10-09); a list with a guest, service
    /// provider or expiring access waits for the server each time.
    static func myHomes(store: ScreenStore = .shared, force: Bool = false) async throws -> ScreenSnapshot<MyHomesResponse> {
        let gate: @Sendable (MyHomesResponse) -> Bool = { $0.homes.allSatisfy(\.showsCopyBeforeRecheck) }
        return try await store.load(
            HomesEndpoints.myHomes(),
            as: MyHomesResponse.self,
            kind: .homes,
            topics: [ScreenTopic.homes],
            force: force,
            showsBeforeRecheck: gate
        )
    }

    static func peekMyHomes() -> ScreenSnapshot<MyHomesResponse>? {
        ScreenStore.shared.peek(HomesEndpoints.myHomes(), as: MyHomesResponse.self)
    }

    /// `GET /api/saved-places`: the account's own saved addresses.
    static func savedPlaces(force: Bool = false) async throws -> ScreenSnapshot<SavedPlacesListResponse> {
        try await ScreenStore.shared.load(
            SavedPlacesEndpoints.list(),
            as: SavedPlacesListResponse.self,
            kind: .you,
            topics: [ScreenTopic.homes],
            force: force
        )
    }
}

extension MyHome {
    /// Owners and household roles with open-ended access may see a copy before
    /// the re-check; guests, service providers and expiring access may not.
    var showsCopyBeforeRecheck: Bool {
        let role = (roleBase ?? occupancy?.roleBase ?? occupancy?.role ?? "").lowercased()
        return !["guest", "service_provider", "nonresident"].contains(role) && occupancy?.endAt == nil
    }
}
