//
//  TeamPerformanceViewModelTests.swift
//  PantopusTests
//
//  H12 · Stream I17. business-only / loaded / empty / permission-gated / sort
//  against the deployed `/insights/team` shape + member-name resolution.
//

import XCTest
@testable import Pantopus

@MainActor
final class TeamPerformanceViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func vm(
        owner: SchedulingOwner = .business(id: "biz1"),
        _ routes: [String: [SequencedURLProtocol.Response]]
    ) -> TeamPerformanceViewModel {
        TeamPerformanceViewModel(
            owner: owner,
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    // swiftlint:disable:next line_length
    private let members = #"{"members":[{"id":"m1","role_base":"owner","user":{"id":"u1","name":"Dana Reyes","username":"dana"}},{"id":"m2","role_base":"staff","user":{"id":"u2","name":"Marcus Lee","username":"marcus"}}]}"#
    // swiftlint:disable:next line_length
    private let team = #"{"window_days":30,"hosts":[{"host_user_id":"u1","total":8,"confirmed":2,"completed":6,"no_show":1,"cancelled":1},{"host_user_id":"u2","total":4,"confirmed":1,"completed":2,"no_show":2,"cancelled":0}]}"#

    func testBusinessOnlyForPersonalOwner() async {
        let model = vm(owner: .personal, [:])
        await model.load()
        XCTAssertEqual(model.phase, .businessOnly)
    }

    func testLoadedResolvesNamesAndBalance() async {
        let model = vm([
            "/api/scheduling/insights/team": [.status(200, body: team)],
            "/api/businesses/biz1/members": [.status(200, body: members)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.hostRows.count, 2)
        XCTAssertEqual(model.hostRows.first?.name, "Dana Reyes") // sorted by bookings
        XCTAssertEqual(model.balanceLabel, "Skewed toward Dana Reyes")
        XCTAssertFalse(model.isSingleMember)
    }

    func testSortToggleReordersByNoShow() async {
        let model = vm([
            "/api/scheduling/insights/team": [.status(200, body: team)],
            "/api/businesses/biz1/members": [.status(200, body: members)]
        ])
        await model.load()
        XCTAssertEqual(model.hostRows.first?.id, "u1")
        model.toggleSort()
        XCTAssertEqual(model.hostRows.first?.id, "u2") // 50% no-show beats 12.5%
    }

    func testEmptyWhenNoHosts() async {
        let model = vm([
            "/api/scheduling/insights/team": [.status(200, body: #"{"window_days":30,"hosts":[]}"#)],
            "/api/businesses/biz1/members": [.status(200, body: members)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testBusinessOnlyResponseMapsToBusinessOnly() async {
        let model = vm(["/api/scheduling/insights/team": [.status(400, body: #"{"error":"BUSINESS_ONLY"}"#)]])
        await model.load()
        XCTAssertEqual(model.phase, .businessOnly)
    }

    func testForbiddenMapsToPermissionGated() async {
        let model = vm(["/api/scheduling/insights/team": [.status(403, body: #"{"error":"FORBIDDEN"}"#)]])
        await model.load()
        XCTAssertEqual(model.phase, .permissionGated)
    }

    func testSingleMemberCollapses() async {
        // swiftlint:disable:next line_length
        let singleHost = #"{"window_days":30,"hosts":[{"host_user_id":"u1","total":5,"confirmed":1,"completed":4,"no_show":0,"cancelled":0}]}"#
        let model = vm([
            "/api/scheduling/insights/team": [.status(200, body: singleHost)],
            "/api/businesses/biz1/members": [.status(200, body: members)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertTrue(model.isSingleMember)
    }
}
