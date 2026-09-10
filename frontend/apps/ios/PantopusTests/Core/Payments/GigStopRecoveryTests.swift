import XCTest
@testable import Pantopus

@MainActor
final class GigStopRecoveryTests: GigStopTestCase {
    func testLostResponseSurvivesReopenAndRetriesOriginalCommandAfter404() async throws {
        let store = StopMemoryStore()
        let first = make(store)
        SequencedURLProtocol.routeResponses = try [
            previewPath: [.status(200, body: preview())],
            submitPath: [.status(503, body: "{}")]
        ]
        await first.checkStatus()
        XCTAssertTrue(first.maySubmit)
        XCTAssertTrue(posts.isEmpty)
        await first.submit(reason: .safetyConcern)
        let original = try XCTUnwrap(store.request)
        XCTAssertFalse(first.completed)
        first.retire()
        let reopened = make(store, action: .reopenBidding)
        SequencedURLProtocol.routeResponses = try [
            submitPath + "/" + original.requestId: [.status(404, body: "{}")],
            previewPath: [.status(200, body: preview())],
            submitPath: [.status(200, body: json(progress(original, completed: true)))]
        ]
        await reopened.checkStatus()
        XCTAssertEqual(posts.count, 1)
        XCTAssertFalse(reopened.maySubmit)
        XCTAssertTrue(reopened.mayRetry)
        XCTAssertEqual(reopened.displayedAction, .cancel)
        await reopened.retry()
        XCTAssertTrue(reopened.completed)
        XCTAssertNil(store.request)
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(try body(posts[0]) as NSDictionary, try body(posts[1]) as NSDictionary)
        let displayed = try XCTUnwrap(try body(posts[1])["expectedTerms"] as? [String: Any])
        XCTAssertTrue(displayed["acceptedAt"] is NSNull)
        XCTAssertTrue(displayed["acceptedBidId"] is NSNull)
    }

    func testPendingAndNeedsReviewResponsesNeverReportSuccess() async throws {
        for status in ["pending", "needs_review"] {
            SequencedURLProtocol.reset()
            let store = StopMemoryStore()
            let original = request()
            store.request = original
            var result = try progress(original)
            result["status"] = status
            result["canRetry"] = false
            SequencedURLProtocol.sequence = try [.status(200, body: json(result))]
            let model = make(store)
            await model.checkStatus()
            XCTAssertFalse(model.completed)
            XCTAssertFalse(model.mayRetry)
            XCTAssertFalse(model.maySubmit)
            XCTAssertEqual(store.request, original)
            XCTAssertTrue(posts.isEmpty)
        }
    }

    func testReadOnlyExactCompletionClearsOnlyItsOwnRecovery() async throws {
        let store = StopMemoryStore()
        let original = request(action: .workerRelease)
        store.request = original
        let model = make(store)
        SequencedURLProtocol.sequence = try [.status(200, body: json(progress(original, completed: true)))]
        await model.checkStatus()
        XCTAssertTrue(model.completed)
        XCTAssertEqual(model.displayedAction, .workerRelease)
        XCTAssertNil(store.request)
        XCTAssertTrue(posts.isEmpty)
    }

    func testMismatchedCompletionFieldsCannotClearRecovery() async throws {
        let invalid: [(String, Any)] = [
            ("requestId", UUID().uuidString),
            ("gigId", UUID().uuidString),
            ("paymentId", UUID().uuidString),
            ("ownerId", UUID().uuidString),
            ("workerId", UUID().uuidString),
            ("amountCents", 999),
            ("currency", "eur"),
            ("action", "close"),
            ("gigStatus", "open"),
            ("financialStatus", "refunded")
        ]
        for (field, value) in invalid {
            SequencedURLProtocol.reset()
            let store = StopMemoryStore()
            let original = request()
            store.request = original
            var result = try progress(original, completed: true)
            var receipt = try XCTUnwrap(result["receipt"] as? [String: Any])
            receipt[field] = value
            result["receipt"] = receipt
            SequencedURLProtocol.sequence = try [.status(200, body: json(result))]
            let model = make(store)
            await model.checkStatus()
            XCTAssertFalse(model.completed, field)
            XCTAssertEqual(store.request, original, field)
            XCTAssertNotNil(model.error, field)
        }
    }

