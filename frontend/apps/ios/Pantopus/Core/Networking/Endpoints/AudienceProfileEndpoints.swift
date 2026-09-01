//
//  AudienceProfileEndpoints.swift
//  Pantopus
//
//  T3.3 Public Profile management (creator-facing audience dashboard).
//  Backend keeps the legacy persona / broadcast / audience names on
//  the wire; UI labels follow
//  docs/identity-firewall-ui-ux-redesign-2026-05-06.md
//  ("Public Profile" / "Updates" / "Followers" / "Post update").
//

import Foundation

public enum AudienceProfileEndpoints {
    /// `GET /api/personas/me` — owner-side persona + primary broadcast
    /// channel. Route `backend/routes/personas.js:367`.
    public static let me = Endpoint(method: .get, path: "/api/personas/me")

    /// `GET /api/personas/me/audience` — fan list + counts by tier.
    /// `sort` ∈ `recent / tenure / tier / alpha` (anything else falls back
    /// to `recent`); `limit` is clamped server-side to 1…200 and `offset`
    /// drives the `pagination.nextOffset` cursor echoed in the response.
    /// Route `backend/routes/personas.js:649`.
    public static func audience(
        sort: String? = nil,
        status: String? = nil,
        tierRank: Int? = nil,
        limit: Int? = nil,
        offset: Int? = nil
    ) -> Endpoint {
        var query: [String: String] = [:]
        if let sort { query["sort"] = sort }
        if let status { query["status"] = status }
        if let tierRank { query["tier_rank"] = String(tierRank) }
        if let limit { query["limit"] = String(limit) }
        if let offset, offset > 0 { query["offset"] = String(offset) }
        return Endpoint(method: .get, path: "/api/personas/me/audience", query: query)
    }

    /// `PATCH /api/personas/:id/followers/:followId` — the owner-side
    /// follower record update. `followId` is the **membership id**: the
    /// handler looks the row up in `PersonaMembership` by `id`
    /// (`backend/routes/personas.js:964-969`), so an id taken from
    /// `/me/audience` resolves here unchanged. `status` ∈
    /// `pending / active / muted / blocked / removed`
    /// (`ownerFollowerUpdateSchema`, `backend/routes/personas.js:108`).
    /// This is the only route that can set `blocked` — the
    /// `/me/audience/:membershipId` action verb list has no block action.
    /// Route `backend/routes/personas.js:960`.
    public static func followerStatus(
        personaId: String,
        followId: String,
        status: String
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/personas/\(personaId)/followers/\(followId)",
            body: AudienceFollowerStatusBody(status: status)
        )
    }

    /// `PATCH /api/personas/me/audience/:membershipId` — owner-side action
    /// on a single audience member. `action` ∈
    /// `approve / decline / remove / mute / unmute`; the backend maps each
    /// to a status transition and writes an audit-log entry. Route
    /// `backend/routes/personas.js:753`.
    public static func memberAction(membershipId: String, action: String) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/personas/me/audience/\(membershipId)",
            body: AudienceMemberActionBody(action: action)
        )
    }

    /// `GET /api/personas/:handle/posts` — recent Update posts.
    /// Route `backend/routes/personas.js:1046`.
    public static func posts(handle: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(handle)/posts")
    }

    /// `GET /api/personas/:handle/tiers` — tier ladder (chips).
    /// Route `backend/routes/personas.js:1111`.
    public static func tiers(handle: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(handle)/tiers")
    }

    /// `GET /api/personas/:id/membership-stats` — owner-only counts
    /// by tier for analytics cells. Route
    /// `backend/routes/personas.js:1256`.
    public static func membershipStats(personaId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(personaId)/membership-stats")
    }

    /// `GET /api/personas/:id/dms/threads` — owner inbox of fan
    /// threads. Route `backend/routes/personaDms.js:185`.
    public static func threads(personaId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(personaId)/dms/threads")
    }

    /// `POST /api/broadcast/channels/:channelId/messages` — publish a
    /// new Update. Route `backend/routes/broadcastChannels.js:450`.
    public static func publishUpdate(
        channelId: String,
        body: PublishUpdateBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/broadcast/channels/\(channelId)/messages",
            body: body
        )
    }

    /// `GET /api/broadcast/channels/:channelId/messages` — broadcast
    /// history, most-recent first. `limit`-only (no offset/cursor). Route
    /// `backend/routes/broadcastChannels.js:315`.
    public static func broadcastHistory(channelId: String, limit: Int = 50) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/broadcast/channels/\(channelId)/messages",
            query: ["limit": String(limit)]
        )
    }
}

