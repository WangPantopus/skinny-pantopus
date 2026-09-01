//
//  WorkflowDTOs.swift
//  Pantopus
//
//  DTOs for scheduling workflow automations — routes
//  `/api/scheduling/workflows*`. See `reference/calendarly-backend-api.md`.
//

import Foundation

/// A scheduling automation rule.
public struct WorkflowDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let ownerType: String?
    public let ownerId: String?
    public let eventTypeId: String?
    public let name: String
    /// `booking_created` | `cancelled` | `rescheduled` | `before_start` | `after_end`.
    public let trigger: String?
    public let offsetMinutes: Int?
    /// `email` | `push` | `in_app` | `sms`.
    public let action: String?
    public let messageTemplate: String?
    public let isActive: Bool?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case eventTypeId = "event_type_id"
        case name
        case trigger
        case offsetMinutes = "offset_minutes"
        case action
        case messageTemplate = "message_template"
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /workflows` → `{ workflows }`.
public struct WorkflowsResponse: Decodable, Sendable, Hashable {
    public let workflows: [WorkflowDTO]
}

/// `POST /workflows`, `PUT /workflows/:id` → `{ workflow }`.
public struct WorkflowResponse: Decodable, Sendable, Hashable {
    public let workflow: WorkflowDTO
}

/// Body for `POST /workflows`. Owner fields spliced in by the builder.
public struct CreateWorkflowRequest: Encodable, Sendable {
    public var eventTypeId: String?
    public let name: String
    public let trigger: String
    public var offsetMinutes: Int?
    public let action: String
    public var messageTemplate: String?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case eventTypeId = "event_type_id"
        case name
        case trigger
        case offsetMinutes = "offset_minutes"
        case action
        case messageTemplate = "message_template"
        case isActive = "is_active"
    }

    public init(
        name: String,
        trigger: String,
        action: String,
        eventTypeId: String? = nil,
        offsetMinutes: Int? = nil,
        messageTemplate: String? = nil,
        isActive: Bool? = nil
    ) {
        self.name = name
        self.trigger = trigger
        self.action = action
        self.eventTypeId = eventTypeId
        self.offsetMinutes = offsetMinutes
        self.messageTemplate = messageTemplate
        self.isActive = isActive
    }
}

/// Body for `PUT /workflows/:id` — partial update.
public struct UpdateWorkflowRequest: Encodable, Sendable {
    public var eventTypeId: String?
    public var name: String?
    public var trigger: String?
    public var offsetMinutes: Int?
    public var action: String?
    public var messageTemplate: String?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case eventTypeId = "event_type_id"
        case name
        case trigger
        case offsetMinutes = "offset_minutes"
        case action
        case messageTemplate = "message_template"
        case isActive = "is_active"
    }

    public init(
        eventTypeId: String? = nil,
        name: String? = nil,
        trigger: String? = nil,
        offsetMinutes: Int? = nil,
        action: String? = nil,
        messageTemplate: String? = nil,
        isActive: Bool? = nil
    ) {
        self.eventTypeId = eventTypeId
        self.name = name
        self.trigger = trigger
        self.offsetMinutes = offsetMinutes
        self.action = action
        self.messageTemplate = messageTemplate
        self.isActive = isActive
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(eventTypeId, forKey: .eventTypeId)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(trigger, forKey: .trigger)
        try c.encodeIfPresent(offsetMinutes, forKey: .offsetMinutes)
        try c.encodeIfPresent(action, forKey: .action)
        try c.encodeIfPresent(messageTemplate, forKey: .messageTemplate)
        try c.encodeIfPresent(isActive, forKey: .isActive)
    }
}
