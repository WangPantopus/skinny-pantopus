//
//  PulseReplyDTOs.swift
//  Pantopus
//
//  Conversation and reply shapes from the Pulse contract §§2.2, 2.4 and
//  2.7. Only a reply's id is required; unknown and missing fields remain
//  absent, as on the Pulse page. Backend availability is tracked under H4.
//

import Foundation

public struct PulseReplyDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let postId: String?
    public let parentCommentId: String?
    public let branchId: String?
    public let replyTo: PulseReplyTargetDTO?
    public let text: String?
    public let createdAt: String?
    public let edited: Bool
    public let author: PulseAuthorDTO?
    public let helpful: Bool
    public let helpfulTo: String?
    public let canThank: Bool
    public let thankedByViewer: Bool
    public let removed: Bool
    public let moderation: PulseModerationDTO?

    private enum CodingKeys: String, CodingKey {
        case id, text, edited, author, helpful, removed, moderation
        case postId = "post_id"
        case parentCommentId = "parent_comment_id"
        case branchId = "branch_id"
        case replyTo = "reply_to"
        case createdAt = "created_at"
        case helpfulTo = "helpful_to"
        case canThank = "can_thank"
        case thankedByViewer = "thanked_by_viewer"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        postId = c.lenient(String.self, forKey: .postId)
        parentCommentId = c.lenient(String.self, forKey: .parentCommentId)
        branchId = c.lenient(String.self, forKey: .branchId)
        replyTo = c.lenient(PulseReplyTargetDTO.self, forKey: .replyTo)
        text = c.lenient(String.self, forKey: .text)
        createdAt = c.lenient(String.self, forKey: .createdAt)
        edited = c.lenient(Bool.self, forKey: .edited) ?? false
        author = c.lenient(PulseAuthorDTO.self, forKey: .author)
        helpful = c.lenient(Bool.self, forKey: .helpful) ?? false
        helpfulTo = c.lenient(String.self, forKey: .helpfulTo)
        canThank = c.lenient(Bool.self, forKey: .canThank) ?? false
        thankedByViewer = c.lenient(Bool.self, forKey: .thankedByViewer) ?? false
        removed = c.lenient(Bool.self, forKey: .removed) ?? false
        moderation = c.lenient(PulseModerationDTO.self, forKey: .moderation)
    }
}

public struct PulseReplyTargetDTO: Decodable, Sendable, Hashable {
    public let commentId: String?
    public let displayName: String?

    private enum CodingKeys: String, CodingKey {
        case commentId = "comment_id"
        case displayName = "display_name"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        commentId = c.lenient(String.self, forKey: .commentId)
        displayName = c.lenient(String.self, forKey: .displayName)
    }
}

/// `GET /api/pulse/posts/:id`. A missing post is an unavailable
/// conversation, never an empty post invented by the client.
public struct PulseConversationResponse: Decodable, Sendable, Hashable {
    public let post: PulsePostDTO?
    public let replies: [PulseReplyDTO]

    private enum CodingKeys: String, CodingKey {
        case post, replies
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        post = c.lenient(PulsePostDTO.self, forKey: .post)
        replies = c.lossyList(PulseReplyDTO.self, forKey: .replies)
    }
}

/// `GET /api/pulse/posts/:id/replies?after=…`.
public struct PulseRepliesResponse: Decodable, Sendable, Hashable {
    public let replies: [PulseReplyDTO]

    private enum CodingKeys: String, CodingKey {
        case replies
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        replies = c.lossyList(PulseReplyDTO.self, forKey: .replies)
    }
}

public struct PulseHelpfulResponse: Decodable, Sendable, Hashable {
    public let reply: PulseReplyDTO?
    public let postStatus: PulsePostStatusDTO?

    private enum CodingKeys: String, CodingKey {
        case reply
        case postStatus = "post_status"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        reply = c.lenient(PulseReplyDTO.self, forKey: .reply)
        postStatus = c.lenient(PulsePostStatusDTO.self, forKey: .postStatus)
    }
}

public struct PulseThankResponse: Decodable, Sendable, Hashable {
    public let thanked: Bool

    private enum CodingKeys: String, CodingKey {
        case thanked
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        thanked = c.lenient(Bool.self, forKey: .thanked) ?? false
    }
}
