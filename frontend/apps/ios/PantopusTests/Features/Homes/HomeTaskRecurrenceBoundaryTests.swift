import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskRecurrenceBoundaryTests: HomeTaskRecurrenceTestCase {
    func testOnlyDefinitiveRejectionMayBeAcknowledgedAndNoReplacementPostOccurs() async {
        for (status, code, dismiss) in [
            (400, "HOME_RECORD_INVALID", true),
            (409, "HOME_TASK_RECURRENCE_STALE", true),
            (409, "HOME_TASK_RECURRENCE_CONFLICT", false),
            (503, "HOME_RECORD_INVALID", false)
        ] {
            SequencedURLProtocol.reset()
            let store = RecurrenceMemoryStore()
            let current = model(store)
            await load(current)
            SequencedURLProtocol.sequence = [.status(200, body: json(recurrence())), .status(status, body: json(["code": code]))]
            await current.start()
            XCTAssertEqual(current.canDismiss, dismiss)
            SequencedURLProtocol.sequence = [.status(200, body: taskDetail()), .status(200, body: json(recurrence()))]
            await current.acknowledge()
            XCTAssertEqual(store.draft == nil, dismiss)
            XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }.count, 1)
        }
    }

    func testUnwritableOrUnreadableStoreCannotSubmitANewChange() async {
        for read in [true, false] {
            SequencedURLProtocol.reset()
            let store = RecurrenceMemoryStore()
            let current = model(store)
            if read { store.failRead = true }
            SequencedURLProtocol.sequence = [.status(200, body: taskDetail()), .status(200, body: json(recurrence()))]
            await current.activate(ifCurrent: current.activationRevision)
            if !read { store.failWrite = true }
            await current.start()
            XCTAssertNotNil(current.error)
            XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod != "POST" })
        }
    }

    func testManagementLossAndCurrentDenialRemoveVisibleSourceAndPreventPost() async {
        for denied in [true, false] {
            SequencedURLProtocol.reset()
            let current = model(RecurrenceMemoryStore())
            await load(current)
            SequencedURLProtocol.sequence = [denied ? .status(403, body: "{}") : .status(200, body: json(recurrence(manage: false)))]
            await current.start()
            XCTAssertNil(current.task)
            XCTAssertNil(current.state)
            XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod != "POST" })
        }
    }

    func testSourceChangedBetweenReadsCannotActivateWithAnUnseenTimestamp() async {
        let current = model(RecurrenceMemoryStore())
        SequencedURLProtocol.sequence = [
            .status(200, body: taskDetail()),
            .status(200, body: json(recurrence(overrides: ["task_updated_at": "2026-09-10T12:00:01Z"])))
        ]
        await current.activate(ifCurrent: current.activationRevision)
        XCTAssertNil(current.task)
        XCTAssertFalse(current.canStart)
    }

    func testConfirmationSurvivesFailedFinalReadAndAcknowledgmentStorageFailure() async {
        let store = RecurrenceMemoryStore()
        let current = model(store)
        await load(current)
        SequencedURLProtocol.sequence = [.status(200, body: json(recurrence())), .status(200, body: changed()), .status(503, body: "{}")]
        await current.start()
        XCTAssertNotNil(store.draft?.confirmed)
        current.suspend()
        await load(current, revision: 1)
        store.failClear = true
        SequencedURLProtocol.sequence = [.status(200, body: taskDetail()), .status(200, body: json(recurrence(1)))]
        await current.acknowledge()
        XCTAssertNotNil(store.draft?.confirmed)
        XCTAssertNotNil(current.pending?.confirmed)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testPauseContainsOnlyOriginalIdActionAndExpectedVersion() async throws {
        let current = model(RecurrenceMemoryStore())
        await load(current, revision: 1)
        SequencedURLProtocol.sequence = [
            .status(200, body: json(recurrence(1))),
            .status(200, body: changed(2, state: "paused", action: "pause", receiptRevision: 2)),
            .status(200, body: taskDetail()),
            .status(200, body: json(recurrence(2, state: "paused")))
        ]
        await current.pause()
        let post = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first { $0.httpMethod == "POST" })
        XCTAssertEqual(try body(post) as NSDictionary, ["request_id": requestId, "action": "pause", "expected_revision": 1] as NSDictionary)
        XCTAssertEqual(current.state?.configuration?.state, "paused")
        XCTAssertNotNil(current.pending?.confirmed)
    }

    func testProtectedStoreRoundTripScopesTaskAndKeepsExactMatchingClear() throws {
        let store = PendingHomeTaskRecurrenceStore(service: "app.pantopus.ios.tests.recurrence.\(UUID().uuidString)")
        let origin = api().apiBaseURL.absoluteString
        let draft = HomeTaskRecurrenceDraft(
            version: 1,
            origin: origin,
            actorId: actor,
            homeId: home,
            taskId: task,
            requestId: requestId,
            command: HomeTaskRecurrenceCommand(action: "pause", expectedRevision: 0)
        )
        try store.save(draft, scope: "scope-one", matching: nil)
        defer { try? store.clear(scope: "scope-one", matching: draft) }
        XCTAssertEqual(try store.load(scope: "scope-one"), draft)
        XCTAssertNil(try store.load(scope: "scope-two"))
        XCTAssertThrowsError(try store.save(draft, scope: "scope-one", matching: nil))
        let encoded = try XCTUnwrap(String(data: JSONEncoder().encode(draft), encoding: .utf8))
        XCTAssertFalse(encoded.lowercased().contains("token"))
        XCTAssertFalse(encoded.lowercased().contains("session"))
        XCTAssertTrue(draft.matches(origin: origin, home: home, task: task, actor: actor))
        XCTAssertFalse(draft.matches(origin: origin, home: home, task: requestId, actor: actor))
        try store.clear(scope: "scope-one", matching: draft)
        XCTAssertNil(try store.load(scope: "scope-one"))
    }

    func testActualScheduleProjectionAppearsInRecurringWithoutLegacyRuleAndRejectsMalformedState() throws {
        let projection: [String: Any] = [
            "state": "active",
            "frequency": "MONTHLY",
            "interval": 2,
            "timezone": "UTC",
            "next_due_at": updated
        ]
        let row = try JSONDecoder().decode(HomeTaskResponse.self, from: Data(taskDetail([
            "recurrence_rule": NSNull(), "automatic_recurrence": projection
        ]).utf8)).task
        XCTAssertTrue(try XCTUnwrap(row.automaticRecurrence).valid)
        XCTAssertTrue(HouseholdTasksListViewModel.passes(row, tab: .recurring, now: Date()))
        XCTAssertEqual(HouseholdTasksListViewModel.project(task: row, now: Date()).recurrenceChip, "Repeats every 2 months")
        let bad = try JSONDecoder().decode(
            HomeTaskAutomaticRecurrence.self,
            from: Data(json(projection.merging(["next_due_at": NSNull()]) { _, new in new }).utf8)
        )
        XCTAssertFalse(bad.valid)
    }
}
