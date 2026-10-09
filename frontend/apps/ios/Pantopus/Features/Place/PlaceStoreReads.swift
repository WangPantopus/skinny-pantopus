//
//  PlaceStoreReads.swift
//  Pantopus
//
//  A home's (or saved place's) intelligence through the screen store: the
//  Place dashboard, its detail pages and Today share one copy, so moving
//  between them shows what's already loaded and a return inside the fresh
//  window sends no request (Instant Screens contract sections 4 and 6).
//

import Foundation

@MainActor
enum PlaceStoreReads {
    /// The sections the Today tab renders, so it asks the server for only
    /// those (contract section 8, "Today on the phones"): the sky, weather,
    /// air, alerts, sun, "good day to", the address calendar, the radon card
    /// and the ballot card, plus the home type and block density the sky draws.
    static let todaySections: [PlaceSectionID] = [
        .weather, .airQuality, .alerts, .sunriseSunset, .goodDayTo, .addressCalendar,
        .leadRadon, .blockDensity, .civicElection, .yourHome
    ]

    static func endpoint(homeId: String, savedPlaceId: String?, sections: [PlaceSectionID]? = nil) -> Endpoint {
        savedPlaceId.map { SavedPlacesEndpoints.today(id: $0) }
            ?? PlaceEndpoints.intelligence(homeId: homeId, sections: sections)
    }

    /// The shared copy, when it may show before the re-check. A screen that
    /// asks for some sections also takes the full copy (the dashboard's).
    static func peek(
        homeId: String,
        savedPlaceId: String? = nil,
        sections: [PlaceSectionID]? = nil
    ) -> ScreenSnapshot<PlaceIntelligence>? {
        let store = ScreenStore.shared
        if let own = store.peek(endpoint(homeId: homeId, savedPlaceId: savedPlaceId, sections: sections), as: PlaceIntelligence.self) {
            return own
        }
        guard sections != nil, savedPlaceId == nil else { return nil }
        return store.peek(endpoint(homeId: homeId, savedPlaceId: nil), as: PlaceIntelligence.self)
    }

    /// The shared copy if fresh, else one (shared) request. `force` for pull
    /// to refresh, Try again and change signals.
    static func load(
        homeId: String,
        savedPlaceId: String? = nil,
        sections: [PlaceSectionID]? = nil,
        kind: ScreenDataKind,
        force: Bool = false
    ) async throws -> ScreenSnapshot<PlaceIntelligence> {
        // A fresh full copy (the dashboard's) serves a screen that wants only some sections.
        if !force, sections != nil, savedPlaceId == nil, let full = peek(homeId: homeId), full.isFresh {
            return full
        }
        var topics: Set<String> = [ScreenTopic.today]
        if savedPlaceId == nil, !homeId.isEmpty {
            topics.formUnion([ScreenTopic.home(homeId), ScreenTopic.place(homeId)])
        }
        // A saved place is the account's own address: no household check.
        var gate: (@Sendable (PlaceIntelligence) -> Bool)?
        if savedPlaceId == nil {
            gate = { intelligence in PlaceStoreReads.showsBeforeRecheck(intelligence) }
        }
        return try await ScreenStore.shared.load(
            endpoint(homeId: homeId, savedPlaceId: savedPlaceId, sections: sections),
            as: PlaceIntelligence.self,
            kind: kind,
            topics: topics,
            force: force,
            // Today turns over at midnight (the device's time zone stands in
            // for the home's; the pilot homes and phones share one).
            expiresAt: nextMidnight(),
            showsBeforeRecheck: gate
        )
    }

    /// Owners and household roles see the last copy while access is
    /// re-checked; guests and service providers ("nonresident") wait for the
    /// re-check (founder decision 3, 2026-10-09). An unknown role waits too.
    nonisolated static func showsBeforeRecheck(_ intelligence: PlaceIntelligence) -> Bool {
        ["owner", "renter", "member"].contains(intelligence.viewer?.role ?? "")
    }

    static func nextMidnight(after date: Date = Date(), calendar: Calendar = .current) -> Date {
        calendar.nextDate(after: date, matching: DateComponents(hour: 0, minute: 0, second: 0), matchingPolicy: .nextTime)
            ?? date.addingTimeInterval(24 * 3600)
    }
}
