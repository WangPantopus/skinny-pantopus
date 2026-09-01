//
//  PaymentsViewModelTests.swift
//  PantopusTests
//
//  Asserts the A14.6 Payments view-model projects the populated and
//  empty fixtures end-to-end: balance hero present/absent, methods
//  count, Stripe Connect chip swap, payouts gating, activity
//  collapse, and the destructive-card gate.
//

// swiftlint:disable file_length type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class PaymentsViewModelTests: XCTestCase {
    func testLoadPopulatedProjectsAllSections() async {
        let vm = PaymentsViewModel(seed: .populated)
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded for populated seed")
            return
        }

        // Balance hero present with payout footer payload.
        XCTAssertNotNil(loaded.balance)
        XCTAssertEqual(loaded.balance?.overline, "Available to pay out")
        XCTAssertEqual(loaded.balance?.amount, "124.50")
        XCTAssertEqual(loaded.balance?.frequencyPill, "Weekly")

        // Three methods, first is default.
        XCTAssertEqual(loaded.methods.count, 3)
        XCTAssertEqual(loaded.methods.first?.brand, .visa)
        XCTAssertEqual(loaded.methods.first?.chip?.label, "Default")
        XCTAssertEqual(loaded.methods.first?.chip?.tone, .primary)
        XCTAssertEqual(loaded.methods.last?.brand, .applePay)

        // Stripe connected — success chip, schedule row present.
        if case let .chipChevron(label, tone) = loaded.payouts.stripe.trailing {
            XCTAssertEqual(label, "Connected")
            XCTAssertEqual(tone, .success)
        } else {
            XCTFail("Stripe row should show success chip + chevron")
        }
        XCTAssertNotNil(loaded.payouts.payoutSchedule)
        XCTAssertEqual(loaded.payouts.payoutSchedule?.subtext, "Weekly · Mondays")

        // Tax info: on-file chip.
        if case let .chipChevron(label, tone) = loaded.payouts.taxInfo.trailing {
            XCTAssertEqual(label, "On file")
            XCTAssertEqual(tone, .success)
        } else {
            XCTFail("Tax row should show on-file chip + chevron")
        }

        // Activity: 3 chevron rows.
        if case let .stats(stats) = loaded.activity {
            XCTAssertEqual(stats.count, 3)
            XCTAssertEqual(stats[0].label, "Transactions")
            XCTAssertEqual(stats[1].label, "Statements")
            XCTAssertEqual(stats[2].label, "Disputes")
        } else {
            XCTFail("Activity should be stats[]")
        }

        XCTAssertTrue(loaded.canCloseAccount, "Populated frame surfaces the destructive card")
    }

    func testLoadEmptyHidesHeroAndGatesPayoutRows() async {
        let vm = PaymentsViewModel(seed: .empty)
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded for empty seed")
            return
        }

        // No hero, no methods, no schedule row.
        XCTAssertNil(loaded.balance, "Empty frame omits the balance hero")
        XCTAssertTrue(loaded.methods.isEmpty)
        XCTAssertNil(loaded.payouts.payoutSchedule, "Schedule row gates behind Stripe Connect")

        // Stripe shows the primary CTA chip.
        if case let .ctaChip(label, tone) = loaded.payouts.stripe.trailing {
            XCTAssertEqual(label, "Connect")
            XCTAssertEqual(tone, .primary)
        } else {
            XCTFail("Empty Stripe row should expose a Connect CTA chip")
        }

        // Payout method + tax info gated.
        XCTAssertEqual(loaded.payouts.payoutMethod.trailing, .gatedDash)
        XCTAssertEqual(loaded.payouts.taxInfo.trailing, .gatedDash)

        // Activity collapses to the empty row.
        if case let .empty(title, _) = loaded.activity {
            XCTAssertEqual(title, "No transactions yet")
        } else {
            XCTFail("Activity should collapse to the empty row")
        }

        XCTAssertFalse(loaded.canCloseAccount, "Empty frame hides the destructive card")
    }

    func testInitialStateIsLoading() {
        let vm = PaymentsViewModel(seed: .populated)
        if case .loading = vm.state { return }
        XCTFail("VM should start in .loading until load() runs")
    }

    // MARK: - Live path (Phase 3 / 3A)

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        stubSupplementaryLoadRoutes()
    }

    /// `load()` fans out to five routes, but the ordered `sequence` below
    /// describes only the two the tests actually assert on (methods, then
    /// history) plus the add-card flow. The three supplementary reads —
    /// earnings, spending and the Connect account — each degrade to `nil` on
    /// their own and are not part of any assertion, so they are answered by
    /// route instead. `routeResponses` is consulted before `sequence`, which
    /// keeps them from eating the entries the add-card assertions depend on.
    private func stubSupplementaryLoadRoutes() {
        // Enough entries for the reloads a single test performs.
        let empty = Array(repeating: SequencedURLProtocol.Response.status(200, body: "{}"), count: 4)
        SequencedURLProtocol.routeResponses["/api/payments/earnings"] = empty
        SequencedURLProtocol.routeResponses["/api/payments/spending"] = empty
        SequencedURLProtocol.routeResponses["/api/payments/connect/account"] = empty
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private struct CardFixture {
        let id: String
        let brand: String
        let last4: String
        let expMonth: Int
        let expYear: Int
        let isDefault: Bool
    }

    private static func cardJSON(_ card: CardFixture) -> String {
        """
        {"id":"\(card.id)","payment_method_type":"card","card_brand":"\(card.brand)",
         "card_last4":"\(card.last4)","card_exp_month":\(card.expMonth),
         "card_exp_year":\(card.expYear),"is_default":\(card.isDefault)}
        """
    }

    private static func methodsResponse(_ cards: String...) -> String {
        "{\"paymentMethods\":[\(cards.joined(separator: ","))]}"
    }

    private static let defaultVisa = CardFixture(
        id: "pm_1",
        brand: "visa",
        last4: "4242",
        expMonth: 3,
        expYear: 2027,
        isDefault: true
    )

    private static let alternateMastercard = CardFixture(
        id: "pm_2",
        brand: "mastercard",
        last4: "4444",
        expMonth: 11,
        expYear: 2026,
        isDefault: false
    )

    private static let defaultMastercard = CardFixture(
        id: "pm_2",
        brand: "mastercard",
        last4: "4444",
        expMonth: 11,
        expYear: 2026,
        isDefault: true
    )

    private static let alternateVisa = CardFixture(
        id: "pm_1",
        brand: "visa",
        last4: "4242",
        expMonth: 3,
        expYear: 2027,
        isDefault: false
    )

    private static let methodsJSON = methodsResponse(
        cardJSON(defaultVisa),
        cardJSON(alternateMastercard)
    )

    private static let addCardParamsJSON = """
    {"setupIntent":"seti_123_secret_abc","ephemeralKey":"ek_test_123","customer":"cus_123","publishableKey":"pk_test_x"}
    """

    /// `GET /api/payments/history` — every live `load()` reads it right after
    /// the methods list.
    private static let emptyHistoryJSON = "{\"transactions\":[],\"total\":0}"

    private static let historyJSON = """
    {"transactions":[\
    {"id":"p1","entry_type":"payment","amount_cents":12000,"currency":"usd","direction":"credit",\
    "status":"succeeded","payment_type":"gig_payment","created_at":"2026-03-04T17:00:00.000Z",\
    "gig":{"id":"g1","title":"Gutter cleaning"},"payer":{"id":"u2","name":"Ana Ruiz"},"_isSender":false},\
    {"id":"p2","entry_type":"payment","amount_cents":2500,"currency":"usd","direction":"debit",\
    "status":"succeeded","payment_type":"tip","created_at":"2026-03-02T17:00:00.000Z",\
    "payee":{"id":"u3","name":"Sam Cole"},"_isSender":true},\
    {"id":"payout_1","entry_type":"payout","amount_cents":40000,"currency":"USD","direction":"debit",\
    "status":"paid","destination_last4":"6789","description":"Payout to bank ••••6789",\
    "created_at":"2026-03-01T17:00:00.000Z"}\
    ],"total":3}
    """

    func testLiveLoadProjectsRealMethods() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.emptyHistoryJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.methods.count, 2)
        XCTAssertEqual(loaded.methods[0].brand, .visa)
        XCTAssertEqual(loaded.methods[0].label, "Visa •• 4242")
        XCTAssertEqual(loaded.methods[0].subtext, "Expires 03/27")
        XCTAssertEqual(loaded.methods[0].chip?.label, "Default")
        XCTAssertEqual(loaded.methods[1].brand, .mastercard)
        XCTAssertNil(loaded.methods[1].chip, "Only the default method carries a chip")
        // Live frame never fabricates a balance — Payouts/Connect land in 3C.
        XCTAssertNil(loaded.balance)
        if case let .ctaChip(label, _) = loaded.payouts.stripe.trailing {
            XCTAssertEqual(label, "Connect")
        } else {
            XCTFail("Live frame should expose the Stripe Connect CTA")
        }
    }

    /// The Activity card renders the real history feed — type, status,
    /// counterparty and signed amounts.
    func testLiveLoadProjectsTransactionHistory() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.historyJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case let .loaded(loaded) = vm.state,
              case let .transactions(rows) = loaded.activity
        else {
            return XCTFail("Expected the Activity card to carry transactions, got \(vm.state)")
        }
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(rows[0].title, "Gutter cleaning")
        XCTAssertEqual(rows[0].kind, .received)
        XCTAssertEqual(rows[0].amount, "+$120.00")
        XCTAssertFalse(rows[0].isOutgoing)
        XCTAssertTrue(rows[0].meta.contains("from Ana Ruiz"))
        XCTAssertTrue(rows[0].meta.contains("Succeeded"))
        XCTAssertEqual(rows[1].kind, .tip, "tips carry the star treatment")
        XCTAssertEqual(rows[1].amount, "-$25.00")
        XCTAssertTrue(rows[1].meta.contains("to Sam Cole"))
        XCTAssertEqual(rows[2].kind, .payout)
        XCTAssertEqual(rows[2].title, "Payout to bank ••••6789")
        XCTAssertEqual(rows[2].amount, "-$400.00")
    }

    /// A user with no payments keeps the genuine empty state.
    func testLiveLoadEmptyHistoryKeepsEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.emptyHistoryJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case let .loaded(loaded) = vm.state, case let .empty(title, _) = loaded.activity else {
            return XCTFail("Expected the empty activity row, got \(vm.state)")
        }
        XCTAssertEqual(title, "No transactions yet")
    }

    /// A history failure must not sink the screen — methods still render.
    func testHistoryFailureKeepsMethodsUsable() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case let .loaded(loaded) = vm.state, case let .empty(title, _) = loaded.activity else {
            return XCTFail("Expected .loaded with an honest activity row, got \(vm.state)")
        }
        XCTAssertEqual(loaded.methods.count, 2)
        XCTAssertEqual(title, "Couldn't load transactions")
    }

    func testLiveLoadEmptyMethods() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"paymentMethods\":[]}"),
            .status(200, body: Self.emptyHistoryJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertTrue(loaded.methods.isEmpty)
    }

    func testLiveLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testAddCardCompletedRefreshesMethods() async {
        // load (empty) → add-card params → reload (now one card).
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"paymentMethods\":[]}"),
            .status(200, body: Self.emptyHistoryJSON),
            .status(200, body: Self.addCardParamsJSON),
            .status(200, body: Self.methodsJSON)
        ]
        let presenter = StubPaymentSheetPresenter()
        presenter.addCardOutcome = .completed
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: presenter)
        await vm.load()
        await vm.tapAddMethod()
        XCTAssertEqual(presenter.presentAddCardCallCount, 1)
        XCTAssertEqual(presenter.lastAddCardPublishableKey, "pk_test_x")
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.methods.count, 2, "Completed add-card refreshes from the backend")
        XCTAssertNil(vm.actionError)
    }

    func testAddCardCanceledDoesNotRefresh() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"paymentMethods\":[]}"),
            .status(200, body: Self.emptyHistoryJSON),
            .status(200, body: Self.addCardParamsJSON)
        ]
        let presenter = StubPaymentSheetPresenter()
        presenter.addCardOutcome = .canceled
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: presenter)
        await vm.load()
        await vm.tapAddMethod()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertTrue(loaded.methods.isEmpty, "Cancel leaves the list untouched")
        XCTAssertNil(vm.actionError)
    }

    func testSetDefaultOptimisticThenReconcile() async {
        // load → PUT default → reload (pm_2 now default).
        let reorderedJSON = Self.methodsResponse(
            Self.cardJSON(Self.defaultMastercard),
            Self.cardJSON(Self.alternateVisa)
        )
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.emptyHistoryJSON),
            .status(200, body: "{\"message\":\"ok\"}"),
            .status(200, body: reorderedJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        await vm.setDefault("pm_2")
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        let defaultMethod = loaded.methods.first { $0.chip?.tone == .primary }
        XCTAssertEqual(defaultMethod?.id, "pm_2")
    }

    func testSetDefaultFailureRevertsAndSurfacesError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.emptyHistoryJSON),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        await vm.setDefault("pm_2")
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Reverted: pm_1 is still the default.
        XCTAssertEqual(loaded.methods.first { $0.chip?.tone == .primary }?.id, "pm_1")
        XCTAssertNotNil(vm.actionError)
    }

    func testRemoveMethodOptimisticThenReconcile() async {
        let afterRemovalJSON = Self.methodsResponse(
            Self.cardJSON(Self.defaultVisa)
        )
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.emptyHistoryJSON),
            .status(200, body: "{\"message\":\"ok\"}"),
            .status(200, body: afterRemovalJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        await vm.removeMethod("pm_2")
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.methods.count, 1)
        XCTAssertEqual(loaded.methods.first?.id, "pm_1")
    }

    /// The destructive path is gated behind a second step: tapping
    /// "Remove Card" only queues the confirmation, and nothing reaches
    /// `DELETE /api/payments/methods/{id}` until it is confirmed.
    func testRemoveMethodRequiresConfirmationBeforeDelete() async {
        let afterRemovalJSON = Self.methodsResponse(
            Self.cardJSON(Self.defaultVisa)
        )
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.methodsJSON),
            .status(200, body: Self.emptyHistoryJSON),
            .status(200, body: "{\"message\":\"ok\"}"),
            .status(200, body: afterRemovalJSON)
        ]
        let vm = PaymentsViewModel(api: makeAPI(), sheetPresenter: StubPaymentSheetPresenter())
        await vm.load()
        guard case let .loaded(loaded) = vm.state, let method = loaded.methods.last else {
            XCTFail("Expected .loaded with methods, got \(vm.state)")
            return
        }

        // Tapping the action menu's destructive item only queues the card.
        vm.requestRemoval(method)
        XCTAssertEqual(vm.pendingRemoval?.id, "pm_2")
        XCTAssertEqual(vm.pendingRemoval?.last4, "4444", "The confirmation names the card by its last4")
        XCTAssertTrue(Self.deleteRequests().isEmpty, "No DELETE before the user confirms")
        guard case let .loaded(queued) = vm.state else {
            XCTFail("Queuing a removal shouldn't change the render state")
            return
        }
        XCTAssertEqual(queued.methods.count, 2, "The row stays put until the removal is confirmed")

        // Dismissing the confirmation still issues nothing.
        vm.cancelRemoval()
        XCTAssertNil(vm.pendingRemoval)
        XCTAssertTrue(Self.deleteRequests().isEmpty, "Cancelling leaves the card on file")

        // Confirming is the only path that reaches the backend.
        vm.requestRemoval(method)
        await vm.removeMethod(method.id)
        XCTAssertNil(vm.pendingRemoval, "Confirming clears the queued removal")
        XCTAssertEqual(Self.deleteRequests().count, 1)
        XCTAssertEqual(Self.deleteRequests().first?.url?.path, "/api/payments/methods/pm_2")
        guard case let .loaded(removed) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(removed.methods.map(\.id), ["pm_1"])
    }

    private static func deleteRequests() -> [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "DELETE" }
    }
}

/// Records presentation calls and returns a scripted outcome so the
/// view-model's add-card branch is unit-testable without the Stripe SDK.
@MainActor
private final class StubPaymentSheetPresenter: PaymentSheetPresenting {
    var addCardOutcome: PaymentSheetOutcome = .completed
    private(set) var presentAddCardCallCount = 0
    private(set) var lastAddCardPublishableKey: String?

    func presentAddCard(
        setupIntentClientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        publishableKey: String?
    ) async -> PaymentSheetOutcome {
        presentAddCardCallCount += 1
        lastAddCardPublishableKey = publishableKey
        return addCardOutcome
    }

    func presentPayment(
        clientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        isSetupIntent _: Bool,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        .completed
    }
}
