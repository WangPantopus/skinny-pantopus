//
//  FollowingDTOs.swift
//  Pantopus
//
//  §1A① — "Following": the Beacons (creator personas) the signed-in user
//  follows. Decodes the `serializeFollowingRow` envelope from
//  `backend/serializers/identitySerializers.js:408`. The serializer already
//  emits camelCase keys, so no `CodingKeys` remapping is required — the
//  property names match the wire exactly.
//

import Foundation

/// `GET /api/personas/me/following` envelope.
/// Route `backend/routes/personas.js:425`.
public struct FollowingListResponse: Decodable, Sendable, Hashable {
    public let items: [FollowingRowDTO]
    public let counts: FollowingCountsDTO
    public let pagination: FollowingPaginationDTO?
}

/// Header counts: total followed Beacons + how many have unread updates.
public struct FollowingCountsDTO: Decodable, Sendable, Hashable {
    public let totalFollowing: Int
    public let unreadBeacons: Int
}

/// Cursor metadata. `nextOffset` is `null` on the last page.
public struct FollowingPaginationDTO: Decodable, Sendable, Hashable {
    public let nextOffset: Int?
    public let hasMore: Bool?
}

/// One followed-Beacon row.
public struct FollowingRowDTO: Decodable, Sendable, Hashable, Identifiable {
    public var id: String {
        membershipId
    }

    public let membershipId: String
    public let persona: FollowingPersonaDTO
    public let fanHandle: String?
    public let notificationLevel: String?
    /// Present (non-null) only while the membership is currently muted.
    public let mutedUntil: String?
    /// Present only for paid tiers (rank > 1).
    public let paidTier: FollowingTierDTO?
    public let latestPost: FollowingPostDTO?
    public let unreadCount: Int?
    public let followedAt: String?
    public let lastSeenAt: String?
}

/// The Beacon persona itself. `followerCount` is not emitted by the current
/// serializer — it is decoded optionally so the subtitle can show "·
/// {n} followers" if a future payload starts including it, and omit it
/// gracefully otherwise.
public struct FollowingPersonaDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let handle: String
    public let displayName: String?
    public let avatarUrl: String?
    public let status: String?
    public let verified: Bool?
    public let followerCount: Int?
}

/// Paid membership tier badge payload.
public struct FollowingTierDTO: Decodable, Sendable, Hashable {
    public let rank: Int
    public let name: String?
    public let priceCents: Int?
}

/// Latest Update post snippet for the body line.
public struct FollowingPostDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let snippet: String?
    public let createdAt: String?
}

/// `POST /api/personas/me/following/:personaId/seen` echo.
/// Route `backend/routes/personas.js:547`.
public struct FollowingSeenResponse: Decodable, Sendable, Hashable {
    public let unreadCount: Int?
    public let lastSeenAt: String?
}

/// `PATCH /api/personas/me/following/:personaId/mute` echo.
/// Route `backend/routes/personas.js:582`.
public struct FollowingMuteResponse: Decodable, Sendable, Hashable {
    public let mutedUntil: String?
}

/// `PATCH /api/personas/:id/follow/preferences` echo.
/// Route `backend/routes/personas.js:1743`.
public struct FollowPreferencesResponse: Decodable, Sendable, Hashable {
    public let following: Bool?
    public let status: String?
    public let relationshipType: String?
    public let notificationLevel: String?
}

/// Body for the notification-level PATCH. The validator requires
/// `notification_level` ∈ `all | highlights | none`
/// (`backend/routes/personas.js:88`).
public struct FollowNotificationLevelBody: Encodable, Sendable {
    public let notificationLevel: String

    public init(notificationLevel: String) {
        self.notificationLevel = notificationLevel
    }

    enum CodingKeys: String, CodingKey {
        case notificationLevel = "notification_level"
    }
}

/// Body for the mute PATCH. The backend validator
/// (`muteFollowingSchema`, `backend/routes/personas.js:95`) makes `days`
/// **required** while allowing `null` (which clears the mute), so the key
/// is always serialized — even when nil it is written as an explicit JSON
/// `null` rather than omitted.
public struct MuteFollowingBody: Encodable, Sendable {
    public let days: Int?

    public init(days: Int?) {
        self.days = days
    }

    enum CodingKeys: String, CodingKey {
        case days
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let days {
            try container.encode(days, forKey: .days)
        } else {
            try container.encodeNil(forKey: .days)
        }
    }
}
