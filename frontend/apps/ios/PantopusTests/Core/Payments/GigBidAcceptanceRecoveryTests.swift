// JSON fixtures retain their wire shape for readable payment-proof assertions.
// swiftlint:disable line_length multiline_literal_brackets

import XCTest
@testable import Pantopus

@MainActor
final class GigBidAcceptanceRecoveryTests: XCTestCase {
    private let acceptPath = "/api/gigs/g1/bids/b1/accept"
    private let finalPath = "/api/gigs/g1/bids/b1/finalize-accept"
    private let abortPath = "/api/gigs/g1/bids/b1/abort-accept"
    private let bidsPath = "/api/gigs/g1/bids"
    private let payment = #"{"bid":{"id":"b1","status":"pending_payment"},"amountCents":3100,"currency":"usd","clientSecret":"pi_test_secret","isSetupIntent":false}"#
    private let ready = #"{"bid":{"id":"b1","status":"pending_payment"},"amountCents":3100,"currency":"usd","authorizationReady":true}"#
    private let accepted = #"{"bid":{"id":"b1","status":"accepted"}}"#
    private let canceled = #"{"bid":{"id":"b1","status":"pending"}}"#
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private var paths: [String] {
        SequencedURLProtocol.capturedRequests.compactMap { $0.url?.path }
    }

