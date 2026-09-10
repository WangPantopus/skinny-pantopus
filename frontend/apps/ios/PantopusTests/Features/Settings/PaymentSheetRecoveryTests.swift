import XCTest
@testable import Pantopus

@MainActor
final class PaymentSheetRecoveryTests: XCTestCase {
    private static let prepare = "/api/payments/payment-sheet-add-card"
    private static let confirm = "\(prepare)/confirm"
    private static let methods = "/api/payments/methods"
    private static let receipt = "{\"confirmed\":true,\"paymentMethod\":{\"id\":\"pm_saved\",\"is_default\":true}}"

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func params(_ status: String, id: String = "seti_saved") -> String {
        """
        {"setupIntent":"\(id)_secret_test","setupIntentId":"\(id)","setupStatus":"\(status)",
        "ephemeralKey":"ek_test","customer":"cus_test"}
        """
    }

    private func model(
        _ store: RecoveryStore,
        presenter: RecoveryPresenter = RecoveryPresenter(),
        account: @escaping () -> String? = { "account-a" }
    ) -> PaymentsViewModel {
        PaymentsViewModel(
            api: APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            sheetPresenter: presenter,
            pendingSaveStore: store,
            userIdProvider: account
        )
    }

    func testRecreatedModelRecoversCompletedSetupWithoutAnotherSheet() async throws {
        let store = RecoveryStore()
        SequencedURLProtocol.routeResponses = [
            Self.prepare: [.status(200, body: params("requires_payment_method")), .status(200, body: params("succeeded"))],
            Self.confirm: [.status(503, body: "{}"), .status(200, body: Self.receipt)],
            Self.methods: [.status(200, body: "{\"paymentMethods\":[{\"id\":\"pm_saved\"}]}")]
        ]
        await model(store).tapAddMethod()
        XCTAssertEqual(Array(store.values.values), ["seti_saved"])
        let presenter = RecoveryPresenter()
        let restored = model(store, presenter: presenter)
        XCTAssertEqual(restored.addMethodLabel, "Retry saving card")
        await restored.tapAddMethod()
        XCTAssertEqual(presenter.calls, 0)
        XCTAssertTrue(store.values.isEmpty)
        let preparation = SequencedURLProtocol.capturedRequests.filter { $0.url?.path == Self.prepare }
        XCTAssertEqual(preparation.count, 2)
        XCTAssertEqual(try body(XCTUnwrap(preparation.last)), ["setupIntentId": "seti_saved"])
    }

