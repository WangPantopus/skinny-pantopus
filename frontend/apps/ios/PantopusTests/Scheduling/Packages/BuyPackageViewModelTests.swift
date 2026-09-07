//
//  BuyPackageViewModelTests.swift
//  PantopusTests
//
//  G10 · Stream I15. Purchase outcomes (free, paid→PaymentSheet, declined) and
//  the already-owns-credits upsell, with a stubbed PaymentSheet presenter.
//

import XCTest
@testable import Pantopus

@MainActor
final class BuyPackageViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = true
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        SchedulingFeatureFlags.paidEnabled = false
        super.tearDown()
    }

    private struct StubPresenter: PaymentSheetPresenting {
        let outcome: PaymentSheetOutcome
        func presentAddCard(
            setupIntentClientSecret _: String,
            customer _: String,
            ephemeralKey _: String,
            publishableKey _: String?
        ) async -> PaymentSheetOutcome {
            outcome
        }

        func presentPayment(
            clientSecret _: String,
            customer _: String,
            ephemeralKey _: String,
            isSetupIntent _: Bool,
            publishableKey _: String?
        ) async -> PaymentSheetOutcome {
            outcome
        }
    }

    private func vm(
        presenter: PaymentSheetOutcome = .completed,
        _ routes: [String: [SequencedURLProtocol.Response]]
    ) -> BuyPackageViewModel {
        BuyPackageViewModel(
            owner: .business(id: "biz1"),
            packageId: "pk1",
            push: { _ in },
            client: SchedulingClient(client: APIClient(
                session: SequencedURLProtocol.makeSession(routeResponses: routes),
                retryPolicy: .none
            )),
            presenter: StubPresenter(outcome: presenter)
        )
    }

    // swiftlint:disable:next line_length
    private let freeBuy = #"{"credit":{"id":"cr1","package_id":"pk1","buyer_user_id":"u1","remaining_sessions":5,"purchased_at":"2026-06-15T00:00:00Z"},"clientSecret":null}"#
    // swiftlint:disable:next line_length
    private let paidBuy = #"{"credit":{"id":"cr1","package_id":"pk1","buyer_user_id":"u1","remaining_sessions":5,"purchased_at":"2026-06-15T00:00:00Z"},"clientSecret":"pi_test_secret"}"#

    func testFreePackagePaidWithoutSheet() async {
        let model = vm(
            presenter: .failed(message: "should-not-be-used"),
            ["/api/scheduling/packages/pk1/buy": [.status(201, body: freeBuy)]]
        )
        await model.pay()
        XCTAssertEqual(model.payState, .paid)
    }

    func testPaidPackageCompletesViaSheet() async {
        let model = vm(presenter: .completed, ["/api/scheduling/packages/pk1/buy": [.status(201, body: paidBuy)]])
        await model.pay()
        XCTAssertEqual(model.payState, .paid)
    }

    func testDeclinedWhenSheetFails() async {
        let model = vm(
            presenter: .failed(message: "Your card was declined."),
            ["/api/scheduling/packages/pk1/buy": [.status(201, body: paidBuy)]]
        )
        await model.pay()
        guard case .declined = model.payState else { return XCTFail("expected declined") }
    }

    func testCanceledSheetReturnsToIdle() async {
        let model = vm(presenter: .canceled, ["/api/scheduling/packages/pk1/buy": [.status(201, body: paidBuy)]])
        await model.pay()
        XCTAssertEqual(model.payState, .idle)
    }

    func testLoadDetectsExistingCreditUpsell() async {
        // swiftlint:disable:next line_length
        let packages = #"{"packages":[{"id":"pk1","owner_type":"business","owner_id":"biz1","name":"5-session cleaning","sessions_count":5,"price_cents":22000,"currency":"USD","is_active":true,"created_at":"2026-06-10T00:00:00Z"}]}"#
        // swiftlint:disable:next line_length
        let mine = #"{"credits":[{"id":"cr1","package_id":"pk1","buyer_user_id":"u1","remaining_sessions":2,"purchased_at":"2026-05-01T00:00:00Z","BookingPackage":{"name":"5-session cleaning","sessions_count":5,"owner_type":"business","owner_id":"biz1"}}]}"#
        let model = vm([
            "/api/scheduling/packages": [.status(200, body: packages)],
            "/api/scheduling/my-packages": [.status(200, body: mine)]
        ])
        await model.load()
        XCTAssertEqual(model.phase, .ready)
        XCTAssertNotNil(model.existingCredit)
        XCTAssertTrue(model.payButtonLabel.contains("Pay"))
    }
}
