//
//  RosterWaitlistViewModelTests.swift
//  PantopusTests
//
//  E8 Group Roster + E13 Waitlist management · Stream I9.
//

import XCTest
@testable import Pantopus

@MainActor
final class RosterWaitlistViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
    }

    // MARK: E8 Roster

    private let bookingDetailJSON = #"""
    {"booking":{"id":"b1","status":"confirmed","event_type_id":"et1"},
     "attendees":[{"id":"a1","name":"Theo","rsvp_status":"going"},
                  {"id":"a2","name":"Wes","rsvp_status":"pending"}]}
    """#
    private let eventType16JSON = #"{"eventType":{"id":"et1","name":"Group class","slug":"gc","durations":[60],"seat_cap":16}}"#
    private let waitlistOneJSON = #"""
    {"waitlist":[{"id":"w1","event_type_id":"et1","invitee_name":"Rosa","status":"waiting","created_at":"2026-06-11T10:00:00Z"}]}
    """#

    func testRosterLoadComposesSeatsAndWaitlist() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: bookingDetailJSON),
            .status(200, body: eventType16JSON),
            .status(200, body: waitlistOneJSON)
        ]
        let viewModel = GroupRosterViewModel(owner: .business(id: "biz"), bookingId: "b1", push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.filled, 2)
        XCTAssertEqual(viewModel.confirmedCount, 1)
        XCTAssertEqual(viewModel.pendingCount, 1)
        XCTAssertEqual(viewModel.seatTotal, 16)
        XCTAssertEqual(viewModel.waitingCount, 1)
        XCTAssertFalse(viewModel.isFull)
    }

    func testRosterEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"booking":{"id":"b1","status":"confirmed","event_type_id":"et1"},"attendees":[]}"#),
            .status(200, body: eventType16JSON),
            .status(200, body: #"{"waitlist":[]}"#)
        ]
        let viewModel = GroupRosterViewModel(owner: .personal, bookingId: "b1", push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .empty)
    }

    // MARK: E13 Waitlist management

    func testWaitlistLoadBuildsEntries() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"eventType":{"id":"et1","name":"Class","slug":"c","durations":[60],"seat_cap":12}}"#),
            .status(
                200,
                body: #"{"waitlist":[{"id":"w1","status":"waiting"},{"id":"w2","status":"waiting"},{"id":"w3","status":"waiting"}]}"#
            )
        ]
        let viewModel = WaitlistManagementViewModel(owner: .personal, eventTypeId: "et1", push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.seatTotal, 12)
        XCTAssertEqual(viewModel.waitingCount, 3)
    }

    func testWaitlistPromoteRefreshes() async {
        SequencedURLProtocol.sequence = [
            // initial load
            .status(200, body: #"{"eventType":{"id":"et1","name":"Class","slug":"c","durations":[60],"seat_cap":12}}"#),
            .status(200, body: #"{"waitlist":[{"id":"w1","status":"waiting"},{"id":"w2","status":"waiting"}]}"#),
            // promote
            .status(200, body: #"{"ok":true}"#),
            // refresh
            .status(200, body: #"{"eventType":{"id":"et1","name":"Class","slug":"c","durations":[60],"seat_cap":12}}"#),
            .status(200, body: #"{"waitlist":[{"id":"w2","status":"waiting"}]}"#)
        ]
        let viewModel = WaitlistManagementViewModel(owner: .personal, eventTypeId: "et1", push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.waitingCount, 2)
        await viewModel.promote(entryId: "w1")
        XCTAssertNil(viewModel.actionError)
        XCTAssertEqual(viewModel.waitingCount, 1)
    }

    func testWaitlistEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"eventType":{"id":"et1","name":"Class","slug":"c","durations":[60],"seat_cap":12}}"#),
            .status(200, body: #"{"waitlist":[]}"#)
        ]
        let viewModel = WaitlistManagementViewModel(owner: .personal, eventTypeId: "et1", push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .empty)
    }
}
