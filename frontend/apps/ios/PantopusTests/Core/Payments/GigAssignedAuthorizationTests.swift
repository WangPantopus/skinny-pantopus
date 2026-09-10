import XCTest
@testable import Pantopus

@MainActor
final class GigAssignedAuthorizationTests: XCTestCase {
    private let gig = "11111111-1111-4111-8111-111111111111"
    private let actor = "22222222-2222-4222-8222-222222222222"
    private let payer = "33333333-3333-4333-8333-333333333333"
    private let payee = "44444444-4444-4444-8444-444444444444"
    private let payment = "55555555-5555-4555-8555-555555555555"
    private let attempt = "66666666-6666-4666-8666-666666666666"
    private let session = String(repeating: "a", count: 64)
    private var statusPath: String {
        "/api/gigs/\(gig)/refresh-payment-status"
    }

    private var resumePath: String {
        "/api/gigs/\(gig)/continue-authorization"
    }

    private var paths: [String] {
        SequencedURLProtocol.capturedRequests.compactMap { $0.url?.path }
    }

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func wire(_ updates: [String: Any] = [:]) throws -> String {
        var fields: [String: Any] = [
            "gigId": gig, "actorId": actor, "sessionScope": session, "paymentId": payment,
            "payerId": payer, "payeeId": payee, "authorizationAttemptId": attempt,
            "paymentIntentId": "pi_original", "amountCents": 1234, "currency": "usd",
            "paymentStatus": "authorize_pending", "providerStatus": "requires_action",
            "authorizationReady": false, "alreadyAuthorized": false, "cancellationPending": false,
            "authorizationAvailableAt": NSNull(), "recoveryState": "action_required", "canRetry": true,
            "clientSecret": "pi_original_secret_temporary"
        ]
        fields.merge(updates) { _, value in value }
        return try XCTUnwrap(String(data: JSONSerialization.data(withJSONObject: fields), encoding: .utf8))
    }

    private var ready: [String: Any] {
        [
            "paymentStatus": "authorized",
            "providerStatus": "requires_capture",
            "authorizationReady": true,
            "alreadyAuthorized": true,
            "recoveryState": "ready",
            "canRetry": false,
            "clientSecret": NSNull()
        ]
    }

    private func make(
        presenter: RecoveryBidPresenter = RecoveryBidPresenter(),
        identity: (() -> GigAssignedAuthorizationViewModel.Identity?)? = nil
    ) throws -> GigAssignedAuthorizationViewModel {
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let original = GigPaymentDTO(
            id: payment, gigId: gig, payerId: payer, payeeId: payee, currency: "usd", amountTotal: 1234
        )
        let terms = try XCTUnwrap(GigAssignedAuthorizationTerms(payment: original, gigId: gig, payeeId: payee))
        return GigAssignedAuthorizationViewModel(
            gigId: gig,
            actor: actor,
            terms: terms,
            api: api,
            checkout: CheckoutCoordinator(api: api, presenter: presenter),
            identity: identity ?? {
                .init(
                    actor: self.actor,
                    session: "native-session",
                    origin: "https://staging.example.invalid"
                )
            }
        )
    }

