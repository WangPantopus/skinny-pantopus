//
//  PaymentsSetupViewModelTests.swift
//  PantopusTests
//
//  G6 · Stream I14. Drives the payments-setup view-model against stubbed
//  `GET /payments/status` responses and asserts the five-frame derivation
//  (not-connected / incomplete / restricted / ready) + the three readiness
//  pills, the home not-applicable short-circuit, and the error path.
//

import XCTest
@testable import Pantopus

@MainActor
final class PaymentsSetupViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func vm(
        status: String,
        code: Int = 200,
        owner: SchedulingOwner = .business(id: "biz1")
    ) -> PaymentsSetupViewModel {
        let routes = ["/api/scheduling/payments/status": [SequencedURLProtocol.Response.status(code, body: status)]]
        let client = SchedulingClient(client: APIClient(
            session: SequencedURLProtocol.makeSession(routeResponses: routes),
            retryPolicy: .none
        ))
        return PaymentsSetupViewModel(owner: owner, push: { _ in }, client: client)
    }

    func testNotConnected() async {
        let model = vm(status: #"{"applicable":true,"connected":false}"#)
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertTrue(model.isApplicable)
        XCTAssertEqual(model.setup, .notConnected)
        XCTAssertEqual(model.chargesPill, .off)
        XCTAssertEqual(model.payoutsPill, .off)
        XCTAssertEqual(model.detailsPill, .off)
        XCTAssertFalse(model.isConnected)
    }

    func testIncomplete() async {
        let model = vm(status: #"{"applicable":true,"connected":true,"charges_enabled":false,"payouts_enabled":false}"#)
        await model.load()
        XCTAssertEqual(model.setup, .incomplete)
        XCTAssertEqual(model.chargesPill, .warn)
        XCTAssertEqual(model.payoutsPill, .off)
        XCTAssertEqual(model.detailsPill, .warn)
    }

    func testRestricted() async {
        let model = vm(status: #"{"applicable":true,"connected":true,"charges_enabled":true,"payouts_enabled":false}"#)
        await model.load()
        XCTAssertEqual(model.setup, .restricted)
        XCTAssertEqual(model.chargesPill, .on)
        XCTAssertEqual(model.payoutsPill, .warn)
        XCTAssertEqual(model.detailsPill, .warn)
    }

    func testReady() async {
        let model = vm(status: #"{"applicable":true,"connected":true,"charges_enabled":true,"payouts_enabled":true}"#)
        await model.load()
        XCTAssertEqual(model.setup, .ready)
        XCTAssertEqual(model.chargesPill, .on)
        XCTAssertEqual(model.payoutsPill, .on)
        XCTAssertEqual(model.detailsPill, .on)
        XCTAssertTrue(model.isConnected)
    }

    func testHomeNotApplicableSkipsNetwork() async {
        // Homes never hit the network — payments are per-user. An empty route
        // table proves no request is made.
        let client = SchedulingClient(client: APIClient(
            session: SequencedURLProtocol.makeSession(routeResponses: [:]),
            retryPolicy: .none
        ))
        let model = PaymentsSetupViewModel(owner: .home(homeId: "h1"), push: { _ in }, client: client)
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertFalse(model.isApplicable)
    }

    func testLoadFailureSurfacesError() async {
        let model = vm(status: #"{"error":"boom"}"#, code: 500)
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
