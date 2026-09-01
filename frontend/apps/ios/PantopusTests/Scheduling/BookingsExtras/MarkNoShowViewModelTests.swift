//
//  MarkNoShowViewModelTests.swift
//  PantopusTests
//
//  E6 · Stream I9. Drives MarkNoShowViewModel against stubbed responses.
//

import XCTest
@testable import Pantopus

@MainActor
final class MarkNoShowViewModelTests: XCTestCase {
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

    func testConfirmSuccessReturnsTrue() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"booking":{"id":"b1","status":"no_show"}}"#)]
        let viewModel = MarkNoShowViewModel(
            owner: .personal,
            targets: [NoShowTarget(bookingId: "b1", name: "Mara Reyes")],
            client: makeClient()
        )
        let success = await viewModel.confirm()
        XCTAssertTrue(success)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isSubmitting)
    }

    func testNotApplicableYetSurfacesFriendlyMessage() async {
        SequencedURLProtocol.sequence = [.status(409, body: #"{"error":"NOT_APPLICABLE_YET","message":"Too early"}"#)]
        let viewModel = MarkNoShowViewModel(
            owner: .personal,
            targets: [NoShowTarget(bookingId: "b1", name: "Mara")],
            client: makeClient()
        )
        let success = await viewModel.confirm()
        XCTAssertFalse(success)
        XCTAssertEqual(viewModel.errorMessage, "You can mark a no-show only after the booking's start time.")
    }

    func testGroupSelectionDrivesConfirmTitle() {
        let viewModel = MarkNoShowViewModel(
            owner: .business(id: "biz"),
            targets: [
                NoShowTarget(bookingId: "b1", name: "Jordan Liu"),
                NoShowTarget(bookingId: "b2", name: "Sam Nguyen"),
                NoShowTarget(bookingId: "b3", name: "Bea Dunn")
            ],
            client: makeClient()
        )
        XCTAssertTrue(viewModel.isGroup)
        XCTAssertEqual(viewModel.confirmTitle, "Mark 3 as no-show")
        viewModel.toggle("b3")
        XCTAssertEqual(viewModel.selectedIds.count, 2)
        XCTAssertEqual(viewModel.confirmTitle, "Mark 2 as no-show")
    }

    func testCannotConfirmWithNoSelection() {
        let viewModel = MarkNoShowViewModel(
            owner: .personal,
            targets: [NoShowTarget(bookingId: "b1", name: "A"), NoShowTarget(bookingId: "b2", name: "B")],
            client: makeClient()
        )
        viewModel.toggle("b1")
        viewModel.toggle("b2")
        XCTAssertTrue(viewModel.selectedIds.isEmpty)
        XCTAssertFalse(viewModel.canConfirm)
    }
}