    func testColdReadAndExplicitContinueUseExactBusinessPayerAndServerSession() async throws {
        let presenter = RecoveryBidPresenter()
        let flow = try make(presenter: presenter)
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire()), .status(200, body: wire(ready))],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        XCTAssertEqual(paths, [statusPath])
        XCTAssertEqual(presenter.count, 0)
        XCTAssertTrue(flow.mayContinue)
        XCTAssertEqual(flow.amount, 1234)
        await flow.continueAuthorization()
        XCTAssertTrue(flow.authorized)
        XCTAssertEqual(presenter.count, 1)
        XCTAssertEqual(paths, [statusPath, resumePath, statusPath, statusPath])
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.url?.path == resumePath })
        let body = try requestBody(request)
        XCTAssertEqual(body["expectedActorId"] as? String, actor)
        XCTAssertEqual(body["expectedSessionScope"] as? String, session)
        XCTAssertEqual(body["expectedPayerId"] as? String, payer)
        XCTAssertEqual(body["expectedPaymentId"] as? String, payment)
        XCTAssertEqual(body["expectedPayeeId"] as? String, payee)
        XCTAssertEqual(body["expectedAmountCents"] as? Int, 1234)
        XCTAssertEqual(body["currency"] as? String, "usd")
    }

    func testSDKCompletionRemainsPendingWithoutAnAuthorizedServerReceipt() async throws {
        let flow = try make()
        let pending = try wire([
            "providerStatus": "processing", "recoveryState": "pending", "canRetry": false, "clientSecret": NSNull()
        ])
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire()), .status(200, body: pending)],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertFalse(flow.authorized)
        XCTAssertFalse(flow.mayContinue)
        XCTAssertTrue(flow.message.contains("pending"))
    }

    func testUnknownResumeCanRecoverReadOnlyWithoutAnotherProviderPresentation() async throws {
        let presenter = RecoveryBidPresenter()
        let flow = try make(presenter: presenter)
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire(ready))],
            resumePath: [.status(503, body: #"{"error":"Unknown outcome"}"#)]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertNotNil(flow.error)
        XCTAssertFalse(flow.authorized)
        await flow.checkStatus()
        XCTAssertTrue(flow.authorized)
        XCTAssertEqual(presenter.count, 0)
        XCTAssertEqual(paths.filter { $0 == resumePath }.count, 1)
    }

    func testMalformedOrForeignReceiptCannotEnableContinuation() async throws {
        for change: [String: Any] in [
            ["actorId": payer], ["paymentId": payee], ["payeeId": payer], ["payerId": actor],
            ["amountCents": 1235], ["sessionScope": "unverified"], ["authorizationReady": true],
            ["clientSecret": "pi_foreign_secret_other"], ["authorizationAvailableAt": "not-a-date"]
        ] {
            let flow = try make()
            SequencedURLProtocol.routeResponses = try [statusPath: [.status(200, body: wire(change))]]
            await flow.checkStatus()
            XCTAssertFalse(flow.mayContinue)
            XCTAssertFalse(flow.authorized)
            XCTAssertNotNil(flow.error)
        }
    }

    func testServerSessionChangesBeforeSDKCannotPresentTheRetainedPayment() async throws {
        let presenter = RecoveryBidPresenter()
        let flow = try make(presenter: presenter)
        let changed = try wire(["sessionScope": String(repeating: "b", count: 64)])
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: changed)],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertEqual(presenter.count, 0)
        XCTAssertFalse(flow.authorized)
        XCTAssertNotNil(flow.error)
    }

    func testNativeSessionChangeBeforeContinueDoesNotSendAnything() async throws {
        var identity: GigAssignedAuthorizationViewModel.Identity? = .init(actor: actor, session: "one", origin: "api")
        let flow = try make { identity }
        SequencedURLProtocol.routeResponses = try [statusPath: [.status(200, body: wire())]]
        await flow.checkStatus()
        identity = .init(actor: actor, session: "two", origin: "api")
        await flow.continueAuthorization()
        XCTAssertEqual(paths, [statusPath])
        XCTAssertFalse(flow.isCurrent)
    }

    func testSessionChangeDuringSDKDiscardsItsLateCompletion() async throws {
        var identity: GigAssignedAuthorizationViewModel.Identity? = .init(actor: actor, session: "one", origin: "api")
        let presenter = RecoveryBidPresenter()
        presenter.onPresent = { identity = nil
            return .completed
        }
        let flow = try make(presenter: presenter) { identity }
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire())],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertFalse(flow.authorized)
        XCTAssertFalse(flow.isCurrent)
        XCTAssertEqual(paths, [statusPath, resumePath, statusPath])
    }

    func testCancellationOfSDKDoesNotCancelGigOrReportAuthorization() async throws {
        let presenter = RecoveryBidPresenter()
        presenter.result = .canceled
        let flow = try make(presenter: presenter)
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire())],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertFalse(flow.authorized)
        XCTAssertNotNil(flow.error)
        XCTAssertEqual(paths, [statusPath, resumePath, statusPath])
    }

    func testAlreadyAuthorizedDuringPreflightSkipsSDK() async throws {
        let presenter = RecoveryBidPresenter()
        let flow = try make(presenter: presenter)
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire(ready))],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertTrue(flow.authorized)
        XCTAssertEqual(presenter.count, 0)
    }

    func testScheduledAndCancellationPendingNeverOfferNewAuthorization() async throws {
        for change: [String: Any] in [
            ["authorizationAvailableAt": "2026-09-15T12:00:00.000Z", "paymentIntentId": NSNull(), "providerStatus": NSNull()],
            ["cancellationPending": true, "providerStatus": "requires_capture"]
        ] {
            let flow = try make()
            let fields: [String: Any] = ["recoveryState": "pending", "canRetry": false, "clientSecret": NSNull()]
            SequencedURLProtocol.routeResponses = try [statusPath: [.status(200, body: wire(fields.merging(change) { _, next in next }))]]
            await flow.checkStatus()
            XCTAssertFalse(flow.mayContinue)
            XCTAssertFalse(flow.authorized)
            XCTAssertNil(flow.error)
        }
    }

    func testDifferentProviderOperationAfterSDKDoesNotConfirmOldPayment() async throws {
        let flow = try make()
        SequencedURLProtocol.routeResponses = try [
            statusPath: [
                .status(200, body: wire()),
                .status(200, body: wire()),
                .status(
                    200,
                    body: wire(ready
                        .merging(["paymentIntentId": "pi_replacement"]) { _, next in next })
                )
            ],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertFalse(flow.authorized)
        XCTAssertNotNil(flow.error)
    }

    func testMissingOpeningIdentityCannotBindToLaterSignIn() async throws {
        var identity: GigAssignedAuthorizationViewModel.Identity?
        let flow = try make { identity }
        identity = .init(actor: actor, session: "new", origin: "api")
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertFalse(flow.isCurrent)
        XCTAssertTrue(paths.isEmpty)
    }

    func testTwoOpenScreensShareOneProviderOperation() async throws {
        let presenter = RecoveryBidPresenter()
        var complete: CheckedContinuation<PaymentSheetOutcome, Never>?
        presenter.onPresent = { await withCheckedContinuation { complete = $0 } }
        let first = try make(presenter: presenter)
        let second = try make(presenter: presenter)
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire()), .status(200, body: wire())],
            resumePath: [.status(200, body: wire())]
        ]
        await first.checkStatus()
        await second.checkStatus()
        let operation = Task { await first.continueAuthorization() }
        for _ in 0..<200 where complete == nil {
            try? await Task.sleep(for: .milliseconds(5))
        }
        guard let complete else { operation.cancel()
            return XCTFail("Provider presentation did not start")
        }
        await second.continueAuthorization()
        XCTAssertEqual(paths.filter { $0 == resumePath }.count, 1)
        XCTAssertEqual(presenter.count, 1)
        complete.resume(returning: .canceled)
        await operation.value
        XCTAssertFalse(first.authorized)
        XCTAssertFalse(second.authorized)
    }

    private func requestBody(_ request: URLRequest) throws -> [String: Any] {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 1024)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count < 0 { throw APIError.invalidResponse }
                if count == 0 { break }
                data.append(buffer, count: count)
            }
        }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}

