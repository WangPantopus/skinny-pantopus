//
//  InviteeConfirmedViewModelTests.swift
//  PantopusTests
//
//  Stream I6 — D3 Confirmed view-model. Drives `GET /api/public/booking/:token`
//  with stubbed 200 (confirmed / pending) / 404 bodies and asserts the success vs
//  pending hero state and the manage hand-off.
//

import XCTest
@testable import Pantopus

@MainActor
final class InviteeConfirmedViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(pushed: @escaping @MainActor (SchedulingRoute) -> Void = { _ in }) -> InviteeConfirmedViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return InviteeConfirmedViewModel(manageToken: "mt_abc123", push: pushed, client: client)
    }

    private func body(status: String) -> String {
        // swiftlint:disable line_length
        """
        {"booking":{"id":"b1","status":"\(
            status
        )","start_at":"2026-06-17T16:30:00Z","end_at":"2026-06-17T17:00:00Z","invitee_timezone":"America/Los_Angeles","location_mode":"video"},
        "actions":{"can_cancel":true,"can_reschedule":true},
        "eventType":{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video"},
        "page":{"slug":"ada","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"}}
        """
        // swiftlint:enable line_length
    }

    func testConfirmedBookingLoadsSuccessHero() async {
        SequencedURLProtocol.sequence = [.status(200, body: body(status: "confirmed"))]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .loaded)
        XCTAssertFalse(viewModel.isPending)
        XCTAssertEqual(viewModel.heroTitle, "You're booked")
        XCTAssertEqual(viewModel.summary.eventName, "Intro call")
    }

    func testPendingBookingShowsRequestSent() async {
        SequencedURLProtocol.sequence = [.status(200, body: body(status: "pending"))]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertTrue(viewModel.isPending)
        XCTAssertEqual(viewModel.heroTitle, "Request sent")
    }

    func testNotFoundShowsError() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND","message":"invalid"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .error = viewModel.state else {
            return XCTFail("expected .error, got \(viewModel.state)")
        }
    }

    func testOpenManagePushesManageRoute() async {
        var pushed: [SchedulingRoute] = []
        SequencedURLProtocol.sequence = [.status(200, body: body(status: "confirmed"))]
        let viewModel = makeViewModel { pushed.append($0) }
        await viewModel.load()
        viewModel.openManage()
        XCTAssertEqual(pushed, [.inviteeManageBooking(token: "mt_abc123")])
    }
}
