//
//  WalletMappingTests.swift
//  PantopusTests
//
//  P1-F — covers the read-path wiring of the Wallet screen:
//    - pure DTO → WalletContent projection (balance, pending, activity),
//    - per-field transaction mapping (direction / category / status),
//    - cents formatting + day/time labels,
//    - the live load() path driven through a stubbed APIClient.
//

import XCTest
@testable import Pantopus

@MainActor
final class WalletMappingTests: XCTestCase {
    // MARK: - Fixtures

    private func balance(_ cents: Int, frozen: Bool = false) -> WalletBalanceResponse {
        WalletBalanceResponse(
            wallet: .init(
                id: "w1",
                balance: cents,
                currency: "usd",
                frozen: frozen,
                lifetimeWithdrawals: 0,
                lifetimeReceived: cents
            )
        )
    }

    private func tx(
        _ id: String,
        type: String,
        amount: Int,
        status: String = "completed",
        description: String? = nil,
        direction: String? = nil,
        createdAt: String? = "2026-06-03T14:14:00.000Z"
    ) -> WalletTransactionDTO {
        WalletTransactionDTO(
            id: id,
            type: type,
            amount: amount,
            direction: direction,
            description: description,
            currency: "usd",
            status: status,
            counterpartyId: nil,
            createdAt: createdAt
        )
    }

    private let pending = WalletPendingReleaseResponse(
        inReviewCents: 12000,
        releasingSoonCents: 6600,
        totalPendingCents: 18600,
        inReviewCount: 2,
        releasingSoonCount: 1
    )