/// Keep view retirement checks separate from the payment-state cases.
extension GigAssignedAuthorizationTests {
    func testDismissalDuringResumeOrPreflightCannotPresentOrSucceedLater() async throws {
        for beforePreflight in [true, false] {
            SequencedURLProtocol.reset()
            let presenter = RecoveryBidPresenter()
            let flow = try make(presenter: presenter)
            SequencedURLProtocol.routeResponses = try [
                statusPath: [.status(200, body: wire()), .status(200, body: wire(), delay: beforePreflight ? 0 : 0.15)],
                resumePath: [.status(200, body: wire(), delay: beforePreflight ? 0.15 : 0)]
            ]
            await flow.checkStatus()
            let operation = Task { await flow.continueAuthorization() }
            let expectedRequests = beforePreflight ? 2 : 3
            for _ in 0..<200 where paths.count < expectedRequests {
                try? await Task.sleep(for: .milliseconds(5))
            }
            XCTAssertEqual(paths.count, expectedRequests)
            flow.retire()
            await operation.value
            XCTAssertEqual(presenter.count, 0)
            XCTAssertFalse(flow.authorized)
            XCTAssertFalse(flow.isCurrent)
        }
    }

    func testDismissalWhileSDKIsOpenRejectsItsLateCompletion() async throws {
        let presenter = RecoveryBidPresenter()
        let flow = try make(presenter: presenter)
        presenter.onPresent = { flow.retire()
            return .completed
        }
        SequencedURLProtocol.routeResponses = try [
            statusPath: [.status(200, body: wire()), .status(200, body: wire())],
            resumePath: [.status(200, body: wire())]
        ]
        await flow.checkStatus()
        await flow.continueAuthorization()
        XCTAssertFalse(flow.authorized)
        XCTAssertEqual(paths, [statusPath, resumePath, statusPath])
    }
}