    private func make(
        _ routes: [String: [SequencedURLProtocol.Response]],
        presenter: RecoveryBidPresenter = RecoveryBidPresenter(),
        identity: @escaping () -> String? = { "origin|payer|session" }
    ) -> GigBidAcceptanceCoordinator {
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none)
        return GigBidAcceptanceCoordinator(api: api, checkout: CheckoutCoordinator(api: api, presenter: presenter), identity: identity)
    }

    func testLostFinalizationResumesExactBidWithoutAnotherSheet() async {
        let presenter = RecoveryBidPresenter()
        let flow = make(
            [acceptPath: [.status(200, body: payment), .status(200, body: ready)], finalPath: [
                .status(503, body: #"{"error":"retry"}"#),
                .status(200, body: accepted)
            ]],
            presenter: presenter
        )
        guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Unknown receipt must remain pending") }
        let result = await flow.accept(gigId: "g1", bidId: "b1")
        XCTAssertEqual(result, .accepted)
        XCTAssertEqual(presenter.count, 1)
        XCTAssertEqual(paths, [acceptPath, finalPath, acceptPath, finalPath])
    }

    func testRestartResumesVerifiedServerHoldWithoutSheet() async {
        let first = make([acceptPath: [.status(503, body: #"{"error":"lost response"}"#)]])
        _ = await first.accept(gigId: "g1", bidId: "b1")
        let presenter = RecoveryBidPresenter()
        let restarted = make([acceptPath: [.status(200, body: ready)], finalPath: [.status(200, body: accepted)]], presenter: presenter)
        let result = await restarted.accept(gigId: "g1", bidId: "b1")
        XCTAssertEqual(result, .accepted)
        XCTAssertEqual(presenter.count, 0)
    }

    func testUnknownCancellationRetainsExactRetry() async {
        let presenter = RecoveryBidPresenter()
        presenter.result = .canceled
        let flow = make(
            [acceptPath: [.status(200, body: payment)], abortPath: [
                .status(503, body: #"{"error":"lost"}"#),
                .status(200, body: canceled)
            ]],
            presenter: presenter
        )
        guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Cancellation must await receipt") }
        let result = await flow.cancel(gigId: "g1", bidId: "b1")
        XCTAssertEqual(result, .canceled)
        XCTAssertEqual(paths, [acceptPath, abortPath, bidsPath, abortPath])
    }

    func testDeclinePreservesPendingPaymentAndFreeReceiptSkipsSheet() async {
        let presenter = RecoveryBidPresenter()
        presenter.result = .failed(message: "Declined")
        let flow = make([acceptPath: [.status(200, body: payment), .status(200, body: accepted)]], presenter: presenter)
        guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Expected recovery") }
        XCTAssertEqual(paths, [acceptPath])
        let result = await flow.accept(gigId: "g1", bidId: "b1")
        XCTAssertEqual(result, .accepted)
        XCTAssertEqual(presenter.count, 1)
    }

    func testInvalidTermsOrForeignFinalReceiptCannotAccept() async {
        for body in [
            payment.replacingOccurrences(of: "b1", with: "foreign"),
            payment.replacingOccurrences(of: "usd", with: "eur"),
            payment.replacingOccurrences(of: "pending_payment", with: "rejected"),
            payment.replacingOccurrences(of: "3100", with: "0"),
            payment.replacingOccurrences(of: "false", with: "true")
        ] {
            let presenter = RecoveryBidPresenter()
            let flow = make([acceptPath: [.status(200, body: body)]], presenter: presenter)
            guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Expected terms rejection") }
            XCTAssertEqual(presenter.count, 0)
        }
        let flow = make([
            acceptPath: [.status(200, body: ready)],
            finalPath: [.status(200, body: accepted.replacingOccurrences(of: "b1", with: "foreign"))]
        ])
        guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Expected exact receipt") }
    }

    func testChangedSessionAfterSheetCannotFinalizeOrCancel() async {
        for dismiss in [false, true] {
            var scope = "first"
            let presenter = RecoveryBidPresenter()
            presenter.onPresent = { scope = "second"
                return dismiss ? .canceled : .completed
            }
            let flow = make([acceptPath: [.status(200, body: payment)]], presenter: presenter) { scope }
            guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Expected identity fence") }
        }
        XCTAssertFalse(paths.contains(finalPath))
        XCTAssertFalse(paths.contains(abortPath))
    }

    func testOldScreenAndSignedOutScreenCannotStartOperations() async {
        var scope: String? = "first"
        let flow = make([:]) { scope }
        scope = "second"
        guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Expected identity fence") }
        scope = nil
        guard case .failed = await flow.cancel(gigId: "g1", bidId: "b1") else { return XCTFail("Expected signed-out fence") }
        XCTAssertTrue(paths.isEmpty)
    }

    func testColdRetryAfterCommittedFinalizationRequiresExactReceiptWithoutSheet() async {
        for cancel in [false, true] {
            let presenter = RecoveryBidPresenter()
            let flow = make([
                cancel ? abortPath : acceptPath: [.status(400, body: #"{"error":"Gig is not open (status=assigned)"}"#)],
                bidsPath: [.status(200, body: #"{"bids":[{"id":"b1","gig_id":"g1","status":"accepted"}]}"#)],
                finalPath: [.status(200, body: accepted)]
            ], presenter: presenter)
            let outcome = cancel ? await flow.cancel(gigId: "g1", bidId: "b1") : await flow.accept(gigId: "g1", bidId: "b1")
            XCTAssertEqual(outcome, .accepted)
            XCTAssertEqual(presenter.count, 0)
        }
        XCTAssertEqual(paths.filter { $0 == finalPath }.count, 2)
    }

    func testReadOnlyRecoveryNeverAcceptsForeignBidOrGigOrUnconfirmedReceipt() async {
        for bid in [
            #"{"id":"other","gig_id":"g1","status":"accepted"}"#,
            #"{"id":"b1","gig_id":"other","status":"accepted"}"#,
            #"{"id":"b1","gig_id":"g1","status":"pending_payment"}"#
        ] {
            let flow = make([
                acceptPath: [.status(400, body: #"{"error":"not open"}"#)],
                bidsPath: [.status(200, body: "{\"bids\":[\(bid)]}")]
            ])
            guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Expected exact recovery identity") }
        }
        XCTAssertFalse(paths.contains(finalPath))
        let flow = make([
            acceptPath: [.status(400, body: #"{"error":"not open"}"#)],
            bidsPath: [.status(200, body: #"{"bids":[{"id":"b1","gig_id":"g1","status":"accepted"}]}"#)],
            finalPath: [.status(503, body: #"{"error":"retry"}"#)]
        ])
        guard case .failed = await flow.accept(gigId: "g1", bidId: "b1") else { return XCTFail("Read alone cannot confirm acceptance") }
    }

    func testDelayedAcceptResponseAfterAccountChangeCannotPresentOrFinalize() async {
        var scope = "original"
        let presenter = RecoveryBidPresenter()
        let flow = make([acceptPath: [.status(200, body: payment, delay: 0.15)]], presenter: presenter) { scope }
        let operation = Task { await flow.accept(gigId: "g1", bidId: "b1") }
        await waitForRequest(acceptPath)
        scope = "another-account"
        guard case .failed = await operation.value else { return XCTFail("Expected account fence") }
        XCTAssertEqual(presenter.count, 0)
        XCTAssertEqual(paths, [acceptPath])
    }

    func testDelayedFinalReceiptAfterSessionChangeCannotReportAccepted() async {
        var scope = "original"
        let flow = make([
            acceptPath: [.status(200, body: ready)], finalPath: [.status(200, body: accepted, delay: 0.15)]
        ]) { scope }
        let operation = Task { await flow.accept(gigId: "g1", bidId: "b1") }
        await waitForRequest(finalPath)
        scope = "new-session"
        guard case .failed = await operation.value else { return XCTFail("Expected session fence") }
        XCTAssertEqual(paths, [acceptPath, finalPath])
    }

    func testTwoScreensCannotPresentOrCancelSameGigConcurrently() async {
        let presenter = RecoveryBidPresenter()
        var dismiss: CheckedContinuation<PaymentSheetOutcome, Never>?
        presenter.onPresent = { await withCheckedContinuation { dismiss = $0 } }
        let first = make([
            acceptPath: [.status(200, body: payment)], abortPath: [.status(200, body: canceled)]
        ], presenter: presenter)
        let anotherScreen = make([:])
        let operation = Task { await first.accept(gigId: "g1", bidId: "b1") }
        for _ in 0..<200 where dismiss == nil {
            try? await Task.sleep(for: .milliseconds(5))
        }
        guard let dismiss else { operation.cancel()
            return XCTFail("Payment presentation did not start")
        }
        if case .failed = await anotherScreen.accept(gigId: "g1", bidId: "b2") {} else { XCTFail("Concurrent bid accepted") }
        if case .failed = await anotherScreen.cancel(gigId: "g1", bidId: "b1") {} else { XCTFail("Concurrent cancel admitted") }
        XCTAssertEqual(paths, [acceptPath])
        dismiss.resume(returning: .canceled)
        let result = await operation.value
        XCTAssertEqual(result, .canceled)
        XCTAssertEqual(presenter.count, 1)
    }

    private func waitForRequest(_ path: String) async {
        for _ in 0..<200 where !paths.contains(path) {
            try? await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertTrue(paths.contains(path), "Expected request to start before changing account")
    }
}

@MainActor
final class RecoveryBidPresenter: PaymentSheetPresenting {
    var result: PaymentSheetOutcome = .completed
    var onPresent: (() async -> PaymentSheetOutcome)?
    private(set) var count = 0
    func presentAddCard(
        setupIntentClientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        .completed
    }

    func presentPayment(
        clientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        isSetupIntent _: Bool,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        count += 1
        return await onPresent?() ?? result
    }
}
