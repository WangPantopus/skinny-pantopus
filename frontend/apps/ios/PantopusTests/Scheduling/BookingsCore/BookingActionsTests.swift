//
//  BookingActionsTests.swift
//  PantopusTests
//
//  Stream I8 — the owner-scoped booking service. Verifies the status/search
//  query, owner context (personal omit / business owner_type+owner_id / home
//  alias path), the `tz`/`from`/`to` on available-slots, the `{ booking }`
//  envelope decode, and 409 conflict → typed `SchedulingError`.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingActionsTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeActions(owner: SchedulingOwner = .personal, routes: [String: [SequencedURLProtocol.Response]]) -> BookingActions {
        let session = SequencedURLProtocol.makeSession(routeResponses: routes)
        return BookingActions(owner: owner, client: SchedulingClient(client: APIClient(session: session, retryPolicy: .none)))
    }

    private func captured(_ contains: String) -> URLRequest? {
        SequencedURLProtocol.capturedRequests.first { ($0.url?.absoluteString ?? "").contains(contains) }
    }

    // MARK: - List

    func testListBuildsStatusAndSearchQuery() async throws {
        let actions = makeActions(routes: [
            "/api/scheduling/bookings": [.status(200, body: #"{"bookings":[{"id":"b1","status":"confirmed"}]}"#)]
        ])
        let result = try await actions.list(status: .upcoming, search: "dana")
        XCTAssertEqual(result.first?.id, "b1")
        let query = captured("/bookings")?.url?.query ?? ""
        XCTAssertTrue(query.contains("status=upcoming"), "status filter must be on the wire — \(query)")
        XCTAssertTrue(query.contains("q=dana"), "search maps to q — \(query)")
    }

    func testListBusinessOwnerSendsOwnerContext() async throws {
        let actions = makeActions(owner: .business(id: "biz1"), routes: [
            "/api/scheduling/bookings": [.status(200, body: #"{"bookings":[]}"#)]
        ])
        _ = try await actions.list(status: .pending, search: nil)
        let query = captured("/bookings")?.url?.query ?? ""
        XCTAssertTrue(query.contains("owner_type=business"), "business owner_type — \(query)")
        XCTAssertTrue(query.contains("owner_id=biz1"), "business owner_id — \(query)")
    }

    func testListHomeOwnerUsesAliasPath() async throws {
        let actions = makeActions(owner: .home(homeId: "home9"), routes: [
            "/api/homes/home9/scheduling/bookings": [.status(200, body: #"{"bookings":[]}"#)]
        ])
        _ = try await actions.list(status: .upcoming, search: nil)
        XCTAssertNotNil(captured("/api/homes/home9/scheduling/bookings"), "home uses the per-home alias path")
    }

    // MARK: - Mutations

    func testApproveDecodesBookingEnvelope() async throws {
        let actions = makeActions(routes: [
            "/api/scheduling/bookings/b1/approve": [.status(200, body: #"{"booking":{"id":"b1","status":"confirmed"}}"#)]
        ])
        let booking = try await actions.approve(id: "b1")
        XCTAssertEqual(booking.status, "confirmed")
    }

    func testCancelSurfacesRefundIssued() async throws {
        let actions = makeActions(routes: [
            "/api/scheduling/bookings/b1/cancel": [
                .status(200, body: #"{"booking":{"id":"b1","status":"cancelled","refund_issued":true}}"#)
            ]
        ])
        let booking = try await actions.cancel(id: "b1", reason: "host")
        XCTAssertEqual(booking.status, "cancelled")
        XCTAssertEqual(booking.refundIssued, true)
    }

    func testRescheduleSlotConflictThrowsAlternatives() async {
        let alt = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z"}"#
        let body = #"{"error":"SLOT_CONFLICT","alternatives":[\#(alt)]}"#
        let actions = makeActions(routes: [
            "/api/scheduling/bookings/b1/reschedule": [.status(409, body: body)]
        ])
        do {
            _ = try await actions.reschedule(id: "b1", startAt: "2030-07-01T16:00:00Z")
            XCTFail("expected a 409 slot conflict")
        } catch let error as SchedulingError {
            guard case let .slotConflict(_, _, alternatives) = error else {
                return XCTFail("expected .slotConflict, got \(error)")
            }
            XCTAssertEqual(alternatives.count, 1)
            XCTAssertEqual(alternatives.first?.start, "2030-07-01T16:00:00Z")
        } catch {
            XCTFail("unexpected error \(error)")
        }
    }

    func testReassignInvalidHostThrowsConflict() async {
        let actions = makeActions(owner: .business(id: "b"), routes: [
            "/api/scheduling/bookings/b1/reassign": [.status(409, body: #"{"error":"INVALID_HOST","message":"not a member"}"#)]
        ])
        do {
            _ = try await actions.reassign(id: "b1", hostUserId: "u9")
            XCTFail("expected INVALID_HOST")
        } catch let error as SchedulingError {
            XCTAssertEqual(error.code, "INVALID_HOST")
        } catch {
            XCTFail("unexpected error \(error)")
        }
    }

    func testAvailableSlotsPassesTzFromTo() async throws {
        let slot = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","eligibleHosts":["u1"]}"#
        let actions = makeActions(routes: [
            "/api/scheduling/bookings/b1/available-slots": [.status(200, body: #"{"slots":[\#(slot)]}"#)]
        ])
        let slots = try await actions.availableSlots(id: "b1", from: "2030-07-01", to: "2030-07-31", tz: "America/Los_Angeles")
        XCTAssertEqual(slots.first?.eligibleHosts, ["u1"])
        let query = captured("/available-slots")?.url?.query ?? ""
        XCTAssertTrue(query.contains("tz="), "tz must always be passed — \(query)")
        XCTAssertTrue(query.contains("from=2030-07-01"), "from — \(query)")
        XCTAssertTrue(query.contains("to=2030-07-31"), "to — \(query)")
    }

    func testEventTypeNamesMapsIdToName() async throws {
        let actions = makeActions(routes: [
            "/api/scheduling/event-types": [
                .status(200, body: #"{"eventTypes":[{"id":"et1","name":"Intro call","slug":"intro","durations":[30]}]}"#)
            ]
        ])
        let names = try await actions.eventTypeNames()
        XCTAssertEqual(names["et1"], "Intro call")
    }
}
