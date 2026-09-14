import XCTest
@testable import Pantopus

@MainActor
final class GigTipTests: XCTestCase {
    let gig = "33333333-3333-4333-8333-333333333333"
    let actor = "11111111-1111-4111-8111-111111111111"
    let worker = "22222222-2222-4222-8222-222222222222"
    let requestId = "55555555-5555-4555-8555-555555555555"
    let otherId = "66666666-6666-4666-8666-666666666666"
    let session = String(repeating: "a", count: 64)
    let origin = "https://tip-fixture.invalid"
    var scope: String {
        "gig-tip-original-v1|\(origin)|\(actor)|\(gig)"
    }

    var statusPath: String {
        "/api/payments/tip-requests/\(requestId)"
    }

    var tipPosts: [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.url?.path == "/api/payments/tip" }
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    func json(_ value: [String: Any]) throws -> String {
        try XCTUnwrap(String(data: JSONSerialization.data(withJSONObject: value), encoding: .utf8))
    }

    func decoded<T: Decodable>(_ value: [String: Any], as _: T.Type) throws -> T {
        try JSONDecoder().decode(T.self, from: JSONSerialization.data(withJSONObject: value))
    }

    var terms: [String: Any] {
        ["gigId": gig, "payerId": actor, "payeeId": worker, "ownerConfirmedAt": "2026-06-01T00:00:00Z"]
    }

    var original: [String: Any] {
        [
            "requestId": requestId,
            "paymentId": requestId,
            "gigId": gig,
            "payerId": actor,
            "payeeId": worker,
            "amountCents": 1000,
            "currency": "usd",
            "terms": terms,
            "paymentMethodId": NSNull()
        ]
    }

    var preview: [String: Any] {
        [
            "actorId": actor,
            "sessionScope": session,
            "terms": terms,
            "eligible": true,
            "unavailableReason": NSNull(),
            "activeRequestId": NSNull(),
            "legacyPaymentId": NSNull(),
            "minimumAmountCents": 50,
            "maximumAmountCents": 99_999_999,
            "remainingTipSlots": 3
        ]
    }

    func response(_ updates: [String: Any] = [:]) -> [String: Any] {
        var value: [String: Any] = [
            "actorId": actor,
            "sessionScope": session,
            "request": original,
            "status": "pending",
            "paymentStatus": "authorize_pending",
            "providerStatus": "requires_payment_method",
            "paymentIntentId": "pi_tip",
            "canRetry": false,
            "canCancel": true,
            "receipt": NSNull(),
            "checkout": [
                "paymentIntentId": "pi_tip",
                "clientSecret": "pi_tip_secret_synthetic",
                "customer": "cus_tip",
                "ephemeralKey": "ek_synthetic",
                "publishableKey": "pk_test_synthetic"
            ]
        ]
        value.merge(updates) { _, next in next }
        return value
    }

    var receipt: [String: Any] {
        [
            "requestId": requestId,
            "paymentId": requestId,
            "gigId": gig,
            "payerId": actor,
            "payeeId": worker,
            "amountCents": 1000,
            "currency": "usd",
            "status": "succeeded",
            "paymentIntentId": "pi_tip",
            "chargeId": "ch_tip",
            "amountChargedCents": 1000
        ]
    }

    var done: [String: Any] {
        response([
            "status": "succeeded",
            "paymentStatus": "captured_hold",
            "providerStatus": "succeeded",
            "canCancel": false,
            "receipt": receipt,
            "checkout": NSNull()
        ])
    }

