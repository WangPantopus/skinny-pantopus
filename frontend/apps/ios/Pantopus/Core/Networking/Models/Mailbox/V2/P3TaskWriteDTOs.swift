//
//  P3TaskWriteDTOs.swift
//  Pantopus
//
//  Write-side DTOs for the mail-linked task endpoints in
//  `backend/routes/mailboxV2Phase3.js`. Read-side shapes (`P3TaskDTO`,
//  `P3TasksResponse`, `P3TaskUpdateRequest`) live in `P3TaskDTOs.swift`;
//  these cover the two routes the Mail-tasks list surface adds —
//  create-from-mail and convert-to-neighbor-gig. Both validators take
//  camelCase keys (`createTaskSchema` at :65, `taskToGigSchema` at :81),
//  so the synthesized `Encodable` keys already match the wire.
//

import Foundation

/// Wire body for `POST /api/mailbox/v2/p3/tasks/from-mail` — route
/// `backend/routes/mailboxV2Phase3.js:886`. `mailId` and `homeId` must be
/// UUIDs; `priority` is one of `low / medium / high`. Nil optionals are
/// omitted by the synthesized encoder, which the Joi schema accepts.
public struct P3CreateTaskFromMailRequest: Encodable, Sendable {
    public let mailId: String
    public let homeId: String
    public let title: String
    public let description: String?
    public let dueAt: String?
    public let priority: String

    public init(
        mailId: String,
        homeId: String,
        title: String,
        description: String? = nil,
        dueAt: String? = nil,
        priority: String = "medium"
    ) {
        self.mailId = mailId
        self.homeId = homeId
        self.title = title
        self.description = description
        self.dueAt = dueAt
        self.priority = priority
    }
}

/// Wire body for `POST /api/mailbox/v2/p3/tasks/:id/to-gig` — route
/// `backend/routes/mailboxV2Phase3.js:977`. Every field is optional; the
/// backend falls back to the task's own title / description.
public struct P3TaskToGigRequest: Encodable, Sendable {
    public let title: String?
    public let description: String?
    public let compensation: Double?

    public init(title: String? = nil, description: String? = nil, compensation: Double? = nil) {
        self.title = title
        self.description = description
        self.compensation = compensation
    }
}

/// Envelope for `POST /api/mailbox/v2/p3/tasks/:id/to-gig` —
/// `{ gigId, title }` (camelCase on the wire, see the handler's
/// `res.json` at `backend/routes/mailboxV2Phase3.js:1017`).
public struct P3TaskToGigResponse: Decodable, Sendable, Hashable {
    public let gigId: String
    public let title: String?
}
