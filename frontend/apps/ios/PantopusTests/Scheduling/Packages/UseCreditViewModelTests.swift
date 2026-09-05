//
//  UseCreditViewModelTests.swift
//  PantopusTests
//
//  G11 apply-credit flow · Stream I15. Eligible-booking filtering and the
//  apply-credit success / ALREADY_APPLIED conflict handling.
//

import XCTest
@testable import Pantopus

@MainActor
final class UseCreditViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func credit() -> PackageCreditDTO {
        // swiftlint:disable:next line_length
        let raw = #"{"id":"cr1","package_id":"pk1","buyer_user_id":"u1","remaining_sessions":2,"purchased_at":"2026-05-01T00:00:00Z","BookingPackage":{"name":"5-session cleaning","sessions_count":5,"owner_type":"business","owner_id":"biz1","event_type_id":"et1"}}"#
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(PackageCreditDTO.self, from: Data(raw.utf8))
    }

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> UseCreditViewModel {
        UseCreditViewModel(
            credit: credit(),
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    private let bookings = #"""
    {"bookings":[
      {"id":"bk1","status":"confirmed","event_type_id":"et1","start_at":"2099-01-01T10:00:00Z"},
      {"id":"bk2","status":"cancelled","event_type_id":"et1","start_at":"2099-01-02T10:00:00Z"},
      {"id":"bk3","status":"confirmed","event_type_id":"et2","start_at":"2099-01-03T10:00:00Z"},
      {"id":"bk4","status":"confirmed","event_type_id":"et1","package_credit_id":"x","start_at":"2099-01-04T10:00:00Z"}
    ]}
    """#

    func testEligibleFiltering() async {
        let model = vm(["/api/scheduling/my-bookings": [.status(200, body: bookings)]])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.bookings.map(\.id), ["bk1"])
    }

    func testEmptyWhenNoEligibleBookings() async {
        let model = vm(["/api/scheduling/my-bookings": [.status(200, body: #"{"bookings":[]}"#)]])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testApplySuccessCallsOnApplied() async {
        let model = vm([
            "/api/scheduling/my-bookings": [.status(200, body: bookings)],
            "/api/scheduling/bookings/bk1/apply-credit": [.status(200, body: #"{"ok":true,"remaining":1}"#)]
        ])
        await model.load()
        var applied = false
        await model.apply(model.bookings[0]) { applied = true }
        XCTAssertTrue(applied)
        XCTAssertNil(model.conflictMessage)
    }

    func testApplyAlreadyAppliedSurfacesConflict() async {
        let model = vm([
            "/api/scheduling/my-bookings": [.status(200, body: bookings)],
            "/api/scheduling/bookings/bk1/apply-credit": [.status(409, body: #"{"error":"ALREADY_APPLIED","message":"already"}"#)]
        ])
        await model.load()
        var applied = false
        await model.apply(model.bookings[0]) { applied = true }
        XCTAssertFalse(applied)
        XCTAssertNotNil(model.conflictMessage)
    }

    func testApplyNotApplicableSurfacesConflict() async {
        let model = vm([
            "/api/scheduling/my-bookings": [.status(200, body: bookings)],
            "/api/scheduling/bookings/bk1/apply-credit": [.status(409, body: #"{"error":"CREDIT_NOT_APPLICABLE","message":"nope"}"#)]
        ])
        await model.load()
        await model.apply(model.bookings[0]) {}
        XCTAssertEqual(model.conflictMessage, "This credit can't be used on that booking.")
    }
}
