//
//  PostUpdateRequest.swift
//  Pantopus
//
//  Request + response payloads for `PATCH /api/posts/:id`. Route:
//  `backend/routes/posts.js:2428`. Schema is `updatePostSchema` at
//  `backend/routes/posts.js:298-328` — a strict subset of the create
//  schema (no `postAs`, `audience`, `businessName`, `purpose`; the
//  identity + audience tag are fixed at create time).
//

import Foundation

/// `PATCH /api/posts/:id` body. Every field is optional — only keys the
/// user actually changed get sent. Joi's `.min(1)` requires at least one.
public struct PostUpdateRequest: Encodable, Sendable, Hashable {
    public let content: String?
    public let title: String?
    public let visibility: String?
    public let eventDate: String?
    public let eventVenue: String?
    public let lostFoundType: String?
    public let serviceCategory: String?
    public let dealBusinessName: String?

    public init(
        content: String? = nil,
        title: String? = nil,
        visibility: String? = nil,
        eventDate: String? = nil,
        eventVenue: String? = nil,
        lostFoundType: String? = nil,
        serviceCategory: String? = nil,
        dealBusinessName: String? = nil
    ) {
        self.content = content
        self.title = title
        self.visibility = visibility
        self.eventDate = eventDate
        self.eventVenue = eventVenue
        self.lostFoundType = lostFoundType
        self.serviceCategory = serviceCategory
        self.dealBusinessName = dealBusinessName
    }

    private enum CodingKeys: String, CodingKey {
        case content
        case title
        case visibility
        case eventDate
        case eventVenue
        case lostFoundType
        case serviceCategory
        case dealBusinessName
    }

    /// Encode dropping `nil` keys so the wire body only carries the
    /// fields the user actually changed.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(content, forKey: .content)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(visibility, forKey: .visibility)
        try container.encodeIfPresent(eventDate, forKey: .eventDate)
        try container.encodeIfPresent(eventVenue, forKey: .eventVenue)
        try container.encodeIfPresent(lostFoundType, forKey: .lostFoundType)
        try container.encodeIfPresent(serviceCategory, forKey: .serviceCategory)
        try container.encodeIfPresent(dealBusinessName, forKey: .dealBusinessName)
    }
}

/// `PATCH /api/posts/:id` response envelope — the backend echoes a
/// thin acknowledgement plus the updated row. We only surface the id
/// so the caller can navigate back to it.
public struct PostUpdateResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let postId: String?

    public init(message: String? = nil, postId: String? = nil) {
        self.message = message
        self.postId = postId
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case post
    }

    private struct NestedPostId: Decodable {
        let id: String
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        if let nested = try? container.decode(NestedPostId.self, forKey: .post) {
            postId = nested.id
        } else {
            postId = nil
        }
    }
}