    func testIdentifierIsDurableBeforePresentationAndCancellationCanResume() async throws {
        let store = RecoveryStore()
        let presenter = RecoveryPresenter()
        presenter.outcome = .canceled
        presenter.onPresent = { XCTAssertEqual(Array(store.values.values), ["seti_saved"]) }
        SequencedURLProtocol.routeResponses[Self.prepare] = [
            .status(200, body: params("requires_payment_method")), .status(200, body: params("requires_action"))
        ]
        await model(store, presenter: presenter).tapAddMethod()
        let secondPresenter = RecoveryPresenter()
        secondPresenter.outcome = .canceled
        let restored = model(store, presenter: secondPresenter)
        await restored.tapAddMethod()
        XCTAssertEqual(secondPresenter.calls, 1)
        XCTAssertEqual(secondPresenter.lastSecret, "seti_saved_secret_test")
        XCTAssertNil(restored.actionError)
        XCTAssertEqual(try body(XCTUnwrap(SequencedURLProtocol.capturedRequests.last)), ["setupIntentId": "seti_saved"])
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == Self.confirm })
    }

    func testAnotherAccountDoesNotResumeOrClearTheFirstAccountsIntent() async throws {
        let store = RecoveryStore()
        let presenter = RecoveryPresenter()
        presenter.outcome = .canceled
        SequencedURLProtocol.routeResponses[Self.prepare] = [
            .status(200, body: params("requires_payment_method")), .status(200, body: params("requires_payment_method", id: "seti_other"))
        ]
        await model(store, presenter: presenter).tapAddMethod()
        let second = model(store, presenter: presenter) { "account-b" }
        XCTAssertEqual(second.addMethodLabel, "Add payment method")
        await second.tapAddMethod()
        XCTAssertEqual(Set(store.values.values), ["seti_saved", "seti_other"])
        XCTAssertTrue(try body(XCTUnwrap(SequencedURLProtocol.capturedRequests.last)).isEmpty)
        XCTAssertTrue(store.values.keys.contains { $0.hasSuffix("|account-a") })
        XCTAssertTrue(store.values.keys.contains { $0.hasSuffix("|account-b") })
    }

    func testProcessingRestorationWaitsWithoutPresentingOrCreatingAnotherSetup() async {
        let store = RecoveryStore()
        SequencedURLProtocol.routeResponses[Self.prepare] = [
            .status(200, body: params("processing")), .status(200, body: params("processing"))
        ]
        let presenter = RecoveryPresenter()
        await model(store, presenter: presenter).tapAddMethod()
        let restored = model(store, presenter: presenter)
        await restored.tapAddMethod()
        XCTAssertEqual(presenter.calls, 0)
        XCTAssertEqual(Array(store.values.values), ["seti_saved"])
        XCTAssertEqual(restored.addMethodLabel, "Retry saving card")
        XCTAssertTrue(restored.actionError?.contains("processing") == true)
    }

    func testTerminal404ClearsRecoveryInsteadOfRetryingForever() async {
        let store = RecoveryStore()
        SequencedURLProtocol.routeResponses = [
            Self.prepare: [.status(200, body: params("requires_payment_method"))],
            Self.confirm: [.status(404, body: "{}")]
        ]
        let vm = model(store)
        await vm.tapAddMethod()
        XCTAssertTrue(store.values.isEmpty)
        XCTAssertEqual(vm.addMethodLabel, "Add payment method")
        XCTAssertTrue(vm.actionError?.contains("no longer available") == true)
    }

    func testIncompleteConfirmationRechecksSameSetupBeforeResumingSheet() async throws {
        let store = RecoveryStore()
        SequencedURLProtocol.routeResponses = [
            Self.prepare: [.status(200, body: params("requires_payment_method")), .status(200, body: params("processing"))],
            Self.confirm: [.status(409, body: "{}")]
        ]
        let presenter = RecoveryPresenter()
        let vm = model(store, presenter: presenter)
        await vm.tapAddMethod()
        await vm.tapAddMethod()
        XCTAssertEqual(presenter.calls, 1)
        XCTAssertEqual(try body(XCTUnwrap(SequencedURLProtocol.capturedRequests.last)), ["setupIntentId": "seti_saved"])
    }

    func testStorageFailureStopsBeforePresentingCardForm() async {
        let store = RecoveryStore()
        store.rejectWrites = true
        SequencedURLProtocol.routeResponses[Self.prepare] = [.status(200, body: params("requires_payment_method"))]
        let presenter = RecoveryPresenter()
        let vm = model(store, presenter: presenter)
        await vm.tapAddMethod()
        XCTAssertEqual(presenter.calls, 0)
        XCTAssertNotNil(vm.actionError)
        XCTAssertEqual(vm.addMethodLabel, "Retry saving card")
    }

    func testAccountSwitchDuringSheetDoesNotConfirmOrProjectAnotherAccountsCard() async {
        let store = RecoveryStore()
        var account: String? = "account-a"
        let presenter = RecoveryPresenter()
        presenter.onPresent = { account = "account-b" }
        SequencedURLProtocol.routeResponses[Self.prepare] = [.status(200, body: params("requires_payment_method"))]
        let vm = model(store, presenter: presenter) { account }
        await vm.tapAddMethod()
        XCTAssertEqual(Array(store.values.values), ["seti_saved"])
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == Self.confirm })
        if case .loaded = vm.state { XCTFail("Another account's card was displayed") }
    }

    func testPersistentStoreRejectsSecretsAndSeparatesOrigins() throws {
        let secure = InMemoryStore()
        let store = PendingCardSaveStore(store: secure)
        try store.save("seti_saved", scope: "https://staging.example|account-a")
        XCTAssertEqual(store.load(scope: "https://staging.example|account-a"), "seti_saved")
        XCTAssertNil(store.load(scope: "https://production.example|account-a"))
        XCTAssertThrowsError(try store.save("seti_saved_secret_test", scope: "https://staging.example|account-a"))
        try store.clear(scope: "https://staging.example|account-a")
        XCTAssertNil(store.load(scope: "https://staging.example|account-a"))
    }

    func testConflictingCardMutationsAreBlockedUntilConfirmationFinishes() async {
        let list = "{\"paymentMethods\":[{\"id\":\"pm_saved\",\"is_default\":true}]}"
        SequencedURLProtocol.routeResponses = [
            Self.prepare: [.status(200, body: params("requires_payment_method"))],
            Self.confirm: [.status(200, body: Self.receipt, delay: 0.1)],
            Self.methods: [.status(200, body: list), .status(200, body: list)]
        ]
        let vm = model(RecoveryStore())
        await vm.load()
        let add = Task { await vm.tapAddMethod() }
        await Task.yield()
        XCTAssertTrue(vm.isAddingMethod)
        await vm.setDefault("pm_saved")
        await vm.removeMethod("pm_saved")
        await vm.refresh()
        await add.value
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { ["PUT", "DELETE"].contains($0.httpMethod ?? "") })
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == Self.methods }.count, 2)
    }

    func testAddWaitsForDefaultMutationAndItsRefresh() async {
        await assertAddWaitsForMutation(removing: false)
    }

    func testAddWaitsForRemovalAndItsRefresh() async {
        await assertAddWaitsForMutation(removing: true)
    }

    private func assertAddWaitsForMutation(removing: Bool) async {
        let list = "{\"paymentMethods\":[{\"id\":\"pm_saved\",\"is_default\":true}]}"
        let mutationPath = "\(Self.methods)/pm_saved\(removing ? "" : "/default")"
        SequencedURLProtocol.routeResponses = [
            mutationPath: [.status(200, body: "{}", delay: 0.1)],
            Self.methods: [.status(200, body: list), .status(200, body: list, delay: 0.1)],
            Self.prepare: [.status(200, body: params("processing"))]
        ]
        let presenter = RecoveryPresenter()
        let vm = model(RecoveryStore(), presenter: presenter)
        await vm.load()
        let mutation = Task {
            if removing { await vm.removeMethod("pm_saved") } else { await vm.setDefault("pm_saved") }
        }
        await Task.yield()
        XCTAssertTrue(vm.isChangingMethod)
        await vm.tapAddMethod()
        await vm.refresh()
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == Self.prepare })
        await mutation.value
        XCTAssertFalse(vm.isChangingMethod)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == Self.methods }.count, 2)
        await vm.tapAddMethod()
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == Self.prepare }.count, 1)
        XCTAssertEqual(presenter.calls, 0)
    }

    func testAccountSwitchDuringMethodMutationDoesNotRestorePreviousAccountsCards() async {
        for removing in [false, true] {
            SequencedURLProtocol.reset()
            let list = "{\"paymentMethods\":[{\"id\":\"pm_saved\",\"is_default\":true}]}"
            let mutationPath = "\(Self.methods)/pm_saved\(removing ? "" : "/default")"
            SequencedURLProtocol.routeResponses = [
                Self.methods: [.status(200, body: list)],
                mutationPath: [.status(503, body: "{}", delay: 0.1)]
            ]
            var account: String? = "account-a"
            let vm = model(RecoveryStore()) { account }
            await vm.load()
            let mutation = Task {
                if removing { await vm.removeMethod("pm_saved") } else { await vm.setDefault("pm_saved") }
            }
            await Task.yield()
            XCTAssertTrue(vm.isChangingMethod)
            account = "account-b"
            await mutation.value
            if case .loaded = vm.state { XCTFail("A failed mutation restored another account's cards") }
            XCTAssertNil(vm.actionError)
            XCTAssertFalse(vm.isChangingMethod)
        }
    }

    private func body(_ request: URLRequest) throws -> [String: String] {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 1024)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
        }
        if data.isEmpty { return [:] }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])
    }
}

@MainActor
private final class RecoveryStore: PendingCardSaveStoring {
    var values: [String: String] = [:]
    var rejectWrites = false
    func load(scope: String) -> String? {
        values[scope]
    }

    func save(_ setupIntentId: String, scope: String) throws {
        if rejectWrites { throw APIError.invalidResponse }
        values[scope] = setupIntentId
    }

    func clear(scope: String) {
        values.removeValue(forKey: scope)
    }
}

@MainActor
private final class RecoveryPresenter: PaymentSheetPresenting {
    var outcome: PaymentSheetOutcome = .completed
    var onPresent: (() -> Void)?
    private(set) var calls = 0
    private(set) var lastSecret: String?
    func presentAddCard(
        setupIntentClientSecret: String,
        customer _: String,
        ephemeralKey _: String,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        calls += 1
        lastSecret = setupIntentClientSecret
        onPresent?()
        return outcome
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
