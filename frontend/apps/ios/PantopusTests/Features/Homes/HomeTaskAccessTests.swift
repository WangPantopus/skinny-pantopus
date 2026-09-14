import XCTest
@testable import Pantopus

@MainActor
final class HomeTaskAccessTests: XCTestCase {
    private let home = "20000000-0000-4000-8000-000000000001"
    private let actor = "20000000-0000-4000-8000-000000000002"
    private let task = "20000000-0000-4000-8000-000000000003"
    private let scope = String(repeating: "a", count: 64)

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func api() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func access(api: APIClient? = nil, identity: @escaping () -> String? = { "opening-session" }) -> HomeTaskAccess {
        HomeTaskAccess(homeId: home, api: api ?? self.api(), actorId: actor, identity: identity)
    }

    private func record(status: String = "open", complete: Bool = false, delete: Bool = false, edit: Bool = false) -> [String: Any] {
        [
            "id": task,
            "home_id": home,
            "created_by": actor,
            "task_type": "chore",
            "title": "Exact task",
            "status": status,
            "capabilities": ["can_edit": edit, "can_complete": complete, "can_delete": delete, "can_upload": false]
        ]
    }

    private func json(_ value: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value), let result = String(data: data, encoding: .utf8) else {
            XCTFail("Invalid task fixture")
            return "{}"
        }
        return result
    }

    private func session(_ changes: [String: Any] = [:]) -> [String: Any] {
        ["home_id": home, "actor_id": actor, "session_scope": scope].merging(changes) { _, value in value }
    }

    private func list(create: Bool = false, records: [[String: Any]]? = nil, scopeChanges: [String: Any] = [:]) -> String {
        json(["tasks": records ?? [record()], "task_session": session(scopeChanges), "collection_capabilities": ["can_create": create]])
    }

    private func detail(_ value: [String: Any]? = nil, scopeChanges: [String: Any] = [:]) -> String {
        json(["task": value ?? record(), "task_session": session(scopeChanges)])
    }

    func testReadOnlyCollectionAndExactDetailBindCurrentSession() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: list()), .status(200, body: detail())]
        let client = access()
        let collection = try await client.list()
        XCTAssertFalse(try XCTUnwrap(collection.collectionCapabilities).canCreate)
        let current = try await client.detail(taskId: task)
        XCTAssertEqual(current.id, task)
        XCTAssertEqual(current.capabilities?.canComplete, false)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/homes/\(home)/tasks/\(task)")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
    }

    func testWrongActorHomeOrScopeCannotBindARead() async {
        for changes in [["actor_id": task], ["home_id": task], ["session_scope": "bad"]] {
            SequencedURLProtocol.sequence = [.status(200, body: list(scopeChanges: changes))]
            let client = access()
            do { _ = try await client.list()
                XCTFail("Wrong session accepted")
            } catch { XCTAssertFalse(client.isCurrent) }
        }
    }

    func testChangedServerSessionRetiresOriginalClient() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: list()),
            .status(200, body: detail(scopeChanges: ["session_scope": String(repeating: "b", count: 64)]))
        ]
        let client = access()
        _ = try await client.list()
        do { _ = try await client.detail(taskId: task)
            XCTFail("Changed server session adopted")
        } catch { XCTAssertFalse(client.isCurrent) }
    }

    func testMissingOpeningIdentityMakesNoRequest() async {
        do { _ = try await access { nil }.list()
            XCTFail("Missing identity accepted")
        } catch {}
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testReplacementSessionBeforeActionMakesNoMutationRequest() async throws {
        var identity = "original"
        let client = access { identity }
        SequencedURLProtocol.sequence = [.status(200, body: list(records: [record(complete: true)]))]
        _ = try await client.list()
        identity = "replacement"
        do { _ = try await client.complete(taskId: task, status: "done")
            XCTFail("Old screen acted")
        } catch {}
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    private func waitForRequest(count: Int = 1) async throws {
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.count >= count { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTFail("Expected request to start")
    }

    func testReplacementWhileReadingDiscardsResponse() async throws {
        var identity = "original"
        let client = access { identity }
        SequencedURLProtocol.sequence = [.status(200, body: list(), delay: 0.1)]
        let operation = Task { try await client.list() }
        try await waitForRequest()
        identity = "replacement"
        do { _ = try await operation.value
            XCTFail("Old response published")
        } catch {}
        XCTAssertFalse(client.isCurrent)
    }

    func testLeavingDuringAuthorizationPreventsLaterPut() async throws {
        let client = access()
        SequencedURLProtocol.sequence = [.status(200, body: detail(record(complete: true)), delay: 0.1)]
        let operation = Task { try await client.complete(taskId: task, status: "done") }
        try await waitForRequest()
        client.invalidatePending()
        do { _ = try await operation.value
            XCTFail("Suspended action continued")
        } catch {}
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET"])
    }

    func testRevokedCompletionCapabilityPreventsPut() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail())]
        do { _ = try await access().complete(taskId: task, status: "done")
            XCTFail("Denied completion accepted")
        } catch {}
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET"])
    }

    func testCompletionChecksCurrentRecordBeforeAndAfterExactMutation() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: detail(record(complete: true))),
            .status(200, body: json(["task": record(status: "done", complete: true)])),
            .status(200, body: detail(record(status: "done")))
        ]
        let current = try await access().complete(taskId: task, status: "done")
        XCTAssertEqual(current.status, "done")
        XCTAssertEqual(current.capabilities?.canComplete, false)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET", "PUT", "GET"])
        for request in SequencedURLProtocol.capturedRequests.dropFirst() {
            XCTAssertEqual(request.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
        }
    }

    func testWrongTaskMutationReceiptDoesNotReportCompletion() async {
        var wrong = record(status: "done")
        wrong["id"] = home
        SequencedURLProtocol.sequence = [.status(200, body: detail(record(complete: true))), .status(200, body: json(["task": wrong]))]
        do { _ = try await access().complete(taskId: task, status: "done")
            XCTFail("Wrong task accepted")
        } catch {}
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET", "PUT"])
    }

    func testMalformedSuccessfulDeleteDoesNotReportDeletion() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail(record(delete: true))), .status(200, body: "{}")]
        do { try await access().delete(taskId: task)
            XCTFail("Malformed deletion accepted")
        } catch {}
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.map(\.httpMethod), ["GET", "DELETE"])
    }

    func testExactDeletionUsesExpectedSession() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: detail(record(delete: true))),
            .status(200, body: "{\"message\":\"Task deleted\"}")
        ]
        try await access().delete(taskId: task)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
    }
}

