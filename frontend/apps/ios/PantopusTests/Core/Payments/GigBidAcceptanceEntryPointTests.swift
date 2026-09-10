// JSON fixtures preserve the exact server wire shape.
// swiftlint:disable line_length

import XCTest
@testable import Pantopus

@MainActor
final class GigBidAcceptanceEntryPointTests: XCTestCase {
    private let mailPath = "/api/mailbox/m1"
    private let bidsPath = "/api/gigs/g1/bids"
    private let acceptPath = "/api/gigs/g1/bids/b1/accept"
    private let finalPath = "/api/gigs/g1/bids/b1/finalize-accept"
    private let abortPath = "/api/gigs/g1/bids/b1/abort-accept"
    private let pending = #"{"bids":[{"id":"b1","gig_id":"g1","status":"pending_payment"}]}"#
    private let ready = #"{"bid":{"id":"b1","status":"pending_payment"},"amountCents":3100,"currency":"usd","authorizationReady":true}"#
    private let accepted = #"{"bid":{"id":"b1","status":"accepted"}}"#
    private let mail = #"{"mail":{"id":"m1","type":"gig","mail_type":"gig","display_title":"New bid","viewed":false,"archived":false,"starred":false,"tags":[],"priority":"normal","ack_required":false,"created_at":"2026-05-15T12:00:00Z","object":{"gig_id":"g1","bid_id":"b1","is_accepted":false,"bidder":{"name":"Synthetic Bidder"},"bid":{"amount":31},"post":{"title":"Exact task"}}}}"#

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeMail(_ routes: [String: [SequencedURLProtocol.Response]]) -> MailDetailViewModel {
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none)
        let presenter = RecoveryBidPresenter()
        presenter.onPresent = { XCTFail("An already authorized bid must not present the SDK again")
            return .canceled
        }
        let checkout = CheckoutCoordinator(api: api, presenter: presenter)
        let flow = GigBidAcceptanceCoordinator(api: api, checkout: checkout) { "origin|payer|session" }
        return MailDetailViewModel(mailId: "m1", api: api, bidAcceptance: flow)
    }

    func testColdMailReadsExactPendingBidAndResumesAfterLostFinalReceipt() async {
        let vm = makeMail([
            mailPath: [.status(200, body: mail)], bidsPath: [.status(200, body: pending)],
            acceptPath: [.status(200, body: ready), .status(200, body: ready)],
            finalPath: [.status(503, body: #"{"error":"unconfirmed"}"#), .status(200, body: accepted)]
        ])
        await vm.load()
        XCTAssertTrue(vm.gigPaymentPending)
        await vm.acceptGigBid()
        XCTAssertTrue(vm.gigPaymentPending)
        guard case let .loaded(first) = vm.state else { return XCTFail("Expected loaded mail") }
        XCTAssertFalse(first.gigDetail?.isAccepted ?? true)
        await vm.acceptGigBid()
        XCTAssertFalse(vm.gigPaymentPending)
        guard case let .loaded(last) = vm.state else { return XCTFail("Expected loaded mail") }
        XCTAssertTrue(last.gigDetail?.isAccepted ?? false)
        XCTAssertEqual(vm.toast, "Bid accepted")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == finalPath }.count, 2)
    }

    func testMailCancellationFailureRetainsRecoveryUntilExactReceipt() async {
        let vm = makeMail([
            mailPath: [.status(200, body: mail)], bidsPath: [.status(200, body: pending)],
            abortPath: [.status(503, body: #"{"error":"unknown"}"#), .status(200, body: #"{"bid":{"id":"b1","status":"pending"}}"#)]
        ])
        await vm.load()
        await vm.cancelGigPayment()
        XCTAssertTrue(vm.gigPaymentPending)
        XCTAssertNotEqual(vm.toast, "Payment setup canceled")
        await vm.cancelGigPayment()
        XCTAssertFalse(vm.gigPaymentPending)
        XCTAssertEqual(vm.toast, "Payment setup canceled")
    }

    func testUnrelatedBidCannotSetMailRecoveryState() async {
        let vm = makeMail([
            mailPath: [.status(200, body: mail)],
            bidsPath: [.status(200, body: pending.replacingOccurrences(of: "b1", with: "another-bid"))]
        ])
        await vm.load()
        XCTAssertFalse(vm.gigPaymentPending)
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "POST" })
    }

    func testOffersExposeResumeAndCancelOnlyToRecipientAndKeepAgreedCounterAcceptable() throws {
        let pendingDTO = try JSONDecoder().decode(
            BidDTO.self,
            from: Data(#"{"id":"b1","gig_id":"g1","bid_amount":31,"status":"pending_payment"}"#.utf8)
        )
        let footer = OffersViewModel.footer(
            dto: pendingDTO,
            perspective: .received,
            isBusy: false,
            onAccept: {},
            onReject: {},
            onWithdraw: {}
        )
        XCTAssertEqual(footer?.actions.map(\.title), ["Resume payment", "Cancel payment"])
        XCTAssertNil(OffersViewModel.footer(dto: pendingDTO, perspective: .sent, isBusy: false, onAccept: {}, onReject: {}, onWithdraw: {}))
        let counter = try JSONDecoder().decode(
            BidDTO.self,
            from: Data(#"{"id":"b1","gig_id":"g1","bid_amount":31,"counter_amount":31,"counter_status":"accepted","status":"countered"}"#
                .utf8)
        )
        let agreed = OffersViewModel.footer(dto: counter, perspective: .received, isBusy: false, onAccept: {}, onReject: {}, onWithdraw: {})
        XCTAssertEqual(agreed?.actions.map(\.title), ["Reject", "Accept"])
        XCTAssertTrue(OffersViewModel.acceptConfirmMessage(for: counter).contains("$31.00"))
    }

    func testChangingLocalBidStatusPreservesItsGigIdentity() throws {
        let response = try JSONDecoder().decode(GigBidsResponse.self, from: Data(pending.utf8))
        let updated = try GigDetailViewModel.bidCopy(of: XCTUnwrap(response.bids.first), status: "countered", counterAmount: 31)
        XCTAssertEqual(updated.id, "b1")
        XCTAssertEqual(updated.gigId, "g1")
    }
}
