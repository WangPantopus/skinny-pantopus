//
//  InviteeManageBookingViewModelTests.swift
//  PantopusTests
//
//  Stream I6 — D4 Manage Booking view-model. Drives `GET /api/public/booking/
//  :token` + `POST …/cancel` with stubbed bodies and asserts the action-flag
//  computation, the token-expired state, cancel → refetch, and the policy-blocked
//  routing when the change window is closed.
//

import XCTest
@testable import Pantopus

@MainActor
final class InviteeManageBookingViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(pushed: @escaping @MainActor (SchedulingRoute) -> Void = { _ in }) -> InviteeManageBookingViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return InviteeManageBookingViewModel(token: "mt_abc123", push: pushed, client: client)
    }

    // swiftlint:disable line_length
    private func body(status: String, canAct: Bool) -> String {
        """
        {"booking":{"id":"b1","status":"\(
            status
        )","start_at":"2026-09-17T16:30:00Z","end_at":"2026-09-17T17:00:00Z","invitee_name":"Maya Chen","invitee_timezone":"America/Los_Angeles","location_mode":"video"},
        "actions":{"can_cancel":\(canAct),"can_reschedule":\(canAct)},
        "eventType":{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video","cancellation_window_min":1440},
        "page":{"slug":"ada","title":"Maria Kessler","owner_type":"user","timezone":"America/Los_Angeles"}}
        """
    }

    // swiftlint:enable line_length

    func testConfirmedWithActionsAllowsRescheduleAndCancel() async {
        SequencedURLProtocol.sequence = [.status(200, body: body(status: "confirmed", canAct: true))]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .loaded)
        XCTAssertEqual(viewModel.lifecycle, .confirmed)
        XCTAssertTrue(viewModel.canReschedule)
        XCTAssertTrue(viewModel.canCancel)
        XCTAssertFalse(viewModel.windowClosed)
    }

    func testWindowClosedWhenActionsDisallowed() async {
        SequencedURLProtocol.sequence = [.status(200, body: body(status: "confirmed", canAct: false))]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertTrue(viewModel.windowClosed)
        XCTAssertFalse(viewModel.canReschedule)
    }

    func testWindowClosedRescheduleTapRoutesToPolicyBlocked() async {
        var pushed: [SchedulingRoute] = []
        SequencedURLProtocol.sequence = [.status(200, body: body(status: "confirmed", canAct: false))]
        let viewModel = makeViewModel { pushed.append($0) }
        await viewModel.load()
        viewModel.tapReschedule()
        XCTAssertEqual(pushed, [.inviteePolicyBlocked(token: "mt_abc123")])
        XCTAssertFalse(viewModel.showReschedule)
    }

    func testTokenExpiredShowsExpiredState() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND","message":"expired"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .expired)
    }

    func testCancelPostsThenRefetchesCancelled() async {
        let confirmed = body(status: "confirmed", canAct: true)
        let cancelResult = #"{"booking":{"id":"b1","status":"cancelled"}}"#
        let cancelledManage = body(status: "cancelled", canAct: false)
        SequencedURLProtocol.sequence = [
            .status(200, body: confirmed), // load
            .status(200, body: cancelResult), // POST cancel
            .status(200, body: cancelledManage) // refetch
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.cancel(reason: "Conflict came up")
        XCTAssertEqual(viewModel.lifecycle, .cancelled)
        XCTAssertFalse(viewModel.showCancelSheet)
    }
}