    func testForeignOriginalActorCanReadButCannotRetry() async throws {
        let store = StopMemoryStore()
        let foreign = request(actor: worker)
        SequencedURLProtocol.routeResponses = try [
            previewPath: [.status(200, body: preview(active: foreign.requestId))],
            submitPath + "/" + foreign.requestId: [
                .status(200, body: json(progress(foreign, canRetry: false)))
            ]
        ]
        let model = make(store)
        await model.checkStatus()
        await model.retry()
        await model.submit(reason: .other)
        XCTAssertTrue(model.hasRequest)
        XCTAssertFalse(model.mayRetry)
        XCTAssertFalse(model.maySubmit)
        XCTAssertNil(store.request)
        XCTAssertTrue(posts.isEmpty)
    }

    func testSessionReplacementRetiresBeforeSendingAndHidesTerms() async throws {
        for changed in ["actor", "session", "origin"] {
            SequencedURLProtocol.reset()
            let store = StopMemoryStore()
            let identity = StopIdentity()
            let model = make(store, identity: identity)
            SequencedURLProtocol.sequence = try [.status(200, body: preview())]
            await model.checkStatus()
            switch changed {
            case "actor": identity.actor = worker
            case "session": identity.session = "replacement"
            default: identity.origin = "https://other.example.invalid"
            }
            await model.submit(reason: .other)
            await model.checkStatus()
            XCTAssertFalse(model.isCurrent)
            XCTAssertNil(model.terms)
            XCTAssertTrue(posts.isEmpty)
        }
    }

    func testNewSameActorSessionRecoversOriginalTermsUsingFreshServerProof() async throws {
        let store = StopMemoryStore()
        let original = request()
        store.request = original
        let identity = StopIdentity()
        identity.session = "fresh-login"
        let newSession = String(repeating: "b", count: 64)
        let model = make(store, identity: identity)
        SequencedURLProtocol.routeResponses = try [
            submitPath + "/" + original.requestId: [.status(200, body: json(progress(original, session: newSession)))],
            submitPath: [.status(200, body: json(progress(original, completed: true, session: newSession)))]
        ]
        await model.checkStatus()
        await model.retry()
        XCTAssertTrue(model.completed)
        XCTAssertEqual(try body(XCTUnwrap(posts.first))["expectedSessionScope"] as? String, newSession)
        XCTAssertEqual(try body(XCTUnwrap(posts.first))["requestId"] as? String, original.requestId)
    }

    func testOpeningServerSessionIsStickyAndDenialRetiresMetadata() async throws {
        for response in try [
            SequencedURLProtocol.Response.status(200, body: preview(session: String(repeating: "b", count: 64))),
            .status(403, body: "{}"),
            .status(404, body: "{}"),
            .status(401, body: "{}")
        ] {
            SequencedURLProtocol.reset()
            let model = make(StopMemoryStore())
            SequencedURLProtocol.sequence = try [.status(200, body: preview()), response]
            await model.checkStatus()
            await model.checkStatus()
            XCTAssertFalse(model.isCurrent)
            XCTAssertNil(model.terms)
            XCTAssertFalse(model.maySubmit)
        }
    }

