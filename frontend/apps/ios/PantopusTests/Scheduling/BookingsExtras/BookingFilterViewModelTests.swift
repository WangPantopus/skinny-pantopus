//
//  BookingFilterViewModelTests.swift
//  PantopusTests
//
//  E9 Booking Search & Filter · Stream I9.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingFilterViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeVM() -> BookingFilterViewModel {
        BookingFilterViewModel(
            owner: .personal,
            eventTypeOptions: [.init(id: "et1", name: "Intro")],
            client: SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        )
    }

    func testClearAllResetsFacets() {
        let viewModel = makeVM()
        XCTAssertFalse(viewModel.hasActiveFilters)
        viewModel.searchText = "rosa"
        viewModel.toggleStatus(.pending)
        XCTAssertTrue(viewModel.hasActiveFilters)
        viewModel.clearAll()
        XCTAssertNil(viewModel.selectedStatus)
        XCTAssertEqual(viewModel.searchText, "")
        XCTAssertEqual(viewModel.scope, .personal)
        XCTAssertFalse(viewModel.hasActiveFilters)
    }

    func testRecountShowsBookingCount() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"bookings":[{"id":"b1","status":"confirmed"},{"id":"b2","status":"confirmed"}]}"#)
        ]
        let viewModel = makeVM()
        await viewModel.recountDebounced()
        XCTAssertEqual(viewModel.resultCount, 2)
        XCTAssertEqual(viewModel.ctaTitle, "Show 2 bookings")
        XCTAssertTrue(viewModel.ctaEnabled)
    }

    func testNoShowStatusFiltersClientSide() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"bookings":[{"id":"b1","status":"confirmed"},{"id":"b2","status":"no_show"}]}"#)
        ]
        let viewModel = makeVM()
        viewModel.toggleStatus(.noShow)
        await viewModel.recountDebounced()
        XCTAssertEqual(viewModel.resultCount, 1)
    }

    func testZeroResultsDisablesCTA() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"bookings":[]}"#)]
        let viewModel = makeVM()
        await viewModel.recountDebounced()
        XCTAssertEqual(viewModel.resultCount, 0)
        XCTAssertEqual(viewModel.ctaTitle, "No matches")
        XCTAssertFalse(viewModel.ctaEnabled)
    }

    func testActiveSummaryIncludesScopeAndStatus() {
        let viewModel = makeVM()
        viewModel.toggleStatus(.pending)
        let ids = viewModel.activeSummary.map(\.id)
        XCTAssertTrue(ids.contains("status"))
        XCTAssertTrue(ids.contains("scope")) // personal scope is non-"All"
    }
}
