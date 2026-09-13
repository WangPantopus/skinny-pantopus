import Foundation

/// Only reviewed public fields and immutable source identity are retained.
/// Credentials, session proof, private task/mail/media content are excluded.
struct HomeTaskGigDraft: Codable, Equatable {
    let version: Int
    let origin: String
    let actorId: String
    let homeId: String
    let taskId: String
    let requestId: String
    let expectedUpdatedAt: String
    let fields: HomeTaskGigFields
    var confirmed: HomeTaskGigReceipt?

    func matches(origin: String, home: String, task: String, actor: String) -> Bool {
        version == 1 && self.origin == origin && homeId == home && taskId == task && actorId == actor
            && [home, task, actor, requestId].allSatisfy { UUID(uuidString: $0) != nil }
            && requestId == requestId.lowercased() && HomeTaskRecurrenceDate.parse(expectedUpdatedAt) != nil
            && fields.valid && (confirmed.map { $0.matches(self) } ?? true)
    }

    struct Request: Encodable {
        let draft: HomeTaskGigDraft
        private enum CodingKeys: String, CodingKey {
            case source = "home_task_source", precision = "location_precision", reveal = "reveal_policy", visibility = "visibility_scope",
                 attachments
        }

        private struct Source: Encodable {
            let homeId: String
            let taskId: String
            let requestId: String
            let expectedUpdatedAt: String
            let reviewed = true
            private enum CodingKeys: String, CodingKey {
                case homeId = "home_id", taskId = "task_id", requestId = "request_id", expectedUpdatedAt = "expected_updated_at", reviewed
            }
        }

        func encode(to encoder: any Encoder) throws {
            try draft.fields.encode(to: encoder)
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(
                Source(homeId: draft.homeId, taskId: draft.taskId, requestId: draft.requestId, expectedUpdatedAt: draft.expectedUpdatedAt),
                forKey: .source
            )
            try container.encode("approx_area", forKey: .precision)
            try container.encode("after_assignment", forKey: .reveal)
            try container.encode("city", forKey: .visibility)
            try container.encode([String](), forKey: .attachments)
        }
    }
}
