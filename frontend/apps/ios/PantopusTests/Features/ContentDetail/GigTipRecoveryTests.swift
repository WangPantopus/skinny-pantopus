import Security
import XCTest
@testable import Pantopus

extension GigTipTests {
    func testLocalMatchingReceiptRecoversWithoutProviderCommand() async throws {
        let store = InMemoryStore()
        try seed(store)
        let vm = try make(reads: [.status(200, body: json(done))], store: store)
        await vm.prepareTip()
        XCTAssertEqual(vm.tipStatus, .succeeded)
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertNil(try store.readData(scope))
    }

    func testMismatchedReceiptCannotClearRecovery() async throws {
        let store = InMemoryStore()
        try seed(store)
        var wrong = receipt
        wrong["amountCents"] = 1001
        var result = done
        result["receipt"] = wrong
        let vm = try make(reads: [.status(200, body: json(result))], store: store)
        await vm.prepareTip()
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNotNil(try store.readData(scope))
    }

    func testEveryFinancialReceiptBindingIsValidated() throws {
        let original = try decoded(original, as: TipOriginal.self)
        let mutations: [[String: Any]] = [
            ["amountCents": 1001],
            ["amountChargedCents": 0],
            ["requestId": otherId],
            ["paymentId": otherId],
            ["gigId": otherId],
            ["payerId": worker],
            ["payeeId": actor],
            ["currency": "eur"],
            ["paymentIntentId": "pi_other"],
            ["chargeId": NSNull()],
            ["status": "canceled"]
        ]
        for mutation in mutations {
            var receipt = receipt
            receipt.merge(mutation) { _, next in next }
            var result = done
            result["receipt"] = receipt
            let decoded = try decoded(result, as: TipResponse.self)
            XCTAssertFalse(
                decoded.matches(gig: gig, actor: actor, requestId: requestId, session: session, original: original),
                "\(mutation)"
            )
        }
    }

    func testReadFailureAndCorruptStoragePreventNewCommand() async throws {
        let store = TipFailingStore()
        store.failRead = true
        let vm = try make(store: store)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertTrue(tipPosts.isEmpty)
        store.failRead = false
        try store.setData(Data("broken".utf8), for: scope)
        let second = try make(store: store)
        await second.load()
        await second.sendTip(amountCents: 1000)
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertEqual(try store.readData(scope), Data("broken".utf8))
    }

    func testFailedDurableWritePreventsSubmission() async throws {
        let store = TipFailingStore()
        store.failWrite = true
        let vm = try make(store: store)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertNil(try store.readData(scope))
    }

