//
//  BookingsInboxViewModelTests.swift
//  PantopusTests
//
//  Stream I8 — E1 inbox view-model. Verifies the tabs map to the `status`
//  filter, search maps to `q`, sections group by relative day (single
//  "Needs your approval" on Pending), and the optimistic approve removes the row
//  and restores + surfaces the error on a PAST_DEADLINE conflict.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingsInboxViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(
        owner: SchedulingOwner = .personal,
        routes: [String: [SequencedURLProtocol.Response]]
    ) -> BookingsInboxViewModel {
        let session = SequencedURLProtocol.makeSession(routeResponses: routes)
        let actions = BookingActions(owner: owner, client: SchedulingClient(client: APIClient(session: session, retryPolicy: .none)))
        return BookingsInboxViewModel(owner: owner, push: { _ in }, actions: actions)
    }

    private func bookingsBody(_ inner: String) -> String {
        "{\"bookings\":[\(inner)]}"
    }

    private func captured(_ contains: String) -> URLRequest? {
        SequencedURLProtocol.capturedRequests.first { ($0.url?.absoluteString ?? "").contains(contains) }
    }

    func testLoadPopulatesUpcomingAndIsReady() async {
        let row = #"{"id":"b1","status":"confirmed","start_at":"2030-06-18T21:00:00Z","invitee_name":"Dana"}"#
        let viewModel = makeViewModel(routes: [
            // `load()` fires the best-effort Pending-badge fetch
            // (`/bookings?status=pending` — the summary endpoint has no
            // pendingCount) BEFORE the tab list fetch, so the route serves the
            // badge count first, then the upcoming list.
            "/api/scheduling/bookings": [
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: bookingsBody(row))
            ]
        ])
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.bookings.count, 1)
        XCTAssertFalse(viewModel.isEmpty)
        XCTAssertNotNil(captured("status=upcoming"), "the tab list fetch carries status=upcoming")
    }

    func testEmptyLoadMarksEmpty() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings": [
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: #"{"bookings":[]}"#)
            ]
        ])
        await viewModel.load()
        XCTAssertTrue(viewModel.isEmpty)
    }

    func testSelectTabRefetchesWithPendingStatus() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings": [
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: #"{"bookings":[]}"#)
            ]
        ])
        await viewModel.load()
        await viewModel.selectTab(.pending)
        XCTAssertEqual(viewModel.selectedTab, .pending)
        // The badge fetch also carries status=pending, so pin the assertion to
        // the LAST /bookings request — the selectTab refetch.
        let lastList = SequencedURLProtocol.capturedRequests.last {
            ($0.url?.path ?? "").hasSuffix("/bookings")
        }
        XCTAssertTrue(
            (lastList?.url?.query ?? "").contains("status=pending"),
            "selecting Pending must refetch with status=pending"
        )
    }

    func testApplyFiltersForwardsFacetsToTheWireAndAcrossTabs() async {
        let empty = SequencedURLProtocol.Response.status(200, body: #"{"bookings":[]}"#)
        let viewModel = makeViewModel(routes: [
            // badge → initial upcoming → applyFilters refetch → selectTab refetch
            "/api/scheduling/bookings": [empty, empty, empty, empty]
        ])
        await viewModel.load()
        let filters = BookingFilters(
            status: nil,
            eventTypeId: "et9",
            dateRange: .today,
            customFrom: Date(),
            customTo: Date(),
            search: "",
            scope: .personal
        )
        await viewModel.applyFilters(filters)
        func lastListQuery() -> String {
            let last = SequencedURLProtocol.capturedRequests.last { ($0.url?.path ?? "").hasSuffix("/bookings") }
            return last?.url?.query ?? ""
        }
        let applied = lastListQuery()
        XCTAssertTrue(applied.contains("event_type_id=et9"), "the event-type facet must reach the wire")
        XCTAssertTrue(applied.contains("from="), "the date-range facet must reach the wire")
        XCTAssertTrue(applied.contains("to="), "the date-range facet must reach the wire")
        // Facets stay applied on subsequent tab switches, matching the sheet CTA.
        await viewModel.selectTab(.past)
        let afterTabSwitch = lastListQuery()
        XCTAssertTrue(afterTabSwitch.contains("status=past"))
        XCTAssertTrue(afterTabSwitch.contains("event_type_id=et9"), "tab switches must keep the applied facets")
    }

    func testPendingTabIsSingleApprovalSection() async {
        let rows = [
            #"{"id":"b1","status":"pending","start_at":"2030-06-18T21:00:00Z","invitee_name":"A"}"#,
            #"{"id":"b2","status":"pending","start_at":"2030-06-20T21:00:00Z","invitee_name":"B"}"#
        ].joined(separator: ",")
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings": [
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: bookingsBody(rows))
            ]
        ])
        viewModel.selectedTab = .pending
        await viewModel.refresh()
        XCTAssertEqual(viewModel.sections.count, 1)
        XCTAssertEqual(viewModel.sections.first?.title, "Needs your approval")
        XCTAssertTrue(viewModel.sections.first?.showsApprovalDot ?? false)
    }

    func testApproveOptimisticallyRemovesRow() async {
        let row = #"{"id":"b1","status":"pending","start_at":"2030-06-18T21:00:00Z","invitee_name":"Dana"}"#
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings": [
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: bookingsBody(row))
            ],
            "/api/scheduling/bookings/b1/approve": [.status(200, body: #"{"booking":{"id":"b1","status":"confirmed"}}"#)]
        ])
        viewModel.selectedTab = .pending
        await viewModel.refresh()
        let target = viewModel.bookings[0]
        await viewModel.approve(target)
        XCTAssertTrue(viewModel.bookings.isEmpty, "approve drops the pending row optimistically")
        XCTAssertNil(viewModel.actionError)
    }

    func testApproveErrorRestoresRowAndSurfacesMessage() async {
        let row = #"{"id":"b1","status":"pending","start_at":"2030-06-18T21:00:00Z","invitee_name":"Dana"}"#
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings": [
                .status(200, body: #"{"bookings":[]}"#),
                .status(200, body: bookingsBody(row))
            ],
            "/api/scheduling/bookings/b1/approve": [.status(409, body: #"{"error":"PAST_DEADLINE"}"#)]
        ])
        viewModel.selectedTab = .pending
        await viewModel.refresh()
        let target = viewModel.bookings[0]
        await viewModel.approve(target)
        XCTAssertEqual(viewModel.bookings.count, 1, "a failed approve restores the row")
        XCTAssertNotNil(viewModel.actionError)
    }

    func testMenuActionsContextualToStatus() {
        let viewModel = makeViewModel(routes: [:])
        let pending = BookingDTO.preview(status: "pending")
        let confirmed = BookingDTO.preview(status: "confirmed")
        XCTAssertTrue(viewModel.menuActions(for: pending).contains { $0.title == "Decline" })
        XCTAssertTrue(viewModel.menuActions(for: confirmed).contains { $0.title == "Reschedule" })
        XCTAssertTrue(viewModel.menuActions(for: confirmed).contains { $0.title == "Cancel" })
    }
}
