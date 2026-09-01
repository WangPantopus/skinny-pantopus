//
//  BusinessInboxDTOs.swift
//  Pantopus
//
//  Wire shapes for the business-side inbox:
//    · `GET /api/chat/business/:businessUserId/rooms`
//      (`backend/routes/chats.js:756-775` builds the row);
//    · `GET /api/businesses/:businessId/matched-posts`
//      (`backend/routes/businesses.js:4380` selects the columns).
//
//  Snake_case is mapped explicitly — `APIClient` does not apply
//  `convertFromSnakeCase`.
//

import Foundation

// MARK: - Messages

/// Envelope for the business chat inbox.
public struct BusinessInboxRoomsResponse: Decodable, Sendable {
    public let rooms: [BusinessInboxRoomDTO]
    public let total: Int?
    public let totalUnread: Int?

    enum CodingKeys: String, CodingKey {
        case rooms, total, totalUnread
    }
}

/// One room the business identity participates in. The serializer flattens
/// the counterpart onto `other_participant_*` fields rather than nesting a
/// participants array.
public struct BusinessInboxRoomDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let roomType: String?
    public let roomName: String?
    public let lastMessageAt: String?
    public let lastMessagePreview: String?
    public let unreadCount: Int?
    public let otherParticipantName: String?
    public let otherParticipantUsername: String?

    enum CodingKeys: String, CodingKey {
        case id
        case roomType = "room_type"
        case roomName = "room_name"
        case lastMessageAt = "last_message_at"
        case lastMessagePreview = "last_message_preview"
        case unreadCount = "unread_count"
        case otherParticipantName = "other_participant_name"
        case otherParticipantUsername = "other_participant_username"
    }
}

// MARK: - Mentions

/// Envelope for the matched-posts ("Mentions") section.
public struct BusinessMatchedPostsResponse: Decodable, Sendable {
    public let posts: [BusinessMatchedPostDTO]
    public let pagination: BusinessMatchedPostsPageDTO?
}

public struct BusinessMatchedPostsPageDTO: Decodable, Sendable, Hashable {
    public let page: Int?
    public let pageSize: Int?
    public let totalCount: Int?
    public let totalPages: Int?

    enum CodingKeys: String, CodingKey {
        case page
        case pageSize = "page_size"
        case totalCount = "total_count"
        case totalPages = "total_pages"
    }
}

/// One neighborhood post whose `matched_business_ids` contains this
/// business.
public struct BusinessMatchedPostDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let content: String?
    public let postType: String?
    public let likeCount: Int?
    public let commentCount: Int?
    public let createdAt: String?
    public let creator: BusinessMatchedPostCreatorDTO?

    enum CodingKeys: String, CodingKey {
        case id, title, content, creator
        case postType = "post_type"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case createdAt = "created_at"
    }
}

public struct BusinessMatchedPostCreatorDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let name: String?
    public let username: String?
    public let profilePictureUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, name, username
        case profilePictureUrl = "profile_picture_url"
    }
}
