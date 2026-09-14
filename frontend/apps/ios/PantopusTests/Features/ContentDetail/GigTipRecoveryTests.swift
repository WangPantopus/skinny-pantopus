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

    func testLegacyPendingBlocksNewTip() async throws {
        var unavailable = preview
        unavailable["eligible"] = false
        unavailable["unavailableReason"] = "legacy_pending"
        unavailable["legacyPaymentId"] = otherId
        let vm = try make(previewFields: unavailable)
        await vm.load()
        await vm.sendTip(amountCents: 1000)
        XCTAssertTrue(tipPosts.isEmpty)
        XCTAssertTrue(vm.tipMessage.contains("earlier tip"))
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