    func testStorageFailurePreventsSendingAndChangedTermsKeepOriginalIdentity() async throws {
        let store = StopMemoryStore()
        let model = make(store)
        SequencedURLProtocol.sequence = try [.status(200, body: preview())]
        await model.checkStatus()
        store.fail = true
        await model.submit(reason: .other)
        XCTAssertTrue(posts.isEmpty)
        store.fail = false
        let original = request()
        store.request = original
        var changed = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(preview().utf8)) as? [String: Any])
        var changedTerms = try XCTUnwrap(changed["terms"] as? [String: Any])
        changedTerms["amountCents"] = 2000
        changed["terms"] = changedTerms
        SequencedURLProtocol.routeResponses = try [
            submitPath + "/" + requestId: [.status(404, body: "{}")],
            previewPath: [.status(200, body: json(changed))]
        ]
        await model.checkStatus()
        XCTAssertFalse(model.mayRetry)
        XCTAssertFalse(model.maySubmit)
        XCTAssertEqual(store.request, original)
    }

    func testOnlyProtectedActiveConflictCanAdoptAnotherRequest() async throws {
        for code in ["STOP_ACTIVE", "TERMS_CHANGED"] {
            SequencedURLProtocol.reset()
            let store = StopMemoryStore()
            let original = request()
            store.request = original
            let active = request(action: .reopenBidding, requestId: UUID().uuidString.lowercased())
            let model = make(store)
            SequencedURLProtocol.routeResponses = try [
                submitPath + "/" + requestId: [.status(404, body: "{}")],
                previewPath: [
                    .status(200, body: preview(active: active.requestId, eligible: false))
                ],
                submitPath: [
                    .status(409, body: json(["code": code, "activeRequestId": active.requestId]))
                ],
                submitPath + "/" + active.requestId: [.status(200, body: json(progress(active)))]
            ]
            await model.checkStatus()
            XCTAssertEqual(store.request, original, "Preview alone cannot replace the original")
            XCTAssertTrue(model.mayRetry)
            await model.retry()
            XCTAssertEqual(store.request, code == "STOP_ACTIVE" ? active : original)
            XCTAssertFalse(model.completed)
        }
    }

    func testDeniedAndUnverifiedPolicyCannotStartARequest() async throws {
        for financial in ["review", "release"] {
            SequencedURLProtocol.reset()
            let model = make(StopMemoryStore())
            SequencedURLProtocol.sequence = try [.status(200, body: preview(eligible: financial == "review", financial: financial))]
            await model.checkStatus()
            await model.submit(reason: .other)
            XCTAssertFalse(model.maySubmit)
            XCTAssertTrue(posts.isEmpty)
        }
    }

    func testCloseAndAllStopActionsUseTheCommonCommandWithNoDelete() throws {
        for action in [GigStopAction.cancel, .close, .reopenBidding, .workerRelease] {
            let endpoint = GigStopEndpoints.submit(gig: gig, command: GigStopCommand(request: request(action: action), session: session))
            XCTAssertEqual(endpoint.method, .post)
            XCTAssertEqual(endpoint.path, submitPath)
            let body = try XCTUnwrap(endpoint.body)
            XCTAssertEqual(try object(body)["action"] as? String, action.rawValue)
        }
    }

    func testProtectedFileStoreRetainsOnlyOriginalNonsecretDataAndClearsExactRequest() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = PendingGigStopStore(directory: directory)
        let original = request()
        try store.save(original, scope: "origin|actor|gig")
        XCTAssertEqual(try store.load(scope: "origin|actor|gig"), original)
        XCTAssertNil(try store.load(scope: "other-origin|actor|gig"))
        try store.clear(scope: "origin|actor|gig", matching: request(action: .close))
        XCTAssertEqual(try store.load(scope: "origin|actor|gig"), original)
        let file = try XCTUnwrap(FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).first)
        let text = try String(contentsOf: file, encoding: .utf8)
        XCTAssertFalse(text.contains("sessionScope"))
        XCTAssertFalse(text.contains("expectedSessionScope"))
        XCTAssertFalse(text.contains("clientSecret"))
        try store.clear(scope: "origin|actor|gig", matching: original)
        XCTAssertNil(try store.load(scope: "origin|actor|gig"))
    }
}