    func make(
        posts: [SequencedURLProtocol.Response] = [],
        reads: [SequencedURLProtocol.Response] = [],
        store: any SecureStore = InMemoryStore(),
        presenter: StubTipPresenter = StubTipPresenter(),
        identity: (() -> GigStopViewModel.Identity?)? = nil,
        previewFields: [String: Any]? = nil
    ) throws -> GigDetailViewModel {
        let envelope: [String: Any] = [
            "gig": [
                "id": gig,
                "title": "Patio cleanup",
                "user_id": actor,
                "status": "completed",
                "accepted_by": worker,
                "owner_confirmed_at": "2026-06-01T00:00:00+00:00"
            ]
        ]
        let routes: [String: [SequencedURLProtocol.Response]] = try [
            "/api/gigs/\(gig)": [.status(200, body: json(envelope))],
            "/api/gigs/\(gig)/bids": [.status(200, body: "{\"bids\":[]}")],
            "/api/gigs/\(gig)/questions": [.status(200, body: "{\"questions\":[]}")],
            "/api/gigs/\(gig)/payment": [.status(200, body: "{\"payment\":null}")],
            "/api/reviews/my-pending": [.status(200, body: "{\"pending\":[]}")],
            "/api/payments/tip-preview": [.status(200, body: json(previewFields ?? preview))],
            statusPath: reads, "/api/payments/tip": posts
        ]
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none)
        let checkout = CheckoutCoordinator(api: api, presenter: presenter)
        return GigDetailViewModel(
            gigId: gig,
            api: api,
            checkout: checkout,
            bidAcceptance: GigBidAcceptanceCoordinator(api: api, checkout: checkout) { "origin|owner|session" },
            currentUserId: actor,
            tipStore: store,
            tipIdentity: identity ?? { .init(actor: self.actor, session: "native-session", origin: self.origin) }
        ) { self.requestId }
    }

    func seed(_ store: any SecureStore) throws {
        try store.setData(JSONSerialization.data(withJSONObject: original), for: scope)
    }

    func bodies() throws -> [[String: Any]] {
        try tipPosts.map { request in
            let data: Data
            if let body = request.httpBody {
                data = body
            } else {
                let stream = try XCTUnwrap(request.httpBodyStream)
                stream.open()
                defer { stream.close() }
                var bytes = Data(), buffer = [UInt8](repeating: 0, count: 4096)
                while stream.hasBytesAvailable {
                    let count = stream.read(&buffer, maxLength: buffer.count)
                    if count <= 0 { break }
                    bytes.append(buffer, count: count)
                }
                data = bytes
            }
            return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        }
    }

    func testTipGateAndExistingDock() throws {
        let confirmed: GigDTO = try decoded(
            ["id": gig, "title": "Patio", "status": "completed", "accepted_by": worker, "owner_confirmed_at": "2026-06-01T00:00:00Z"],
            as: GigDTO.self
        )
        XCTAssertTrue(GigDetailViewModel.viewerCanTip(gig: confirmed, viewerIsOwner: true))
        XCTAssertFalse(GigDetailViewModel.viewerCanTip(gig: confirmed, viewerIsOwner: false))
        let unconfirmed: GigDTO = try decoded(["id": gig, "title": "Patio", "status": "completed", "accepted_by": worker], as: GigDTO.self)
        XCTAssertFalse(GigDetailViewModel.viewerCanTip(gig: unconfirmed, viewerIsOwner: true))
        let projected = GigDetailViewModel.project(gig: confirmed, bids: [], canTip: true)
        XCTAssertEqual(projected.dock.primary.label, "Send a tip")
        XCTAssertEqual(projected.dock.secondary?.label, "Message")
    }

    func testOpeningReadsOnlyAndFirstSubmissionRetainsOriginalBeforeProviderResponse() async throws {
        let store = InMemoryStore()
        let vm = try make(posts: [.status(503, body: "{}")], store: store)
        await vm.load()
        await vm.prepareTip()
        XCTAssertTrue(vm.mayChooseTip)
        XCTAssertTrue(tipPosts.isEmpty)
        await vm.sendTip(amountCents: 1000)
        let saved = try XCTUnwrap(store.readData(scope))
        let parsed = try JSONDecoder().decode(TipOriginal.self, from: saved)
        XCTAssertEqual(parsed.requestId, requestId)
        XCTAssertEqual(parsed.amountCents, 1000)
        XCTAssertFalse(try XCTUnwrap(String(data: saved, encoding: .utf8)).contains("secret"))
        let body = try XCTUnwrap(bodies().first)
        XCTAssertEqual(body["requestId"] as? String, requestId)
        XCTAssertEqual(body["expectedActorId"] as? String, actor)
        XCTAssertEqual(body["expectedSessionScope"] as? String, session)
        XCTAssertEqual(body["mode"] as? String, "resume")
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
    }

    func testConfirmedReceiptAfterSDKClearsOnlyTheOriginal() async throws {
        let store = InMemoryStore(), presenter = StubTipPresenter()
        let vm = try make(
            posts: [.status(202, body: json(response())), .status(202, body: json(response())), .status(200, body: json(done))],
            store: store,
            presenter: presenter
        )
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertEqual(presenter.lastPublishableKey, "pk_test_synthetic")
        XCTAssertEqual(vm.tipStatus, .succeeded)
        XCTAssertNil(try store.readData(scope))
        XCTAssertEqual(try bodies().compactMap { $0["mode"] as? String }, ["resume", "check", "check"])
        XCTAssertEqual(try Set(bodies().compactMap { $0["requestId"] as? String }), [requestId])
    }

    func testSDKCompletionWithUnconfirmedServerStateDoesNotReportPaid() async throws {
        let store = InMemoryStore(), presenter = StubTipPresenter()
        let vm = try make(
            posts: [
                .status(202, body: json(response())),
                .status(202, body: json(response())),
                .status(
                    202,
                    body: json(response(["checkout": NSNull(), "providerStatus": "processing"]))
                )
            ],
            store: store,
            presenter: presenter
        )
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNotNil(try store.readData(scope))
        XCTAssertEqual(vm.tipOriginalAmount, 1000)
    }

    func testLostStatusAfterSDKRetainsOriginal() async throws {
        let store = InMemoryStore()
        let vm = try make(
            posts: [.status(202, body: json(response())), .status(202, body: json(response())), .status(503, body: "{}")],
            store: store
        )
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNotNil(try store.readData(scope))
    }

    func testLostCreationAnd404RetryTheSameAmountAndUUIDAfterModelRestart() async throws {
        let store = InMemoryStore()
        let first = try make(posts: [.status(503, body: "{}")], store: store)
        await first.load()
        await first.sendTip(amountCents: 1000)
        let second = try make(posts: [.status(200, body: json(done))], reads: [.status(404, body: "{}")], store: store)
        await second.load()
        await second.prepareTip()
        XCTAssertEqual(second.tipOriginalAmount, 1000)
        await second.sendTip(amountCents: 1000)
        XCTAssertEqual(second.tipStatus, .succeeded)
        XCTAssertNil(try store.readData(scope))
        let commands = try bodies()
        XCTAssertEqual(commands.count, 2)
        XCTAssertEqual(
            try JSONSerialization.data(withJSONObject: commands[0], options: .sortedKeys),
            try JSONSerialization.data(withJSONObject: commands[1], options: .sortedKeys)
        )
    }

    func testStoredPendingTipCannotBeReplacedByAnotherAmount() async throws {
        let store = InMemoryStore()
        try seed(store)
        let vm = try make(reads: [.status(202, body: json(response()))], store: store)
        await vm.load()
        await vm.prepareTip()
        await vm.sendTip(amountCents: 2000)
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertEqual(vm.tipOriginalAmount, 1000)
    }
}

@MainActor
final class StubTipPresenter: PaymentSheetPresenting {
    var outcome: PaymentSheetOutcome = .completed
    var beforeResult: (() -> Void)?
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
        beforeResult?()
        return outcome
    }
}

final class TipFailingStore: SecureStore, @unchecked Sendable {
    let memory = InMemoryStore()
    var failRead = false
    var failWrite = false
    func set(_ value: String, for key: String) throws {
        try memory.set(value, for: key)
    }

    func get(_ key: String) -> String? {
        memory.get(key)
    }

    func delete(_ key: String) throws {
        try memory.delete(key)
    }

    func setData(_ value: Data, for key: String) throws {
        if failWrite { throw APIError.invalidResponse }
        try memory.setData(value, for: key)
    }

    func getData(_ key: String) -> Data? {
        memory.getData(key)
    }

    func readData(_ key: String) throws -> Data? {
        if failRead { throw APIError.invalidResponse }
        return memory.getData(key)
    }
}
