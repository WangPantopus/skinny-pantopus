//
//  BeaconProfileDTOs.swift
//  Pantopus
//
//  Decoder shapes for the public Beacon profile archetype (A21.1) when
//  it is driven by the *persona* backend rather than the local-user
//  endpoint. One persona shape decodes both:
//
//    - `GET /api/personas/me`        — the owner's own Beacon ("My Beacon").
//      Route `backend/routes/personas.js:367`.
//    - `GET /api/personas/:handle`   — a visitor viewing someone's Beacon.
//      Route `backend/routes/personas.js:1028`.
//
//  Both return `{ persona, channel }`. The serializer always emits the
//  `viewer` sub-object — on `/me` it carries `isOwner: true`; on `/:handle`
//  it carries the visitor's follow status + ownership. Every field is
//  optional so both envelopes decode through the same type. Backend renames
//  at the serializer boundary; the UI renames again at the VM boundary.
//
//  Tokens-only / snake_case → camelCase per `CLAUDE.md`.
//

import Foundation

// MARK: - Envelope

/// Envelope shared by `GET /api/personas/me` and `GET /api/personas/:handle`.
public struct BeaconPersonaResponse: Decodable, Sendable {
    public let persona: BeaconPersonaDTO?
    public let channel: BroadcastChannelDTO?
}

// MARK: - Persona

/// Full public-Beacon persona. Superset of `PersonaSummaryDTO` — adds the
/// `viewer` relationship, public links, audience mode, and broadcast flag
/// the profile surface needs that the owner dashboard summary omits.
public struct BeaconPersonaDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let bannerUrl: String?
    public let bio: String?
    public let category: String?
    public let audienceLabel: String?
    public let audienceMode: String?
    public let followerCount: Int?
    public let postCount: Int?
    public let broadcastEnabled: Bool?
    public let createdAt: String?
    public let publicLinks: [BeaconPublicLinkDTO]?
    public let credential: BeaconCredentialDTO?
    public let viewer: BeaconViewerDTO?

    enum CodingKeys: String, CodingKey {
        case id, handle, bio, category, viewer, credential
        case displayName, avatarUrl, bannerUrl
        case audienceLabel, audienceMode
        case followerCount, postCount
        case broadcastEnabled
        case publicLinks
        case createdAt
        case createdAtSnake = "created_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        handle = try c.decodeIfPresent(String.self, forKey: .handle)
        displayName = try c.decodeIfPresent(String.self, forKey: .displayName)
        avatarUrl = try c.decodeIfPresent(String.self, forKey: .avatarUrl)
        bannerUrl = try c.decodeIfPresent(String.self, forKey: .bannerUrl)
        bio = try c.decodeIfPresent(String.self, forKey: .bio)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        audienceLabel = try c.decodeIfPresent(String.self, forKey: .audienceLabel)
        audienceMode = try c.decodeIfPresent(String.self, forKey: .audienceMode)
        followerCount = try c.decodeIfPresent(Int.self, forKey: .followerCount)
        postCount = try c.decodeIfPresent(Int.self, forKey: .postCount)
        broadcastEnabled = try c.decodeIfPresent(Bool.self, forKey: .broadcastEnabled)
        publicLinks = try c.decodeIfPresent([BeaconPublicLinkDTO].self, forKey: .publicLinks)
        credential = try c.decodeIfPresent(BeaconCredentialDTO.self, forKey: .credential)
        viewer = try c.decodeIfPresent(BeaconViewerDTO.self, forKey: .viewer)
        // Accept either `createdAt` (serializer) or `created_at` (raw row).
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
            ?? c.decodeIfPresent(String.self, forKey: .createdAtSnake)
    }
}

/// Caller's relationship to the persona. `isOwner` drives the owner vs
/// visitor chrome split (true on `/me`, reflects the visitor on `/:handle`).
public struct BeaconViewerDTO: Decodable, Sendable, Hashable {
    public let isOwner: Bool?
    public let isFollowing: Bool?
    public let followStatus: String?
    public let relationshipType: String?
    public let notificationLevel: String?
}

/// Verification credential. `status == "verified"` drives the verified
/// check dot + the gold "Persona · Verified" tier chip; otherwise the chip
/// reads "Persona · New".
public struct BeaconCredentialDTO: Decodable, Sendable, Hashable {
    public let status: String?
    public let label: String?
}

/// One labelled external link the owner exposes on the About tab.
public struct BeaconPublicLinkDTO: Decodable, Sendable, Hashable {
    public let label: String?
    public let url: String?
}

// MARK: - Posts

/// Broadcast/post envelope from `GET /api/personas/:handle/posts`.
/// Route `backend/routes/personas.js:1046`.
public struct BeaconPostsResponse: Decodable, Sendable {
    public let posts: [BeaconPostDTO]
}

/// One persona broadcast. Tolerant of the post serializer (`content`,
/// `like_count`, `comment_count`) and the broadcast-message serializer
/// (`body`, `delivered_count`, `read_count`, `locked`, `teaser`) so the
/// same row decodes whichever the route returns. All fields optional.
public struct BeaconPostDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let body: String?
    public let createdAt: String?
    public let visibility: String?
    public let targetTierRank: Int?
    public let reactions: Int?
    public let replies: Int?
    public let locked: Bool?
    public let teaser: String?
    public let mediaUrls: [String]?
    /// Set on Post rows published through a broadcast channel
    /// (`backend/routes/broadcastChannels.js:554`). Non-nil is what makes a
    /// row eligible for a read receipt — RN gates on the same field
    /// (`src/app/persona/[personaHandle]/index.tsx:66`).
    public let broadcastChannelId: String?

    enum CodingKeys: String, CodingKey {
        case id, body, content, visibility, locked, teaser
        case createdAt = "created_at"
        case targetTierRank = "target_tier_rank"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case deliveredCount = "delivered_count"
        case readCount = "read_count"
        case mediaUrls = "media_urls"
        case broadcastChannelId = "broadcast_channel_id"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        body = try c.decodeIfPresent(String.self, forKey: .body)
            ?? c.decodeIfPresent(String.self, forKey: .content)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        visibility = try c.decodeIfPresent(String.self, forKey: .visibility)
        targetTierRank = try c.decodeIfPresent(Int.self, forKey: .targetTierRank)
        reactions = try c.decodeIfPresent(Int.self, forKey: .likeCount)
            ?? c.decodeIfPresent(Int.self, forKey: .deliveredCount)
        replies = try c.decodeIfPresent(Int.self, forKey: .commentCount)
            ?? c.decodeIfPresent(Int.self, forKey: .readCount)
        locked = try c.decodeIfPresent(Bool.self, forKey: .locked)
        teaser = try c.decodeIfPresent(String.self, forKey: .teaser)
        mediaUrls = try c.decodeIfPresent([String].self, forKey: .mediaUrls)
        broadcastChannelId = try c.decodeIfPresent(String.self, forKey: .broadcastChannelId)
    }
}
