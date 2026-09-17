import XCTest
@testable import Pantopus

// Nested JSON wire fixtures preserve the server response structure.
// swiftlint:disable multiline_literal_brackets

@MainActor
private final class RefundMemoryStore: PendingRefundStoring {
    var attempt: PaymentRefundAttempt?
    var fail = false
    func load(scope _: String) throws -> PaymentRefundAttempt? {
        if fail { throw APIError.invalidResponse }
        return attempt
    }

    func save(_ attempt: PaymentRefundAttempt, scope _: String) throws {
        if fail { throw APIError.invalidResponse }
        if attempt.description == nil { self.attempt = attempt }
    }

    func clear(scope _: String) throws {
        if fail { throw APIError.invalidResponse }
        attempt = nil
    }
}

@MainActor
private final class RefundIdentity {
    var session = "session-one"
    var value: GigRefundViewModel.Identity {
        .init(account: "payer", session: session, origin: "https://staging.example.invalid")
    }
}

@MainActor
final class GigRefundRecoveryTests: XCTestCase {
    private let paymentId = "11111111-1111-4111-8111-111111111111"
    private let requestId = "22222222-2222-4222-8222-222222222222"
    private var historyPath: String {
        "/api/payments/\(paymentId)/refunds"
    }

    private var refundPath: String {
        "/api/payments/\(paymentId)/refund"
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func summary(status: String = "captured_hold", release: String = "held", refunded: Int = 0) -> [String: Any] {
        [
            "id": paymentId,
            "payment_status": status,
            "amount_total": 1000,
            "refunded_amount": refunded,
            "currency": "usd",
            "payee_release_status": release,
            "wallet_settlement": NSNull(),
            "captured_at": status == "authorized" ? NSNull() : "2026-09-10T00:00:00Z"
        ]
    }

    private func receipt(_ attempt: PaymentRefundAttempt, status: String = "pending", canRetry: Bool = true) -> [String: Any] {
        [
            "requestId": attempt.requestId,
            "paymentId": paymentId,
            "operation": "refund",
            "amountCents": 300,
            "currency": "usd",
            "status": status,
            "canRetry": canRetry,
            "requestedAmountCents": attempt.requestedAmountCents as Any? ?? NSNull(),
            "reason": attempt.reason.rawValue,
            "description": attempt.description as Any? ?? NSNull()
        ]
    }

    private func json(_ value: [String: Any]) throws -> String {
        try XCTUnwrap(String(data: JSONSerialization.data(withJSONObject: value), encoding: .utf8))
    }

    private func make(_ store: RefundMemoryStore, identity: RefundIdentity = RefundIdentity()) -> GigRefundViewModel {
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        return GigRefundViewModel(paymentId: paymentId, total: 1000, api: api, store: store) { identity.value }
    }

    private func history(_ requests: [[String: Any]] = [], payment: [String: Any]? = nil) throws -> String {
        try json(["requests": requests, "payment": payment ?? summary()])
    }

    private var posts: [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }
    }

