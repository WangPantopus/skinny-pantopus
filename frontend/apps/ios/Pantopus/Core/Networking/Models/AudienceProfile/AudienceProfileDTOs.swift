//
//  AudienceProfileDTOs.swift
//  Pantopus
//
//  Decoder shapes for /api/personas/* — the owner-facing audience
//  dashboard (T3.3). Backend column names stay (persona / fan /
//  broadcast / tier); the UI renames at the VM boundary.
//

import Foundation

// MARK: - GET /api/personas/me

/// Envelope from `GET /api/personas/me` — the persona summary + its
/// primary broadcast channel ID needed by the composer.
public struct PersonaMeResponse: Decodable, Sendable {
    public let persona: PersonaSummaryDTO?
    public let channel: BroadcastChannelDTO?
}

public struct PersonaSummaryDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let bannerUrl: String?
    public let bio: String?
    public let category: String?
    public let audienceLabel: String?
    /// `open / approval_required / invite_only / organization_managed`.
    public let audienceMode: String?
    public let publicLinks: [PersonaPublicLinkDTO]?
    public let followerCount: Int?
    public let postCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, handle, bio, category
        case displayName, avatarUrl, bannerUrl
        case audienceLabel, audienceMode, publicLinks
        case followerCount, postCount
    }
}

public struct BroadcastChannelDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let title: String?
    public let description: String?
    public let status: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, status
    }
}

// MARK: - GET /api/personas/me/audience

public struct AudienceListResponse: Decodable, Sendable {
    public let persona: PersonaSummaryDTO?
    public let items: [FanDTO]
    public let counts: AudienceCountsDTO
    /// Offset cursor echoed by the handler
    /// (`backend/routes/personas.js:735-741`). Absent on the
    /// no-persona short-circuit, so it stays optional.
    public let pagination: AudiencePaginationDTO?
}

/// `{ nextOffset, hasMore }` — `nextOffset` is `null` on the last page.
public struct AudiencePaginationDTO: Decodable, Sendable, Hashable {
    public let nextOffset: Int?
    public let hasMore: Bool?
}

public struct AudienceCountsDTO: Decodable, Sendable, Hashable {
    public let totalActive: Int?
    public let pending: Int?
    public let byTier: [String: Int]?

    enum CodingKeys: String, CodingKey {
        case totalActive, pending, byTier
    }
}

/// One follower row in the creator's audience list — strictly the
/// creator-side serializer (no PII per the privacy gate). Backend
/// returns camelCase keys here (`fanHandle` not `fan_handle`), so no
/// per-field CodingKeys are needed.
public struct FanDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let membershipId: String?
    public let fanHandle: String?
    public let fanDisplayName: String?
    public let fanAvatarUrl: String?
    public let status: String?
    public let tier: FanTierBadgeDTO?
    public let verifiedLocal: Bool?
    public let joinedMonth: String?
    public let tenureMonths: Int?
    public let cancelAtPeriodEnd: Bool?

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Server emits `membershipId` (no separate `id`); map either
        // key to our `id` so the serializer evolution stays compatible.
        let mid = try container.decodeIfPresent(String.self, forKey: .membershipId)
        let raw = try container.decodeIfPresent(String.self, forKey: .id)
        id = mid ?? raw ?? ""
        membershipId = mid
        fanHandle = try container.decodeIfPresent(String.self, forKey: .fanHandle)
        fanDisplayName = try container.decodeIfPresent(String.self, forKey: .fanDisplayName)
        fanAvatarUrl = try container.decodeIfPresent(String.self, forKey: .fanAvatarUrl)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        tier = try container.decodeIfPresent(FanTierBadgeDTO.self, forKey: .tier)
        verifiedLocal = try container.decodeIfPresent(Bool.self, forKey: .verifiedLocal)
        joinedMonth = try container.decodeIfPresent(String.self, forKey: .joinedMonth)
        tenureMonths = try container.decodeIfPresent(Int.self, forKey: .tenureMonths)
        cancelAtPeriodEnd = try container.decodeIfPresent(Bool.self, forKey: .cancelAtPeriodEnd)
    }

    enum CodingKeys: String, CodingKey {
        case id, membershipId, fanHandle, fanDisplayName, fanAvatarUrl
        case status, tier, verifiedLocal, joinedMonth, tenureMonths, cancelAtPeriodEnd
    }
}

public struct FanTierBadgeDTO: Decodable, Sendable, Hashable {
    public let rank: Int?
    public let name: String?
}

