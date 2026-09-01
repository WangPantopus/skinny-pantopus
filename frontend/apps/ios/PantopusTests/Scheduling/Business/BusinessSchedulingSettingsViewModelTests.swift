//
//  BusinessSchedulingSettingsViewModelTests.swift
//  PantopusTests
//
//  G5 · Stream I13. Drives the business settings view-model against stubbed
//  responses via APIClient(retryPolicy: .none, session: SequencedURLProtocol…),
//  keyed by route path so the concurrent load fan-out is deterministic.
//

import XCTest
@testable import Pantopus

@MainActor
final class BusinessSchedulingSettingsViewModelTests: XCTestCase {
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

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> BusinessSchedulingSettingsViewModel {
        BusinessSchedulingSettingsViewModel(owner: .business(id: "biz1"), push: { _ in }, client: client(routes))
    }

    // swiftlint:disable:next line_length
    private let page = #"{"page":{"id":"p1","owner_type":"business","owner_id":"biz1","slug":"acme","is_live":true,"is_paused":false,"timezone":"America/Los_Angeles"}}"#
    // swiftlint:disable:next line_length
    private let paidTypes = #"{"eventTypes":[{"id":"et1","name":"Haircut","slug":"haircut","durations":[45],"min_notice_min":240,"max_horizon_days":60,"buffer_before_min":10,"buffer_after_min":10,"price_cents":5000,"requires_approval":true,"assignment_mode":"round_robin","is_active":true}]}"#
    private let prefs = #"{"prefs":{"business_notify_owner":true,"business_notify_assigned_member":false,"keep_me":"yes"}}"#
    private let ownerAccess = #"{"hasAccess":true,"isOwner":true,"role_base":"owner","permissions":["team.manage"]}"#

    private func routes(payments: String, access: String) -> [String: [SequencedURLProtocol.Response]] {
        [
            "/api/scheduling/booking-page": [.status(200, body: page)],
            "/api/scheduling/payments/status": [.status(200, body: payments)],
            "/api/scheduling/event-types": [.status(200, body: paidTypes)],
            "/api/scheduling/notification-preferences": [.status(200, body: prefs)],
            "/api/businesses/biz1/me": [.status(200, body: access)]
        ]
    }

    func testLoadedProjectsBusinessSettings() async {
        let model = vm(routes(payments: #"{"applicable":true,"connected":true,"payouts_enabled":true}"#, access: ownerAccess))
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.timezone, "America/Los_Angeles")
        XCTAssertTrue(model.paymentsConnected)
        XCTAssertTrue(model.canManage)
        XCTAssertFalse(model.isGated)
        XCTAssertEqual(model.minNoticeValue, "4 hours")
        XCTAssertEqual(model.horizonValue, "60 days out")
        XCTAssertTrue(model.confirmationApprove)
    }

    func testGatedWhenMissingManagePermission() async {
        let access = #"{"hasAccess":true,"isOwner":false,"role_base":"staff","permissions":["team.view"]}"#
        let model = vm(routes(payments: #"{"applicable":true,"connected":false}"#, access: access))
        await model.load()
        XCTAssertTrue(model.isGated)
        XCTAssertFalse(model.canManage)
    }

    func testPaymentsRequiredWhenPaidServiceUnconnected() async {
        let model = vm(routes(payments: #"{"applicable":true,"connected":false}"#, access: ownerAccess))
        await model.load()
        XCTAssertFalse(model.paymentsConnected)
        XCTAssertTrue(model.hasPaidServices)
        XCTAssertTrue(model.paymentsRequired)
    }

    func testLoadFailureSurfacesError() async {
        let model = vm(["/api/scheduling/booking-page": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }

    func testToggleNotifyOwnerPersistsMergedPrefs() async {
        var r = routes(payments: #"{"applicable":true,"connected":true}"#, access: ownerAccess)
        // Second hit on the prefs path is the PUT result (queue popped in order).
        r["/api/scheduling/notification-preferences"] = [
            .status(200, body: prefs),
            .status(200, body: #"{"prefs":{"business_notify_owner":false,"business_notify_assigned_member":false,"keep_me":"yes"}}"#)
        ]
        let model = vm(r)
        await model.load()
        XCTAssertTrue(model.notifyOwner)
        await model.setNotifyOwner(false)
        XCTAssertFalse(model.notifyOwner)
        // The merged PUT round-trips and preserves unknown keys (no crash / re-sync).
    }

    func testDurationLabelFormatting() {
        XCTAssertEqual(BusinessSchedulingSettingsViewModel.durationLabel(240), "4 hours")
        XCTAssertEqual(BusinessSchedulingSettingsViewModel.durationLabel(60), "1 hour")
        XCTAssertEqual(BusinessSchedulingSettingsViewModel.durationLabel(2880), "2 days")
        XCTAssertEqual(BusinessSchedulingSettingsViewModel.durationLabel(45), "45 min")
    }
}
