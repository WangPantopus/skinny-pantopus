//
//  ManualBookingViewModelTests.swift
//  PantopusTests
//
//  E12 Manual / On-Behalf Booking · Stream I9.
//

import XCTest
@testable import Pantopus

@MainActor
final class ManualBookingViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeVM() -> ManualBookingViewModel {
        ManualBookingViewModel(
            owner: .business(id: "biz"),
            push: { _ in },
            client: SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        )
    }

    func testLoadEventTypesEnablesContinue() async {
        SequencedURLProtocol.sequence = [
            .status(
                200,
                // swiftlint:disable:next line_length
                body: #"{"eventTypes":[{"id":"et1","name":"Discovery call","slug":"discovery","durations":[30],"default_duration":30,"location_mode":"video","is_active":true}]}"#
            )
        ]
        let viewModel = makeVM()
        await viewModel.load()
        XCTAssertEqual(viewModel.eventTypesPhase, .loaded)
        XCTAssertEqual(viewModel.eventTypes.count, 1)
        XCTAssertFalse(viewModel.chrome.primaryCTAEnabled)
        viewModel.selectedEventTypeId = "et1"
        XCTAssertTrue(viewModel.chrome.primaryCTAEnabled)
    }

    func testCreateSuccessAdvancesToCreated() async {
        SequencedURLProtocol.sequence = [.status(201, body: #"{"booking":{"id":"bk1","status":"pending"}}"#)]
        let viewModel = makeVM()
        viewModel.selectedEventTypeId = "et1"
        viewModel.selectedSlotStart = "2026-06-14T17:00:00Z"
        viewModel.inviteeName = "Dana"
        await viewModel.bookAnyway() // skips the advisory overlap pre-check
        XCTAssertEqual(viewModel.step, .created)
        XCTAssertEqual(viewModel.createdBookingId, "bk1")
        XCTAssertNil(viewModel.createError)
    }

    func testCreateConflictShowsSlotTaken() async {
        // swiftlint:disable:next line_length
        let conflictBody = #"{"error":"SLOT_TAKEN","message":"Just taken","alternatives":[{"start":"2026-06-14T18:00:00Z","end":"2026-06-14T18:30:00Z","startLocal":"2026-06-14T11:00:00"}]}"#
        SequencedURLProtocol.sequence = [
            .status(409, body: conflictBody)
        ]
        let viewModel = makeVM()
        viewModel.selectedEventTypeId = "et1"
        viewModel.selectedSlotStart = "2026-06-14T17:00:00Z"
        await viewModel.bookAnyway()
        XCTAssertTrue(viewModel.showSlotTaken)
        XCTAssertEqual(viewModel.slotConflictAlternatives.count, 1)
        XCTAssertNotEqual(viewModel.step, .created)
    }

    func testDetailsValidationRequiresName() {
        let viewModel = makeVM()
        XCTAssertFalse(viewModel.isDetailsValid)
        viewModel.inviteeName = "Dana Whitfield"
        XCTAssertTrue(viewModel.isDetailsValid)
    }
}
