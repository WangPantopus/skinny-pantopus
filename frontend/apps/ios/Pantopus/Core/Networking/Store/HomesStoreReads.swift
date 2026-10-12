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

    /// `GET /api/saved-places`: the account's own saved addresses, one copy
    /// for every screen that lists them.
    static func savedPlaces(store: ScreenStore = .shared, force: Bool = false) async throws -> ScreenSnapshot<SavedPlacesListResponse> {
        try await store.load(
            SavedPlacesEndpoints.list(),
            as: SavedPlacesListResponse.self,
            kind: .you,
            topics: [ScreenTopic.homes, ScreenTopic.savedPlaces],
            force: force
        )
    }

    static func peekSavedPlaces(store: ScreenStore = .shared) -> ScreenSnapshot<SavedPlacesListResponse>? {
        store.peek(SavedPlacesEndpoints.list(), as: SavedPlacesListResponse.self)
    }

    /// A save or removal went through: the kept list is read again next time,
    /// and (with `notify`) an open Saved places screen refreshes.
    static func savedPlacesChanged(store: ScreenStore = .shared, notify: Bool = true) {
        store.markStale(topics: [ScreenTopic.savedPlaces])
        if notify { NotificationCenter.default.post(name: .savedPlacesDidChange, object: nil) }
    }
}

extension MyHome {
    /// Owners and household roles with open-ended access, and the person's
    /// own private setup, may see a copy before the re-check. Guests, service
    /// providers, unknown contexts and expiring access may not.
    var showsCopyBeforeRecheck: Bool {
        guard hasValidListContext, occupancy?.endAt == nil, occupancy?.accessEndAt == nil else { return false }
        if accessKind == "private_setup" { return true }
        let household = ["owner", "admin", "manager", "lease_resident", "member", "restricted_member"]
        return hasSharedAccess && household.contains(roleBase ?? "")
    }
}
