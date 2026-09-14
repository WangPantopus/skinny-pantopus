import Foundation

struct HomeTaskRecurrenceCommand: Codable, Equatable {
    let action: String
    let expectedRevision: Int
    var expectedTaskUpdatedAt: String?
    var frequency: HomeTaskRecurrenceFrequency?
    var interval: Int?
    var timezone: String?

    private enum CodingKeys: String, CodingKey {
        case action, frequency, interval, timezone
        case expectedRevision = "expected_revision", expectedTaskUpdatedAt = "expected_task_updated_at"
    }

    var valid: Bool {
        guard expectedRevision >= 0, expectedRevision <= 999_999_999_999_999 else { return false }
        if action == "pause" {
            return expectedTaskUpdatedAt == nil && frequency == nil && interval == nil && timezone == nil
        }
        return action == "start" && HomeTaskRecurrenceDate.parse(expectedTaskUpdatedAt) != nil && frequency != nil
            && interval.map { (1...365).contains($0) } == true && timezone.flatMap(TimeZone.init(identifier:)) != nil
    }
}

struct HomeTaskRecurrenceReceipt: Codable, Equatable {
    let requestId: String
    let actorId: String
    let homeId: String
    let taskId: String
    let action: String
    let revision: Int
    let requestHash: String
    let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case action, revision
        case requestId = "request_id", actorId = "actor_id", homeId = "home_id", taskId = "task_id"
        case requestHash = "request_hash", createdAt = "created_at"
    }

    func matches(_ draft: HomeTaskRecurrenceDraft) -> Bool {
        let expected = draft.command.expectedRevision + (draft.command.action == "start" || draft.command.expectedRevision > 0 ? 1 : 0)
        return requestId == draft.requestId && actorId == draft.actorId && homeId == draft.homeId && taskId == draft.taskId
            && action == draft.command.action && revision == expected
            && HomeClaimReviewSnapshot.validToken(requestHash) && HomeTaskRecurrenceDate.parse(createdAt) != nil
    }
}

/// This protected payload has no credentials or session proof. The original
/// command survives process death; confirmation stays until explicit review.
struct HomeTaskRecurrenceDraft: Codable, Equatable {
    let version: Int
    let origin: String
    let actorId: String
    let homeId: String
    let taskId: String
    let requestId: String
    let command: HomeTaskRecurrenceCommand
    var confirmed: HomeTaskRecurrenceReceipt?

    func matches(origin: String, home: String, task: String, actor: String) -> Bool {
        version == 1 && self.origin == origin && homeId == home && taskId == task && actorId == actor
            && [home, task, actor, requestId].allSatisfy { UUID(uuidString: $0) != nil }
            && requestId == requestId.lowercased() && command.valid && (confirmed.map { $0.matches(self) } ?? true)
    }

    struct Request: Encodable {
        let draft: HomeTaskRecurrenceDraft
        private enum CodingKeys: String, CodingKey { case requestId = "request_id" }

        func encode(to encoder: any Encoder) throws {
            try draft.command.encode(to: encoder)
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode(draft.requestId, forKey: .requestId)
        }
    }
}