extension HomeTaskAccessTests {
    func testReadOnlyListHasNoCreateCompletionOrDeletionControls() async {
        SequencedURLProtocol.sequence = [.status(200, body: list())]
        let vm = HouseholdTasksListViewModel(homeId: home, access: access())
        await vm.load()
        XCTAssertNil(vm.fab)
        guard case let .loaded(sections, _) = vm.state else { return XCTFail("Expected read-only task list") }
        guard case .chevron = sections[0].rows[0].trailing else { return XCTFail("Read-only task exposed a mutation") }
        vm.requestDelete(taskId: task)
        await vm.toggleDone(taskId: task)
        XCTAssertNil(vm.pendingEvent)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testUnknownCapabilitiesRemainReadOnly() async {
        var unknown = record()
        unknown.removeValue(forKey: "capabilities")
        SequencedURLProtocol.sequence = [.status(200, body: list(records: [unknown]))]
        let vm = HouseholdTasksListViewModel(homeId: home, access: access())
        await vm.load()
        vm.requestDelete(taskId: task)
        await vm.toggleDone(taskId: task)
        XCTAssertNil(vm.pendingEvent)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testEmptyReadOnlyListHasNoCreationCTA() async {
        SequencedURLProtocol.sequence = [.status(200, body: list(records: []))]
        let vm = HouseholdTasksListViewModel(homeId: home, access: access())
        await vm.load()
        guard case let .empty(content) = vm.state else { return XCTFail("Expected empty list") }
        XCTAssertNil(content.ctaTitle)
        XCTAssertNil(content.onCTA)
        XCTAssertNil(vm.fab)
    }

    func testListSuspensionDiscardsLateRowsAndRetainedCreateAction() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: list(create: true), delay: 0.1)]
        let opened = NavigationCount()
        let vm = HouseholdTasksListViewModel(homeId: home, onAddTask: { opened.value += 1 }, access: access())
        let operation = Task { await vm.load() }
        try await waitForRequest()
        vm.suspend()
        await operation.value
        XCTAssertNil(vm.fab)
        XCTAssertFalse(vm.hasLoadedContent)
        XCTAssertEqual(opened.value, 0)
    }

    func testDetailRetirementDiscardsInFlightContent() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: detail(), delay: 0.1)]
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        let operation = Task { await vm.load() }
        try await waitForRequest()
        vm.retire()
        await operation.value
        XCTAssertNil(vm.task)
        XCTAssertFalse(vm.isCurrent)
    }

    func testDetailFailedAccessClearsPreviouslyDisplayedTask() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail()), .status(403, body: "{\"error\":\"Access denied\"}")]
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        await vm.load()
        XCTAssertNotNil(vm.task)
        await vm.load()
        XCTAssertNil(vm.task)
        XCTAssertNotNil(vm.error)
    }

    func testCreateRechecksCapabilityBeforeNavigation() async {
        SequencedURLProtocol.sequence = [.status(200, body: list(create: true)), .status(200, body: list(create: false))]
        let opened = NavigationCount()
        let vm = HouseholdTasksListViewModel(homeId: home, onAddTask: { opened.value += 1 }, access: access())
        await vm.load()
        XCTAssertNotNil(vm.fab)
        await vm.requestCreate()
        XCTAssertEqual(opened.value, 0)
        XCTAssertNil(vm.fab)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testCurrentCreateNavigatesOnceAfterFreshCapability() async {
        SequencedURLProtocol.sequence = [.status(200, body: list(create: true)), .status(200, body: list(create: true))]
        let opened = NavigationCount()
        let vm = HouseholdTasksListViewModel(homeId: home, onAddTask: { opened.value += 1 }, access: access())
        await vm.load()
        await vm.requestCreate()
        XCTAssertEqual(opened.value, 1)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), scope)
    }

    func testLeavingDuringCreateCheckCannotNavigateOrRestoreContent() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: list(create: true)), .status(200, body: list(create: true), delay: 0.1)]
        let opened = NavigationCount()
        let vm = HouseholdTasksListViewModel(homeId: home, onAddTask: { opened.value += 1 }, access: access())
        await vm.load()
        let operation = Task { await vm.requestCreate() }
        try await waitForRequest(count: 2)
        vm.suspend()
        await operation.value
        XCTAssertEqual(opened.value, 0)
        XCTAssertFalse(vm.hasLoadedContent)
        XCTAssertNil(vm.fab)
    }

    func testReadOnlyDetailCannotOpenEdit() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail())]
        let opened = NavigationCount()
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        await vm.load()
        await vm.edit { opened.value += 1 }
        XCTAssertEqual(opened.value, 0)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func testEditRechecksCurrentCapabilityBeforeNavigation() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail(record(edit: true))), .status(200, body: detail())]
        let opened = NavigationCount()
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        await vm.load()
        await vm.edit { opened.value += 1 }
        XCTAssertEqual(opened.value, 0)
        XCTAssertNil(vm.task)
        XCTAssertNotNil(vm.error)
    }

    func testCurrentEditNavigatesAfterExactRecordCheck() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail(record(edit: true))), .status(200, body: detail(record(edit: true)))]
        let opened = NavigationCount()
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        await vm.load()
        await vm.edit { opened.value += 1 }
        XCTAssertEqual(opened.value, 1)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testLeavingDuringEditCheckCannotNavigateOrRestoreContent() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: detail(record(edit: true))),
            .status(200, body: detail(record(edit: true)), delay: 0.1)
        ]
        let opened = NavigationCount()
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        await vm.load()
        let operation = Task { await vm.edit { opened.value += 1 } }
        try await waitForRequest(count: 2)
        vm.suspend()
        await operation.value
        XCTAssertEqual(opened.value, 0)
        XCTAssertNil(vm.task)
    }

    func testQueuedListActivationCannotReviveSuspendedScreen() async {
        SequencedURLProtocol.sequence = [.status(200, body: list(create: true))]
        let vm = HouseholdTasksListViewModel(homeId: home, access: access())
        let queuedRevision = vm.activationRevision
        vm.suspend()
        await vm.resume(ifCurrent: queuedRevision)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
        XCTAssertNil(vm.fab)
        XCTAssertFalse(vm.hasLoadedContent)
        await vm.resume(ifCurrent: vm.activationRevision)
        XCTAssertTrue(vm.hasLoadedContent)
    }

    func testQueuedDetailActivationCannotReviveSuspendedScreen() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail())]
        let vm = HouseholdTaskDetailViewModel(homeId: home, taskId: task, access: access())
        let queuedRevision = vm.activationRevision
        vm.suspend()
        await vm.resume(ifCurrent: queuedRevision)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
        XCTAssertNil(vm.task)
        await vm.resume(ifCurrent: vm.activationRevision)
        XCTAssertNotNil(vm.task)
    }
}

@MainActor
private final class NavigationCount {
    var value = 0
}
