//
//  SupportTrainsViewModelTests.swift
//  PantopusTests
//
//  T6.6c (P26.5) — Support Trains. Covers:
//    - load → loaded / empty / error transitions on My-trains tab
//    - tabs expose My trains / Nearby / Invitations with counts
//    - Invitations tab filters status == "invited" out of the
//      My-trains projection
//    - Nearby graceful degrade when no location provider supplied
//    - Row mapping: title falls back to `recipient_name → title →
//      "Support train"`; archetype tile is `.generic` when
//      `support_train_type` is nil; slot meta tail is omitted when
//      backend doesn't project counts
//    - Status chip variant maps per backend status value
//

import XCTest
@testable import Pantopus

@MainActor
final class SupportTrainsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(
        api: APIClient? = nil,
        onStartTrain: @escaping @MainActor () -> Void = {},
        onOpenTrain: @escaping @MainActor (String) -> Void = { _ in },
        onSearch: @escaping @MainActor () -> Void = {},
        locationProvider: @escaping @MainActor () async -> (latitude: Double, longitude: Double)? = { nil }
    ) -> SupportTrainsViewModel {
        SupportTrainsViewModel(
            api: api ?? makeAPI(),
            onStartTrain: onStartTrain,
            onOpenTrain: onOpenTrain,
            onSearch: onSearch,
            locationProvider: locationProvider
        )
    }

    private func stub(mine: String, nearby: String? = nil) {
        var routes: [String: [SequencedURLProtocol.Response]] = [
            "/api/activities/support-trains/me/support-trains": [.status(200, body: mine)]
        ]
        if let nearby {
            routes["/api/activities/support-trains/nearby"] = [.status(200, body: nearby)]
        }
        SequencedURLProtocol.routeResponses = routes
    }

    // MARK: - Fixtures (real backend shape — keep this honest)

    /// Real `/me/support-trains` shape — id / title / status /
    /// published_at / created_at / my_role. Extra UI fields stay nil.
    private static let mineRealJSON = """
    {"support_trains":[
      {"id":"st1","title":"Chen family meal train","status":"filling",
       "published_at":"2026-05-10T10:00:00Z",
       "created_at":"2026-05-10T09:30:00Z","my_role":"organizer"},
      {"id":"st2","title":"Daniel R. rides","status":"active",
       "published_at":"2026-05-08T14:00:00Z",
       "created_at":"2026-05-08T13:30:00Z","my_role":"helper"}
    ],"total":2,"limit":20,"offset":0}
    """

    /// Includes an `invited` row to exercise the Invitations tab.
    private static let mineWithInviteJSON = """
    {"support_trains":[
      {"id":"st1","title":"Chen family","status":"filling",
       "created_at":"2026-05-10T10:00:00Z","my_role":"organizer"},
      {"id":"st3","title":"Okafor errands","status":"invited",
       "created_at":"2026-05-09T10:00:00Z","my_role":"helper"}
    ]}
    """

    /// Nearby-RPC shape — adds support_train_type + slot counts +
    /// recipient_name + distance_meters.
    private static let nearbyEnrichedJSON = """
    {"support_trains":[
      {"id":"n1","title":"Welcoming baby Theo","status":"filling",
       "support_train_type":"meal_support",
       "starts_on":"2026-05-18","ends_on":"2026-06-02",
       "slots_filled":12,"slots_total":18,
       "distance_meters":640.0,
       "recipient_name":"For the Chen family"}
    ]}
    """

    private static let emptyJSON = """
    {"support_trains":[]}
    """

    // MARK: - Lifecycle

    func testLoadPopulatedRendersLoaded() async {
        stub(mine: Self.mineRealJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
    }

    func testLoadEmptyRendersEmptyMineTab() async {
        stub(mine: Self.emptyJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No support trains yet")
        XCTAssertEqual(content.ctaTitle, "Start a train")
    }

    func testBothFetchesFailingTransitionsToError() async {
        SequencedURLProtocol.routeResponses = [
            "/api/activities/support-trains/me/support-trains": [.status(500, body: "{}")]
        ]
        // swiftlint:disable:next trailing_closure
        let vm = makeVM(locationProvider: { (latitude: 40.0, longitude: -73.0) })
        SequencedURLProtocol.routeResponses["/api/activities/support-trains/nearby"] = [.status(500, body: "{}")]
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    // MARK: - Tabs

    func testTabsExposeMyNearbyInvitationsWithCounts() async {
        stub(mine: Self.mineWithInviteJSON)
        let vm = makeVM()
        await vm.load()
        let labels = vm.tabs.map(\.label)
        XCTAssertEqual(labels, ["My trains", "Nearby", "Invitations"])
        let counts = vm.tabs.map { $0.count ?? -1 }
        XCTAssertEqual(counts, [1, 0, 1]) // 1 mine (filling), 0 nearby (no loc), 1 invited
    }

    func testInvitationsTabSegmentsInvitedRows() async {
        stub(mine: Self.mineWithInviteJSON)
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = SupportTrainsTab.invitations
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded on Invitations, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "st3")
    }

    func testNearbyTabUsesLocationProviderWhenSupplied() async {
        stub(mine: Self.emptyJSON, nearby: Self.nearbyEnrichedJSON)
        // swiftlint:disable:next trailing_closure
        let vm = makeVM(locationProvider: { (latitude: 40.0, longitude: -73.0) })
        await vm.load()
        vm.selectedTab = SupportTrainsTab.nearby
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded on Nearby, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "n1")
    }

    func testNearbyTabGracefullyDegradesWithoutLocation() async {
        stub(mine: Self.emptyJSON)
        let vm = makeVM() // locationProvider returns nil by default
        await vm.load()
        vm.selectedTab = SupportTrainsTab.nearby
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty on Nearby without location, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No trains nearby right now")
    }

    // MARK: - Row mapping

    func testMyTrainsRowFallsBackToTitleWhenRecipientNameMissing() async {
        stub(mine: Self.mineRealJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("No row available")
            return
        }
        XCTAssertEqual(row.title, "Chen family meal train")
    }

    func testMyTrainsRowUsesGenericArchetypeWhenTypeMissing() async {
        stub(mine: Self.mineRealJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first,
              case let .categoryGradientIcon(icon, _) = row.leading else {
            XCTFail("Expected categoryGradientIcon leading")
            return
        }
        // .handCoins is the .generic archetype glyph
        XCTAssertEqual(icon, .handCoins)
    }

    func testNearbyRowUsesMealArchetypeWhenTypeProjected() async {
        stub(mine: Self.emptyJSON, nearby: Self.nearbyEnrichedJSON)
        // swiftlint:disable:next trailing_closure
        let vm = makeVM(locationProvider: { (latitude: 40.0, longitude: -73.0) })
        await vm.load()
        vm.selectedTab = SupportTrainsTab.nearby
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first,
              case let .categoryGradientIcon(icon, _) = row.leading else {
            XCTFail("Expected categoryGradientIcon leading on Nearby row")
            return
        }
        XCTAssertEqual(icon, .utensils)
    }

    func testNearbyRowRendersSlotProgressAndDistance() async {
        stub(mine: Self.emptyJSON, nearby: Self.nearbyEnrichedJSON)
        // swiftlint:disable:next trailing_closure
        let vm = makeVM(locationProvider: { (latitude: 40.0, longitude: -73.0) })
        await vm.load()
        vm.selectedTab = SupportTrainsTab.nearby
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("No row available")
            return
        }
        XCTAssertEqual(row.metaTail, "12 / 18 slots · 6 open")
        XCTAssertEqual(row.title, "For the Chen family")
    }

    func testStatusChipMapsBackendStatusToVariant() async {
        stub(mine: Self.mineRealJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // st1.status == "filling" → ("Filling up", .info)
        // st2.status == "active"  → ("Active",   .success)
        let trailings = sections.first?.rows.compactMap { row -> String? in
            if case let .statusChip(text, _) = row.trailing { return text }
            return nil
        }
        XCTAssertEqual(trailings, ["Filling up", "Active"])
    }

    func testRowTapRoutesToOpenTrain() async {
        stub(mine: Self.mineRealJSON)
        var captured: String?
        // swiftlint:disable:next trailing_closure
        let vm = makeVM(onOpenTrain: { id in captured = id })
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("No row")
            return
        }
        row.onTap()
        XCTAssertEqual(captured, "st1")
    }
}
