//
//  SettingsDTOs.swift
//  Pantopus
//
//  Decoder shapes for the privacy + auth-methods Settings endpoints.
//  All fields are Optional so the backend can roll out new keys
//  without breaking older clients.
//

import Foundation

/// Envelope from `GET /api/privacy/settings` (`privacy.js:80`) and from
/// `PATCH /api/privacy/settings` (`privacy.js:142`, which also carries a
/// `message` we ignore).
public struct PrivacySettingsResponse: Decodable, Sendable {
    public let settings: PrivacySettings
}

/// One `UserPrivacySettings` row. Columns per
/// `supabase/migrations/20260301000001_identity_firewall_tables.sql:128`
/// plus `findable_by_name` (migration `143_user_privacy_findable_by_name`).
/// Every field is Optional so the backend can add columns without
/// breaking older clients.
public struct PrivacySettings: Decodable, Sendable, Hashable {
    public let userId: String?
    /// `everyone` · `mutuals` · `nobody`.
    public let searchVisibility: String?
    public let findableByName: Bool?
    public let findableByEmail: Bool?
    public let findableByPhone: Bool?
    /// `public` · `followers` · `private`.
    public let profileDefaultVisibility: String?
    public let showGigHistory: String?
    public let showNeighborhood: String?
    public let showHomeAffiliation: String?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case searchVisibility = "search_visibility"
        case findableByName = "findable_by_name"
        case findableByEmail = "findable_by_email"
        case findableByPhone = "findable_by_phone"
        case profileDefaultVisibility = "profile_default_visibility"
        case showGigHistory = "show_gig_history"
        case showNeighborhood = "show_neighborhood"
        case showHomeAffiliation = "show_home_affiliation"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Envelope from `GET /api/privacy/blocks`.
public struct PrivacyBlocksResponse: Decodable, Sendable {
    public let blocks: [PrivacyBlock]
}

public struct PrivacyBlock: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let blockedUserId: String?
    public let blockScope: String?
    public let reason: String?
    public let createdAt: String?
    public let blocked: BlockedUserSummary?

    enum CodingKeys: String, CodingKey {
        case id
        case blockedUserId = "blocked_user_id"
        case blockScope = "block_scope"
        case reason
        case createdAt = "created_at"
        case blocked
    }
}

/// Nested user summary returned by `privacy.js:154` join.
public struct BlockedUserSummary: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, username, name
        case profilePictureUrl = "profile_picture_url"
    }
}

/// Envelope from `GET /api/users/auth-methods`.
public struct AuthMethodsResponse: Decodable, Sendable {
    public let methods: [AuthMethod]?
    public let hasPassword: Bool?
    public let providers: [String]?
    public let twoFactorEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case methods
        case hasPassword = "has_password"
        case providers
        case twoFactorEnabled = "two_factor_enabled"
    }
}

public struct AuthMethod: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let provider: String?
    public let label: String?

    enum CodingKeys: String, CodingKey {
        case id, provider, label
    }
}
