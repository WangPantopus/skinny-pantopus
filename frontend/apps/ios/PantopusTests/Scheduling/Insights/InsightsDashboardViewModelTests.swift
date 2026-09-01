//
//  InsightsDashboardViewModelTests.swift
//  PantopusTests
//
//  H9 · Stream I17. Loaded / empty / error against the deployed
//  `/bookings/summary` (+ `/insights/no-shows` + `/event-types`).
//

import XCTest
@testable import Pantopus

@MainActor
final class InsightsDashboardViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func vm(owner: SchedulingOwner = .personal, _ routes: [String: [SequencedURLProtocol.Response]]) -> InsightsDashboardViewModel {
        InsightsDashboardViewModel(
            owner: owner,
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    private let summary = #"""
    {"bookingsThisMonth":12,"bookingsLastMonth":10,"deltaPct":20,"upcomingCount":4,"noShowCount":1,
     "sparkline":[{"date":"2026-06-01","count":2},{"date":"2026-06-02","count":3},{"date":"2026-06-03","count":1}],
     "byEventType":[{"event_type_id":"et1","count":7},{"event_type_id":"et2","count":5}]}
    """#
    // swiftlint:disable:next line_length
    private let eventTypes = #"{"eventTypes":[{"id":"et1","name":"Intro call","slug":"intro","durations":[30]},{"id":"et2","name":"Deep dive","slug":"deep","durations":[60]}]}"#
    private let report = #"{"window_days":30,"completed":8,"no_show":2,"cancelled":1,"no_show_rate":20,"recent_no_shows":[]}"#

    func testLoadedBuildsTilesTrendAndTopTypes() async {
        let model = vm([
            "/api/scheduling/bookings/summary": [.status(200, body: summary)],
            "/api/scheduling/event-types": [.status(200, body: eventTypes)],
            "/api/scheduling/insights/no-shows": [.status(200, body: report)]
        ])
        await model.load()

        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.tiles.count, 4)
        XCTAssertEqual(model.tiles[0].value, "12")
        XCTAssertEqual(model.tiles[0].delta, 20)
        XCTAssertEqual(model.tiles[3].value, "20%") // no-show rate
        XCTAssertEqual(model.topTypes.first?.title, "Intro call")
        XCTAssertEqual(model.topTypes.first?.count, 7)
        XCTAssertFalse(model.dayBars.isEmpty)
        XCTAssertTrue(model.hasTrend)
        XCTAssertEqual(model.noShowLinkSubtitle, "20% no-show rate")
    }

    func testEmptyWhenNoData() async {
        let summaryEmpty = #"{"bookingsThisMonth":0,"upcomingCount":0,"sparkline":[],"byEventType":[]}"#
        let noShowsEmpty = #"{"window_days":30,"completed":0,"no_show":0,"cancelled":0,"no_show_rate":0,"recent_no_shows":[]}"#
        let model = vm([
            "/api/scheduling/bookings/summary": [.status(200, body: summaryEmpty)],
            "/api/scheduling/event-types": [.status(200, body: #"{"eventTypes":[]}"#)],
            "/api/scheduling/insights/no-shows": [.status(200, body: noShowsEmpty)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testErrorWhenSummaryFails() async {
        let model = vm(["/api/scheduling/bookings/summary": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }

    func testApplyReloadsWithFilter() async {
        let model = vm([
            "/api/scheduling/bookings/summary": [.status(200, body: summary), .status(200, body: summary)],
            "/api/scheduling/event-types": [.status(200, body: eventTypes), .status(200, body: eventTypes)],
            "/api/scheduling/insights/no-shows": [.status(200, body: report), .status(200, body: report)]
        ])
        await model.load()
        await model.apply(InsightsFilter(period: .last7))
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.filter.period, .last7)
    }
}
