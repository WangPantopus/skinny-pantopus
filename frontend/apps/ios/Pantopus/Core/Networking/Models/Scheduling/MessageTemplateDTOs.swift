//
//  MessageTemplateDTOs.swift
//  Pantopus
//
//  DTOs for scheduling message templates — routes
//  `/api/scheduling/message-templates*` (+ `/preview`). Bodies can carry
//  `{{variable}}` placeholders. See `reference/calendarly-backend-api.md`.
//

import Foundation

/// A reusable message template (used by workflows and manual sends).
public struct MessageTemplateDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let ownerType: String?
    public let ownerId: String?
    public let name: String
    /// `email` | `push` | `in_app` | `sms`.
    public let channel: String?
    public let subject: String?
    public let body: String
    public let isActive: Bool?
    public let createdBy: String?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case name
        case channel
        case subject
        case body
        case isActive = "is_active"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /message-templates` → `{ templates }`.
public struct MessageTemplatesResponse: Decodable, Sendable, Hashable {
    public let templates: [MessageTemplateDTO]
}

/// `POST /message-templates`, `PUT /message-templates/:id` → `{ template }`.
public struct MessageTemplateResponse: Decodable, Sendable, Hashable {
    public let template: MessageTemplateDTO
}

/// Body for `POST /message-templates`. Owner fields spliced in by the builder.
public struct CreateMessageTemplateRequest: Encodable, Sendable {
    public let name: String
    public var channel: String?
    public var subject: String?
    public let body: String
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case channel
        case subject
        case body
        case isActive = "is_active"
    }

    public init(
        name: String,
        body: String,
        channel: String? = nil,
        subject: String? = nil,
        isActive: Bool? = nil
    ) {
        self.name = name
        self.body = body
        self.channel = channel
        self.subject = subject
        self.isActive = isActive
    }
}

/// Body for `PUT /message-templates/:id` — partial update.
public struct UpdateMessageTemplateRequest: Encodable, Sendable {
    public var name: String?
    public var channel: String?
    public var subject: String?
    public var body: String?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case channel
        case subject
        case body
        case isActive = "is_active"
    }

    public init(
        name: String? = nil,
        channel: String? = nil,
        subject: String? = nil,
        body: String? = nil,
        isActive: Bool? = nil
    ) {
        self.name = name
        self.channel = channel
        self.subject = subject
        self.body = body
        self.isActive = isActive
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(channel, forKey: .channel)
        try c.encodeIfPresent(subject, forKey: .subject)
        try c.encodeIfPresent(body, forKey: .body)
        try c.encodeIfPresent(isActive, forKey: .isActive)
    }
}

/// Body for `POST /message-templates/preview` — interpolates `{{variable}}`.
public struct TemplatePreviewRequest: Encodable, Sendable {
    public var subject: String?
    public let body: String
    public var variables: JSONValue?

    public init(body: String, subject: String? = nil, variables: JSONValue? = nil) {
        self.body = body
        self.subject = subject
        self.variables = variables
    }
}

/// `POST /message-templates/preview` → filled subject + body.
public struct TemplatePreviewResponse: Decodable, Sendable, Hashable {
    public let subject: String?
    public let body: String
}
