import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskCreationRecoveryTests: HomeTaskCreationTestCase {
    func testLostResponseReopenRetriesExactRequestAndAcceptsLaterLegitimateTitle() async throws {
        let store = CreationMemoryStore()
        let first = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(503, body: "{}")]
        do { _ = try await first.save(payload)
            XCTFail("Unknown response accepted")
        } catch {}
        XCTAssertEqual(store.singleDraft, draft)
        let reopened = coordinator(store)
        try reopened.restore()
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: created(taskChanges: ["title": "Later legitimate edit"]))
        ]
        let current = try await reopened.save(CreateHomeTaskRequest(taskType: "repair", title: "Must not replace original"))
        XCTAssertEqual(current.title, "Later legitimate edit")
        XCTAssertNil(store.singleDraft)
        let posts = SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(try body(posts[0]) as NSDictionary, try body(posts[1]) as NSDictionary)
        XCTAssertEqual(try body(posts[1])["request_id"] as? String, requestId)
        XCTAssertEqual(posts[1].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), session)
    }

    func test408And429KeepOriginalRequestForExactRecovery() async throws {
        let store = CreationMemoryStore()
        let client = coordinator(store)
        for code in [408, 429] {
            SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(code, body: "{}")]
            do { _ = try await client.save(payload)
                XCTFail("Unknown response accepted")
            } catch {}
            XCTAssertEqual(store.singleDraft, draft)
        }
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        _ = try await client.save(payload)
        XCTAssertNil(store.singleDraft)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }.count, 3)
    }

    func testWrongCreationReceiptNeverClearsSavedRequest() async {
        for changes in [
            ["actor_id": task],
            ["home_id": task],
            ["request_id": task],
            ["task_id": actor],
            ["payload_hash": "bad"],
            ["created_at": "bad"]
        ] {
            SequencedURLProtocol.reset()
            let store = CreationMemoryStore()
            SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created(receiptChanges: changes))]
            do { _ = try await coordinator(store).save(payload)
                XCTFail("Wrong receipt accepted")
            } catch {}
            XCTAssertEqual(store.singleDraft, draft)
        }
    }

    func testUnreadableAndUnwritableStoreCannotSendARequest() async {
        for read in [true, false] {
            let store = CreationMemoryStore()
            store.failRead = read
            store.failWrite = !read
            do { _ = try await coordinator(store).save(payload)
                XCTFail("Failed storage accepted")
            } catch {}
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testFailedReceiptCleanupKeepsKnownHashAndRejectsChangedRecovery() async throws {
        let store = CreationMemoryStore()
        store.failClear = true
        let client = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        do { _ = try await client.save(payload)
            XCTFail("Failed cleanup accepted")
        } catch {}
        XCTAssertEqual(store.singleDraft?.taskId, task)
        XCTAssertEqual(store.singleDraft?.payloadHash, payloadHash)
        store.failClear = false
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: created(receiptChanges: ["payload_hash": String(repeating: "c", count: 64)]))
        ]
        do { _ = try await client.save(payload)
            XCTFail("Changed hash accepted")
        } catch {}
        XCTAssertEqual(store.singleDraft?.taskId, task)
        XCTAssertEqual(store.singleDraft?.payloadHash, payloadHash)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        _ = try await client.save(payload)
        XCTAssertNil(store.singleDraft)
    }

    func testMissingSavedOriginalCannotTurnIntoAnotherCreate() async throws {
        let store = CreationMemoryStore()
        let client = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(503, body: "{}")]
        do { _ = try await client.save(payload) } catch {}
        store.saved = [:]
        client.hide()
        XCTAssertThrowsError(try client.restore())
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testSameActorNewSessionCanExplicitlyRecoverWithNewProof() async throws {
        let store = CreationMemoryStore()
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(503, body: "{}")]
        do { _ = try await coordinator(store).save(payload) } catch {}
        let next = coordinator(store) { "new-session" }
        try next.restore()
        let proof = String(repeating: "d", count: 64)
        SequencedURLProtocol.sequence = [.status(200, body: collection(token: proof)), .status(200, body: created(token: proof))]
        _ = try await next.save(payload)
        XCTAssertNil(store.singleDraft)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), proof)
    }

    func testConcurrentCoordinatorsCannotSendCompetingCreates() async throws {
        let store = CreationMemoryStore()
        let first = coordinator(store)
        let second = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection(), delay: 0.1), .status(200, body: created())]
        let operation = Task { try await first.save(payload) }
        try await waitForRequests(1)
        try second.restore()
        do { _ = try await second.save(payload)
            XCTFail("Concurrent create accepted")
        } catch {}
        _ = try await operation.value
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testLeavingAfterPostRetainsSavedRequestAndCannotDismissOldForm() async throws {
        let store = CreationMemoryStore()
        let model = form(store)
        SequencedURLProtocol.sequence = [
            .status(200, body: collection()),
            .status(200, body: "{\"occupants\":[]}"),
            .status(200, body: collection()),
            .status(201, body: created(), delay: 0.1)
        ]
        await model.load()
        model.update(.title, to: "Original task")
        let operation = Task { await model.save() }
        try await waitForRequests(4)
        model.suspend()
        let result = await operation.value
        XCTAssertFalse(result)
        XCTAssertFalse(model.shouldDismiss)
        XCTAssertNotNil(store.singleDraft)
    }

    func testLeavingAtCreationReturnCannotClearOriginalDespiteUnchangedIdentity() async throws {
        let store = CreationMemoryStore()
        let returned = try JSONDecoder().decode(HomeTaskCreationResult.self, from: Data(created().utf8))
        let boundary = CreationReturnBoundary(actor: actor, result: returned)
        let client = HomeTaskCreationCoordinator(home: home, origin: api().apiBaseURL, access: boundary, store: store) { self.requestId }
        do { _ = try await client.save(payload)
            XCTFail("Retired continuation accepted")
        } catch {}
        XCTAssertEqual(boundary.calls, 1)
        XCTAssertEqual(store.singleDraft, draft)
        XCTAssertNotNil(client.pending)
        XCTAssertNil(client.receipt)
    }

    func testCompletedCoordinatorCannotAllocateAnotherRequestBeforeDismissal() async throws {
        let store = CreationMemoryStore()
        let client = coordinator(store)
        SequencedURLProtocol.sequence = [.status(200, body: collection()), .status(200, body: created())]
        _ = try await client.save(payload)
        do { _ = try await client.save(CreateHomeTaskRequest(taskType: "chore", title: "Queued second task"))
            XCTFail("Completed form created another request")
        } catch {}
        XCTAssertNil(store.singleDraft)
        XCTAssertNil(client.pending)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testDeniedCreationCapabilityHidesFormAndMakesNoPost() async {
        SequencedURLProtocol.sequence = [.status(200, body: collection(create: false))]
        let model = form(CreationMemoryStore())
        await model.load()
        model.update(.title, to: "A task")
        let saved = await model.save()
        XCTAssertFalse(saved)
        XCTAssertFalse(model.isValid)
        guard case .error = model.state else { return XCTFail("Denied form remained open") }
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }
}

/// Models retirement at the async return boundary after transport has checked
/// its result, before the retaining coordinator resumes on the main actor.
@MainActor
private final class CreationReturnBoundary: HomeTaskCreationAccess {
    let openingActorId: String?
    var lifecycleRevision = 0
    var calls = 0
    private let result: HomeTaskCreationResult

    init(actor: String, result: HomeTaskCreationResult) {
        openingActorId = actor
        self.result = result
    }

    func requireCurrent(_ revision: Int?) throws {
        if let revision, revision != lifecycleRevision { throw CancellationError() }
    }

    func create(_: HomeTaskCreateDraft) async throws -> HomeTaskCreationResult {
        calls += 1
        lifecycleRevision += 1
        return result
    }
}