// MARK: - PATCH /api/personas/me/audience/:membershipId

/// Owner-side action response (A22.2 "Your audience"). The backend echoes
/// the membership id and its new status after an approve / decline /
/// remove / mute / unmute transition.
public struct AudienceMemberActionResponse: Decodable, Sendable, Hashable {
    public let membershipId: String?
    public let status: String?
}

// MARK: - PATCH /api/personas/:id/followers/:followId

/// `{ follower: … }` echoed after an owner-side follower status change
/// (`serializePersonaFollowForOwner`, `backend/routes/personas.js:225`).
/// Only the new status is read — the block flow re-fetches the list for
/// authoritative counts.
public struct AudienceFollowerUpdateResponse: Decodable, Sendable, Hashable {
    public let follower: AudienceFollowerDTO?
}

public struct AudienceFollowerDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let status: String?
    public let relationshipType: String?
    public let notificationLevel: String?
}

// MARK: - GET /api/personas/:handle/posts

public struct PersonaPostsResponse: Decodable, Sendable {
    public let posts: [PersonaPostDTO]
}

/// Owner-side decoder for the same route `BeaconPostDTO` reads
/// (`GET /api/personas/:handle/posts`), kept separate because the audience
/// dashboard projects the delivered/read counters the visitor surface has no
/// use for. The `media_*` arrays must stay in step across both decoders —
/// two divergent shapes for one route is how the Beacon media gap opened.
public struct PersonaPostDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let body: String?
    public let createdAt: String?
    public let visibility: String?
    public let targetTierRank: Int?
    public let deliveredCount: Int?
    public let readCount: Int?
    public let mediaUrls: [String]?
    /// Parallel arrays to `media_urls` — slot `i` is described by
    /// `media_types[i]` / `media_thumbnails[i]` / `media_live_urls[i]`, with
    /// `media_live_urls[i]` carrying the companion clip when the type is
    /// `live_photo`. Same shape as `FeedDTOs.swift:40-45`.
    public let mediaTypes: [String]
    public let mediaThumbnails: [String]
    public let mediaLiveURLs: [String]

    enum CodingKeys: String, CodingKey {
        case id, body, visibility
        case createdAt = "created_at"
        case targetTierRank = "target_tier_rank"
        case deliveredCount = "delivered_count"
        case readCount = "read_count"
        case mediaUrls = "media_urls"
        case mediaTypes = "media_types"
        case mediaThumbnails = "media_thumbnails"
        case mediaLiveURLs = "media_live_urls"
    }

    /// Hand-rolled because the synthesized decoder can't fall back to `[]`
    /// for the three non-optional media arrays when the serializer omits the
    /// key. Every other field keeps the synthesized behaviour verbatim.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        body = try c.decodeIfPresent(String.self, forKey: .body)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        visibility = try c.decodeIfPresent(String.self, forKey: .visibility)
        targetTierRank = try c.decodeIfPresent(Int.self, forKey: .targetTierRank)
        deliveredCount = try c.decodeIfPresent(Int.self, forKey: .deliveredCount)
        readCount = try c.decodeIfPresent(Int.self, forKey: .readCount)
        mediaUrls = try c.decodeIfPresent([String].self, forKey: .mediaUrls)
        mediaTypes = try c.decodeIfPresent([String].self, forKey: .mediaTypes) ?? []
        mediaThumbnails = try c.decodeIfPresent([String].self, forKey: .mediaThumbnails) ?? []
        mediaLiveURLs = try c.decodeIfPresent([String].self, forKey: .mediaLiveURLs) ?? []
    }
}

// MARK: - GET /api/personas/:handle/tiers

public struct PersonaTiersResponse: Decodable, Sendable {
    public let tiers: [PersonaTierDTO]
}

public struct PersonaTierDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let rank: Int
    public let name: String
    public let description: String?
    public let priceCents: Int?
    public let currency: String?
}

// MARK: - GET /api/personas/:id/membership-stats

public struct MembershipStatsResponse: Decodable, Sendable {
    public let counts: MembershipStatsCounts
}

public struct MembershipStatsCounts: Decodable, Sendable, Hashable {
    public let followers: Int?
    public let members: Int?
    public let insiders: Int?
    public let direct: Int?
}

// MARK: - GET /api/personas/:id/dms/threads

public struct PersonaThreadsResponse: Decodable, Sendable {
    public let threads: [PersonaThreadDTO]
}

