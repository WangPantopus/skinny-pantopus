//
//  NoAvailabilityViewModelTests.swift
//  PantopusTests
//
//  Stream I5 — C8 No-Availability view-model. Verifies the calm "no times"
//  state, the "times found" hand-off state, and that `status:'paused'` stays a
//  calm state rather than an error.
//

import XCTest
@testable import Pantopus

@MainActor
final class NoAvailabilityViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> NoAvailabilityViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return NoAvailabilityViewModel(slug: "ada", eventTypeSlug: "intro", tz: "America/New_York", push: { _ in }, client: client)
    }

    private func slotsBody(slots: String, status: String = "active") -> String {
        """
        {"eventType":{"id":"et1","name":"Intro","slug":"intro"},"timezone":"America/New_York","status":"\(status)","slots":[\(slots)]}
        """
    }

    func testNoTimesState() async {
        SequencedURLProtocol.sequence = [.status(200, body: slotsBody(slots: ""))]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .noTimes = viewModel.state else {
            return XCTFail("expected .noTimes, got \(viewModel.state)")
        }
    }

    func testFoundState() async {
        let slot = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T12:00:00"}"#
        SequencedURLProtocol.sequence = [.status(200, body: slotsBody(slots: slot))]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .found = viewModel.state else {
            return XCTFail("expected .found, got \(viewModel.state)")
        }
    }

    func testPausedStaysCalm() async {
        SequencedURLProtocol.sequence = [.status(200, body: slotsBody(slots: "", status: "paused"))]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .paused)
    }
}
