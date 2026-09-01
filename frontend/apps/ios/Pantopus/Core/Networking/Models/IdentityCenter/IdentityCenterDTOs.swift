//
//  IdentityCenterDTOs.swift
//  Pantopus
//
//  Decoder shapes for `/api/identity-center/*`. Backend column names
//  stay (persona / bridges); the UI renames at the view-model
//  boundary. See docs/identity-firewall-ui-ux-redesign-2026-05-06.md.
//

import Foundation

/// Envelope from `GET /api/identity-center`.
public struct IdentityCenterResponse: Decodable, Sendable {
    public let privateAccount: PrivateAccountDTO?
    public let localProfile: LocalProfileDTO?
    public let audienceProfile: AudienceProfileDTO?
    public let bridges: BridgesDTO?
    public let homes: [HomeIdentityDTO]?
    public let businessProfiles: [BusinessIdentityDTO]?
    public let personaCount: Int?
    public let blockCounts: BlockCountsDTO?

    public init(
        privateAccount: PrivateAccountDTO?,
        localProfile: LocalProfileDTO?,
        audienceProfile: AudienceProfileDTO?,
        bridges: BridgesDTO?,
        homes: [HomeIdentityDTO]?,
        businessProfiles: [BusinessIdentityDTO]?,
        personaCount: Int?,
        blockCounts: BlockCountsDTO?
    ) {
        self.privateAccount = privateAccount
        self.localProfile = localProfile
        self.audienceProfile = audienceProfile
        self.bridges = bridges
        self.homes = homes
        self.businessProfiles = businessProfiles
        self.personaCount = personaCount
        self.blockCounts = blockCounts
    }

    enum CodingKeys: String, CodingKey {
        case privateAccount = "private_account"
        case localProfile = "local_profile"
        case audienceProfile = "audience_profile"
        case bridges, homes
        case businessProfiles = "business_profiles"
        case personaCount = "persona_count"
        case blockCounts = "block_counts"
    }
}

/// The signed-in user's email-level identity. Surfaces as "Personal"
/// in the design.
public struct PrivateAccountDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let email: String?
    public let name: String?
    public let verified: Bool?
    public let profilePictureUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, email, name, verified
        case profilePictureUrl = "profile_picture_url"
    }
}

/// "Local Profile" card data.
public struct LocalProfileDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let postCount: Int?
    public let connectionCount: Int?
    public let verified: Bool?
    public let locality: String?

    enum CodingKeys: String, CodingKey {
        case id, handle
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case postCount = "post_count"
        case connectionCount = "connection_count"
        case verified, locality
    }
}

/// "Public profile" card (backend calls it audience profile / persona
/// — renamed at the UI boundary).
public struct AudienceProfileDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let followerCount: Int?
    public let postCadence: String?
    public let status: String?

    enum CodingKeys: String, CodingKey {
        case id, handle
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case followerCount = "follower_count"
        case postCadence = "post_cadence"
        case status
    }
}

/// Per-identity bridge toggles — "Profile links" in the UI.
public struct BridgesDTO: Decodable, Sendable, Hashable {
    public let showPersonaOnLocal: Bool?
    public let showLocalOnPersona: Bool?

    enum CodingKeys: String, CodingKey {
        case showPersonaOnLocal = "show_persona_on_local"
        case showLocalOnPersona = "show_local_on_persona"
    }
}

/// One row in the Homes list.
public struct HomeIdentityDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    public let city: String?
    public let state: String?
    public let primaryPhotoUrl: String?
    public let role: String?

    enum CodingKeys: String, CodingKey {
        case id, name, city, state
        case primaryPhotoUrl = "primary_photo_url"
        case role
    }
}

/// One row in the Business profiles list.
public struct BusinessIdentityDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String?
    public let role: String?
    public let isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case role
        case isActive = "is_active"
    }
}

public struct BlockCountsDTO: Decodable, Sendable, Hashable {
    public let personal: Int?
    public let audience: Int?
}

// MARK: - View As (GET /api/identity-center/view-as — identityCenter.js:489)

/// Privacy-preview payload: the signed-in user's profile resolved for a
/// chosen viewer. `visible` is the serialized profile the viewer sees;
/// `hidden` lists the redacted field keys. Keys are camelCase on the wire
/// (the route builds plain JS objects), so no `CodingKeys` are needed.
public struct ViewAsResponse: Decodable, Sendable, Hashable {
    public let viewer: String?
    public let viewerLabel: String?
    public let visible: ViewAsVisibleProfile?
    public let hidden: [String]?
    public let context: ViewAsContextDTO?

    public struct ViewAsVisibleProfile: Decodable, Sendable, Hashable {
        public let handle: String?
        public let displayName: String?
        public let bio: String?
        public let badges: [String]?
        public let locality: Locality?
        public let stats: Stats?
        public let viewer: ViewerRelationship?

        public struct Locality: Decodable, Sendable, Hashable {
            public let city: String?
            public let state: String?
            public let neighborhood: String?
            public let precision: String?
        }

        public struct Stats: Decodable, Sendable, Hashable {
            public let reviews: Int?
            public let gigsCompleted: Int?
        }

        public struct ViewerRelationship: Decodable, Sendable, Hashable {
            public let relationshipStatus: String?
            public let isFollowingLocal: Bool?
            public let canMessage: Bool?
        }
    }

    public struct ViewAsContextDTO: Decodable, Sendable, Hashable {
        public let isNeighbor: Bool?
        public let isConnection: Bool?
        public let isHouseholdMember: Bool?
        public let isGigParticipant: Bool?
    }
}