    func testInterruptedRefundSurvivesRestartAndRetriesOriginalTerms() async throws {
        let store = RefundMemoryStore()
        let flow = make(store)
        SequencedURLProtocol.routeResponses = try [
            historyPath: [.status(200, body: history())],
            refundPath: [.status(503, body: #"{"error":"Response lost"}"#)]
        ]
        await flow.checkStatus()
        XCTAssertTrue(flow.mayRequest)
        await flow.submit(amountText: "3.00", reason: .workNotCompleted)
        let saved = try XCTUnwrap(store.attempt)
        XCTAssertEqual(saved.requestedAmountCents, 300)
        let restarted = make(store)
        SequencedURLProtocol.routeResponses = try [
            historyPath: [.status(200, body: history())],
            refundPath: [.status(200, body: json([
                "success": false, "refundRequest": receipt(saved, status: "succeeded"),
                "payment": summary(status: "refunded_partial", refunded: 300)
            ]))]
        ]
        await restarted.checkStatus()
        XCTAssertTrue(restarted.mayRetry)
        XCTAssertFalse(restarted.mayRequest)
        await restarted.retry()
        XCTAssertNil(store.attempt)
        XCTAssertEqual(restarted.requests.first?.status, "succeeded")
        XCTAssertEqual(restarted.remaining, 700)
        let bodies = try posts.map(body)
        XCTAssertEqual(bodies.count, 2)
        XCTAssertEqual(bodies[0]["requestId"] as? String, bodies[1]["requestId"] as? String)
        XCTAssertEqual(bodies[1]["amount"] as? Int, 300)
        XCTAssertEqual(bodies[1]["reason"] as? String, "work_not_completed")
    }

    func testHistoryReadRecoversCompletedRequestWithoutAnotherPost() async throws {
        let store = RefundMemoryStore()
        let attempt = PaymentRefundAttempt(requestId: requestId, requestedAmountCents: nil, reason: .requestedByCustomer, description: nil)
        store.attempt = attempt
        let flow = make(store)
        SequencedURLProtocol.sequence = try [.status(200, body: history([receipt(attempt, status: "succeeded")]))]
        await flow.checkStatus()
        XCTAssertNil(store.attempt)
        XCTAssertEqual(flow.requests.count, 1)
        XCTAssertTrue(posts.isEmpty)
    }

    func testReadOnlyServerRecoveryHonorsCallerRetryRestriction() async throws {
        let store = RefundMemoryStore()
        let flow = make(store)
        let attempt = PaymentRefundAttempt(
            requestId: requestId,
            requestedAmountCents: nil,
            reason: .other,
            description: "From another client"
        )
        SequencedURLProtocol.sequence = try [.status(200, body: history([receipt(attempt, canRetry: false)]))]
        await flow.checkStatus()
        await flow.retry()
        XCTAssertFalse(flow.mayRetry)
        XCTAssertFalse(flow.mayRequest)
        XCTAssertNil(store.attempt)
        XCTAssertTrue(posts.isEmpty)
    }

    func testStorageFailurePreventsNewPostAndMalformedHistoryPreventsActions() async throws {
        let store = RefundMemoryStore()
        let flow = make(store)
        SequencedURLProtocol.sequence = try [.status(200, body: history())]
        await flow.checkStatus()
        store.fail = true
        await flow.submit(amountText: "", reason: .requestedByCustomer)
        XCTAssertTrue(posts.isEmpty)
        XCTAssertNotNil(flow.error)
        store.fail = false
        var foreign = summary()
        foreign["id"] = UUID().uuidString
        SequencedURLProtocol.sequence = try [.status(200, body: history(payment: foreign))]
        await flow.checkStatus()
        XCTAssertFalse(flow.mayRequest)
        XCTAssertFalse(flow.mayRetry)
    }

    func testSessionChangeHidesHistoryAndFencesRetainedActions() async throws {
        let identity = RefundIdentity()
        let store = RefundMemoryStore()
        let flow = make(store, identity: identity)
        SequencedURLProtocol.sequence = try [.status(200, body: history())]
        await flow.checkStatus()
        identity.session = "replacement"
        await flow.submit(amountText: "3", reason: .duplicate)
        await flow.checkStatus()
        XCTAssertFalse(flow.isCurrent)
        XCTAssertTrue(flow.requests.isEmpty)
        XCTAssertFalse(flow.mayRequest)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testUnknownReceiptAndSuccessFlagCannotEraseOriginalAttempt() async throws {
        let store = RefundMemoryStore()
        let flow = make(store)
        let foreign = PaymentRefundAttempt(requestId: requestId, requestedAmountCents: nil, reason: .other, description: nil)
        SequencedURLProtocol.routeResponses = try [
            historyPath: [.status(200, body: history())],
            refundPath: [.status(
                200,
                body: json(["success": true, "refundRequest": receipt(foreign, status: "succeeded"), "payment": summary()])
            )]
        ]
        await flow.checkStatus()
        await flow.submit(amountText: "3", reason: .duplicate)
        XCTAssertNotNil(store.attempt)
        XCTAssertNotEqual(store.attempt?.requestId, foreign.requestId)
        XCTAssertFalse(flow.mayRequest)
        XCTAssertTrue(flow.requests.isEmpty)
    }

    func testHoldReleaseUsesOriginalNullableAmountAndExactReleaseReceipt() async throws {
        let store = RefundMemoryStore()
        let flow = make(store)
        SequencedURLProtocol.routeResponses = try [
            historyPath: [.status(200, body: history(payment: summary(status: "authorized")))],
            refundPath: [.status(503, body: #"{"error":"Unknown"}"#)]
        ]
        await flow.checkStatus()
        XCTAssertTrue(flow.isRelease)
        await flow.submit(amountText: "2.00", reason: .requestedByCustomer)
        let saved = try XCTUnwrap(store.attempt)
        XCTAssertNil(saved.requestedAmountCents)
        var released = receipt(saved, status: "succeeded")
        released["operation"] = "release"
        SequencedURLProtocol.sequence = try [.status(200, body: history([released], payment: summary(status: "canceled")))]
        await flow.checkStatus()
        XCTAssertNil(store.attempt)
        XCTAssertTrue(try XCTUnwrap(flow.requests.first).message.contains("No captured charge"))
        XCTAssertEqual(posts.count, 1)
    }

    func testWorkerReleaseStopsNewRefundButKeepsStatusAvailable() async throws {
        let flow = make(RefundMemoryStore())
        for release in ["wallet_credited", "external_transfer", "unknown"] {
            SequencedURLProtocol.sequence = try [.status(200, body: history(payment: summary(release: release)))]
            await flow.checkStatus()
            XCTAssertFalse(flow.mayRequest)
            XCTAssertNotNil(flow.releaseMessage)
        }
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 3)
    }

    func testOnlyActiveConflictCanReplaceTheLocallySavedRequest() async throws {
        for code in ["REFUND_IDENTITY_CONFLICT", "REFUND_ACTIVE"] {
            SequencedURLProtocol.reset()
            let store = RefundMemoryStore()
            let flow = make(store)
            let active = PaymentRefundAttempt(requestId: requestId, requestedAmountCents: 300, reason: .other, description: nil)
            SequencedURLProtocol.routeResponses = try [
                historyPath: [.status(200, body: history())],
                refundPath: [.status(409, body: json(["code": code, "refundRequest": receipt(active)]))]
            ]
            await flow.checkStatus()
            await flow.submit(amountText: "3", reason: .duplicate)
            let original = try body(XCTUnwrap(posts.first))["requestId"] as? String
            XCTAssertNotEqual(original, active.requestId)
            XCTAssertEqual(store.attempt?.requestId, code == "REFUND_ACTIVE" ? nil : original)
            SequencedURLProtocol.sequence = try [.status(200, body: history([receipt(active)]))]
            await flow.checkStatus()
            SequencedURLProtocol.routeResponses = [refundPath: [.status(503, body: #"{"error":"Unknown"}"#)]]
            await flow.retry()
            XCTAssertEqual(try body(XCTUnwrap(posts.last))["requestId"] as? String, code == "REFUND_ACTIVE" ? active.requestId : original)
        }
    }

    func testSameRequestWithChangedTermsCannotClearOrRetrySavedOperation() async throws {
        let store = RefundMemoryStore()
        let saved = PaymentRefundAttempt(requestId: requestId, requestedAmountCents: 300, reason: .duplicate, description: nil)
        store.attempt = saved
        var changed = receipt(saved, status: "succeeded")
        changed["requestedAmountCents"] = 400
        let flow = make(store)
        SequencedURLProtocol.sequence = try [.status(200, body: history([changed]))]
        await flow.checkStatus()
        await flow.retry()
        XCTAssertEqual(store.attempt, saved)
        XCTAssertFalse(flow.mayRequest)
        XCTAssertFalse(flow.mayRetry)
        XCTAssertTrue(posts.isEmpty)
    }

    func testDiskRecoverySurvivesStoreRecreationAndKeepsPaymentScopesSeparate() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let saved = PaymentRefundAttempt(requestId: requestId, requestedAmountCents: nil, reason: .other, description: nil)
        let first = PendingRefundStore(directory: directory)
        XCTAssertNil(try first.load(scope: "origin|payer|payment"))
        try first.save(saved, scope: "origin|payer|payment")
        let restarted = PendingRefundStore(directory: directory)
        XCTAssertEqual(try restarted.load(scope: "origin|payer|payment"), saved)
        XCTAssertNil(try restarted.load(scope: "origin|other|payment"))
        XCTAssertNil(try restarted.load(scope: "other-origin|payer|payment"))
        try restarted.clear(scope: "origin|payer|payment")
        try restarted.clear(scope: "origin|payer|payment")
        XCTAssertNil(try restarted.load(scope: "origin|payer|payment"))
    }

    private func body(_ request: URLRequest) throws -> [String: Any] {
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
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
