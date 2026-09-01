//
//  PaymentFailedViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D6 payment recovery. Verifies the paid-
//  flag gate and the payment-status → stage mapping. Saves/restores the paid
//  flag so the suite stays hermetic.
//

import XCTest
@testable import Pantopus

@MainActor
final class PaymentFailedViewModelTests: XCTestCase {
    private var originalPaid = false

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        originalPaid = UserDefaults.standard.bool(forKey: SchedulingFeatureFlags.paidEnabledDefaultsKey)
    }

    override func tearDown() {
        UserDefaults.standard.set(originalPaid, forKey: SchedulingFeatureFlags.paidEnabledDefaultsKey)
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> PaymentFailedViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return PaymentFailedViewModel(token: "tok", push: { _ in }, client: client)
    }

    private func manage(status: String) -> String {
        #"""
        {"booking":{"id":"b1","status":"pending","start_at":"2026-06-17T21:00:00Z","invitee_timezone":"America/Los_Angeles"},
         "payment":{"amount_total":4800,"currency":"usd","payment_status":"\#(status)"},
         "eventType":{"id":"et1","name":"Consult","default_duration":30},
         "page":{"slug":"x","title":"Host","owner_type":"user"}}
        """#
    }

    func testFlagOffIsNotApplicable() async throws {
        SchedulingFeatureFlags.paidEnabled = false
        try XCTSkipIf(SchedulingFeatureFlags.paidEnabled, "paid flag forced on by environment")
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.stage, .notApplicable)
    }

    func testFailedPaymentBecomesDeclined() async throws {
        SchedulingFeatureFlags.paidEnabled = true
        try XCTSkipUnless(SchedulingFeatureFlags.paidEnabled, "paid flag forced off by environment")
        SequencedURLProtocol.sequence = [.status(200, body: manage(status: "failed"))]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.stop()
        XCTAssertEqual(viewModel.stage, .declined)
    }

    func testSucceededPaymentBecomesSucceeded() async throws {
        SchedulingFeatureFlags.paidEnabled = true
        try XCTSkipUnless(SchedulingFeatureFlags.paidEnabled, "paid flag forced off by environment")
        SequencedURLProtocol.sequence = [.status(200, body: manage(status: "succeeded"))]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.stage, .succeeded)
    }

    func testPendingPaymentBecomesUncertain() async throws {
        SchedulingFeatureFlags.paidEnabled = true
        try XCTSkipUnless(SchedulingFeatureFlags.paidEnabled, "paid flag forced off by environment")
        SequencedURLProtocol.sequence = [.status(200, body: manage(status: "pending"))]
        let viewModel = makeViewModel()
        await viewModel.load()
        viewModel.stop()
        XCTAssertEqual(viewModel.stage, .uncertain)
    }
}
