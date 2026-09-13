import Foundation

struct HomeTaskCreateDraft: Codable, Equatable {
    let requestId: String
    let homeId: String
    let actorId: String
    let payload: CreateHomeTaskRequest
    let taskId: String?
    let payloadHash: String?

    init(
        requestId: String,
        homeId: String,
        actorId: String,
        payload: CreateHomeTaskRequest,
        taskId: String? = nil,
        payloadHash: String? = nil
    ) {
        self.requestId = requestId
        self.homeId = homeId
        self.actorId = actorId
        self.payload = payload
        self.taskId = taskId
        self.payloadHash = payloadHash
    }

    func confirmed(by receipt: HomeTaskCreationReceipt) -> Self {
        Self(
            requestId: requestId,
            homeId: homeId,
            actorId: actorId,
            payload: payload,
            taskId: receipt.taskId,
            payloadHash: receipt.payloadHash
        )
    }

    func compatible(with other: Self) -> Bool {
        requestId == other.requestId && homeId == other.homeId && actorId == other.actorId && payload == other.payload
            && (taskId == nil || other.taskId == nil || (taskId == other.taskId && payloadHash == other.payloadHash))
    }

    func matches(home: String, actor: String) -> Bool {
        requestId == requestId.lowercased() && UUID(uuidString: requestId) != nil
            && homeId == home && actorId == actor && UUID(uuidString: home) != nil && UUID(uuidString: actor) != nil
            && ["chore", "shopping", "project", "reminder", "repair"].contains(payload.taskType)
            && !payload.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && ((taskId == nil && payloadHash == nil) || (taskId.flatMap(UUID.init(uuidString:)) != nil
                    && HomeClaimReviewSnapshot.validToken(payloadHash)))
    }

    struct Command: Encodable {
        let draft: HomeTaskCreateDraft
        private enum CodingKeys: String, CodingKey { case requestId = "request_id" }
        func encode(to encoder: any Encoder) throws {
            try draft.payload.encode(to: encoder)
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode(draft.requestId, forKey: .requestId)
        }
    }
}

struct HomeTaskCreationReceipt: Decodable, Equatable {
    let homeId: String
    let actorId: String
    let requestId: String
    let taskId: String
    let payloadHash: String
    let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id", actorId = "actor_id", requestId = "request_id", taskId = "task_id"
        case payloadHash = "payload_hash", createdAt = "created_at"
    }

    func matches(_ draft: HomeTaskCreateDraft, task: HomeTaskDTO) -> Bool {
        matches(draft) && taskId == task.id && task.homeId == homeId
    }

    func matches(_ draft: HomeTaskCreateDraft) -> Bool {
        homeId == draft.homeId && actorId == draft.actorId && requestId == draft.requestId
            && UUID(uuidString: taskId) != nil
            && (draft.taskId == nil || (draft.taskId == taskId && draft.payloadHash == payloadHash))
            && payloadHash.count == 64 && payloadHash.allSatisfy { "0123456789abcdef".contains($0) }
            && validDate
    }

    private var validDate: Bool {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if format.date(from: createdAt) != nil { return true }
        format.formatOptions = [.withInternetDateTime]
        return format.date(from: createdAt) != nil
    }
}

struct HomeTaskCreationResult: Decodable {
    let task: HomeTaskDTO
    let receipt: HomeTaskCreationReceipt
    let replayed: Bool
    let taskSession: HomeTaskSession

    private enum CodingKeys: String, CodingKey {
        case task, replayed
        case receipt = "creation_receipt", taskSession = "task_session"
    }
}
