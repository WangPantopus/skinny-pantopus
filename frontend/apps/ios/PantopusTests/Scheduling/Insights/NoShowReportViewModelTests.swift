//
//  NoShowReportViewModelTests.swift
//  PantopusTests
//
//  H11 · Stream I17. Loaded / celebratory / error against the deployed
//  `/insights/no-shows` shape, plus recent-row + repeat-offender projection.
//

import XCTest
@testable import Pantopus

@MainActor
final class NoShowReportViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> NoShowReportViewModel {
        NoShowReportViewModel(
            owner: .personal,
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    private let eventTypes = #"{"eventTypes":[{"id":"et1","name":"Intro call","slug":"intro","durations":[30]}]}"#

    func testLoadedBuildsHeaderBreakdownAndRecent() async {
        let body = #"""
        {"window_days":30,"completed":18,"no_show":2,"cancelled":4,"no_show_rate":10,
         "recent_no_shows":[
           {"id":"b1","start_at":"2026-06-10T17:00:00Z","status":"no_show","invitee_name":"Sam Lee","event_type_id":"et1"},
           {"id":"b2","start_at":"2026-06-09T17:00:00Z","status":"no_show","invitee_name":"Sam Lee","event_type_id":"et1"}
         ]}
        """#
        let model = vm([
            "/api/scheduling/insights/no-shows": [.status(200, body: body)],
            "/api/scheduling/event-types": [.status(200, body: eventTypes)]
        ])
        await model.load()

        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.noShowRateLabel, "10%")
        XCTAssertEqual(model.totalConsidered, 24)
        XCTAssertEqual(model.segments.first { $0.kind == .honored }?.count, 18)
        XCTAssertEqual(model.recentRows.count, 2)
        // Repeat invitee gets flagged; event-type name is joined.
        XCTAssertTrue(model.recentRows.allSatisfy(\.isRepeat))
        XCTAssertTrue(model.recentRows.first?.detail.contains("Intro call") ?? false)
    }

    func testCelebratoryWhenZeroNoShows() async {
        let model = vm([
            "/api/scheduling/insights/no-shows": [
                .status(
                    200,
                    body: #"{"window_days":30,"completed":12,"no_show":0,"cancelled":1,"no_show_rate":0,"recent_no_shows":[]}"#
                )
            ],
            "/api/scheduling/event-types": [.status(200, body: eventTypes)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .celebratory)
    }

    func testErrorWhenReportFails() async {
        let model = vm(["/api/scheduling/insights/no-shows": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
