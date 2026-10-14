//
//  PostDetailDTO.swift
//  Pantopus
//
//  DTOs for `GET /api/posts/:id` — route `backend/routes/posts.js:2142`.
//
//  Only one reaction kind exists server-side today (`POST /:id/like`);
//  the design draws three (Helpful/Heart/Going). UI surfaces all three
//  but wires only Helpful — see `PulsePostDetailViewModel`.
//

import Foundation

/// Public-profile credential supplied by the identity serializer.
public struct FeedAuthorCredentialDTO: Decodable, Sendable, Hashable {
    public let status: String?
}

/// Author / business-author projection on a post. Accepts the legacy
/// `{ username, name, first_name }` shape, the P0.4 identity projection
/// `{ handle, displayName, avatarUrl }` returned by `attachIdentityAuthors`,
/// and the Pulse author `{ display_name, avatar_url }` (contract 2.1).
public struct PostCreatorDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let firstName: String?
    public let lastName: String?
    public let profilePictureURL: String?
    public let city: String?
    public let state: String?
    public let accountType: String?
    private let wireDisplayName: String?
    public let credential: FeedAuthorCredentialDTO?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, handle
        case displayName, credential
        case displayNameSnake = "display_name"
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureURL = "profile_picture_url"
        case avatarUrl
        case avatarURLSnake = "avatar_url"
        case city, state
        case accountType = "account_type"
    }

    public init(
        id: String,
        username: String?,
        name: String?,
        firstName: String?,
        lastName: String?,
        profilePictureURL: String?,
        city: String?,
        state: String?,
        accountType: String?
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.firstName = firstName
        self.lastName = lastName
        self.profilePictureURL = profilePictureURL
        self.city = city
        self.state = state
        self.accountType = accountType
        wireDisplayName = nil
        credential = nil
    }

    /// Tolerant (Pulse S2): a field that is missing, null or of another shape
    /// reads as absent rather than failing the post or reply it belongs to.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let rawId = c.lenient(String.self, forKey: .id)
        let usernameValue = c.lenient(String.self, forKey: .username)
        let handleValue = c.lenient(String.self, forKey: .handle)
        id = rawId ?? usernameValue ?? handleValue ?? "pantopus"
        username = usernameValue ?? handleValue
        wireDisplayName = c.lenient(String.self, forKey: .displayName)
            ?? c.lenient(String.self, forKey: .displayNameSnake)
        credential = c.lenient(FeedAuthorCredentialDTO.self, forKey: .credential)
        name = c.lenient(String.self, forKey: .name)
        firstName = c.lenient(String.self, forKey: .firstName)
        lastName = c.lenient(String.self, forKey: .lastName)
        profilePictureURL = c.lenient(String.self, forKey: .profilePictureURL)
            ?? c.lenient(String.self, forKey: .avatarUrl)
            ?? c.lenient(String.self, forKey: .avatarURLSnake)
        city = c.lenient(String.self, forKey: .city)
        state = c.lenient(String.self, forKey: .state)
        accountType = c.lenient(String.self, forKey: .accountType)
    }

    /// Best-effort display name across the various populated fields.
    public var displayName: String {
        if let wireDisplayName, !wireDisplayName.isEmpty { return wireDisplayName }
        if let name, !name.isEmpty { return name }
        let combined = [firstName, lastName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        if !combined.isEmpty { return combined }
        if let handle = MadeUpUsername.handle(username) { return handle }
        return "Pantopus user"
    }

    /// Locality summary — "City, ST" if both, else city, else state, else nil.
    public var locality: String? {
        switch (city?.isEmpty, state?.isEmpty) {
        case (false, false) where city != nil && state != nil: "\(city ?? ""), \(state ?? "")"
        case (false, _) where city != nil: city
        case (_, false) where state != nil: state
        default: nil
        }
    }
}

/// Home reference attached to a post.
public struct PostHomeRefDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let address: String?
    public let city: String?
    public let state: String?
}

/// One file attached to a comment — projected by
/// `attachFilesToComments` (`backend/routes/posts.js:422`).
public struct CommentAttachmentDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let fileURL: String
    public let mimeType: String?
    public let originalFilename: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case fileURL = "file_url"
        case mimeType = "mime_type"
        case originalFilename = "original_filename"
    }
}

