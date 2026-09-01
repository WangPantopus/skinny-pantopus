//
//  MyListingsViewModelTests.swift
//  PantopusTests
//
//  T6.3f / P14 — covers `MyListingsViewModel`. Validates:
//    - load → loaded / empty / error transitions
//    - tab counts (Active includes pending_pickup; Sold / Drafts are
//      exclusive)
//    - selecting a tab rebuilds state with only the matching rows
//    - row projection (price + relative time subtitle, chips for
//      views/offers/status, thumbnail URL or fallback icon)
//    - FAB tinted sky with .canonicalCreate variant
//

import XCTest
@testable import Pantopus

@MainActor
final class MyListingsViewModelTests: XCTestCase {
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

    private static let payload = """
    {"listings":[
      {"id":"l1","user_id":"u_me","title":"Mid-century credenza","price":250,
       "is_free":false,"status":"active","media_urls":["https://x/y.jpg"],
       "view_count":2400,"active_offer_count":5,"created_at":"2026-05-15T08:00:00Z"},
      {"id":"l2","user_id":"u_me","title":"Reserved iPad","price":520,
       "is_free":false,"status":"pending_pickup","media_urls":[],
       "view_count":120,"active_offer_count":3,"created_at":"2026-05-14T08:00:00Z"},
      {"id":"l3","user_id":"u_me","title":"Pyrex bowl set","price":45,
       "is_free":false,"status":"sold","media_urls":["https://x/p.jpg"],
       "view_count":89,"active_offer_count":0,"created_at":"2026-04-01T08:00:00Z"},
      {"id":"l4","user_id":"u_me","title":"Untitled draft","price":null,
       "is_free":false,"status":"draft","media_urls":[],
       "view_count":0,"active_offer_count":0,"created_at":"2026-05-10T08:00:00Z"}
    ]}
    """

    func testLoadEmptyOnActiveTabRendersEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"listings\":[]}")]
        let vm = MyListingsViewModel(api: makeAPI())
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No active listings")
        XCTAssertEqual(content.ctaTitle, "List something")
    }

    func testLoadPopulatedBucketsTabsAndRendersActive() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.payload)]
        let vm = MyListingsViewModel(api: makeAPI())
        await vm.load()
        // Tab counts: Active bucket includes both `active` + `pending_pickup`.
        XCTAssertEqual(vm.tabs.first { $0.id == "active" }?.count, 2)
        XCTAssertEqual(vm.tabs.first { $0.id == "sold" }?.count, 1)
        XCTAssertEqual(vm.tabs.first { $0.id == "drafts" }?.count, 1)
        // Active tab renders 2 rows (l1 active + l2 pending_pickup).
        guard case let .loaded(sections, _) = vm.state,
              let rows = sections.first?.rows else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.map(\.id), ["l1", "l2"])
        // First row: chips include views, offers, status; thumbnail uses
        // mediaUrls URL.
        XCTAssertEqual(rows[0].title, "Mid-century credenza")
        XCTAssertEqual(rows[0].chips?.count, 3)
        XCTAssertEqual(rows[0].chips?[0].text, "2400 views")
        XCTAssertEqual(rows[0].chips?[1].text, "5 offers")
        XCTAssertEqual(rows[0].chips?[2].text, "Active")
        if case let .thumbnail(image, size) = rows[0].leading {
            XCTAssertEqual(size, .large)
            if case .url = image {} else { XCTFail("Expected URL thumbnail when mediaUrls present") }
        } else {
            XCTFail("Expected .thumbnail leading")
        }
    }

    func testSwitchingToSoldTabRendersOnlySoldRows() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.payload)]
        let vm = MyListingsViewModel(api: makeAPI())
        await vm.load()
        vm.selectedTab = "sold"
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after tab switch, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.map(\.id), ["l3"])
        XCTAssertEqual(sections.first?.rows.first?.chips?.last?.text, "Sold")
    }

    func testSwitchingToDraftsTabFallsBackToIconThumbnail() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.payload)]
        let vm = MyListingsViewModel(api: makeAPI())
        await vm.load()
        vm.selectedTab = "drafts"
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected .loaded with at least 1 draft, got \(vm.state)")
            return
        }
        XCTAssertEqual(row.id, "l4")
        XCTAssertEqual(row.chips?.last?.text, "Draft")
        if case let .thumbnail(image, _) = row.leading,
           case .icon = image {
            // ok — empty media_urls falls back to gradient icon
        } else {
            XCTFail("Expected .icon thumbnail for draft with no media_urls")
        }
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = MyListingsViewModel(api: makeAPI())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testFabUsesCanonicalCreateAndSkyTint() {
        let vm = MyListingsViewModel()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.tint, .sky)
        XCTAssertEqual(fab.accessibilityLabel, "List something")
        if case .canonicalCreate = fab.variant {} else {
            XCTFail("Expected .canonicalCreate variant, got \(fab.variant)")
        }
    }
}
