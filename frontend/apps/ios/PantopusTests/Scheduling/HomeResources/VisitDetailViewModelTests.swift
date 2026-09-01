//
//  VisitDetailViewModelTests.swift
//  PantopusTests
//
//  Stream I12 — F14 visit detail: time-derived lifecycle + removed state.
//

import XCTest
@testable import Pantopus

@MainActor
final class VisitDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        ))
    }

    // swiftlint:disable:next line_length
    private static let occupants = #"{"occupants":[{"id":"o1","user_id":"u1","role":"member","is_active":true,"display_name":"Dad"}],"pendingInvites":[]}"#

    private static func eventBody(start: String, end: String) -> String {
        #"""
        {"event":{"id":"e1","home_id":"h1","event_type":"vendor","title":"Plumber visit",
         "start_at":"\#(start)","end_at":"\#(end)","assigned_to":["u1"],"location_notes":"Front door code 4827"},
         "attendees":[]}
        """#
    }

    func testUpcomingVisitIsConfirmed() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.eventBody(start: "2099-01-01T10:00:00Z", end: "2099-01-01T11:00:00Z")),
            .status(200, body: Self.occupants)
        ]
        let viewModel = VisitDetailViewModel(homeId: "h1", eventId: "e1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .loaded = viewModel.state else {
            return XCTFail("Expected .loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(viewModel.lifecycle, .confirmed)
        XCTAssertEqual(viewModel.title, "Plumber visit")
        XCTAssertEqual(viewModel.kind, .vendor)
        XCTAssertEqual(viewModel.entryNote, "Front door code 4827")
        XCTAssertEqual(viewModel.hostSummary, "Dad must be home")
    }

    func testPastVisitIsDone() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.eventBody(start: "2000-01-01T10:00:00Z", end: "2000-01-01T11:00:00Z")),
            .status(200, body: Self.occupants)
        ]
        let viewModel = VisitDetailViewModel(homeId: "h1", eventId: "e1", push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.lifecycle, .done)
    }

    func testNotFoundProducesRemoved() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"Event not found"}"#)]
        let viewModel = VisitDetailViewModel(homeId: "h1", eventId: "e1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .removed = viewModel.state else {
            return XCTFail("Expected .removed, got \(viewModel.state)")
        }
    }
}
