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
    /// The current owner's optional payment summary can be absent. Bind this
    /// response to its route so conditional reads cannot consume tip receipts.
    private static let paymentJSON = #"{"payment":null}"#
    private static let tipJSON =
        #"{"success":true,"clientSecret":"pi_tip","paymentId":"pay-tip-1","customer":"cus","ephemeralKey":"ek","publishableKey":"pk"}"#
    private static let refreshJSON =
        #"{"paymentStatus":"captured","previousPaymentStatus":"authorize_pending","changed":true}"#

    private func makeVM(presenter: StubTipPresenter) -> GigDetailViewModel {
        let api = makeAPI()
        let checkout = CheckoutCoordinator(api: api, presenter: presenter)
        return GigDetailViewModel(
            gigId: "g1",
            api: api,
            checkout: checkout,
            bidAcceptance: GigBidAcceptanceCoordinator(api: api, checkout: checkout) { "origin|owner-1|tip-session" },
            currentUserId: "owner-1"
        )
    }

    private func stubTipJourney() {
        SequencedURLProtocol.routeResponses = [
            "/api/gigs/g1": [.status(200, body: Self.gigEnvelope), .status(200, body: Self.gigEnvelope)],
            "/api/gigs/g1/bids": [.status(200, body: Self.bidsJSON), .status(200, body: Self.bidsJSON)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON), .status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/payment": [.status(200, body: Self.paymentJSON), .status(200, body: Self.paymentJSON)],
            "/api/reviews/my-pending": [.status(200, body: Self.pendingJSON)],
            "/api/payments/tip": [.status(200, body: Self.tipJSON)],
            "/api/payments/tip/pay-tip-1/refresh-status": [.status(200, body: Self.refreshJSON)]
        ]
    }

    private func assertTipRequest() {
        let requests = SequencedURLProtocol.capturedRequests
        XCTAssertEqual(requests.filter { $0.url?.path == "/api/gigs/g1/payment" }.count, 1)
        let tips = requests.filter { $0.url?.path == "/api/payments/tip" }
        XCTAssertEqual(tips.count, 1)
        XCTAssertEqual(tips.first?.httpMethod, "POST")
    }

    /// tip.success
    func testSendTipSucceedsAndReconciles() async {
        stubTipJourney()
        let presenter = StubTipPresenter()
        presenter.outcome = .completed
        let vm = makeVM(presenter: presenter)
        await vm.load()
        XCTAssertTrue(vm.canTip, "Poster on a completed + confirmed gig can tip")
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertEqual(presenter.lastPublishableKey, "pk")
        XCTAssertEqual(vm.tipStatus, .succeeded)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == "/api/payments/tip" }.count, 1)
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.filter { $0.url?.path == "/api/payments/tip/pay-tip-1/refresh-status" }.count,
            1
        )
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == "/api/gigs/g1/payment" }.count, 2)
    }

    /// tip declined (card / SCA fail)
    func testSendTipDeclined() async {
        stubTipJourney()
        let presenter = StubTipPresenter()
        presenter.outcome = .failed(message: "Your card was declined.")
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(vm.tipStatus, .failed(message: "Your card was declined."))
        assertTipRequest()
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path.contains("refresh-status") == true })
    }

    /// tip canceled (buyer dismissed the sheet)
    func testSendTipCanceled() async {
        stubTipJourney()
        let presenter = StubTipPresenter()
        presenter.outcome = .canceled
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(vm.tipStatus, .canceled)
        assertTipRequest()
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path.contains("refresh-status") == true })
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
