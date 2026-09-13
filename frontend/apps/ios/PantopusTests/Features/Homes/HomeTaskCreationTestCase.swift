import XCTest
@testable import Pantopus

@MainActor
class HomeTaskCreationTestCase: XCTestCase {
    let home = "40000000-0000-4000-8000-000000000001"
    let actor = "40000000-0000-4000-8000-000000000002"
    let task = "40000000-0000-4000-8000-000000000003"
    let requestId = "40000000-0000-4000-8000-000000000004"
    let session = String(repeating: "a", count: 64)
    let payloadHash = String(repeating: "b", count: 64)

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    func api() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    func access(_ api: APIClient, identity: @escaping () -> String? = { "opening" }) -> HomeTaskAccess {
        HomeTaskAccess(homeId: home, api: api, actorId: actor, identity: identity)
    }

    func coordinator(_ store: CreationMemoryStore, identity: @escaping () -> String? = { "opening" }) -> HomeTaskCreationCoordinator {
        let api = api()
        return HomeTaskCreationCoordinator(home: home, origin: api.apiBaseURL, access: access(api, identity: identity), store: store) {
            self.requestId
        }
    }

    func form(
        _ store: CreationMemoryStore,
        taskId: String? = nil,
        identity: @escaping () -> String? = { "opening" }
    ) -> AddHouseholdTaskFormViewModel {
        let api = api()
        return AddHouseholdTaskFormViewModel(
            homeId: home,
            taskId: taskId,
            api: api,
            access: access(api, identity: identity),
            store: store
        ) { self.requestId }
    }

    var payload: CreateHomeTaskRequest {
        CreateHomeTaskRequest(taskType: "chore", title: "Original task", description: "Original private note")
    }

    var draft: HomeTaskCreateDraft {
        HomeTaskCreateDraft(requestId: requestId, homeId: home, actorId: actor, payload: payload)
    }

    func scope(_ token: String? = nil) -> [String: Any] {
        ["actor_id": actor, "home_id": home, "session_scope": token ?? session]
    }

    func collection(create: Bool = true, token: String? = nil) -> String {
        json(["tasks": [], "collection_capabilities": ["can_create": create], "task_session": scope(token)])
    }

    func record(edit: Bool = true, overrides: [String: Any] = [:]) -> [String: Any] {
        [
            "id": task,
            "home_id": home,
            "created_by": actor,
            "task_type": "chore",
            "title": "Original task",
            "status": "open",
            "description": "Original private note",
            "assigned_to": actor,
            "due_at": "2026-09-12T14:25:00Z",
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO,FR",
            "capabilities": ["can_edit": edit, "can_upload": edit]
        ].merging(overrides) { _, value in value }
    }

    func detail(edit: Bool = true, overrides: [String: Any] = [:]) -> String {
        json(["task": record(edit: edit, overrides: overrides), "task_session": scope()])
    }

    func created(receiptChanges: [String: Any] = [:], taskChanges: [String: Any] = [:], token: String? = nil) -> String {
        let receipt: [String: Any] = [
            "home_id": home,
            "actor_id": actor,
            "request_id": requestId,
            "task_id": task,
            "payload_hash": payloadHash,
            "created_at": "2026-09-10T12:00:00Z"
        ]
        return json([
            "task": record(overrides: taskChanges),
            "creation_receipt": receipt.merging(receiptChanges) { _, value in value },
            "replayed": true,
            "task_session": scope(token)
        ])
    }

    func json(_ object: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object), let value = String(data: data, encoding: .utf8) else {
            XCTFail("Invalid fixture")
            return "{}"
        }
        return value
    }

    func body(_ request: URLRequest) throws -> [String: Any] {
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
        }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    func waitForRequests(_ count: Int) async throws {
        for _ in 0..<100 {
            if SequencedURLProtocol.capturedRequests.count >= count { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTFail("Request did not start")
    }
}

@MainActor
final class CreationMemoryStore: PendingHomeTaskCreateStoring {
    enum Failure: Error { case unavailable }
    var saved: [String: HomeTaskCreateDraft] = [:]
    var failRead = false
    var failWrite = false
    var failWriteOn: Int?
    private var writes = 0
    var failClear = false
    var singleDraft: HomeTaskCreateDraft? {
        saved.values.first
    }

    func load(scope: String) throws -> HomeTaskCreateDraft? {
        if failRead { throw Failure.unavailable }
        return saved[scope]
    }

    func save(_ draft: HomeTaskCreateDraft, scope: String, matching expected: HomeTaskCreateDraft?) throws {
        writes += 1
        if failWrite || writes == failWriteOn { throw Failure.unavailable }
        guard saved[scope] == expected else { throw Failure.unavailable }
        saved[scope] = draft
    }

    func clear(scope: String, matching draft: HomeTaskCreateDraft) throws {
        if failClear { throw Failure.unavailable }
        guard saved[scope] == draft else { throw Failure.unavailable }
        saved.removeValue(forKey: scope)
    }
}
