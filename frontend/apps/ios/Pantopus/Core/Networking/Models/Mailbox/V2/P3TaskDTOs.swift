//
//  P3TaskDTOs.swift
//  Pantopus
//
//  DTOs for the mail-linked task endpoints in
//  `backend/routes/mailboxV2Phase3.js`. The list endpoint returns the
//  flat `HomeTask` shape split into active / completed buckets; there is
//  no detail-by-id route, so the Mail-task detail screen fetches the
//  list and selects by id. Only the fields the native screen maps are
//  modelled — the rich AI / checklist / next-up slots have no backend
//  source today and stay client-side (sample-only) until one ships.
//

import Foundation

/// A mail-linked task row. Route: `backend/routes/mailboxV2Phase3.js:831`.
public struct P3TaskDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let mailId: String?
    public let title: String
    public let description: String?
    public let dueAt: String?
    /// `low / medium / high`.
    public let priority: String?
    /// `pending / in_progress / completed`.
    public let status: String?
    public let assignedTo: String?
    public let convertedToGigId: String?
    public let createdAt: String?
    /// Subject of the originating mail (enriched server-side).
    public let mailPreview: String?
    /// Sender name of the originating mail (enriched server-side).
    public let mailSender: String?

    private enum CodingKeys: String, CodingKey {
        case id, title, description, priority, status
        case homeId = "home_id"
        case mailId = "mail_id"
        case dueAt = "due_at"
        case assignedTo = "assigned_to"
        case convertedToGigId = "converted_to_gig_id"
        case createdAt = "created_at"
        case mailPreview = "mail_preview"
        case mailSender = "mail_sender"
    }
}

/// Envelope for `GET /api/mailbox/v2/p3/tasks` — `{ active, completed }`.
public struct P3TasksResponse: Decodable, Sendable, Hashable {
    public let active: [P3TaskDTO]
    public let completed: [P3TaskDTO]
}

/// Wire body for `PATCH /api/mailbox/v2/p3/tasks/:id` — route
/// `backend/routes/mailboxV2Phase3.js:935`. All fields optional; `status`
/// is one of `pending / in_progress / completed`. Synthesized `Encodable`
/// omits nil fields, so a status-only update sends just `{ status }`.
public struct P3TaskUpdateRequest: Encodable, Sendable {
    public let status: String?
    public let title: String?
    public let priority: String?
    public let dueAt: String?

    public init(
        status: String? = nil,
        title: String? = nil,
        priority: String? = nil,
        dueAt: String? = nil
    ) {
        self.status = status
        self.title = title
        self.priority = priority
        self.dueAt = dueAt
    }
}

/// Envelope for `PATCH /api/mailbox/v2/p3/tasks/:id` — `{ task }`.
public struct P3TaskResponse: Decodable, Sendable, Hashable {
    public let task: P3TaskDTO
}
