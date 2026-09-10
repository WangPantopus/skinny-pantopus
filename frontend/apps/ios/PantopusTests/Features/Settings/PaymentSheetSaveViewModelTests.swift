import XCTest
@testable import Pantopus

@MainActor
final class PaymentSheetSaveViewModelTests: XCTestCase {
    private static let prepare = "/api/payments/payment-sheet-add-card"
    private static let confirm = "\(prepare)/confirm"
    private static let methods = "/api/payments/methods"
    private static let params = """
    {"setupIntent":"seti_saved_secret_test","setupIntentId":"seti_saved","setupStatus":"requires_payment_method",
    "ephemeralKey":"ek_test","customer":"cus_test"}
    """
    private static let receipt = """
    {"confirmed":true,"paymentMethod":{"id":"pm_saved","payment_method_type":"card",
    "card_brand":"visa","card_last4":"4242","is_default":true}}
    """

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func model(_ presenter: SaveCardPresenter) -> PaymentsViewModel {
        PaymentsViewModel(
            api: APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            sheetPresenter: presenter
        )
    }

    private func stub(confirmation: [SequencedURLProtocol.Response], list: SequencedURLProtocol.Response) {
        SequencedURLProtocol.routeResponses = [
            Self.prepare: [.status(200, body: Self.params)], Self.confirm: confirmation, Self.methods: [list]
        ]
    }

