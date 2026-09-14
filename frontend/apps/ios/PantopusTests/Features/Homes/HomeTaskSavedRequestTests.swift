import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskSavedRequestTests: HomeTaskCreationTestCase {
    func testOnlyExactConfirmedTerminalCodesAllowExplicitAcknowledgement() async throws {
        for (status, code) in [(400, "HOME_RECORD_INVALID"), (409, "HOME_TASK_CREATE_RETIRED")] {
            SequencedURLProtocol.reset()
            let store = CreationMemoryStore()
            let client = coordinator(store)
            SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(status, body: json(["code": code]))]
            do { _ = try await client.save(payload)
                XCTFail("Rejected request accepted")
            } catch {}
            XCTAssertNotNil(client.terminalMessage)
            XCTAssertEqual(store.singleDraft, draft)
            try client.acknowledgeTerminalRequest()
            XCTAssertNil(store.singleDraft)
            XCTAssertNil(client.pending)
            XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
        }
    }

    func testUnknownConflictOrMalformedTerminalResponseCannotBeDiscarded() async {
        for (status, code) in [
            (408, "HOME_RECORD_INVALID"),
            (429, "HOME_RECORD_INVALID"),
            (503, "HOME_RECORD_INVALID"),
            (400, "UNKNOWN"),
            (409, "HOME_TASK_CREATE_CONFLICT"),
            (409, "HOME_RECORD_INVALID")
        ] {
            SequencedURLProtocol.reset()
            let store = CreationMemoryStore()
            let client = coordinator(store)
            SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(status, body: json(["code": code]))]
            do { _ = try await client.save(payload) } catch {}
            XCTAssertNil(client.terminalMessage)
            XCTAssertThrowsError(try client.acknowledgeTerminalRequest())
            XCTAssertEqual(store.singleDraft, draft)
        }
    }

    func testTerminalAcknowledgementDoesNotDismissIfProtectedClearFails() async {
        let store = CreationMemoryStore()
        store.failClear = true
        let model = form(store)
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: collection()),
            .status(409, body: json(["code": "HOME_TASK_CREATE_RETIRED"]))
        ]
        await model.load()
        model.update(.title, to: "Rejected task")
        _ = await model.save()
        model.acknowledgeTerminalRequest()
        XCTAssertFalse(model.shouldDismiss)
        XCTAssertNotNil(store.singleDraft)
        store.failClear = false
        model.acknowledgeTerminalRequest()
        XCTAssertTrue(model.shouldDismiss)
        XCTAssertNil(model.createdTaskId)
        XCTAssertNil(store.singleDraft)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 4)
    }

    func testRetiredScreenCannotAcknowledgeAnotherSessionsTerminalRequest() async {
        var identity: String? = "opening"
        let store = CreationMemoryStore()
        let client = coordinator(store) { identity }
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(409, body: json(["code": "HOME_TASK_CREATE_RETIRED"]))]
        do { _ = try await client.save(payload) } catch {}
        identity = "replacement"
        XCTAssertThrowsError(try client.acknowledgeTerminalRequest())
        XCTAssertEqual(store.singleDraft, draft)
    }

    func testKnownReceiptSurvivesReopenAfterFailedCleanup() async throws {
        let store = CreationMemoryStore()
        store.failClear = true
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        do { _ = try await coordinator(store).save(payload) } catch {}
        XCTAssertEqual(store.singleDraft?.taskId, task)
        XCTAssertEqual(store.singleDraft?.payloadHash, payloadHash)
        store.failClear = false
        let reopened = coordinator(store)
        try reopened.restore()
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: created(receiptChanges: ["payload_hash": String(repeating: "c", count: 64)]))
        ]
        do { _ = try await reopened.save(payload)
            XCTFail("Known proof was forgotten")
        } catch {}
        XCTAssertEqual(store.singleDraft?.payloadHash, payloadHash)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        _ = try await reopened.save(payload)
        XCTAssertNil(store.singleDraft)
    }

    func testFailedProofWriteThenHideRestoreKeepsKnownReceiptHash() async throws {
        let store = CreationMemoryStore()
        store.failWriteOn = 2
        let client = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        do { _ = try await client.save(payload)
            XCTFail("Failed proof write accepted")
        } catch {}
        XCTAssertEqual(store.singleDraft, draft)
        XCTAssertEqual(client.receipt?.payloadHash, payloadHash)
        client.hide()
        XCTAssertNil(client.pending)
        try client.restore()
        XCTAssertEqual(client.pending?.payloadHash, payloadHash)
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: created(receiptChanges: ["payload_hash": String(repeating: "c", count: 64)]))
        ]
        do { _ = try await client.save(payload)
            XCTFail("Observed proof was forgotten")
        } catch {}
        XCTAssertEqual(store.singleDraft?.payloadHash, payloadHash)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        _ = try await client.save(payload)
        XCTAssertNil(store.singleDraft)
    }

    func testAnotherSavedRequestDuringAwaitCannotBeOverwrittenOrCleared() async throws {
        let store = CreationMemoryStore()
        let client = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created(), delay: 0.1)]
        let operation = Task { try await client.save(payload) }
        try await waitForRequests(2)
        let scope = try XCTUnwrap(store.saved.keys.first)
        let other = HomeTaskCreateDraft(requestId: task, homeId: home, actorId: actor, payload: payload)
        store.saved[scope] = other
        do { _ = try await operation.value
            XCTFail("Competing saved request overwritten")
        } catch {}
        XCTAssertEqual(store.singleDraft, other)
        XCTAssertNotNil(client.pending)
        XCTAssertThrowsError(try client.restore())
    }

    func testProtectedStoreRoundTripUsesExactScopeAndMatchingClear() throws {
        let store = PendingHomeTaskCreateStore(service: "app.pantopus.ios.tests.task-create.\(UUID().uuidString)")
        let first = "synthetic-origin|\(actor)|\(home)"
        let other = "synthetic-origin|\(task)|\(home)"
        try store.save(draft, scope: first, matching: nil)
        defer { try? store.clear(scope: first, matching: draft) }
        XCTAssertEqual(try store.load(scope: first), draft)
        XCTAssertNil(try store.load(scope: other))
        let different = HomeTaskCreateDraft(requestId: task, homeId: home, actorId: actor, payload: payload)
        XCTAssertThrowsError(try store.clear(scope: first, matching: different))
        XCTAssertEqual(try store.load(scope: first), draft)
        try store.clear(scope: first, matching: draft)
        XCTAssertNil(try store.load(scope: first))
    }
}
