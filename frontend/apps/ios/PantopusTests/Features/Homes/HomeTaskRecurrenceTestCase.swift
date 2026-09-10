import XCTest
@testable import Pantopus

@MainActor
class HomeTaskRecurrenceTestCase: HomeTaskCreationTestCase {
    let updated = "2026-09-10T12:00:00Z"

    func model(_ store: RecurrenceMemoryStore, identity: @escaping () -> String? = { "opening" }) -> HomeTaskRecurrenceViewModel {
        let api = api()
        return HomeTaskRecurrenceViewModel(homeId: home, taskId: task, api: api, access: access(api, identity: identity), store: store) {
            self.requestId
        }
    }

    func taskDetail(_ changes: [String: Any] = [:]) -> String {
        detail(overrides: ["updated_at": updated].merging(changes) { _, new in new })
    }

    func configuration(_ revision: Int = 1, state: String = "active") -> [String: Any] {
        [
            "id": requestId,
            "revision": revision,
            "state": state,
            "reason": NSNull(),
            "frequency": "WEEKLY",
            "interval": 1,
            "timezone": "UTC",
            "anchor_at": updated,
            "next_due_at": state == "active" ? "2026-09-17T12:00:00Z" : NSNull(),
            "last_due_at": NSNull(),
            "last_task_id": NSNull(),
            "generated_count": 0
        ]
    }

    func recurrence(_ revision: Int = 0, state: String = "active", manage: Bool = true, overrides: [String: Any] = [:]) -> [String: Any] {
        [
            "ok": true,
            "home_id": home,
            "task_id": task,
            "can_manage": manage,
            "task_updated_at": updated,
            "revision": revision,
            "configuration": revision == 0 ? NSNull() : configuration(revision, state: state),
            "task_session": scope()
        ]
        .merging(overrides) { _, new in new }
    }

    func changed(
        _ revision: Int = 1,
        state: String = "active",
        action: String = "start",
        receiptRevision: Int = 1,
        receiptChanges: [String: Any] = [:]
    ) -> String {
        let receipt: [String: Any] = [
            "request_id": requestId,
            "actor_id": actor,
            "home_id": home,
            "task_id": task,
            "action": action,
            "revision": receiptRevision,
            "request_hash": payloadHash,
            "created_at": updated
        ]
        return json(recurrence(revision, state: state).merging([
            "receipt": receipt.merging(receiptChanges) { _, new in new }, "replayed": true
        ]) { _, new in new })
    }

    func load(_ model: HomeTaskRecurrenceViewModel, revision: Int = 0, state: String = "active") async {
        SequencedURLProtocol.sequence = [.status(200, body: taskDetail()), .status(200, body: json(recurrence(revision, state: state)))]
        await model.activate(ifCurrent: model.activationRevision)
        XCTAssertNotNil(model.state)
    }

    func successfulChange(revision: Int = 1) -> [SequencedURLProtocol.Response] {
        [
            .status(200, body: json(recurrence(revision - 1))),
            .status(200, body: changed(revision)),
            .status(200, body: taskDetail()),
            .status(200, body: json(recurrence(revision)))
        ]
    }
}

@MainActor
final class RecurrenceMemoryStore: PendingHomeTaskRecurrenceStoring {
    enum Failure: Error { case unavailable }
    var saved: [String: HomeTaskRecurrenceDraft] = [:]
    var failRead = false
    var failWrite = false
    var failProof = false
    var failClear = false
    var draft: HomeTaskRecurrenceDraft? {
        saved.values.first
    }

    func load(scope: String) throws -> HomeTaskRecurrenceDraft? {
        if failRead { throw Failure.unavailable }
        return saved[scope]
    }

    func save(_ draft: HomeTaskRecurrenceDraft, scope: String, matching expected: HomeTaskRecurrenceDraft?) throws {
        if failWrite || (failProof && draft.confirmed != nil) { throw Failure.unavailable }
        guard saved[scope] == expected else { throw HomeTaskRecurrenceViewModel.Failure.changedRequest }
        saved[scope] = draft
    }

    func clear(scope: String, matching draft: HomeTaskRecurrenceDraft) throws {
        if failClear { throw Failure.unavailable }
        guard saved[scope] == draft else { throw HomeTaskRecurrenceViewModel.Failure.changedRequest }
        saved.removeValue(forKey: scope)
    }
}
