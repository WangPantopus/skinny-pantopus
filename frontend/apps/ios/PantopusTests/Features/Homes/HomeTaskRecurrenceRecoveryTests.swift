import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskRecurrenceRecoveryTests: HomeTaskRecurrenceTestCase {
    func testLostResponseColdRecoveryPreservesLaterPauseAndOriginalReceiptUntilAcknowledgment() async throws {
        let store = RecurrenceMemoryStore()
        let originalModel = model(store)
        await load(originalModel)
        SequencedURLProtocol.sequence = [.status(200, body: json(recurrence())), .status(503, body: "{}")]
        await originalModel.start()
        let original = try XCTUnwrap(store.draft)
        originalModel.suspend()
        let reopened = model(store)
        await load(reopened, revision: 2, state: "paused")
        SequencedURLProtocol.sequence = [
            .status(200, body: json(recurrence(2, state: "paused"))), .status(200, body: changed(2, state: "paused")),
            .status(200, body: taskDetail()), .status(200, body: json(recurrence(2, state: "paused")))
        ]
        await reopened.retry()
        XCTAssertEqual(reopened.state?.configuration?.state, "paused")
        XCTAssertEqual(store.draft?.confirmed?.revision, 1)
        XCTAssertEqual(store.draft?.command, original.command)
        reopened.suspend()
        let confirmed = model(store)
        await load(confirmed, revision: 2, state: "paused")
        XCTAssertNotNil(confirmed.pending?.confirmed)
        SequencedURLProtocol.sequence = [.status(200, body: taskDetail()), .status(200, body: json(recurrence(2, state: "paused")))]
        await confirmed.acknowledge()
        XCTAssertNil(store.draft)
        let posts = SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(try body(posts[0]) as NSDictionary, try body(posts[1]) as NSDictionary)
        XCTAssertEqual(posts[1].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), session)
    }

    func testSuspendOrAccountChangeDuringPreflightKeepsOriginalAndSendsNoPost() async throws {
        for accountChange in [false, true] {
            SequencedURLProtocol.reset()
            var identity: String? = "opening"
            let store = RecurrenceMemoryStore()
            let current = model(store) { identity }
            await load(current)
            SequencedURLProtocol.sequence = [.status(200, body: json(recurrence()), delay: 0.15)]
            let operation = Task { await current.start() }
            try await waitForRequests(3)
            if accountChange { identity = "replacement" } else { current.suspend() }
            await operation.value
            XCTAssertNotNil(store.draft)
            XCTAssertNil(current.task)
            XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod != "POST" })
        }
    }

    func testCloseAfterPostDoesNotDropOriginalAndColdRetryRemainsAvailable() async throws {
        let store = RecurrenceMemoryStore()
        let opened = model(store)
        await load(opened)
        SequencedURLProtocol.sequence = [.status(200, body: json(recurrence())), .status(200, body: changed(), delay: 0.15)]
        let operation = Task { await opened.start() }
        try await waitForRequests(4)
        opened.suspend()
        await operation.value
        XCTAssertNil(opened.task)
        XCTAssertNotNil(store.draft)
        XCTAssertNil(store.draft?.confirmed)
        let cold = model(store)
        await load(cold, revision: 1)
        XCTAssertNotNil(cold.pending)
    }

    func testChangedStoreDuringPreflightCannotSendOrEraseOtherRequest() async throws {
        let store = RecurrenceMemoryStore()
        let current = model(store)
        await load(current)
        SequencedURLProtocol.sequence = [.status(200, body: json(recurrence()), delay: 0.15)]
        let operation = Task { await current.start() }
        try await waitForRequests(3)
        let key = try XCTUnwrap(store.saved.keys.first), original = try XCTUnwrap(store.draft)
        let replacement = HomeTaskRecurrenceDraft(
            version: 1,
            origin: original.origin,
            actorId: actor,
            homeId: home,
            taskId: task,
            requestId: task,
            command: original.command
        )
        store.saved[key] = replacement
        await operation.value
        XCTAssertEqual(store.draft, replacement)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod != "POST" })
    }

    func testMismatchedReceiptRetainsUnconfirmedOriginal() async {
        for changes: [String: Any] in [
            ["actor_id": task],
            ["task_id": actor],
            ["request_id": task],
            ["revision": 9],
            ["created_at": "bad"]
        ] {
            SequencedURLProtocol.reset()
            let store = RecurrenceMemoryStore()
            let current = model(store)
            await load(current)
            SequencedURLProtocol.sequence = [.status(200, body: json(recurrence())), .status(200, body: changed(receiptChanges: changes))]
            await current.start()
            XCTAssertNotNil(store.draft)
            XCTAssertNil(store.draft?.confirmed)
            XCTAssertFalse(current.canDismiss)
        }
    }

    func testFailedProofWriteKeepsObservedReceiptThroughSuspendAndRejectsChangedHash() async {
        let store = RecurrenceMemoryStore()
        let current = model(store)
        await load(current)
        store.failProof = true
        SequencedURLProtocol.sequence = successfulChange()
        await current.start()
        XCTAssertNil(store.draft?.confirmed)
        current.suspend()
        await load(current, revision: 1)
        store.failProof = false
        SequencedURLProtocol.sequence = [
            .status(200, body: json(recurrence(1))),
            .status(200, body: changed(receiptChanges: ["request_hash": String(repeating: "c", count: 64)]))
        ]
        await current.retry()
        XCTAssertNil(store.draft?.confirmed)
        XCTAssertNotNil(current.error)
    }
}
