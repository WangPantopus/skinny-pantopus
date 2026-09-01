//
//  RecurringSetupViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D12 recurring setup. Covers the event-
//  type load, the computed `sessions[]` (count + weekly cadence), the successful
//  book, and the 409 → SlotTakenSheet recovery.
//

import XCTest
@testable import Pantopus

@MainActor
final class RecurringSetupViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> RecurringSetupViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return RecurringSetupViewModel(owner: .personal, eventTypeId: "et1", push: { _ in }, client: client)
    }

    // swiftlint:disable:next line_length
    private let eventTypeJSON = #"{"eventType":{"id":"et1","name":"Intro","slug":"intro","durations":[30],"default_duration":30,"price_cents":4000,"currency":"usd"}}"#

    func testLoadConfigures() async {
        SequencedURLProtocol.sequence = [.status(200, body: eventTypeJSON)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .configuring = viewModel.state else { return XCTFail("expected configuring, got \(viewModel.state)") }
        XCTAssertEqual(viewModel.eventType?.name, "Intro")
    }

    func testSessionsMatchCountAndWeeklyCadence() async {
        SequencedURLProtocol.sequence = [.status(200, body: eventTypeJSON)]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.setCount(4)
        let sessions = viewModel.sessions
        XCTAssertEqual(sessions.count, 4)
        // Each consecutive session is exactly 7 days apart.
        for index in 1..<sessions.count {
            let gap = sessions[index].timeIntervalSince(sessions[index - 1])
            XCTAssertEqual(gap, 7 * 24 * 3600, accuracy: 3600)
        }
        XCTAssertEqual(viewModel.sessionISOs.count, 4)
    }

    func testCountClampsToBounds() async {
        SequencedURLProtocol.sequence = [.status(200, body: eventTypeJSON)]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.setCount(999)
        XCTAssertEqual(viewModel.count, viewModel.maxCount)
        viewModel.setCount(0)
        XCTAssertEqual(viewModel.count, viewModel.minCount)
    }

    func testConfirmSuccessBooks() async {
        let booked = #"{"bookings":[{"id":"b1","status":"confirmed"},{"id":"b2","status":"confirmed"}]}"#
        SequencedURLProtocol.sequence = [.status(200, body: eventTypeJSON), .status(201, body: booked)]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.confirm()
        guard case let .booked(count) = viewModel.state else { return XCTFail("expected booked, got \(viewModel.state)") }
        XCTAssertEqual(count, 2)
    }

    func testConfirmConflictSurfacesRecovery() async {
        // swiftlint:disable:next line_length
        let conflict = #"{"error":"SLOT_CONFLICT","message":"taken","alternatives":[{"start":"2026-07-07T20:00:00Z","end":"2026-07-07T20:30:00Z","startLocal":"2026-07-07T13:00:00"}]}"#
        SequencedURLProtocol.sequence = [.status(200, body: eventTypeJSON), .status(409, body: conflict)]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.confirm()
        XCTAssertNotNil(viewModel.slotConflict)
        guard case .configuring = viewModel.state else { return XCTFail("expected configuring, got \(viewModel.state)") }
    }
}
