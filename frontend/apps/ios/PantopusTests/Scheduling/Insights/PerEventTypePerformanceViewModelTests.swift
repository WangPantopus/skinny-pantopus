//
//  PerEventTypePerformanceViewModelTests.swift
//  PantopusTests
//
//  H10 · Stream I17. Loaded / empty / error against `/event-types/:id` +
//  `/bookings?event_type_id`, with funnel/stat aggregation.
//

import XCTest
@testable import Pantopus

@MainActor
final class PerEventTypePerformanceViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> PerEventTypePerformanceViewModel {
        PerEventTypePerformanceViewModel(
            owner: .personal,
            eventTypeId: "et1",
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    // swiftlint:disable:next line_length
    private let detail = #"{"eventType":{"id":"et1","name":"Intro call","slug":"intro","durations":[30],"default_duration":30,"price_cents":5000,"currency":"USD"},"assignees":[],"questions":[]}"#

    func testLoadedBuildsHeaderTilesAndFunnel() async {
        let bookings = #"""
        {"bookings":[
          {"id":"b1","status":"completed","start_at":"2026-06-10T17:00:00Z","event_type_id":"et1"},
          {"id":"b2","status":"no_show","start_at":"2026-06-11T17:00:00Z","event_type_id":"et1"},
          {"id":"b3","status":"confirmed","start_at":"2026-06-12T17:00:00Z","event_type_id":"et1"}
        ]}
        """#
        let model = vm([
            "/api/scheduling/event-types/et1": [.status(200, body: detail)],
            "/api/scheduling/bookings": [.status(200, body: bookings)]
        ])
        await model.load()

        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.title, "Intro call")
        XCTAssertEqual(model.durationLabel, "30 min")
        XCTAssertEqual(model.priceLabel, "$50")
        XCTAssertEqual(model.tiles[0].value, "3") // booked
        XCTAssertEqual(model.tiles[2].value, "50%") // completion: 1 of (1+1)
        XCTAssertEqual(model.tiles[3].value, "50%") // no-show
        XCTAssertEqual(model.funnel.count, 3)
    }

    func testEmptyWhenNeverBooked() async {
        let model = vm([
            "/api/scheduling/event-types/et1": [.status(200, body: detail)],
            "/api/scheduling/bookings": [.status(200, body: #"{"bookings":[]}"#)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testErrorWhenEventTypeFails() async {
        let model = vm(["/api/scheduling/event-types/et1": [.status(404, body: #"{"error":"NOT_FOUND"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