public struct PersonaThreadDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let membershipId: String?
    public let fanHandle: String?
    public let fanDisplayName: String?
    public let fanAvatarUrl: String?
    public let tier: FanTierBadgeDTO?
    public let lastMessagePreview: String?
    public let lastMessageAt: String?
    public let unreadCount: Int?
    public let status: String?
    /// Marked by the creator (or the moderation pipeline) as flagged
    /// for review — drives the amber flag glyph on the Creator Inbox
    /// row and the "Flagged" filter chip count. Missing field decodes
    /// as `nil`, treated as `false` at the projection boundary.
    public let flagged: Bool?
    /// Verified-local follower flag, mirrored from `FanDTO`. Drives the
    /// small sky-blue check overlay on the avatar.
    public let verifiedLocal: Bool?
    /// Counterparty user id needed to push the existing
    /// `ChatConversationView` in `.person` mode from a Creator Inbox
    /// row tap. Older serializers may not surface this — when nil the
    /// row's tap target uses `membershipId` as the conversation peer.
    public let counterpartyUserId: String?
}

// MARK: - POST /api/broadcast/channels/:id/messages

public struct PublishUpdateResponse: Decodable, Sendable {
    public let message: BroadcastMessageDTO?
}

public struct BroadcastMessageDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let body: String?
    public let visibility: String?
    public let targetTierRank: Int?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body, visibility
        case targetTierRank = "target_tier_rank"
        case createdAt = "created_at"
    }
}

// MARK: - GET /api/broadcast/channels/:id/messages  (history)

/// History envelope. The compose surface only reads `messages`; `channel` /
/// `persona` / `analytics` / `viewer` are present on the wire but unused.
public struct BroadcastHistoryResponse: Decodable, Sendable {
    public let messages: [BroadcastHistoryMessageDTO]
}

/// One row in the broadcast history. The owner sees full rows; a `locked`
/// teaser row only appears for tier-gated content above the viewer's rank
/// (never for the owner). All fields optional so both shapes decode.
public struct BroadcastHistoryMessageDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let body: String?
    public let visibility: String?
    public let targetTierRank: Int?
    public let createdAt: String?
    public let publishedAt: String?
    public let deliveredCount: Int?
    public let readCount: Int?
    public let media: [BroadcastMediaDTO]?
    public let locked: Bool?

    enum CodingKeys: String, CodingKey {
        case id, body, visibility, media, locked
        case targetTierRank = "target_tier_rank"
        case createdAt = "created_at"
        case publishedAt = "published_at"
        case deliveredCount = "delivered_count"
        case readCount = "read_count"
    }
}

/// One attachment on a broadcast-channel row.
///
/// **Wire-shape divergence, and it is a trap.** Every other post route
/// (`/api/posts/feed`, `/api/personas/:handle/posts`) describes attachments
/// with four *parallel snake_case arrays* padded to equal length —
/// `media_urls[i]` / `media_types[i]` / `media_thumbnails[i]` /
/// `media_live_urls[i]`. The broadcast serializer does not: `mediaFromPost`
/// (`backend/routes/broadcastChannels.js:200-229`) zips those arrays into a
/// **nested camelCase object array** and OMITS every key whose slot value is
/// falsy (`if (thumbnailUrl) item.thumbnailUrl = …`). So a plain image
/// arrives as a bare `{ "url": … }`, and only a Live Photo carries
/// `liveVideoUrl`. Nothing here is padded, and nothing is indexed — which is
/// why this shape needs its own adapter rather than
/// `PostMediaItem.items(urls:types:thumbnails:liveURLs:)`.
///
/// Keys are already camelCase on the wire, so no `CodingKeys` are needed —
/// `APIClient` does not apply `convertFromSnakeCase`.
public struct BroadcastMediaDTO: Decodable, Sendable, Hashable {
    public let url: String?
    /// `image` / `video` / `live_photo` — normalized server-side by
    /// `normalizeBroadcastMediaType` (`broadcastChannels.js:142`).
    public let type: String?
    /// Video poster frame or Live Photo still. Absent when blank.
    public let thumbnailUrl: String?
    /// Companion clip for a `live_photo`. Absent for every other type —
    /// and a `live_photo` row can never reach the client without one,
    /// because `broadcastMediaItemSchema` rejects that combination on the
    /// write (`broadcastChannels.js:50-55`).
    public let liveVideoUrl: String?
}
