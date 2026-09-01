//
//  PayoutsEarningsViewModelTests.swift
//  PantopusTests
//
//  G7 · Stream I14. Exercises the payouts/earnings projections — payout-state
//  derivation from the Connect account, source classification, pending →
//  "Pending" rendering — and a populated load against stubbed Wallet +
//  Connect endpoints with the booking-source filter applied.
//

import XCTest
@testable import Pantopus

@MainActor
final class PayoutsEarningsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Pure projections

    func testPayoutStateMapping() {
        XCTAssertEqual(PayoutsEarningsViewModel.payoutState(for: nil), .notEnabled)
        XCTAssertEqual(
            PayoutsEarningsViewModel.payoutState(for: ConnectAccountDTO(stripeAccountId: nil, payoutsEnabled: true)),
            .notEnabled
        )
        XCTAssertEqual(
            PayoutsEarningsViewModel.payoutState(for: ConnectAccountDTO(stripeAccountId: "acct", payoutsEnabled: false)),
            .onHold
        )
        XCTAssertEqual(
            PayoutsEarningsViewModel.payoutState(for: ConnectAccountDTO(stripeAccountId: "acct", payoutsEnabled: true)),
            .enabled
        )
    }

    func testSourceClassification() {
        XCTAssertEqual(PayoutsEarningsViewModel.source(for: "gig_income", description: "5-session package"), .packages)
        XCTAssertEqual(PayoutsEarningsViewModel.source(for: "gig_income", description: "Booking · Dana"), .booking)
        XCTAssertEqual(PayoutsEarningsViewModel.source(for: "gig_income", description: "Lawn mow"), .gigs)
    }

    func testProjectRowPendingShowsPending() throws {
        let json = """
        {"id":"t1","type":"gig_income","amount":4800,"status":"pending",
        "created_at":"2026-06-15T14:00:00Z","description":"Booking · Dana"}
        """
        let tx = try JSONDecoder().decode(WalletTransactionDTO.self, from: Data(json.utf8))
        let row = PayoutsEarningsViewModel.projectRow(from: tx)
        XCTAssertTrue(row.isPending)
        XCTAssertEqual(row.statusLabel, "Pending")
        XCTAssertEqual(row.source, .booking)
        XCTAssertEqual(row.amount, "48.00")
        XCTAssertEqual(row.direction, .in)
    }

    // MARK: - Load

    private func loadModel(payoutsEnabled: Bool) -> PayoutsEarningsViewModel {
        let balance = """
        {"wallet":{"id":"w1","balance":84750,"currency":"USD","frozen":false}}
        """
        let transactions = """
        {"transactions":[
          {"id":"t1","type":"gig_income","amount":4800,"status":"pending",
           "created_at":"2026-06-15T14:00:00Z","description":"Booking · Dana"},
          {"id":"t2","type":"gig_income","amount":9600,"status":"completed",
           "created_at":"2026-06-15T11:00:00Z","description":"Lawn mow"}
        ]}
        """
        let pending = """
        {"in_review_cents":4800,"releasing_soon_cents":0,"total_pending_cents":4800,
        "in_review_count":1,"releasing_soon_count":0}
        """
        let account = """
        {"account":{"stripe_account_id":"acct_1","charges_enabled":true,
        "payouts_enabled":\(payoutsEnabled),"details_submitted":true}}
        """
        let routes: [String: [SequencedURLProtocol.Response]] = [
            "/api/wallet": [.status(200, body: balance)],
            "/api/wallet/transactions": [.status(200, body: transactions)],
            "/api/wallet/pending-release": [.status(200, body: pending)],
            "/api/payments/connect/account": [.status(200, body: account)]
        ]
        let client = SchedulingClient(client: APIClient(
            session: SequencedURLProtocol.makeSession(routeResponses: routes),
            retryPolicy: .none
        ))
        return PayoutsEarningsViewModel(owner: .business(id: "biz1"), push: { _ in }, client: client)
    }

    func testLoadPopulatedFiltersBookingSource() async {
        let model = loadModel(payoutsEnabled: true)
        await model.load()
        XCTAssertEqual(model.phase, .loaded)
        XCTAssertEqual(model.availableCents, 84750)
        XCTAssertEqual(model.availableDisplay, "847.50")
        XCTAssertEqual(model.payoutState, .enabled)
        XCTAssertTrue(model.canWithdraw)
        XCTAssertEqual(model.allRows.count, 2)
        // Default filter is "Booking earnings" → only the booking-tagged row.
        XCTAssertEqual(model.source, .booking)
        XCTAssertEqual(model.rows.count, 1)
        XCTAssertEqual(model.rows.first?.id, "t1")
        // Switching to "All" surfaces both.
        model.source = .all
        XCTAssertEqual(model.rows.count, 2)
    }

    func testLoadOnHoldWhenPayoutsDisabled() async {
        let model = loadModel(payoutsEnabled: false)
        await model.load()
        XCTAssertEqual(model.payoutState, .onHold)
        XCTAssertFalse(model.canWithdraw)
    }

    func testLoadFailureSurfacesError() async {
        let routes: [String: [SequencedURLProtocol.Response]] = [
            "/api/wallet": [.status(500, body: #"{"error":"boom"}"#)]
        ]
        let client = SchedulingClient(client: APIClient(
            session: SequencedURLProtocol.makeSession(routeResponses: routes),
            retryPolicy: .none
        ))
        let model = PayoutsEarningsViewModel(owner: .business(id: "biz1"), push: { _ in }, client: client)
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
