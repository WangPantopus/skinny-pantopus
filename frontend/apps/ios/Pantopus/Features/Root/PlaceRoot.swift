//
//  PlaceRoot.swift
//  Pantopus
//
//  What the Place tab shows at its root. The tab is the person's place:
//  Your Place for a Home they can open, the address they saved, or the
//  address-first screen. My homes roots the tab only while every entry
//  still waits on verification. Nothing sits under Your Place.
//

import Foundation

enum PlaceRoot: Equatable {
    /// No answer yet and no kept copy.
    case resolving
    /// Your Place for this Home.
    case home(String)
    /// No Home entries; the address they saved privately.
    case savedPlace(SavedPlaceDTO)
    /// No Home entries and no saved address: the address-first screen.
    case firstRun
    /// Entries that all still wait on verification: My homes shows them.
    case homes
    /// The first read failed and there was no kept copy.
    case error(String)
}

enum PlaceRootResolver {
    /// Homes the Place tab can open: shared with access, or the person's own
    /// private setup.
    static func openableHomes(in response: MyHomesResponse) -> [MyHome] {
        response.homes.filter { $0.hasValidListContext && ($0.hasSharedAccess || $0.accessKind == "private_setup") }
    }

    static func isOpenable(_ homeId: String, in response: MyHomesResponse) -> Bool {
        openableHomes(in: response).contains { $0.id == homeId }
    }

    /// The landing rule: the Home where the person is primary owner, else the
    /// newest shared Home, else their private setup. A resident's own private
    /// setup is their Place until a household shares it (as on the web).
    static func landingHomeId(in response: MyHomesResponse) -> String? {
        response.sharedHomes.first { $0.isPrimaryOwner == true }?.id
            ?? response.sharedHomes.first?.id
            ?? response.homes.first { $0.hasValidListContext && $0.accessKind == "private_setup" }?.id
    }

    /// The root the home list decides, keeping the session's current Home while
    /// it can still be opened. Nil when there are no Home entries at all: the
    /// saved places decide then.
    static func root(for response: MyHomesResponse, current: String?) -> PlaceRoot? {
        if let current, isOpenable(current, in: response) { return .home(current) }
        if let homeId = landingHomeId(in: response) { return .home(homeId) }
        if response.homes.contains(where: \.hasValidListContext) { return .homes }
        return nil
    }

    /// The saved address the Place tab shows: the newest one saved as a home,
    /// else the newest one looked up. Work and other spots aren't "your place".
    static func savedPlace(in places: [SavedPlaceDTO]) -> SavedPlaceDTO? {
        places.first { $0.placeType == "home" } ?? places.first { $0.placeType == "searched" }
    }
}