    private var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? cal.timeZone
        return cal
    }

    private var fixedNow: Date {
        WalletViewModel.parseDate("2026-06-03T18:00:00.000Z") ?? Date(timeIntervalSince1970: 1_780_509_600)
    }

    // MARK: - Formatting

    func testCentsFormatting() {
        XCTAssertEqual(WalletViewModel.centsToPlain(84750), "847.50")
        XCTAssertEqual(WalletViewModel.centsToPlain(128_450), "1,284.50")
        XCTAssertEqual(WalletViewModel.centsToCurrency(18600), "$186.00")
        XCTAssertEqual(WalletViewModel.centsToPlain(0), "0.00")
    }

    func testDayLabels() {
        let cal = utcCalendar
        let today = WalletViewModel.dayLabel(
            WalletViewModel.parseDate("2026-06-03T09:00:00.000Z"), calendar: cal, now: fixedNow
        )
        let yesterday = WalletViewModel.dayLabel(
            WalletViewModel.parseDate("2026-06-02T23:00:00.000Z"), calendar: cal, now: fixedNow
        )
        let older = WalletViewModel.dayLabel(
            WalletViewModel.parseDate("2026-05-28T12:00:00.000Z"), calendar: cal, now: fixedNow
        )
        XCTAssertEqual(today, "Today")
        XCTAssertEqual(yesterday, "Yesterday")
        XCTAssertEqual(older, "May 28")
    }

    // MARK: - Per-field mapping

    func testDirectionMapping() {
        XCTAssertEqual(WalletViewModel.direction(for: "withdrawal"), .out)
        XCTAssertEqual(WalletViewModel.direction(for: "cancellation_fee"), .out)
        XCTAssertEqual(WalletViewModel.direction(for: "tip_sent"), .out)
        XCTAssertEqual(WalletViewModel.direction(for: "gig_income"), .in)
        XCTAssertEqual(WalletViewModel.direction(for: "refund"), .in)
    }

    func testCategoryMapping() {
        XCTAssertEqual(WalletViewModel.category(for: "withdrawal"), .bank)
        XCTAssertEqual(WalletViewModel.category(for: "transfer_in"), .bank)
        XCTAssertEqual(WalletViewModel.category(for: "cancellation_fee"), .fee)
        XCTAssertEqual(WalletViewModel.category(for: "refund"), .fee)
        XCTAssertEqual(WalletViewModel.category(for: "gig_income"), .handyman)
        XCTAssertEqual(WalletViewModel.category(for: "tip_income"), .handyman)
    }

    func testActivityItemMapping() {
        let item = WalletViewModel.activityItem(
            from: tx("tx-1", type: "gig_income", amount: 14000, description: "Patio cleanup · 3 hr"),
            calendar: utcCalendar,
            now: fixedNow
        )
        XCTAssertEqual(item.id, "tx-1")
        XCTAssertEqual(item.amount, "140.00")
        XCTAssertEqual(item.direction, .in)
        XCTAssertEqual(item.category, .handyman)
        XCTAssertEqual(item.day, "Today")
        XCTAssertEqual(item.dateLabel, "2:14 pm")
        XCTAssertEqual(item.description, "Patio cleanup · 3 hr")
        guard case .available = item.status else {
            return XCTFail("Expected completed inbound income to be .available")
        }
        XCTAssertFalse(item.isFee)
    }

    func testPendingTransactionMapsToPendingStatus() {
        let item = WalletViewModel.activityItem(
            from: tx("tx-2", type: "gig_income", amount: 8500, status: "pending"),
            calendar: utcCalendar,
            now: fixedNow
        )
        guard case .pending = item.status else {
            return XCTFail("Expected pending status, got \(item.status)")
        }
    }

    func testFeeRowFlaggedOutbound() {
        let item = WalletViewModel.activityItem(
            from: tx("tx-3", type: "cancellation_fee", amount: 240),
            calendar: utcCalendar,
            now: fixedNow
        )
        XCTAssertTrue(item.isFee)
        XCTAssertEqual(item.direction, .out)
        XCTAssertEqual(item.category, .fee)
    }

    // MARK: - Whole-content projection

    func testMakeContentProjection() {
        let content = WalletViewModel.makeContent(
            balance: balance(84750),
            transactions: [
                tx("tx-1", type: "gig_income", amount: 14000, createdAt: "2026-06-03T14:14:00.000Z"),
                tx("tx-2", type: "withdrawal", amount: 50000, createdAt: "2026-05-28T11:14:00.000Z")
            ],
            pending: pending,
            calendar: utcCalendar,
            now: fixedNow
        )
        XCTAssertEqual(content.available, "847.50")
        XCTAssertEqual(content.pending, "$186.00")
        XCTAssertEqual(content.activity.count, 2)
        // Only the inbound June row counts toward "this month".
        XCTAssertEqual(content.monthValue, "$140.00")
        XCTAssertEqual(content.monthMeta, "1 task this month")
        XCTAssertFalse(content.isOnHold, "Live content never renders the Stripe-specific hold banner")
        XCTAssertEqual(content.activity[1].category, .bank)
    }

    func testMakeContentWithNoPendingDegradesGracefully() {
        let content = WalletViewModel.makeContent(
            balance: balance(0),
            transactions: [],
            pending: nil,
            calendar: utcCalendar,
            now: fixedNow
        )
        XCTAssertEqual(content.available, "0.00")
        XCTAssertEqual(content.pending, "$0.00")
        XCTAssertEqual(content.pendingMeta, "Nothing in escrow")
        XCTAssertTrue(content.activity.isEmpty)
    }

    // MARK: - Live load() path

    func testLiveLoadFetchesAndPopulates() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/wallet": [
                .status(200, body: """
                {"wallet":{"id":"w1","balance":84750,"currency":"usd","frozen":false,\
                "lifetime_withdrawals":0,"lifetime_received":84750}}
                """)
            ],
            "/api/wallet/transactions": [
                .status(200, body: """
                {"transactions":[{"id":"tx-1","type":"gig_income","amount":14000,\
                "description":"Patio cleanup","currency":"usd","status":"completed",\
                "created_at":"2026-06-03T14:14:00.000Z"}],"total":1,"limit":50,"offset":0}
                """)
            ],
            "/api/wallet/pending-release": [
                .status(200, body: """
                {"in_review_cents":12000,"releasing_soon_cents":6600,"total_pending_cents":18600,\
                "in_review_count":2,"releasing_soon_count":1}
                """)
            ]
        ])
        let client = APIClient(session: session, retryPolicy: .none)
        let vm = WalletViewModel(api: client)
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected populated, got \(vm.state)")
        }
        XCTAssertEqual(content.available, "847.50")
        XCTAssertEqual(content.pending, "$186.00")
        XCTAssertEqual(content.activity.count, 1)
        XCTAssertEqual(content.activity.first?.amount, "140.00")
    }

    func testLiveLoadSurfacesError() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/wallet": [
                .status(500, body: "{\"error\":\"boom\"}")
            ]
        ])
        let client = APIClient(session: session, retryPolicy: .none)
        let vm = WalletViewModel(api: client)
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }
}
