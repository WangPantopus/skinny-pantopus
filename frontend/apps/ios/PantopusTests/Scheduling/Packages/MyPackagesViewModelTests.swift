//
//  MyPackagesViewModelTests.swift
//  PantopusTests
//
//  G11 · Stream I15. Credits projection, owner reconstruction, and the
//  remaining/progress math.
//

import XCTest
@testable import Pantopus

@MainActor
final class MyPackagesViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = true
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = false
        super.tearDown()
    }

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> MyPackagesViewModel {
        MyPackagesViewModel(
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            ))
        )
    }

    private let credits = #"""
    {"credits":[
      {"id":"cr1","package_id":"pk1","buyer_user_id":"u1","remaining_sessions":3,
       "purchased_at":"2026-06-01T00:00:00Z",
       "BookingPackage":{"name":"5-session cleaning","sessions_count":5,
       "owner_type":"business","owner_id":"biz1","event_type_id":"et1"}},
      {"id":"cr2","package_id":"pk2","buyer_user_id":"u1","remaining_sessions":0,
       "purchased_at":"2026-03-01T00:00:00Z",
       "BookingPackage":{"name":"3 facials","sessions_count":3,
       "owner_type":"business","owner_id":"biz2"}}
    ]}
    """#

    func testLoadedProjectsCredits() async {
        let model = vm(["/api/scheduling/my-packages": [.status(200, body: credits)]])
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.credits.count, 2)
        let active = model.credits[0]
        XCTAssertEqual(model.remaining(active), 3)
        XCTAssertEqual(model.total(active), 5)
        XCTAssertEqual(model.progress(active), 0.6, accuracy: 0.001)
        XCTAssertFalse(model.isSpent(active))
        XCTAssertTrue(model.isSpent(model.credits[1]))
    }

    func testEmptyWhenNoCredits() async {
        let model = vm(["/api/scheduling/my-packages": [.status(200, body: #"{"credits":[]}"#)]])
        await model.load()
        XCTAssertEqual(model.phase, .empty)
    }

    func testOwnerReconstruction() async {
        let model = vm(["/api/scheduling/my-packages": [.status(200, body: credits)]])
        await model.load()
        XCTAssertEqual(model.owner(for: model.credits[0].bookingPackage), .business(id: "biz1"))
    }

    func testErrorPhase() async {
        let model = vm(["/api/scheduling/my-packages": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
