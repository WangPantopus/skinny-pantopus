//
//  InvoiceCheckoutTests.swift
//  PantopusTests
//
//  The invoice "Pay" CTA runs the real backend sequence:
//    POST /api/businesses/invoices/{id}/pay      → PaymentIntent client secret
//    → Stripe PaymentSheet
//    → POST /api/businesses/invoices/{id}/confirm
//    → GET /api/businesses/invoices/{id}         (server is the source of truth)
//  These tests drive the success / declined / canceled / pay-failure branches
//  with a stub presenter + `SequencedURLProtocol`, so the round-trip is
//  exercised without the Stripe SDK.
//

import XCTest
@testable import Pantopus

@MainActor
final class InvoiceCheckoutTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private static func invoiceJSON(status: String, paidAt: String? = nil) -> String {
        let paid = paidAt.map { "\"\($0)\"" } ?? "null"
        return """
        {"invoice":{"id":"7f3c1a24-1111-4000-8000-000000000001","business_user_id":"b1",\
        "recipient_user_id":"u1","line_items":[{"description":"Install labor",\
        "amount_cents":6500,"quantity":2}],"subtotal_cents":13000,"fee_cents":390,\
        "total_cents":13000,"currency":"usd","status":"\(status)",\
        "due_date":"2025-12-18T17:00:00.000Z","memo":null,\
        "created_at":"2025-12-04T17:00:00.000Z","paid_at":\(paid),\
        "business":{"id":"b1","name":"Brightside Outdoor","username":"brightside"}}}
        """
    }

    private static let payJSON = """
    {"client_secret":"pi_secret_1","payment_intent_id":"pi_1","payment_id":"pay_1",\
    "amount_cents":13000,"fee_cents":390}
    """

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(presenter: StubCheckoutPresenter) -> InvoiceDetailViewModel {
        let api = makeAPI()
        return InvoiceDetailViewModel(
            invoiceId: "7f3c1a24-1111-4000-8000-000000000001",
            api: api,
            checkout: CheckoutCoordinator(api: api, presenter: presenter)
        )
    }

    /// The invoice is read from the backend — never from a fixture.
    func testLoadRendersTheServerInvoice() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.invoiceJSON(status: "sent"))]
        let vm = makeVM(presenter: StubCheckoutPresenter())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.hero.priceLine, "$130.00")
        XCTAssertEqual(content.dock.primary.label, "Pay $130.00")
    }

    /// A backend failure surfaces the error frame (with Retry), not a fixture.
    func testLoadFailureSurfacesErrorFrame() async {
        SequencedURLProtocol.sequence = [.status(404, body: "{\"error\":\"Invoice not found\"}")]
        let vm = makeVM(presenter: StubCheckoutPresenter())
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    /// checkout.paySuccess — pay → sheet → confirm → re-read.
    func testPayCompletesConfirmsAndRefreshes() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.invoiceJSON(status: "sent")),
            .status(200, body: Self.payJSON),
            .status(200, body: Self.invoiceJSON(status: "paid", paidAt: "2025-12-14T17:00:00.000Z")),
            .status(200, body: Self.invoiceJSON(status: "paid", paidAt: "2025-12-14T17:00:00.000Z"))
        ]
        let presenter = StubCheckoutPresenter()
        presenter.outcome = .completed
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.payNow()

        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertEqual(presenter.lastClientSecret, "pi_secret_1")
        XCTAssertNil(presenter.lastPublishableKey, "the invoice pay route returns no publishable key")
        XCTAssertEqual(vm.paymentStatus, .paid)
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected the invoice to re-load after payment, got \(vm.state)")
        }
        XCTAssertEqual(content.dock.primary.label, "Paid in full")
        XCTAssertFalse(content.dock.primary.enabled)
    }

    /// checkout.payDeclined — card declined / SCA failed.
    func testPayDeclinedSurfacesMessage() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.invoiceJSON(status: "sent")),
            .status(200, body: Self.payJSON)
        ]
        let presenter = StubCheckoutPresenter()
        presenter.outcome = .failed(message: "Your card was declined.")
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.payNow()
        XCTAssertEqual(vm.paymentStatus, .declined(message: "Your card was declined."))
    }

    /// checkout.cancel — buyer dismissed the sheet.
    func testPayCanceledLeavesInvoiceUnpaid() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.invoiceJSON(status: "sent")),
            .status(200, body: Self.payJSON)
        ]
        let presenter = StubCheckoutPresenter()
        presenter.outcome = .canceled
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.payNow()
        XCTAssertEqual(vm.paymentStatus, .canceled)
    }

    /// `/pay` fails → never presents the sheet, surfaces the server's message.
    func testPayFailureDoesNotPresentSheet() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.invoiceJSON(status: "sent")),
            .status(400, body: "{\"error\":\"This invoice has already been paid\"}")
        ]
        let presenter = StubCheckoutPresenter()
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.payNow()
        XCTAssertEqual(presenter.presentPaymentCallCount, 0)
        guard case .declined = vm.paymentStatus else {
            return XCTFail("Expected .declined, got \(vm.paymentStatus)")
        }
    }

    /// A paid invoice never re-runs checkout.
    func testPaidInvoiceRefusesToPayAgain() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.invoiceJSON(status: "paid", paidAt: "2025-12-14T17:00:00.000Z"))
        ]
        let presenter = StubCheckoutPresenter()
        let vm = makeVM(presenter: presenter)
        await vm.load()
        await vm.payNow()
        XCTAssertEqual(presenter.presentPaymentCallCount, 0)
        XCTAssertEqual(vm.paymentStatus, .declined(message: "This invoice has already been paid."))
    }

    /// The coordinator maps a missing client secret to .failed (no present).
    func testCoordinatorRejectsEmptyClientSecret() async {
        let presenter = StubCheckoutPresenter()
        let coordinator = CheckoutCoordinator(api: makeAPI(), presenter: presenter)
        let outcome = await coordinator.present(PaymentIntentSheetParams(clientSecret: nil))
        XCTAssertEqual(presenter.presentPaymentCallCount, 0)
        guard case .failed = outcome else {
            return XCTFail("Expected .failed for a missing client secret, got \(outcome)")
        }
    }
}

/// Records `presentPayment` calls and returns a scripted outcome so the
/// checkout branches are unit-testable without the Stripe SDK.
@MainActor
private final class StubCheckoutPresenter: PaymentSheetPresenting {
    var outcome: PaymentSheetOutcome = .completed
    private(set) var presentPaymentCallCount = 0
    private(set) var lastClientSecret: String?
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
        clientSecret: String,
        customer _: String,
        ephemeralKey _: String,
        isSetupIntent _: Bool,
        publishableKey: String?
    ) async -> PaymentSheetOutcome {
        presentPaymentCallCount += 1
        lastClientSecret = clientSecret
        lastPublishableKey = publishableKey
        return outcome
    }
}
