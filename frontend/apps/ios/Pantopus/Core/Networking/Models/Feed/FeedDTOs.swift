//
//  FeedDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/posts/feed` — route `backend/routes/posts.js:1449`.
//  Drives the Pulse tab and (later) the Gigs feed surface.
//

import Foundation

/// One row in `/api/posts/feed`. The backend serializer projects every
/// `Post` column the feed needs; this DTO keeps the fields the Pulse UI
/// actually reads.
public struct FeedPostDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// Null for cold-start seeded neighborhood facts (`is_seeded`).
    public let userId: String?
    public let title: String?
    public let content: String
    public let postType: String?
    public let createdAt: String
    public let likeCount: Int
    public let commentCount: Int
    public let shareCount: Int
    public let userHasLiked: Bool
    public let userHasSaved: Bool
    public let userHasReposted: Bool
    /// Lifecycle state — `open` / `solved` (`feedService.js:234`).
    public let state: String?
    /// Server-derived authorship: `user`, `curator` or `system`.
    public let origin: String?
    /// One of the twelve Pulse topics, or null (`feedService.js:246`).
    public let topic: String?
    /// True for cold-start neighborhood facts injected by the feed handler
    /// (`backend/routes/posts.js:84`). Those rows are dismissable, not
    /// reportable.
    public let isSeeded: Bool
    /// The poster's homes are all far from where they posted (`feedService.js:234`); the card says Visitor.
    public let isVisitorPost: Bool
    /// Set when the post was authored as a business (`feedService.js:115`).
    public let businessAuthorId: String?
    public let locationName: String?
    public let eventDate: String?
    public let eventVenue: String?
    public let lostFoundType: String?
    public let mediaURLs: [String]
    public let mediaThumbnails: [String]
    public let mediaTypes: [String]
    /// Parallel array to `media_urls` — companion video clip URL when
    /// `media_types[i] == "live_photo"`, empty string otherwise.
    public let mediaLiveURLs: [String]
    public let creator: PostCreatorDTO?

    private enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title, content
        case postType = "post_type"
        case createdAt = "created_at"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case shareCount = "share_count"
        case userHasLiked
        case userHasSaved
        case userHasReposted
        case state, origin, topic
        case isSeeded = "is_seeded"
        case isVisitorPost = "is_visitor_post"
        case businessAuthorId = "business_author_id"
        case locationName = "location_name"
        case eventDate = "event_date"
        case eventVenue = "event_venue"
        case lostFoundType = "lost_found_type"
        case mediaURLs = "media_urls"
        case mediaThumbnails = "media_thumbnails"
        case mediaTypes = "media_types"
        case mediaLiveURLs = "media_live_urls"
        case creator
    }

    /// Tolerant (Pulse S2): only `id` and `created_at` are required; any
    /// other field that is missing, null or of another shape reads as absent.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = c.lenient(String.self, forKey: .userId)
        title = c.lenient(String.self, forKey: .title)
        content = c.lenient(String.self, forKey: .content) ?? ""
        postType = c.lenient(String.self, forKey: .postType)
        createdAt = try c.decode(String.self, forKey: .createdAt)
        likeCount = c.lenient(Int.self, forKey: .likeCount) ?? 0
        commentCount = c.lenient(Int.self, forKey: .commentCount) ?? 0
        shareCount = c.lenient(Int.self, forKey: .shareCount) ?? 0
        userHasLiked = c.lenient(Bool.self, forKey: .userHasLiked) ?? false
        userHasSaved = c.lenient(Bool.self, forKey: .userHasSaved) ?? false
        userHasReposted = c.lenient(Bool.self, forKey: .userHasReposted) ?? false
        state = c.lenient(String.self, forKey: .state)
        origin = c.lenient(String.self, forKey: .origin)
        topic = c.lenient(String.self, forKey: .topic)
        isSeeded = c.lenient(Bool.self, forKey: .isSeeded) ?? false
        isVisitorPost = c.lenient(Bool.self, forKey: .isVisitorPost) ?? false
        businessAuthorId = c.lenient(String.self, forKey: .businessAuthorId)
        locationName = c.lenient(String.self, forKey: .locationName)
        eventDate = c.lenient(String.self, forKey: .eventDate)
        eventVenue = c.lenient(String.self, forKey: .eventVenue)
        lostFoundType = c.lenient(String.self, forKey: .lostFoundType)
        // The four media lists are read side by side, so one is kept whole or not at all.
        mediaURLs = c.lenient([String].self, forKey: .mediaURLs) ?? []
        mediaThumbnails = c.lenient([String].self, forKey: .mediaThumbnails) ?? []
        mediaTypes = c.lenient([String].self, forKey: .mediaTypes) ?? []
        mediaLiveURLs = c.lenient([String].self, forKey: .mediaLiveURLs) ?? []
        creator = c.lenient(PostCreatorDTO.self, forKey: .creator)
    }
}

/// Paging envelope returned by `GET /api/posts/feed`.
public struct FeedPagination: Decodable, Sendable, Hashable {
    /// Opaque cursor id for the next page. The backend v1.1 feed returns an
    /// object `{ createdAt, id, rankBucket? }`; older stubs used a string.
    public let nextCursor: String?
    /// Companion timestamp for keyset pagination — both `cursorCreatedAt`
    /// and `cursorId` must ride on the next request.
    public let nextCursorCreatedAt: String?
    public let hasMore: Bool?

    private enum CodingKeys: String, CodingKey {
        case nextCursor
        case hasMore
    }

    private struct CursorObject: Decodable {
        let createdAt: String
        let id: String
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore)
        if let cursorString = try? container.decode(String.self, forKey: .nextCursor) {
            nextCursor = cursorString
            nextCursorCreatedAt = nil
        } else if let cursorObject = try? container.decode(CursorObject.self, forKey: .nextCursor) {
            nextCursor = cursorObject.id
            nextCursorCreatedAt = cursorObject.createdAt
        } else {
            nextCursor = nil
            nextCursorCreatedAt = nil
        }
    }
}

/// `GET /api/posts/feed` response envelope.
public struct FeedResponse: Decodable, Sendable, Hashable {
    public let posts: [FeedPostDTO]
    public let pagination: FeedPagination?
    /// Place feed only: no area was given and the person has no home or saved place to fall back on.
    public var requiresViewingLocation: Bool?
    /// Place feed only: no area was given, so the server looked around the person's own place.
    public var fallbackArea: FeedFallbackArea?

    private enum CodingKeys: String, CodingKey {
        case posts, pagination, requiresViewingLocation, fallbackArea
    }

    /// A row this build can't read is left out; the rest of the feed shows (Pulse S2).
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        posts = c.lossyList(FeedPostDTO.self, forKey: .posts)
        pagination = c.lenient(FeedPagination.self, forKey: .pagination)
        requiresViewingLocation = c.lenient(Bool.self, forKey: .requiresViewingLocation)
        fallbackArea = c.lenient(FeedFallbackArea.self, forKey: .fallbackArea)
    }
}

/// Where the place feed looked when no area was given, such as "Near Camas, WA".
public struct FeedFallbackArea: Decodable, Sendable, Hashable {
    public let label: String
    public let source: String?
}
