//
//  MyPostDTO.swift
//  Pantopus
//
//  T5.3.3 — My posts. Decoder for `GET /api/posts/user/:userId` (route
//  `backend/routes/posts.js:3016`). Reuses the feed serializer on the
//  backend, so most fields mirror `FeedPostDTO`; we add an optional
//  `archivedAt` so the client can model the Archived-tab state
//  locally even though the current backend filters archived rows out
//  of the `/user/:id` response.
//

import Foundation

/// One row in `GET /api/posts/user/:userId`.
public struct MyPostDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String
    public let title: String?
    public let content: String
    public let postType: String?
    public let createdAt: String
    public let likeCount: Int
    public let commentCount: Int
    public let userHasLiked: Bool
    public let locationName: String?
    public let eventDate: String?
    public let eventVenue: String?
    public let lostFoundType: String?
    /// Local mirror of `archived_at`. The current backend strips this from
    /// the `/user/:id` response (the SELECT applies `archived_at IS NULL`),
    /// so it always decodes as `nil` over the wire today. When the future
    /// `GET /api/posts/me?status=archived` lands, the decoder will start
    /// populating this field automatically.
    public let archivedAt: String?

    public init(
        id: String,
        userId: String,
        title: String? = nil,
        content: String = "",
        postType: String? = nil,
        createdAt: String,
        likeCount: Int = 0,
        commentCount: Int = 0,
        userHasLiked: Bool = false,
        locationName: String? = nil,
        eventDate: String? = nil,
        eventVenue: String? = nil,
        lostFoundType: String? = nil,
        archivedAt: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.title = title
        self.content = content
        self.postType = postType
        self.createdAt = createdAt
        self.likeCount = likeCount
        self.commentCount = commentCount
        self.userHasLiked = userHasLiked
        self.locationName = locationName
        self.eventDate = eventDate
        self.eventVenue = eventVenue
        self.lostFoundType = lostFoundType
        self.archivedAt = archivedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title, content
        case postType = "post_type"
        case createdAt = "created_at"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case userHasLiked
        case locationName = "location_name"
        case eventDate = "event_date"
        case eventVenue = "event_venue"
        case lostFoundType = "lost_found_type"
        case archivedAt = "archived_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decode(String.self, forKey: .userId)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        content = try c.decodeIfPresent(String.self, forKey: .content) ?? ""
        postType = try c.decodeIfPresent(String.self, forKey: .postType)
        createdAt = try c.decode(String.self, forKey: .createdAt)
        likeCount = try c.decodeIfPresent(Int.self, forKey: .likeCount) ?? 0
        commentCount = try c.decodeIfPresent(Int.self, forKey: .commentCount) ?? 0
        userHasLiked = try c.decodeIfPresent(Bool.self, forKey: .userHasLiked) ?? false
        locationName = try c.decodeIfPresent(String.self, forKey: .locationName)
        eventDate = try c.decodeIfPresent(String.self, forKey: .eventDate)
        eventVenue = try c.decodeIfPresent(String.self, forKey: .eventVenue)
        lostFoundType = try c.decodeIfPresent(String.self, forKey: .lostFoundType)
        archivedAt = try c.decodeIfPresent(String.self, forKey: .archivedAt)
    }
}

/// `GET /api/posts/user/:userId` response envelope. Pagination mirrors
/// the Pulse feed envelope.
public struct MyPostsResponse: Decodable, Sendable {
    public let posts: [MyPostDTO]

    private enum CodingKeys: String, CodingKey {
        case posts
    }

    public init(posts: [MyPostDTO]) {
        self.posts = posts
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        posts = try c.decodeIfPresent([MyPostDTO].self, forKey: .posts) ?? []
    }
}

/// Response for `POST /api/posts/:id/archive` and `/unarchive`.
public struct PostArchiveResponse: Decodable, Sendable, Hashable {
    public let archived: Bool
    public let archivedAt: String?

    private enum CodingKeys: String, CodingKey {
        case archived
        case archivedAt = "archived_at"
    }
}
