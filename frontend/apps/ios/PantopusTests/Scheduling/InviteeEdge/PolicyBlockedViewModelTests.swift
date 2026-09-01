//
//  PolicyBlockedViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D10 policy gate. Covers the pure
//  `PolicyState` derivation from the manage `actions`/`payment` bundle, plus the
//  load + cancel network paths over `SequencedURLProtocol`.
//

import XCTest
@testable import Pantopus

@MainActor
final class PolicyBlockedViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> PolicyBlockedViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return PolicyBlockedViewModel(token: "tok", push: { _ in }, client: client)
    }

    private func decode<T: Decodable>(_ json: String) -> T {
        // swiftlint:disable:next force_try
        try! JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    // MARK: - Derivation

    func testBothActionsFreeIsWithinPolicy() {
        let actions: ManageActions = decode(#"{"can_cancel":true,"can_reschedule":true}"#)
        let state = PolicyBlockedViewModel.derive(actions: actions, payment: nil)
        guard case .withinPolicy = state else { return XCTFail("expected withinPolicy, got \(state)") }
    }

    func testRescheduleClosedButCancelOpen() {
        let actions: ManageActions = decode(#"{"can_cancel":true,"can_reschedule":false,"reschedule_deadline":"2026-06-16T00:00:00Z"}"#)
        let state = PolicyBlockedViewModel.derive(actions: actions, payment: nil)
        guard case .rescheduleCutoff = state else { return XCTFail("expected rescheduleCutoff, got \(state)") }
    }

    func testPaidPastFreeWindowIsCancelCutoffNoRefund() {
        let actions: ManageActions =
            decode(#"{"can_cancel":true,"can_reschedule":false,"free_cancel_until":"2000-01-01T00:00:00Z","refund_estimate_cents":0}"#)
        let payment: ManagePayment = decode(#"{"amount_total":4800,"currency":"usd","payment_status":"succeeded"}"#)
        let state = PolicyBlockedViewModel.derive(actions: actions, payment: payment)
        guard case .cancelCutoffNoRefund = state else { return XCTFail("expected cancelCutoffNoRefund, got \(state)") }
    }

    func testPartialRefund() {
        let actions: ManageActions = decode(#"{"can_cancel":true,"can_reschedule":false,"refund_estimate_cents":2400}"#)
        let payment: ManagePayment = decode(#"{"amount_total":4800,"currency":"usd","payment_status":"succeeded"}"#)
        let state = PolicyBlockedViewModel.derive(actions: actions, payment: payment)
        guard case let .partialRefund(refund, paid, _) = state else {
            return XCTFail("expected partialRefund, got \(state)")
        }
        XCTAssertEqual(refund, 2400)
        XCTAssertEqual(paid, 4800)
    }

    func testNoChangesAllowed() {
        let actions: ManageActions = decode(#"{"can_cancel":false,"can_reschedule":false}"#)
        let state = PolicyBlockedViewModel.derive(actions: actions, payment: nil)
        guard case .changeNotAllowed = state else { return XCTFail("expected changeNotAllowed, got \(state)") }
    }

    // MARK: - Network

    func testLoadResolvesToLoaded() async {
        let json = #"""
        {"booking":{"id":"b1","status":"confirmed","start_at":"2026-06-17T16:30:00Z"},
         "actions":{"can_cancel":true,"can_reschedule":true},
         "eventType":{"id":"et1","name":"Intro call"},
         "page":{"slug":"maria","title":"Maria","owner_type":"user"}}
        """#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .loaded = viewModel.state else { return XCTFail("expected loaded, got \(viewModel.state)") }
    }

    func testCancelTransitionsToCancelled() async {
        let manage = #"{"booking":{"id":"b1","status":"confirmed"},"actions":{"can_cancel":true,"can_reschedule":true}}"#
        let cancelled = #"{"booking":{"id":"b1","status":"cancelled"}}"#
        SequencedURLProtocol.sequence = [.status(200, body: manage), .status(200, body: cancelled)]
        let viewModel = makeViewModel()
        await viewModel.load()
        await viewModel.cancel()
        guard case .cancelled = viewModel.state else { return XCTFail("expected cancelled, got \(viewModel.state)") }
    }

    func testLoadErrorSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND","message":"gone"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .error = viewModel.state else { return XCTFail("expected error, got \(viewModel.state)") }
    }
}