/// A single comment on a post. Route reference:
/// `backend/routes/posts.js:2157`.
public struct PostCommentDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let postId: String
    /// Nil for a reply whose author deleted their account ("Reply removed", contract 2.2).
    public let userId: String?
    public let parentCommentId: String?
    public let comment: String
    public let createdAt: String
    /// Deleted, or removed (`removed`, contract 2.2): this screen shows neither.
    public let isDeleted: Bool
    public let userHasLiked: Bool?
    public let likeCount: Int?
    public let author: PostCreatorDTO?
    public let attachments: [CommentAttachmentDTO]?

    private enum CodingKeys: String, CodingKey {
        case id
        case postId = "post_id"
        case userId = "user_id"
        case parentCommentId = "parent_comment_id"
        case comment
        case createdAt = "created_at"
        case isDeleted = "is_deleted"
        case removed
        case userHasLiked
        case likeCount = "like_count"
        case author
        case attachments
    }

    /// Tolerant (Pulse S2): only `id` is required; a field that is missing,
    /// null or of another shape reads as absent, and an unreadable
    /// attachment is left out.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        postId = c.lenient(String.self, forKey: .postId) ?? ""
        userId = c.lenient(String.self, forKey: .userId)
        parentCommentId = c.lenient(String.self, forKey: .parentCommentId)
        comment = c.lenient(String.self, forKey: .comment) ?? ""
        createdAt = c.lenient(String.self, forKey: .createdAt) ?? ""
        isDeleted = c.lenient(Bool.self, forKey: .isDeleted) == true || c.lenient(Bool.self, forKey: .removed) == true
        userHasLiked = c.lenient(Bool.self, forKey: .userHasLiked)
        likeCount = c.lenient(Int.self, forKey: .likeCount)
        author = c.lenient(PostCreatorDTO.self, forKey: .author)
        attachments = c.lenient(LossyList<CommentAttachmentDTO>.self, forKey: .attachments)?.items
    }
}

/// `GET /api/posts/:id` envelope — see `backend/routes/posts.js:2142`.
public struct PostDetailResponse: Decodable, Sendable, Hashable {
    public let post: PostDetailDTO
}

