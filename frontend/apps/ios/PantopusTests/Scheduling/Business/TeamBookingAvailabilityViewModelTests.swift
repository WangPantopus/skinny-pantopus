//
//  TeamBookingAvailabilityViewModelTests.swift
//  PantopusTests
//
//  G3 · Stream I13. Verifies the roster fold (business members × team-availability
//  free grids), derived bookability/coverage, business-only + empty + gated
//  states. Route-keyed stubs keep the concurrent load deterministic.
//

import XCTest
@testable import Pantopus

@MainActor
final class TeamBookingAvailabilityViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func client(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingClient {
        SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none))
    }

    private func vm(
        owner: SchedulingOwner = .business(id: "biz1"),
        _ routes: [String: [SequencedURLProtocol.Response]]
    ) -> TeamBookingAvailabilityViewModel {
        TeamBookingAvailabilityViewModel(owner: owner, tz: "America/Los_Angeles", push: { _ in }, client: client(routes))
    }

    // swiftlint:disable:next line_length
    private let members = #"{"members":[{"id":"m1","role_base":"owner","title":"Owner","user":{"id":"u1","name":"Dana Reyes","username":"dana"}},{"id":"m2","role_base":"staff","title":"Stylist","user":{"id":"u2","name":"Marcus Lee","username":"marcus"}}]}"#
    private let ownerAccess = #"{"hasAccess":true,"isOwner":true,"role_base":"owner","permissions":["team.manage"]}"#
    private let noTypes = #"{"eventTypes":[]}"#

    /// u1 has openings this week; u2 has none.
    private func freeBody() -> String {
        let today = ISO8601DateFormatter().string(from: Date())
        // swiftlint:disable:next line_length
        return "{\"members\":[\"u1\",\"u2\"],\"freeByMember\":{\"u1\":[{\"start\":\"\(today)\",\"end\":\"\(today)\",\"startLocal\":\"\(today)\"}],\"u2\":[]}}"
    }

    func testLoadedRosterDerivesBookability() async {
        let model = vm([
            "/api/businesses/biz1/members": [.status(200, body: members)],
            "/api/scheduling/team-availability": [.status(200, body: freeBody())],
            "/api/businesses/biz1/me": [.status(200, body: ownerAccess)],
            "/api/scheduling/event-types": [.status(200, body: noTypes)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.rows.count, 2)
        let dana = model.rows.first { $0.name == "Dana Reyes" }
        let marcus = model.rows.first { $0.name == "Marcus Lee" }
        XCTAssertEqual(dana?.bookable, true)
        XCTAssertEqual(marcus?.bookable, false)
        XCTAssertEqual(marcus?.summary, "Not taking bookings")
        XCTAssertFalse(model.isGated)
    }

    func testBusinessOnlyForPersonalOwner() async {
        let model = vm(owner: .personal, [:])
        await model.load()
        XCTAssertEqual(model.phase, .businessOnly)
    }

    func testEmptyWhenNoMembers() async {
        let model = vm([
            "/api/businesses/biz1/members": [.status(200, body: #"{"members":[]}"#)],
            "/api/scheduling/team-availability": [.status(200, body: #"{"members":[],"freeByMember":{}}"#)],
            "/api/businesses/biz1/me": [.status(200, body: ownerAccess)],
            "/api/scheduling/event-types": [.status(200, body: noTypes)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testGatedWhenNoManagePermission() async {
        let access = #"{"hasAccess":true,"isOwner":false,"role_base":"staff","permissions":["team.view"]}"#
        let model = vm([
            "/api/businesses/biz1/members": [.status(200, body: members)],
            "/api/scheduling/team-availability": [.status(200, body: freeBody())],
            "/api/businesses/biz1/me": [.status(200, body: access)],
            "/api/scheduling/event-types": [.status(200, body: noTypes)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertTrue(model.isGated)
    }

    func testErrorWhenMembersFail() async {
        let model = vm(["/api/businesses/biz1/members": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