/// Exercise the actual detail entrypoint, including a business payer distinct from its manager.
extension GigAssignedAuthorizationTests {
    private func detail(
        actor viewer: String? = nil,
        changes: [String: Any] = [:],
        paymentChanges: [String: Any] = [:],
        status: Int = 200
    ) async throws -> GigDetailViewModel {
        SequencedURLProtocol.reset()
        let api = APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
        let presenter = RecoveryBidPresenter()
        let checkout = CheckoutCoordinator(api: api, presenter: presenter)
        let model = GigDetailViewModel(
            gigId: gig,
            api: api,
            checkout: checkout,
            bidAcceptance: GigBidAcceptanceCoordinator(api: api, checkout: checkout) { "native-session" },
            currentUserId: viewer ?? actor,
            roomEvents: { _ in AsyncStream { $0.finish() } },
            emitRoom: { _, _ in }
        )
        var record: [String: Any] = [
            "id": gig, "title": "Exact assigned task", "status": "assigned", "price": 12.34,
            "user_id": payer, "accepted_by": payee, "payment_id": payment
        ]
        record.merge(changes) { _, next in next }
        var paymentRecord: [String: Any] = [
            "id": payment, "gig_id": gig, "payer_id": payer, "payee_id": payee,
            "currency": "usd", "amount_total": 1234, "payment_status": "authorize_pending"
        ]
        paymentRecord.merge(paymentChanges) { _, next in next }
        func json(_ value: [String: Any]) throws -> String {
            try XCTUnwrap(String(data: JSONSerialization.data(withJSONObject: value), encoding: .utf8))
        }
        SequencedURLProtocol.routeResponses = try [
            "/api/gigs/\(gig)": [.status(200, body: json(["gig": record]))],
            "/api/gigs/\(gig)/questions": [.status(200, body: #"{"questions":[]}"#)],
            "/api/gigs/\(gig)/payment": [.status(status, body: json(["payment": paymentRecord]))]
        ]
        await model.load()
        return model
    }

    func testAssignedEntrySupportsExactOwnerAndAuthorizedBusinessManager() async throws {
        for viewer in [payer, actor] {
            let model = try await detail(actor: viewer)
            XCTAssertTrue(model.showPaymentCard)
            XCTAssertTrue(model.canOpenAssignedAuthorization)
            XCTAssertEqual(model.payment?.payerId, payer)
        }
    }

    func testAssignedEntryRejectsStaleTermsWorkerAndDeniedManager() async throws {
        for changes: [String: Any] in [
            ["payment_id": payee], ["price": 12.35], ["payment_id": NSNull()], ["status": "canceled"]
        ] {
            let model = try await detail(changes: changes)
            XCTAssertFalse(model.canOpenAssignedAuthorization)
        }
        for changes: [String: Any] in [["payer_id": actor], ["payee_id": actor], ["gig_id": payee], ["currency": "eur"]] {
            let model = try await detail(paymentChanges: changes)
            XCTAssertFalse(model.canOpenAssignedAuthorization)
        }
        let worker = try await detail(actor: payee)
        XCTAssertFalse(worker.showPaymentCard)
        XCTAssertFalse(paths.contains("/api/gigs/\(gig)/payment"))
        let denied = try await detail(status: 403)
        XCTAssertFalse(denied.showPaymentCard)
        XCTAssertFalse(denied.canOpenAssignedAuthorization)
    }
}
