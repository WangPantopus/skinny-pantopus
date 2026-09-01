//
//  GigSearchViewModelTests.swift
//  PantopusTests
//
//  Covers the Gig Search VM (P4.4): idle by default, debounced loading,
//  loaded/empty/error transitions, category chip re-issues the query,
//  and the row projection matches the feed's.
//

import XCTest
@testable import Pantopus

@MainActor
final class GigSearchViewModelTests: XCTestCase {
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

    private static let shelfGigJSON = """
    {
      "id": "g1",
      "title": "Hang 3 floating shelves",
      "description": "Need 3 IKEA Lack shelves mounted on drywall.",
      "price": 60,
      "category": "handyman",
      "status": "open",
      "created_at": "2026-05-14T08:00:00Z",
      "user_id": "u1",
      "bid_count": 4,
      "distance_miles": 0.2
    }
    """

    private static let dogGigJSON = """
    {
      "id": "g2",
      "title": "Midday dog walks",
      "description": "20-min loop, friendly shepherd mix.",
      "price": 22,
      "category": "petcare",
      "status": "open",
      "created_at": "2026-05-14T05:00:00Z",
      "user_id": "u2",
      "bid_count": 0,
      "distance_miles": 0.5,
      "pay_type": "per_walk"
    }
    """

    private static func gigsJSON(_ rows: String...) -> String {
        "{\"gigs\":[\(rows.joined(separator: ","))],\"total\":\(rows.count)}"
    }

    func testStartsIdle() {
        let vm = GigSearchViewModel(api: makeAPI())
        guard case .idle = vm.state else {
            XCTFail("Expected .idle, got \(vm.state)")
            return
        }
        XCTAssertFalse(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testEmptyQuerySearchStaysIdle() async {
        let vm = GigSearchViewModel(api: makeAPI())
        vm.query = "   "
        await vm.search()
        guard case .idle = vm.state else {
            XCTFail("Expected .idle for blank query, got \(vm.state)")
            return
        }
    }

    func testSearchTransitionsLoadedAndReusesFeedProjection() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.shelfGigJSON, Self.dogGigJSON))
        ]
        let vm = GigSearchViewModel(api: makeAPI())
        vm.query = "shel"
        await vm.search()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].category, .handyman)
        XCTAssertEqual(rows[0].price, "$60")
        XCTAssertEqual(rows[1].category, .petcare)
        // pay_type → "/ walk" suffix proves the shared feed projection ran.
        XCTAssertEqual(rows[1].price, "$22 / walk")
        XCTAssertEqual(vm.results.count, 2)
    }

    func testSearchEmptyTransitionsEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.gigsJSON())]
        let vm = GigSearchViewModel(api: makeAPI())
        vm.query = "zzzzzz"
        await vm.search()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(vm.emptyStateContent.icon, .search)
    }

    func testSearchFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = GigSearchViewModel(api: makeAPI())
        vm.query = "shelf"
        await vm.search()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
        XCTAssertEqual(vm.emptyStateContent.icon, .alertCircle)
    }

    func testScheduleSearchEntersLoadingThenIdleOnClear() {
        let vm = GigSearchViewModel(api: makeAPI())
        vm.query = "shelf"
        vm.scheduleSearch()
        XCTAssertTrue(vm.isLoading, "Non-empty query should flip to loading before the debounce fires")
        // Clearing cancels the in-flight debounce and returns to idle.
        vm.query = ""
        vm.scheduleSearch()
        guard case .idle = vm.state else {
            XCTFail("Expected .idle after clearing, got \(vm.state)")
            return
        }
    }

    func testSelectCategoryRefetchesWithFilter() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.shelfGigJSON, Self.dogGigJSON)),
            .status(200, body: Self.gigsJSON(Self.dogGigJSON))
        ]
        let vm = GigSearchViewModel(api: makeAPI())
        vm.query = "walk"
        await vm.search()
        await vm.selectCategory(.petcare)
        XCTAssertEqual(vm.activeCategory, .petcare)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after category filter, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows.first?.category, .petcare)
    }

    func testSelectCategoryWithoutQueryDoesNotFetch() async {
        // Empty sequence — a stray fetch would surface as an error.
        let vm = GigSearchViewModel(api: makeAPI())
        await vm.selectCategory(.petcare)
        XCTAssertEqual(vm.activeCategory, .petcare)
        guard case .idle = vm.state else {
            XCTFail("Expected .idle with no active query, got \(vm.state)")
            return
        }
    }
}
