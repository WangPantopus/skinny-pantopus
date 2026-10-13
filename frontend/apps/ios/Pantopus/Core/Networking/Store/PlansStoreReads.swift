//
//  PlansStoreReads.swift
//  Pantopus
//
//  Nearby Plans through the screen store (Plans build brief, section 6).
//  Pins and lists are area-only and use the `nearby` kind. A reply that
//  carries an exact point (a plan the viewer hosts or is in) or a playdate's
//  exact time is never saved on the phone and never shown from a copy
//  before a re-check, so a removed guest never sees the place again.
//  `PlanDetail` and the host's requests use `sensitive`: never saved,
//  always re-checked.
//

import Foundation

@MainActor
enum PlansStoreReads {
    /// Where the map was last centered (the viewer's location or home), for
    /// screens that list "other plans this week" without a map.
    static var lastCenter: UserCoordinate?
    /// The last device fix and when it was taken (a location for asking
    /// while it is under 5 minutes old).
    static var lastFix: (coordinate: UserCoordinate, at: Date)?

    /// The last fix, while still under 5 minutes old.
    static var freshGPS: PlansGPS? {
        guard let lastFix, Date().timeIntervalSince(lastFix.at) < 290 else { return nil }
        return PlansGPS(latitude: lastFix.coordinate.latitude, longitude: lastFix.coordinate.longitude, timestamp: lastFix.at)
    }

    /// The signed-in user's id.
    static var viewerId: String? {
        ScreenStore.account(of: AuthManager.shared)
    }

    /// The `plans` layer of the map for a viewport.
    static func pins(
        _ viewport: PlansViewport,
        kinds: [PlanKind],
        window: PlansWindow,
        store: ScreenStore = .shared,
        force: Bool = false
    ) async throws -> ScreenSnapshot<PlanPinsResponse> {
        try await store.load(
            PlansEndpoints.pins(viewport, kinds: kinds, window: window),
            as: PlanPinsResponse.self,
            kind: .nearby,
            topics: [ScreenTopic.plans],
            force: force
        ) { !$0.carriesExactPoints }
    }

    /// The list under the map.
    static func list(
        latitude: Double,
        longitude: Double,
        window: PlansWindow,
        kinds: [PlanKind],
        store: ScreenStore = .shared,
        force: Bool = false
    ) async throws -> ScreenSnapshot<PlansListResponse> {
        try await store.load(
            PlansEndpoints.list(latitude: latitude, longitude: longitude, window: window, kinds: kinds, gps: freshGPS),
            as: PlansListResponse.self,
            kind: .nearby,
            topics: [ScreenTopic.plans],
            force: force
        ) { !$0.carriesPrivateTimes }
    }

    /// Your plans: hosting, going, asked, waitlisted (the list and Today).
    static func mine(store: ScreenStore = .shared, force: Bool = false) async throws -> ScreenSnapshot<MyPlansResponse> {
        try await store.load(
            PlansEndpoints.mine(),
            as: MyPlansResponse.self,
            kind: .nearby,
            topics: [ScreenTopic.plans],
            force: force
        ) { !$0.carriesPrivateTimes }
    }

    static func peekMine(store: ScreenStore = .shared) -> MyPlansResponse? {
        store.peek(PlansEndpoints.mine(), as: MyPlansResponse.self)?.value
    }

    /// One plan: a detail for the host and people who are in, a card for
    /// everyone else. Never kept: every open asks the server.
    static func detail(id: String, store: ScreenStore = .shared) async throws -> PlanDetailDTO {
        try await store.load(
            PlansEndpoints.detail(id: id, from: lastCenter, gps: freshGPS),
            as: PlanDetailDTO.self,
            kind: .sensitive
        ).value
    }

    /// The host's pending and waitlisted requests (names and hellos). Never kept.
    static func requests(planId: String, store: ScreenStore = .shared) async throws -> PlanRequestsResponse {
        try await store.load(PlansEndpoints.requests(planId: planId), as: PlanRequestsResponse.self, kind: .sensitive).value
    }

    /// A list row or pin that stands in for the plan screen until the detail
    /// read answers (area only).
    static func seed(_ card: PlanCardDTO, store: ScreenStore = .shared) {
        store.seed(PlanDetailDTO(card: card), for: PlansEndpoints.detail(id: card.id))
    }

    static func seeded(id: String, store: ScreenStore = .shared) -> PlanDetailDTO? {
        store.seeded(PlansEndpoints.detail(id: id), as: PlanDetailDTO.self)
    }

    /// Something about a plan changed here (hosted, asked, answered,
    /// cancelled): every Plans copy is read again, and screens showing one
    /// refresh now.
    static func changed(planId: String? = nil, store: ScreenStore = .shared) {
        var topics: Set<String> = [ScreenTopic.plans]
        if let planId { topics.insert(ScreenTopic.plan(planId)) }
        store.markStale(topics: topics)
        NotificationCenter.default.post(name: .screenStoreChanged, object: nil, userInfo: ["topics": topics])
    }

    /// Whether a change signal concerns Plans screens.
    nonisolated static func affects(_ note: Notification) -> Bool {
        if let topics = note.userInfo?["topics"] as? Set<String> {
            return topics.contains(ScreenTopic.plans) || topics.contains { $0.hasPrefix("plan:") }
        }
        return note.userInfo?["kinds"] != nil
    }
}
