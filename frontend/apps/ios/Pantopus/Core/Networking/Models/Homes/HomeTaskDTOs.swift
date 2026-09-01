//
//  HomeTaskDTOs.swift
//  Pantopus
//
//  DTOs for the Home Tasks endpoints under `backend/routes/home.js`:
//   - GET    /api/homes/:id/tasks              (line 4170)
//   - POST   /api/homes/:id/tasks              (line 4238)
//   - PUT    /api/homes/:id/tasks/:taskId      (line 4308)
//   - DELETE /api/homes/:id/tasks/:taskId      (line 4354)
//
//  These are HOUSEHOLD chores — internal "who's vacuuming, taking out
//  the trash, walking the dog" — NOT to be confused with `MyTaskDTO`
//  (the posted-to-neighbours gig list reached via `me.gigs`).
//
//  Per the schema (`backend/database/schema.sql:6833`):
//    * `status` is one of `open / in_progress / done / canceled`
//    * `task_type` is one of `chore / shopping / project / reminder / repair`
//    * `recurrence_rule` is a free-form RRULE string (NULL = one-off)
//

import Foundation

/// One row from `GET /api/homes/:id/tasks`.
public struct HomeTaskDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let taskType: String
    public let title: String
    public let description: String?
    public let assignedTo: String?
    public let dueAt: String?
    public let recurrenceRule: String?
    public let status: String
    public let priority: String?
    public let completedAt: String?
    public let createdBy: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case taskType = "task_type"
        case title
        case description
        case assignedTo = "assigned_to"
        case dueAt = "due_at"
        case recurrenceRule = "recurrence_rule"
        case status
        case priority
        case completedAt = "completed_at"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        homeId: String,
        taskType: String,
        title: String,
        description: String? = nil,
        assignedTo: String? = nil,
        dueAt: String? = nil,
        recurrenceRule: String? = nil,
        status: String = "open",
        priority: String? = nil,
        completedAt: String? = nil,
        createdBy: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.taskType = taskType
        self.title = title
        self.description = description
        self.assignedTo = assignedTo
        self.dueAt = dueAt
        self.recurrenceRule = recurrenceRule
        self.status = status
        self.priority = priority
        self.completedAt = completedAt
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Envelope for `GET /api/homes/:id/tasks`.
public struct GetHomeTasksResponse: Decodable, Sendable {
    public let tasks: [HomeTaskDTO]
}

/// Envelope for `POST /api/homes/:id/tasks` and `PUT …/:taskId`.
public struct HomeTaskResponse: Decodable, Sendable {
    public let task: HomeTaskDTO
}

/// Body for `POST /api/homes/:id/tasks`. `task_type` and `title` are
/// required; everything else is optional (see backend validation at
/// `home.js:4252`).
public struct CreateHomeTaskRequest: Encodable, Sendable {
    public let taskType: String
    public let title: String
    public let description: String?
    public let assignedTo: String?
    public let dueAt: String?
    public let recurrenceRule: String?
    public let priority: String?

    private enum CodingKeys: String, CodingKey {
        case taskType = "task_type"
        case title
        case description
        case assignedTo = "assigned_to"
        case dueAt = "due_at"
        case recurrenceRule = "recurrence_rule"
        case priority
    }

    public init(
        taskType: String,
        title: String,
        description: String? = nil,
        assignedTo: String? = nil,
        dueAt: String? = nil,
        recurrenceRule: String? = nil,
        priority: String? = nil
    ) {
        self.taskType = taskType
        self.title = title
        self.description = description
        self.assignedTo = assignedTo
        self.dueAt = dueAt
        self.recurrenceRule = recurrenceRule
        self.priority = priority
    }
}

/// Body for `PUT /api/homes/:id/tasks/:taskId`. All fields optional —
/// only those set are sent on the wire.
///
/// Backend `allowed` list at `home.js:4316` accepts `title /
/// description / status / assigned_to / priority / due_at / budget /
/// details / completed_at / visibility / viewer_user_ids` —
/// `recurrence_rule` is **not** in that allowlist today. We carry
/// `recurrenceRule` on the client side so the Add/Edit Task form has
/// a single source of truth; when the backend extends its allowlist,
/// no client change is needed. Until then the field is silently
/// dropped by the server.
public struct UpdateHomeTaskRequest: Encodable, Sendable {
    public let status: String?
    public let title: String?
    public let description: String?
    public let assignedTo: String?
    public let dueAt: String?
    public let recurrenceRule: String?
    public let priority: String?
    public let completedAt: String?

    private enum CodingKeys: String, CodingKey {
        case status
        case title
        case description
        case assignedTo = "assigned_to"
        case dueAt = "due_at"
        case recurrenceRule = "recurrence_rule"
        case priority
        case completedAt = "completed_at"
    }

    public init(
        status: String? = nil,
        title: String? = nil,
        description: String? = nil,
        assignedTo: String? = nil,
        dueAt: String? = nil,
        recurrenceRule: String? = nil,
        priority: String? = nil,
        completedAt: String? = nil
    ) {
        self.status = status
        self.title = title
        self.description = description
        self.assignedTo = assignedTo
        self.dueAt = dueAt
        self.recurrenceRule = recurrenceRule
        self.priority = priority
        self.completedAt = completedAt
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(assignedTo, forKey: .assignedTo)
        try c.encodeIfPresent(dueAt, forKey: .dueAt)
        try c.encodeIfPresent(recurrenceRule, forKey: .recurrenceRule)
        try c.encodeIfPresent(priority, forKey: .priority)
        try c.encodeIfPresent(completedAt, forKey: .completedAt)
    }
}