    func testFailedReconciliationRetriesSameIntentWithoutAnotherSheet() async throws {
        stub(
            confirmation: [.status(503, body: "{}"), .status(200, body: Self.receipt)],
            list: .status(200, body: "{\"paymentMethods\":[{\"id\":\"pm_saved\",\"is_default\":true}]}")
        )
        let presenter = SaveCardPresenter()
        let vm = model(presenter)
        await vm.tapAddMethod()
        XCTAssertEqual(vm.addMethodLabel, "Retry saving card")
        XCTAssertNotNil(vm.actionError)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.compactMap { $0.url?.path }, [Self.prepare, Self.confirm])
        await vm.tapAddMethod()
        XCTAssertEqual(presenter.calls, 1)
        XCTAssertEqual(vm.addMethodLabel, "Add payment method")
        XCTAssertNil(vm.actionError)
        guard case let .loaded(content) = vm.state else { return XCTFail("Missing durable saved card") }
        XCTAssertEqual(content.methods.map(\.id), ["pm_saved"])
        let confirms = SequencedURLProtocol.capturedRequests.filter { $0.url?.path == Self.confirm }
        XCTAssertEqual(confirms.count, 2)
        for request in confirms {
            let body = try XCTUnwrap(JSONSerialization.jsonObject(with: Self.body(request)) as? [String: String])
            XCTAssertEqual(body, ["setupIntentId": "seti_saved"])
        }
    }

    func testSavedReceiptSurvivesFailedListRefresh() async {
        stub(confirmation: [.status(200, body: Self.receipt)], list: .status(503, body: "{}"))
        let vm = model(SaveCardPresenter())
        await vm.tapAddMethod()
        guard case let .loaded(content) = vm.state else { return XCTFail("Saved card was lost") }
        XCTAssertEqual(content.methods.first?.last4, "4242")
        XCTAssertEqual(vm.addMethodLabel, "Add payment method")
        XCTAssertTrue(vm.actionError?.hasPrefix("Your card was saved.") == true)
    }

    func testFalseConfirmationNeverProjectsASavedCard() async {
        stub(
            confirmation: [.status(200, body: Self.receipt.replacingOccurrences(of: "\"confirmed\":true", with: "\"confirmed\":false"))],
            list: .status(200, body: "{}")
        )
        let vm = model(SaveCardPresenter())
        await vm.tapAddMethod()
        XCTAssertEqual(vm.addMethodLabel, "Retry saving card")
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == Self.methods })
        if case .loaded = vm.state { XCTFail("Unconfirmed receipt was displayed") }
    }

    func testSuccessfulListCanRemoveAJustConfirmedCard() async {
        stub(confirmation: [.status(200, body: Self.receipt)], list: .status(200, body: "{\"paymentMethods\":[]}"))
        let vm = model(SaveCardPresenter())
        await vm.tapAddMethod()
        guard case let .loaded(content) = vm.state else { return XCTFail("Missing list") }
        XCTAssertTrue(content.methods.isEmpty, "Fresh removal wins over the older confirmation receipt")
    }

    func testSuccessfulListCanChangeTheDefaultAfterConfirmation() async {
        let list = """
        {"paymentMethods":[{"id":"pm_other","is_default":true},{"id":"pm_saved","is_default":false}]}
        """
        stub(confirmation: [.status(200, body: Self.receipt)], list: .status(200, body: list))
        let vm = model(SaveCardPresenter())
        await vm.tapAddMethod()
        guard case let .loaded(content) = vm.state else { return XCTFail("Missing list") }
        XCTAssertEqual(content.methods.map(\.id), ["pm_other", "pm_saved"])
        XCTAssertNotNil(content.methods.first?.chip)
        XCTAssertNil(content.methods.last?.chip, "Do not restore the old receipt's default")
    }

    func testDuplicateTapsDuringPreparationAndPresentationDoNotCreateAnotherIntent() async {
        SequencedURLProtocol.routeResponses[Self.prepare] = [.status(200, body: Self.params, delay: 0.1)]
        let presenter = SaveCardPresenter()
        presenter.hold = true
        let vm = model(presenter)
        let first = Task { await vm.tapAddMethod() }
        await Task.yield()
        await vm.tapAddMethod()
        while presenter.calls == 0 {
            await Task.yield()
        }
        XCTAssertTrue(vm.isAddingMethod)
        await vm.tapAddMethod()
        presenter.finish(.canceled)
        await first.value
        XCTAssertEqual(presenter.calls, 1)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
        XCTAssertFalse(vm.isAddingMethod)
        XCTAssertEqual(vm.addMethodLabel, "Retry saving card")
        XCTAssertNil(vm.actionError)
    }

    func testMissingSetupIdentifierFailsBeforePresentation() async {
        SequencedURLProtocol.routeResponses[Self.prepare] = [
            .status(200, body: "{\"setupIntent\":\"seti_secret\",\"customer\":\"cus_test\",\"ephemeralKey\":\"ek_test\"}")
        ]
        let presenter = SaveCardPresenter()
        let vm = model(presenter)
        await vm.tapAddMethod()
        XCTAssertEqual(presenter.calls, 0)
        XCTAssertNotNil(vm.actionError)
        XCTAssertFalse(vm.isAddingMethod)
    }

    func testSavedCardDTOUsesRealCamelAndSnakeCaseKeys() throws {
        let params = try JSONDecoder().decode(AddCardSheetParams.self, from: Data(Self.params.utf8))
        XCTAssertEqual(params.setupIntentId, "seti_saved")
        let receipt = try JSONDecoder().decode(ConfirmAddCardResponse.self, from: Data(Self.receipt.utf8))
        XCTAssertTrue(receipt.confirmed)
        XCTAssertEqual(receipt.paymentMethod.cardLast4, "4242")
        XCTAssertTrue(receipt.paymentMethod.isDefault)
    }

    private static func body(_ request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}

@MainActor
private final class SaveCardPresenter: PaymentSheetPresenting {
    private(set) var calls = 0
    var hold = false
    private var continuation: CheckedContinuation<PaymentSheetOutcome, Never>?

    func presentAddCard(
        setupIntentClientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        calls += 1
        if hold { return await withCheckedContinuation { continuation = $0 } }
        return .completed
    }

    func finish(_ outcome: PaymentSheetOutcome) {
        continuation?.resume(returning: outcome)
        continuation = nil
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
