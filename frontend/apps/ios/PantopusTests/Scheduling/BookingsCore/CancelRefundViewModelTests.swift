//
//  CancelRefundViewModelTests.swift
//  PantopusTests
//
//  Stream I8 — E5 cancel/refund view-model. Verifies cancel surfaces
//  `refund_issued`, REFUND_FAILED flips the retry affordance, an already-
//  cancelled booking renders the read-only frame, and the paid refund surface is
//  gated behind the paid flag.
//

import XCTest
@testable import Pantopus

@MainActor
final class CancelRefundViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(booking: BookingDTO, routes: [String: [SequencedURLProtocol.Response]]) -> CancelRefundViewModel {
        let session = SequencedURLProtocol.makeSession(routeResponses: routes)
        let actions = BookingActions(owner: .personal, client: SchedulingClient(client: APIClient(session: session, retryPolicy: .none)))
        return CancelRefundViewModel(owner: .personal, booking: booking, eventName: "Intro call", actions: actions)
    }

    func testCancelSurfacesRefundIssued() async {
        let viewModel = makeViewModel(
            booking: .preview(status: "confirmed"),
            routes: [
                "/api/scheduling/bookings/bk_preview/cancel": [
                    .status(200, body: #"{"booking":{"id":"bk_preview","status":"cancelled","refund_issued":true}}"#)
                ]
            ]
        )
        await viewModel.cancel()
        XCTAssertTrue(viewModel.succeeded)
        XCTAssertEqual(viewModel.refundIssued, true)
    }

    func testRefundFailedFlipsRetry() async {
        let viewModel = makeViewModel(
            booking: .preview(status: "confirmed", paymentId: "pay1"),
            routes: [
                "/api/scheduling/bookings/bk_preview/cancel": [.status(409, body: #"{"error":"REFUND_FAILED"}"#)]
            ]
        )
        await viewModel.cancel()
        XCTAssertFalse(viewModel.succeeded)
        XCTAssertEqual(viewModel.confirmTitle, "Retry refund")
        XCTAssertNotNil(viewModel.error)
    }

    func testAlreadyCancelledIsReadOnly() {
        let viewModel = makeViewModel(booking: .preview(status: "cancelled"), routes: [:])
        XCTAssertTrue(viewModel.alreadyCancelled)
    }

    func testUnpaidBookingHidesRefundSurface() {
        // Paid flag default OFF → even a payment id shouldn't expose the refund UI.
        let viewModel = makeViewModel(booking: .preview(status: "confirmed", paymentId: "pay1"), routes: [:])
        XCTAssertFalse(viewModel.isPaid, "paid surfaces stay behind the paid feature flag")
    }
}
