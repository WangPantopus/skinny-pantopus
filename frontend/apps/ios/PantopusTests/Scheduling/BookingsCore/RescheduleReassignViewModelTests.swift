//
//  RescheduleReassignViewModelTests.swift
//  PantopusTests
//
//  Stream I8 — E4 reschedule/reassign view-model. Verifies available-slots always
//  passes `tz`/`from`/`to`, propose vs reschedule-now hit the right endpoints, a
//  409 SLOT_CONFLICT routes into the SlotTakenSheet (alternatives), and
//  PAST_DEADLINE surfaces inline (no dead end).
//

import XCTest
@testable import Pantopus

@MainActor
final class RescheduleReassignViewModelTests: XCTestCase {
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
        routes: [String: [SequencedURLProtocol.Response]]
    ) -> RescheduleReassignViewModel {
        let session = SequencedURLProtocol.makeSession(routeResponses: routes)
        let actions = BookingActions(owner: owner, client: SchedulingClient(client: APIClient(session: session, retryPolicy: .none)))
        return RescheduleReassignViewModel(
            owner: owner,
            booking: .preview(status: "confirmed"),
            actions: actions,
            tz: "America/Los_Angeles"
        )
    }

    private func captured(_ contains: String) -> URLRequest? {
        SequencedURLProtocol.capturedRequests.first { ($0.url?.absoluteString ?? "").contains(contains) }
    }

    func testLoadFetchesSlotsAndAlwaysPassesTz() async {
        let slots = #"{"slots":[{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T09:00:00"}]}"#
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk_preview/available-slots": [.status(200, body: slots)]
        ])
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertFalse(viewModel.availableDays.isEmpty)
        let query = captured("/available-slots")?.url?.query ?? ""
        XCTAssertTrue(query.contains("tz="), "tz must always be passed — \(query)")
        XCTAssertTrue(query.contains("from="), "from — \(query)")
        XCTAssertTrue(query.contains("to="), "to — \(query)")
    }

    func testProposeModeHitsProposeEndpoint() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk_preview/propose-reschedule": [
                .status(200, body: #"{"booking":{"id":"bk_preview","status":"pending"}}"#)
            ]
        ])
        viewModel.selectSlot(SlotDTO(start: "2030-07-01T16:00:00Z", end: "2030-07-01T16:30:00Z"))
        viewModel.mode = .propose
        await viewModel.submit()
        XCTAssertTrue(viewModel.proposalSent)
        XCTAssertNotNil(captured("/propose-reschedule"))
    }

    func testRescheduleNowConflictOpensSlotTaken() async {
        let alt = #"{"start":"2030-07-02T16:00:00Z","end":"2030-07-02T16:30:00Z"}"#
        let body = #"{"error":"SLOT_CONFLICT","alternatives":[\#(alt)]}"#
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk_preview/reschedule": [.status(409, body: body)]
        ])
        viewModel.selectSlot(SlotDTO(start: "2030-07-01T16:00:00Z", end: "2030-07-01T16:30:00Z"))
        viewModel.mode = .now
        await viewModel.submit()
        XCTAssertTrue(viewModel.showSlotTaken, "a 409 conflict must surface the SlotTakenSheet, never a dead end")
        XCTAssertEqual(viewModel.conflictAlternatives.count, 1)
        XCTAssertNil(viewModel.error)
    }

    func testReschedulePastDeadlineSurfacesInline() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk_preview/reschedule": [.status(409, body: #"{"error":"PAST_DEADLINE"}"#)]
        ])
        viewModel.selectSlot(SlotDTO(start: "2030-07-01T16:00:00Z", end: "2030-07-01T16:30:00Z"))
        viewModel.mode = .now
        await viewModel.submit()
        XCTAssertFalse(viewModel.showSlotTaken)
        XCTAssertNotNil(viewModel.error)
    }

    func testChooseAlternativeResubmits() async {
        let viewModel = makeViewModel(routes: [
            "/api/scheduling/bookings/bk_preview/reschedule": [
                .status(200, body: #"{"booking":{"id":"bk_preview","status":"confirmed"}}"#)
            ]
        ])
        viewModel.mode = .now
        await viewModel.chooseAlternative(
            SchedulingSlotAlternative(start: "2030-07-02T16:00:00Z", end: "2030-07-02T16:30:00Z", startLocal: nil)
        )
        XCTAssertFalse(viewModel.showSlotTaken)
        XCTAssertNil(viewModel.error)
    }
}
