//
//  PrivacyHandshakeEndpoints.swift
//  Pantopus
//
//  T3.4 Privacy Handshake — the modal a visitor sees the first time
//  they tap Follow on a Public Profile. Tier 1 lands as a free
//  Follower immediately; tier > 1 returns a Stripe Checkout URL the
//  shell opens in the system browser.
//
//  Backend keeps `/personas/:id/follow` (with the handshake schema)
//  and the related discovery routes. UI strings the user sees say
//  "Public Profile" / "Followers" / "Members" per the firewall doc.
//

import Foundation

public enum PrivacyHandshakeEndpoints {
    /// `GET /api/personas/:handle` — visitor-side persona view used
    /// to render the handshake preview card. Route
    /// `backend/routes/personas.js:1028`.
    public static func persona(handle: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(handle)")
    }

    /// `GET /api/personas/:handle/tiers` — tier ladder (public).
    /// Route `backend/routes/personas.js:1111`.
    public static func tiers(handle: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(handle)/tiers")
    }

    /// `GET /api/personas/:handle/fan-handle-suggestion` — random
    /// suggested handle, or the viewer's already-bound one when
    /// `locked == true`. Route
    /// `backend/routes/personas.js:1303`.
    public static func fanHandleSuggestion(handle: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(handle)/fan-handle-suggestion")
    }

    /// `GET /api/personas/:id/follow/status` — checks whether the
    /// viewer is already an active follower so the wizard can short-
    /// circuit to the return-visitor frame. Route
    /// `backend/routes/personas.js:1790`.
    public static func followStatus(personaId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/personas/\(personaId)/follow/status")
    }

    /// `POST /api/personas/:id/follow` — handshake body. Tier 1 →
    /// active free Follower; tier > 1 → Stripe Checkout URL. Route
    /// `backend/routes/personas.js:1345`.
    public static func submit(personaId: String, body: HandshakeBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/personas/\(personaId)/follow", body: body)
    }

    /// `PATCH /api/personas/:id/follow/preferences` — notification
    /// level / muted state after a successful free follow. Route
    /// `backend/routes/personas.js:1743`.
    public static func updatePreferences(
        personaId: String,
        body: FollowPreferencesBody
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/personas/\(personaId)/follow/preferences",
            body: body
        )
    }
}

/// Handshake POST body. `acknowledged_platform_trust` MUST be `true`
/// or backend rejects the request. `acknowledged_using_pantopus_username`
/// is required only when `fan_handle` matches the viewer's username.
public struct HandshakeBody: Encodable, Sendable {
    public let tierRank: Int
    public let fanHandle: String
    public let fanDisplayName: String?
    public let fanAvatarUrl: String?
    public let acknowledgedPlatformTrust: Bool
    public let acknowledgedUsingPantopusUsername: Bool?

    public init(
        tierRank: Int,
        fanHandle: String,
        fanDisplayName: String? = nil,
        fanAvatarUrl: String? = nil,
        acknowledgedPlatformTrust: Bool = true,
        acknowledgedUsingPantopusUsername: Bool? = nil
    ) {
        self.tierRank = tierRank
        self.fanHandle = fanHandle
        self.fanDisplayName = fanDisplayName
        self.fanAvatarUrl = fanAvatarUrl
        self.acknowledgedPlatformTrust = acknowledgedPlatformTrust
        self.acknowledgedUsingPantopusUsername = acknowledgedUsingPantopusUsername
    }

    enum CodingKeys: String, CodingKey {
        case tierRank = "tier_rank"
        case fanHandle = "fan_handle"
        case fanDisplayName = "fan_display_name"
        case fanAvatarUrl = "fan_avatar_url"
        case acknowledgedPlatformTrust = "acknowledged_platform_trust"
        case acknowledgedUsingPantopusUsername = "acknowledged_using_pantopus_username"
    }
}

public struct FollowPreferencesBody: Encodable, Sendable {
    public let notificationLevel: String?
    public let mutedUntil: String?

    public init(notificationLevel: String? = nil, mutedUntil: String? = nil) {
        self.notificationLevel = notificationLevel
        self.mutedUntil = mutedUntil
    }

    enum CodingKeys: String, CodingKey {
        case notificationLevel = "notification_level"
        case mutedUntil = "muted_until"
    }
}