/// `Post` row + creator + comments — the union of columns the detail
/// handler selects. Many columns are optional because list endpoints
/// project different subsets.
public struct PostDetailDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String
    public let title: String?
    public let content: String
    public let postType: String?
    public let postFormat: String?
    public let purpose: String?
    public let mediaURLs: [String]
    public let mediaTypes: [String]?
    public let mediaThumbnails: [String]
    public let mediaLiveURLs: [String]
    public let createdAt: String
    public let updatedAt: String?
    public let isEdited: Bool?
    public let likeCount: Int
    public let commentCount: Int
    public let shareCount: Int?
    public let viewCount: Int?
    public let creator: PostCreatorDTO?
    public let home: PostHomeRefDTO?
    public let userHasLiked: Bool
    public let userHasSaved: Bool
    public let userHasReposted: Bool
    public let comments: [PostCommentDTO]
    /// Visibility scope — needed by the edit-mode prefill so the compose
    /// form can show the saved audience.
    public let visibility: String?
    public let audience: String?
    public let readScope: String?
    public let allowExternalShare: Bool?
    public let moderationState: String?
    /// Event date in ISO-8601 — populated for `event` posts.
    public let eventDate: String?
    /// Event venue — populated for `event` posts.
    public let eventVenue: String?
    /// `lost` / `found` — populated for `lost_found` posts.
    public let lostFoundType: String?
    /// How the owner asked to be contacted: `dm`, `comment`, `phone` or
    /// `phone|<digits>` — populated for `lost_found` posts.
    public let lostFoundContactPref: String?
    /// Service category — populated for `ask_local` posts.
    public let serviceCategory: String?
    /// Recommended business name — populated for `recommendation` posts.
    public let dealBusinessName: String?
    /// Post-level place label ("Camas, WA") — preferred over the
    /// creator's locality for the header meta line.
    public let locationName: String?
    /// `moderation` when a moderator removed the post. Only its author can
    /// still open it then.
    public let archiveReason: String?
    /// Lifecycle state: `open`, `solved` or `archived`.
    public let state: String?
    /// How the post ended (Pulse S7, contract §1); nil while open.
    public let resolution: String?
    /// When the post ends (ISO 8601), when it names a time.
    public let expiresAt: String?
    /// `choose` or `first`; it means something only on an offer.
    public let claimMode: String?
    /// The asker already used "Keep open 7 more days" (`post_metadata.kept_open_at`).
    public let keptOpenAt: String?

    /// A moderator removed the post: neighbors can't see it or reply.
    public var isRemovedByModerator: Bool {
        archiveReason == "moderation"
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title, content
        case postType = "post_type"
        case postFormat = "post_format"
        case purpose
        case mediaURLs = "media_urls"
        case mediaTypes = "media_types"
        case mediaThumbnails = "media_thumbnails"
        case mediaLiveURLs = "media_live_urls"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isEdited = "is_edited"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case shareCount = "share_count"
        case viewCount = "view_count"
        case creator, home
        case userHasLiked, userHasSaved, userHasReposted
        case comments
        case visibility
        case audience
        case readScope = "read_scope"
        case allowExternalShare = "allow_external_share"
        case moderationState = "moderation_state"
        case eventDate = "event_date"
        case eventVenue = "event_venue"
        case lostFoundType = "lost_found_type"
        case lostFoundContactPref = "lost_found_contact_pref"
        case serviceCategory = "service_category"
        case dealBusinessName = "deal_business_name"
        case locationName = "location_name"
        case archiveReason = "archive_reason"
        case state, resolution
        case expiresAt = "expires_at"
        case claimMode = "claim_mode"
        case postMetadata = "post_metadata"
    }

    /// Tolerant (Pulse S2): only `id` and `created_at` are required; any
    /// other field that is missing, null or of another shape reads as
    /// absent, and a reply this build can't read is left out.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        // Empty when the post comes without its author's id: nothing is owned or opened by it.
        userId = c.lenient(String.self, forKey: .userId) ?? ""
        title = c.lenient(String.self, forKey: .title)
        content = c.lenient(String.self, forKey: .content) ?? ""
        postType = c.lenient(String.self, forKey: .postType)
        postFormat = c.lenient(String.self, forKey: .postFormat)
        purpose = c.lenient(String.self, forKey: .purpose)
        // The four media lists are read side by side, so one is kept whole or not at all.
        mediaURLs = c.lenient([String].self, forKey: .mediaURLs) ?? []
        mediaTypes = c.lenient([String].self, forKey: .mediaTypes)
        mediaThumbnails = c.lenient([String].self, forKey: .mediaThumbnails) ?? []
        mediaLiveURLs = c.lenient([String].self, forKey: .mediaLiveURLs) ?? []
        createdAt = try c.decode(String.self, forKey: .createdAt)
        updatedAt = c.lenient(String.self, forKey: .updatedAt)
        isEdited = c.lenient(Bool.self, forKey: .isEdited)
        likeCount = c.lenient(Int.self, forKey: .likeCount) ?? 0
        commentCount = c.lenient(Int.self, forKey: .commentCount) ?? 0
        shareCount = c.lenient(Int.self, forKey: .shareCount)
        viewCount = c.lenient(Int.self, forKey: .viewCount)
        creator = c.lenient(PostCreatorDTO.self, forKey: .creator)
        home = c.lenient(PostHomeRefDTO.self, forKey: .home)
        userHasLiked = c.lenient(Bool.self, forKey: .userHasLiked) ?? false
        userHasSaved = c.lenient(Bool.self, forKey: .userHasSaved) ?? false
        userHasReposted = c.lenient(Bool.self, forKey: .userHasReposted) ?? false
        comments = c.lossyList(PostCommentDTO.self, forKey: .comments)
        visibility = c.lenient(String.self, forKey: .visibility)
        audience = c.lenient(String.self, forKey: .audience)
        readScope = c.lenient(String.self, forKey: .readScope)
        allowExternalShare = c.lenient(Bool.self, forKey: .allowExternalShare)
        moderationState = c.lenient(String.self, forKey: .moderationState)
        eventDate = c.lenient(String.self, forKey: .eventDate)
        eventVenue = c.lenient(String.self, forKey: .eventVenue)
        lostFoundType = c.lenient(String.self, forKey: .lostFoundType)
        lostFoundContactPref = c.lenient(String.self, forKey: .lostFoundContactPref)
        serviceCategory = c.lenient(String.self, forKey: .serviceCategory)
        dealBusinessName = c.lenient(String.self, forKey: .dealBusinessName)
        locationName = c.lenient(String.self, forKey: .locationName)
        archiveReason = c.lenient(String.self, forKey: .archiveReason)
        state = c.lenient(String.self, forKey: .state)
        resolution = c.lenient(String.self, forKey: .resolution)
        expiresAt = c.lenient(String.self, forKey: .expiresAt)
        claimMode = c.lenient(String.self, forKey: .claimMode)
        keptOpenAt = c.lenient(PostLifecycleMetadata.self, forKey: .postMetadata)?.keptOpenAt
    }
}

