//
//  PersonaEditDTOs.swift
//  Pantopus
//
//  Write-side shapes for Beacon (persona) create / edit and the
//  avatar + banner multipart upload. The read-side owner dashboard
//  decoders live in `AudienceProfileDTOs.swift`.
//
//  Field names follow `createPersonaSchema` / `updatePersonaSchema`
//  (`backend/routes/personas.js:56-85`) on the way out and
//  `serializeAudienceProfileForViewer`
//  (`backend/serializers/identitySerializers.js:219`) on the way back —
//  the request is snake_case, the response is camelCase.
//

import Foundation

// MARK: - Public links

/// One `{ label, url }` pair in `public_links`. Max 8 per Beacon; the
/// backend rejects a link that is missing either half.
public struct PersonaPublicLinkDTO: Codable, Sendable, Hashable, Identifiable {
    public let label: String
    public let url: String

    public var id: String {
        "\(label)|\(url)"
    }

    public init(label: String, url: String) {
        self.label = label
        self.url = url
    }
}

// MARK: - POST /api/personas · PATCH /api/personas/:id

/// Request body shared by create and update. `handle` + `display_name`
/// are required on create; every field is optional on update, but we
/// always send the full form so the two paths stay identical.
public struct PersonaWriteBody: Encodable, Sendable, Hashable {
    public var handle: String
    public var displayName: String
    public var bio: String?
    public var category: String
    public var audienceLabel: String
    public var audienceMode: String
    public var publicLinks: [PersonaPublicLinkDTO]

    public init(
        handle: String,
        displayName: String,
        bio: String?,
        category: String,
        audienceLabel: String,
        audienceMode: String,
        publicLinks: [PersonaPublicLinkDTO]
    ) {
        self.handle = handle
        self.displayName = displayName
        self.bio = bio
        self.category = category
        self.audienceLabel = audienceLabel
        self.audienceMode = audienceMode
        self.publicLinks = publicLinks
    }

    enum CodingKeys: String, CodingKey {
        case handle, bio, category
        case displayName = "display_name"
        case audienceLabel = "audience_label"
        case audienceMode = "audience_mode"
        case publicLinks = "public_links"
    }
}

/// `{ persona, channel }` — create returns both, update returns only
/// `persona` (the channel is unchanged).
public struct PersonaWriteResponse: Decodable, Sendable {
    public let persona: PersonaSummaryDTO?
    public let channel: BroadcastChannelDTO?
}

// MARK: - GET /api/personas/compliance/categories

public struct PersonaCategoryPoliciesResponse: Decodable, Sendable {
    public let categories: [PersonaCategoryPolicyDTO]
    public let sensitiveCategoriesEnabled: Bool?
}

/// One selectable (or gated) Beacon category. `enabled == false` means
/// the category is modeled but blocked behind credential verification —
/// the picker renders it disabled rather than hiding it.
public struct PersonaCategoryPolicyDTO: Decodable, Sendable, Hashable, Identifiable {
    public let category: String
    public let label: String?
    public let sensitive: Bool?
    public let enabled: Bool?
    public let requirements: [String]?
    public let defaultAudienceMode: String?

    public var id: String {
        category
    }
}

// MARK: - POST /api/upload/persona-media/:personaId

/// Response from the Beacon avatar / banner upload. The route writes
/// `avatar_url` / `banner_url` on the persona row itself and echoes the
/// new CDN URL. Route `backend/routes/upload.js:312`.
public struct PersonaMediaUploadResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let url: String
    public let key: String?
    public let persona: PersonaMediaPersonaDTO?
}

public struct PersonaMediaPersonaDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let handle: String?
    public let avatarUrl: String?
    public let bannerUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, handle
        case avatarUrl = "avatar_url"
        case bannerUrl = "banner_url"
    }
}

/// Which slot a persona image lands in. Sent as the `?type=` query param.
public enum PersonaMediaKind: String, Sendable, Hashable {
    case avatar
    case banner
}
