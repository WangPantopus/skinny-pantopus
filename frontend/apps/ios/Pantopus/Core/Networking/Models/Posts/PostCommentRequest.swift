//
//  PostCommentRequest.swift
//  Pantopus
//
//  Request + response payloads for `POST /api/posts/:id/comments` and
//  `GET /api/posts/:id/comments`. Routes: `backend/routes/posts.js:2431`
//  and `:2520`.
//

import Foundation

/// `POST /api/posts/:id/comments` body. `parentCommentId` is omitted for
/// top-level comments.
public struct PostCommentRequest: Encodable, Sendable, Hashable {
    public let comment: String
    public let parentCommentId: String?

    public init(comment: String, parentCommentId: String? = nil) {
        self.comment = comment
        self.parentCommentId = parentCommentId
    }

    private enum CodingKeys: String, CodingKey {
        case comment
        case parentCommentId
    }
}

/// `POST /api/posts/:id/comments` envelope — returns the new row.
public struct PostCommentCreateResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let comment: PostCommentDTO
}

/// `GET /api/posts/:id/comments` envelope.
public struct PostCommentsResponse: Decodable, Sendable, Hashable {
    public let comments: [PostCommentDTO]
}