    func testReplacedOriginalCannotBeClearedByLateReceipt() async throws {
        let store = InMemoryStore()
        try seed(store)
        let vm = try make(reads: [.status(200, body: json(done), delay: 0.15)], store: store)
        let read = Task { await vm.prepareTip() }
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline, !SequencedURLProtocol.capturedRequests.contains(where: { $0.url?.path == statusPath }) {
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == statusPath })
        var newer = original
        newer["requestId"] = otherId
        newer["paymentId"] = otherId
        let data = try JSONSerialization.data(withJSONObject: newer)
        try store.setData(data, for: scope)
        await read.value
        XCTAssertEqual(try store.readData(scope), data)
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
    }

    func testSessionReplacementAfterSDKCannotReadOrCompleteOldTip() async throws {
        let store = InMemoryStore(), presenter = StubTipPresenter()
        var identity: GigStopViewModel.Identity? = .init(actor: actor, session: "native-session", origin: origin)
        presenter.beforeResult = { identity = nil }
        let vm = try make(
            posts: [.status(202, body: json(response())), .status(202, body: json(response()))],
            store: store,
            presenter: presenter
        ) { identity }
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertEqual(tipPosts.count, 2)
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNotNil(try store.readData(scope))
    }

    func testSDKDismissalChecksOriginalWithoutImplicitCancellation() async throws {
        let store = InMemoryStore(), presenter = StubTipPresenter()
        presenter.outcome = .canceled
        let vm = try make(
            posts: [
                .status(202, body: json(response())),
                .status(202, body: json(response())),
                .status(
                    202,
                    body: json(response(["checkout": NSNull()]))
                )
            ],
            store: store,
            presenter: presenter
        )
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(try bodies().compactMap { $0["mode"] as? String }, ["resume", "check", "check"])
        XCTAssertNotNil(try store.readData(scope))
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
    }

    func testExplicitCancelBeforeFirstAdmissionUsesSameUUIDAndZeroChargeReceipt() async throws {
        let store = InMemoryStore()
        try seed(store)
        var canceled = receipt
        canceled["status"] = "canceled"
        canceled["paymentIntentId"] = NSNull()
        canceled["chargeId"] = NSNull()
        canceled["amountChargedCents"] = 0
        let result = response([
            "status": "canceled",
            "paymentStatus": "canceled",
            "paymentIntentId": NSNull(),
            "providerStatus": NSNull(),
            "checkout": NSNull(),
            "canCancel": false,
            "receipt": canceled
        ])
        let vm = try make(posts: [.status(200, body: json(result))], reads: [.status(404, body: "{}")], store: store)
        await vm.prepareTip()
        await vm.cancelOriginalTip()
        XCTAssertEqual(vm.tipStatus, .canceled)
        XCTAssertNil(try store.readData(scope))
        XCTAssertEqual(try bodies().first?["mode"] as? String, "cancel")
    }

    func testRefundedRecordDoesNotAnnounceANewSentTip() async throws {
        let store = InMemoryStore()
        try seed(store)
        var result = done
        result["paymentStatus"] = "refunded_full"
        let vm = try make(reads: [.status(200, body: json(result))], store: store)
        await vm.prepareTip()
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNil(try store.readData(scope))
        XCTAssertTrue(vm.tipMessage.contains("history"))
    }

    private var legacyOriginal: [String: Any] {
        var value = original
        var historicalTerms = terms
        historicalTerms["ownerConfirmedAt"] = NSNull()
        value["terms"] = historicalTerms
        value["source"] = "legacy"
        return value
    }

    private var legacyPending: [String: Any] {
        response(["request": legacyOriginal, "status": "needs_review", "canRetry": false, "checkout": NSNull()])
    }

    func testLegacyPreviewRecoversOnlyExistingOriginalAndCheckCommand() async throws {
        var unavailable = preview
        unavailable["eligible"] = false
        unavailable["unavailableReason"] = "LEGACY_REVIEW"
        unavailable["legacyPaymentId"] = requestId
        let store = InMemoryStore(), presenter = StubTipPresenter()
        let vm = try make(
            posts: [.status(202, body: json(legacyPending))],
            reads: [.status(200, body: json(legacyPending))],
            store: store,
            presenter: presenter,
            previewFields: unavailable
        )
        await vm.load()
        await vm.prepareTip()
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertTrue(vm.hasTipOriginal)
        XCTAssertFalse(vm.mayChooseTip)
        XCTAssertEqual(vm.tipActionTitle, "Check tip status")
        let saved = try JSONDecoder().decode(TipOriginal.self, from: XCTUnwrap(store.readData(scope)))
        XCTAssertTrue(saved.isLegacy)
        XCTAssertNil(saved.terms.ownerConfirmedAt)
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(try bodies().first?["mode"] as? String, "check")
        XCTAssertEqual(try bodies().first?["requestId"] as? String, requestId)
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNotNil(try store.readData(scope))
    }

    func testLegacyReceiptClearsExactOriginalAndPreservesHistoryState() async throws {
        let store = InMemoryStore()
        try store.setData(JSONSerialization.data(withJSONObject: legacyOriginal), for: scope)
        var result = done
        result["request"] = legacyOriginal
        result["paymentStatus"] = "refunded_full"
        let vm = try make(reads: [.status(200, body: json(result))], store: store)
        await vm.prepareTip()
        XCTAssertNil(try store.readData(scope))
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertTrue(tipPosts.isEmpty)
    }

    func testMissingLegacyProviderKeepsOriginalWithoutCanceling() async throws {
        let store = InMemoryStore()
        try store.setData(JSONSerialization.data(withJSONObject: legacyOriginal), for: scope)
        var result = legacyPending
        result["paymentIntentId"] = NSNull()
        result["canCancel"] = false
        let vm = try make(reads: [.status(200, body: json(result))], store: store)
        await vm.prepareTip()
        XCTAssertFalse(vm.mayCancelTip)
        await vm.cancelOriginalTip()
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertNotNil(try store.readData(scope))
    }

    func testLegacyValidationRejectsCheckoutRetryAndInventedOriginalTerms() throws {
        let old = try decoded(legacyOriginal, as: TipOriginal.self)
        for patch: [String: Any] in try [
            ["canRetry": true],
            ["checkout": XCTUnwrap(response()["checkout"])],
            ["request": original]
        ] {
            var value = legacyPending
            value.merge(patch) { _, next in next }
            XCTAssertFalse(try decoded(value, as: TipResponse.self).matches(
                gig: gig, actor: actor, requestId: requestId, session: session, original: old
            ))
        }
        var wrong = legacyOriginal
        wrong["terms"] = terms
        XCTAssertFalse(try decoded(wrong, as: TipOriginal.self).matches(gig: gig, actor: actor))
    }

    func testFreshInstallFindsHistoricalTipAfterCurrentWorkerAndConfirmationDisappear() async throws {
        var unavailable = preview
        unavailable["eligible"] = false
        unavailable["unavailableReason"] = "LEGACY_REVIEW"
        unavailable["legacyPaymentId"] = requestId
        unavailable["terms"] = ["gigId": gig, "payerId": actor, "payeeId": NSNull(), "ownerConfirmedAt": NSNull()]
        let vm = try make(
            posts: [.status(202, body: json(legacyPending))],
            reads: [.status(200, body: json(legacyPending))],
            gigFields: ["accepted_by": NSNull(), "owner_confirmed_at": NSNull()],
            previews: [.status(200, body: json(unavailable)), .status(200, body: json(unavailable))]
        )
        await vm.load()
        XCTAssertTrue(vm.canTip)
        XCTAssertFalse(vm.mayChooseTip)
        XCTAssertTrue(tipPosts.isEmpty)
        guard case let .loaded(content) = vm.state else { return XCTFail("Existing detail did not load") }
        XCTAssertEqual(content.dock.primary.label, "Send a tip")
        await vm.prepareTip()
        XCTAssertTrue(vm.hasTipOriginal)
        XCTAssertEqual(vm.tipOriginalAmount, 1000)
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(try bodies().first?["mode"] as? String, "check")
        XCTAssertEqual(try bodies().first?["requestId"] as? String, requestId)
    }

    func testFreshInstallDoesNotInventTipEntryWithoutPendingHistoricalPayment() async throws {
        var unavailable = preview
        unavailable["eligible"] = false
        unavailable["unavailableReason"] = "NOT_CONFIRMED"
        unavailable["terms"] = ["gigId": gig, "payerId": actor, "payeeId": NSNull(), "ownerConfirmedAt": NSNull()]
        let vm = try make(previewFields: unavailable, gigFields: ["accepted_by": NSNull(), "owner_confirmed_at": NSNull()])
        await vm.load()
        XCTAssertFalse(vm.canTip)
        XCTAssertTrue(tipPosts.isEmpty)
    }

    func testRealKeychainRetainsOnlyOriginalAcrossStoreInstances() throws {
        let service = "app.pantopus.ios.tip-verification.\(UUID().uuidString)"
        let first = KeychainStore(service: service)
        defer { try? first.delete(scope) }
        try seed(first)
        let reopened = KeychainStore(service: service)
        let bytes = try XCTUnwrap(reopened.readData(scope))
        XCTAssertEqual(try JSONDecoder().decode(TipOriginal.self, from: bytes), try decoded(original, as: TipOriginal.self))
        var attributes: CFTypeRef?
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: scope,
            kSecReturnAttributes as String: true
        ]
        XCTAssertEqual(SecItemCopyMatching(query as CFDictionary, &attributes), errSecSuccess)
        let values = try XCTUnwrap(attributes as? [String: Any])
        XCTAssertEqual(values[kSecAttrAccessible as String] as? String, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
        XCTAssertNotEqual(values[kSecAttrSynchronizable as String] as? Bool, true)
        try reopened.delete(scope)
        XCTAssertNil(try first.readData(scope))
    }

    func testChangedCheckoutBeforeSDKPresentationKeepsOriginalAndDoesNotPresent() async throws {
        let store = InMemoryStore(), presenter = StubTipPresenter()
        var changed = response()
        changed["checkout"] = ["paymentIntentId": "pi_tip", "clientSecret": "pi_tip_secret_synthetic", "customer": "cus_other"]
        let vm = try make(
            posts: [.status(202, body: json(response())), .status(202, body: json(changed))],
            store: store,
            presenter: presenter
        )
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertEqual(presenter.presentPaymentCallCount, 0)
        XCTAssertNotNil(try store.readData(scope))
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
    }

    func testRetiredServerReadCannotClearOriginalOrPublishPaid() async throws {
        let store = InMemoryStore()
        try seed(store)
        var identity: GigStopViewModel.Identity? = .init(actor: actor, session: "native-session", origin: origin)
        let vm = try make(reads: [.status(200, body: json(done), delay: 0.15)], store: store) { identity }
        let read = Task { await vm.prepareTip() }
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline,
              !SequencedURLProtocol.capturedRequests
              .contains(where: { $0.url?.path == statusPath }) {
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == statusPath })
        identity = nil
        await read.value
        XCTAssertNotEqual(vm.tipStatus, .succeeded)
        XCTAssertNotNil(try store.readData(scope))
    }
}