/// One already-hosted media item riding along with the publish call.
/// `broadcastMediaItemsFromPayload` (`backend/routes/broadcastChannels.js:113`)
/// reads `url` + `type` (+ optional `thumbnailUrl` / `liveVideoUrl`) and
/// fans them out onto the Post's parallel media arrays.
public struct BroadcastMediaPayload: Encodable, Sendable, Hashable {
    public var url: String
    public var type: String
    public var thumbnailUrl: String?
    public var liveVideoUrl: String?

    public init(url: String, type: String, thumbnailUrl: String? = nil, liveVideoUrl: String? = nil) {
        self.url = url
        self.type = type
        self.thumbnailUrl = thumbnailUrl
        self.liveVideoUrl = liveVideoUrl
    }
}

/// Body for the broadcast-publish route. `visibility` valid values:
/// `public / followers / tier_or_above / subscribers`. When `tier_or_above`
/// is selected, `target_tier_rank` (1-4) is required. `media` carries
/// already-uploaded items (max 10); locally-picked files are attached
/// after publish via `POST /api/upload/post-media/:messageId`, because a
/// broadcast message *is* a Post row and that route needs its id.
public struct PublishUpdateBody: Encodable, Sendable {
    public var body: String
    public var visibility: String
    public var targetTierRank: Int?
    public var media: [BroadcastMediaPayload]?
    /// Explicit place tag (Instagram-style). All-or-nothing on the
    /// backend: the location columns are only written when latitude +
    /// longitude + location_name are all present
    /// (`backend/routes/broadcastChannels.js` createBroadcastMessageSchema).
    /// Nil fields are dropped from the payload — the schema is a CLOSED
    /// Joi object but these keys are accepted; `null` is not.
    public var latitude: Double?
    public var longitude: Double?
    public var locationName: String?
    public var locationAddress: String?
    public var placeId: String?

    public init(
        body: String,
        visibility: String,
        targetTierRank: Int? = nil,
        media: [BroadcastMediaPayload]? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        locationName: String? = nil,
        locationAddress: String? = nil,
        placeId: String? = nil
    ) {
        self.body = body
        self.visibility = visibility
        self.targetTierRank = targetTierRank
        self.media = media?.isEmpty == true ? nil : media
        self.latitude = latitude
        self.longitude = longitude
        self.locationName = locationName
        self.locationAddress = locationAddress
        self.placeId = placeId
    }

    enum CodingKeys: String, CodingKey {
        case body, visibility, media
        case targetTierRank = "target_tier_rank"
        case latitude, longitude
        case locationName = "location_name"
        case locationAddress = "location_address"
        case placeId = "place_id"
    }
}

/// Body for the owner-side audience-member action route (A22.2 "Your
/// audience"). `action` valid values: `approve / decline / remove / mute /
/// unmute`.
public struct AudienceMemberActionBody: Encodable, Sendable {
    public let action: String

    public init(action: String) {
        self.action = action
    }
}

/// Body for `PATCH /api/personas/:id/followers/:followId`. Only `status`
/// is sent; the schema also accepts `relationship_type` /
/// `notification_level` but the block flow never changes those.
public struct AudienceFollowerStatusBody: Encodable, Sendable {
    public let status: String

    public init(status: String) {
        self.status = status
    }
}