extension PostDetailDTO {
    /// The feed card's copy of a post, shown while the post and its comments
    /// load (Instant Screens). Nil for rows without an author (seeded facts).
    init?(feedPost post: FeedPostDTO) {
        guard let userId = post.userId else { return nil }
        id = post.id
        self.userId = userId
        title = post.title
        content = post.content
        postType = post.postType
        postFormat = nil
        purpose = nil
        mediaURLs = post.mediaURLs
        mediaTypes = post.mediaTypes
        mediaThumbnails = post.mediaThumbnails
        mediaLiveURLs = post.mediaLiveURLs
        createdAt = post.createdAt
        updatedAt = nil
        isEdited = nil
        likeCount = post.likeCount
        commentCount = post.commentCount
        shareCount = post.shareCount
        viewCount = nil
        creator = post.creator
        home = nil
        userHasLiked = post.userHasLiked
        userHasSaved = post.userHasSaved
        userHasReposted = post.userHasReposted
        comments = []
        visibility = nil
        audience = nil
        readScope = nil
        allowExternalShare = nil
        moderationState = nil
        eventDate = post.eventDate
        eventVenue = post.eventVenue
        lostFoundType = post.lostFoundType
        lostFoundContactPref = nil
        serviceCategory = nil
        dealBusinessName = nil
        locationName = post.locationName
        archiveReason = nil
        state = post.state
        resolution = post.resolution
        expiresAt = post.expiresAt
        claimMode = post.claimMode
        keptOpenAt = post.keptOpenAt
    }
}

// MARK: - Interaction request/response payloads

/// Body for `POST /api/posts/:id/share` — `sharePostSchema`
/// (`backend/routes/posts.js:344`).
public struct PostShareRequest: Encodable, Sendable {
    public let shareType: String
    /// The repost state the person chose (`shareType: "repost"`), so a re-sent request can't
    /// flip it back. Omitted for external shares, and the server toggles when it's absent.
    public var reposted: Bool?
}

/// Body for `POST /api/posts/:id/like` and the comment like: the state the person chose, so a
/// re-sent request can't flip it back. Without a body the server toggles.
public struct PostLikeStateRequest: Encodable, Sendable {
    public let liked: Bool
}

/// Body for `POST /api/posts/:id/save`: the state the person chose (see `PostLikeStateRequest`).
public struct PostSaveStateRequest: Encodable, Sendable {
    public let saved: Bool
}

/// Body for `POST /api/posts/:id/report` — `reportPostSchema`
/// (`backend/routes/posts.js:339`).
public struct PostReportRequest: Encodable, Sendable {
    public let reason: String
    public let details: String?
}

/// `POST /:postId/comments/:commentId/like` response —
/// `backend/routes/posts.js:3056`.
public struct CommentLikeResponse: Decodable, Sendable, Hashable {
    public let liked: Bool
    public let likeCount: Int
}

/// `POST /:id/share` response — `shared` for external shares,
/// `reposted` for repost toggles (`backend/routes/posts.js:2895`).
public struct PostShareResponse: Decodable, Sendable, Hashable {
    public let shared: Bool?
    public let reposted: Bool?
    public let shareCount: Int?
}

/// `POST /:id/save` response — `backend/routes/posts.js:3294`.
public struct PostSaveResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let saved: Bool
}

/// Message-only acknowledgement (report / delete-comment routes).
public struct PostActionAckResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// `GET /api/posts/place-eligibility` response — `backend/routes/posts.js:1941`.
public struct PlaceEligibilityResponse: Decodable, Sendable, Hashable {
    public let eligible: Bool
    public let readOnly: Bool?
    public let reason: String?
    public let trustLevel: String?

    enum CodingKeys: String, CodingKey {
        case eligible
        case readOnly
        case reason
        case trustLevel
    }
}
