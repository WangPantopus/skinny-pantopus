//
//  GigTipTests.swift
//  PantopusTests
//
//  Block 3D — tipping a gig worker. The gig poster, on a completed +
//  owner-confirmed gig, tips the worker via PaymentSheet. Covers the tip gate,
//  the "Send a tip" dock projection, and the send-tip round-trip (create tip →
//  present PaymentSheet → reconcile) with a stub presenter + SequencedURLProtocol.
//

import XCTest
@testable import Pantopus

@MainActor
final class GigTipTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func decodeGig(_ json: String) throws -> GigDTO {
        try JSONDecoder().decode(GigDTO.self, from: Data(json.utf8))
    }

    private static let completedConfirmed =
        #"{"id":"g1","title":"Patio cleanup","status":"completed","accepted_by":"w1","owner_confirmed_at":"2026-06-01T00:00:00Z"}"#

    // MARK: - Gate

    func testTipGate() throws {
        let gig = try decodeGig(Self.completedConfirmed)
        XCTAssertTrue(GigDetailViewModel.viewerCanTip(gig: gig, viewerIsOwner: true))
        XCTAssertFalse(
            GigDetailViewModel.viewerCanTip(gig: gig, viewerIsOwner: false),
            "Only the poster can tip"
        )

        let notConfirmed = try decodeGig(#"{"id":"g1","title":"t","status":"completed","accepted_by":"w1"}"#)
        XCTAssertFalse(
            GigDetailViewModel.viewerCanTip(gig: notConfirmed, viewerIsOwner: true),
            "Gig must be owner-confirmed"
        )

        let inProgress = try decodeGig(
            #"{"id":"g1","title":"t","status":"in_progress","accepted_by":"w1","owner_confirmed_at":"2026-06-01T00:00:00Z"}"#
        )
        XCTAssertFalse(
            GigDetailViewModel.viewerCanTip(gig: inProgress, viewerIsOwner: true),
            "Gig must be completed"
        )
    }

    // MARK: - Projection

    func testCompletedOwnerDockOffersTip() throws {
        let gig = try decodeGig(Self.completedConfirmed)
        let content = GigDetailViewModel.project(gig: gig, bids: [], canTip: true)
        XCTAssertEqual(content.dock.primary.label, "Send a tip")
        XCTAssertEqual(content.dock.secondary?.label, "Message")
    }

    // MARK: - Send tip round-trip

    private static let gigEnvelope =
        #"{"gig":{"id":"g1","title":"Patio cleanup","user_id":"owner-1","status":"completed","#
            + #""accepted_by":"worker-1","owner_confirmed_at":"2026-06-01T00:00:00Z"}}"#
    private static let bidsJSON = #"{"bids":[]}"#
    private static let questionsJSON = #"{"questions":[]}"#
    /// Phase 5 — completed gigs also fetch `/api/reviews/my-pending`.
    private static let pendingJSON = #"{"pending":[]}"#
    /// Phase 5b — the owner's payment summary (`GET /:gigId/payment`) fires on
    /// every load for an assigned+ gig; `loadPayment` swallows the body via
    /// `try?`, so a benign null envelope keeps the FIFO aligned.
    private static let paymentJSON = #"{"payment":null}"#
    private static let tipJSON =
        #"{"success":true,"clientSecret":"pi_tip","paymentId":"pay-tip-1","customer":"cus","ephemeralKey":"ek","publishableKey":"pk"}"#
    private static let refreshJSON =
        #"{"paymentStatus":"captured","previousPaymentStatus":"authorize_pending","changed":true}"#

    private func makeVM(presenter: StubTipPresenter) -> GigDetailViewModel {
        let api = makeAPI()
        return GigDetailViewModel(
            gigId: "g1",
            api: api,
            checkout: CheckoutCoordinator(api: api, presenter: presenter),
            currentUserId: "owner-1"
        )
    }

    /// tip.success
    func testSendTipSucceedsAndReconciles() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigEnvelope), .status(200, body: Self.bidsJSON),
            .status(200, body: Self.questionsJSON), .status(200, body: Self.paymentJSON),
            .status(200, body: Self.pendingJSON), // load
            .status(200, body: Self.tipJSON), // POST /tip
            .status(200, body: Self.refreshJSON), // refresh-status
            .status(200, body: Self.gigEnvelope), .status(200, body: Self.bidsJSON),
            .status(200, body: Self.questionsJSON), .status(200, body: Self.paymentJSON)
            // reload (my-pending settled on load)
        ]
        let presenter = StubTipPresenter()
        presenter.outcome = .completed
        let vm = makeVM(presenter: presenter)
        await vm.load()
        XCTAssertTrue(vm.canTip, "Poster on a completed + confirmed gig can tip")
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertEqual(presenter.lastPublishableKey, "pk")
        XCTAssertEqual(vm.tipStatus, .succeeded)
    }

    /// tip declined (card / SCA fail)
    func testSendTipDeclined() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigEnvelope), .status(200, body: Self.bidsJSON),
            .status(200, body: Self.questionsJSON), .status(200, body: Self.paymentJSON),
            .status(200, body: Self.pendingJSON), // load
            .status(200, body: Self.tipJSON) // POST /tip
        ]
        let presenter = StubTipPresenter()
        presenter.outcome = .failed(message: "Your card was declined.")
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(vm.tipStatus, .failed(message: "Your card was declined."))
    }

    /// tip canceled (buyer dismissed the sheet)
    func testSendTipCanceled() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigEnvelope), .status(200, body: Self.bidsJSON),
            .status(200, body: Self.questionsJSON), .status(200, body: Self.paymentJSON),
            .status(200, body: Self.pendingJSON), // load
            .status(200, body: Self.tipJSON) // POST /tip
        ]
        let presenter = StubTipPresenter()
        presenter.outcome = .canceled
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(vm.tipStatus, .canceled)
    }
}

/// Records `presentPayment` calls + returns a scripted outcome so the tip
/// branches are testable without the Stripe SDK.
@MainActor
private final class StubTipPresenter: PaymentSheetPresenting {
    var outcome: PaymentSheetOutcome = .completed
    private(set) var presentPaymentCallCount = 0
    private(set) var lastPublishableKey: String?

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
        publishableKey: String?
    ) async -> PaymentSheetOutcome {
        presentPaymentCallCount += 1
        lastPublishableKey = publishableKey
        return outcome
    }
}
