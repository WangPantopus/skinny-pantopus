//
//  BookingDetailViewModelTests.swift
//  PantopusTests
//
//  Stream I8 — E2 booking detail view-model. Verifies the detail decode (booking
//  + event type), the status timeline, status-contextual overflow actions
//  (reassign for business), and the no-show guard (NOT_APPLICABLE_YET).
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(
        owner: SchedulingOwner = .personal,
        id: String = "bk1",
        routes: [String: [SequencedURLProtocol.Response]]
    ) -> BookingDetailViewModel {
        let session = SequencedURLProtocol.makeSession(routeResponses: routes)
        let actions = BookingActions(owner: owner, client: SchedulingClient(client: APIClient(session: session, retryPolicy: .none)))
        return BookingDetailViewModel(owner: owner, bookingId: id, push: { _ in }, actions: actions)
    }

    private func detailBody(status: String, hostUserId: String? = nil) -> String {
        let host = hostUserId.map { "\"\($0)\"" } ?? "null"
        return """
        {"booking":{"id":"bk1","owner_type":"business","status":"\(status)","host_user_id":\(host),
        "start_at":"2030-06-18T21:00:00Z","end_at":"2030-06-18T21:30:00Z","invitee_name":"Dana",
        "intake_answers":{"Topic":"Intro"},"created_at":"2030-06-12T16:04:00Z"},
        "attendees":[],"eventType":{"id":"et1","name":"Intro call","location_mode":"video"}}
        """
    }

    func testLoadDecodesDetail() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk1": [.status(200, body: detailBody(status: "confirmed"))]
        ])
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.status, .confirmed)
        XCTAssertEqual(viewModel.eventName, "Intro call")
    }

    func testPendingTimelineHasAwaitingApproval() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk1": [.status(200, body: detailBody(status: "pending"))]
        ])
        await viewModel.load()
        XCTAssertTrue(viewModel.timelineSteps.contains { $0.label == "Awaiting approval" })
    }

    func testBusinessConfirmedOverflowOffersReassign() async {
        let viewModel = makeViewModel(owner: .business(id: "b"), routes: [
            "/api/scheduling/bookings/bk1": [.status(200, body: detailBody(status: "confirmed", hostUserId: "u9"))]
        ])
        await viewModel.load()
        XCTAssertTrue(viewModel.canReassign)
        XCTAssertTrue(viewModel.overflowActions.contains { $0.title == "Reassign" })
    }

    func testMarkNoShowGuardSurfacesMessage() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk1/no-show": [.status(409, body: #"{"error":"NOT_APPLICABLE_YET"}"#)]
        ])
        await viewModel.markNoShow()
        XCTAssertNotNil(viewModel.actionError)
    }

    func testErrorStateOnFailure() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk1": [.status(500, body: #"{"error":"boom"}"#)]
        ])
        await viewModel.load()
        guard case .error = viewModel.phase else {
            return XCTFail("expected .error, got \(viewModel.phase)")
        }
    }
}
