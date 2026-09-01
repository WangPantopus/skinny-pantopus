//
//  BusinessPagesDTOs.swift
//  Pantopus
//
//  C4 — DTOs for the business Pages CMS (custom pages + block builder +
//  revision history) and the public page-by-slug read.
//
//  Routes:
//    · `backend/routes/businesses.js:2809` POST   /api/businesses/:id/pages
//    · `backend/routes/businesses.js:2865` GET    /api/businesses/:id/pages
//    · `backend/routes/businesses.js:2894` PATCH  /api/businesses/:id/pages/:pageId
//    · `backend/routes/businesses.js:2949` DELETE /api/businesses/:id/pages/:pageId
//    · `backend/routes/businesses.js:3006` GET    …/pages/:pageId/blocks
//    · `backend/routes/businesses.js:3066` PUT    …/pages/:pageId/blocks
//    · `backend/routes/businesses.js:3153` POST   …/pages/:pageId/publish
//    · `backend/routes/businesses.js:3241` GET    …/pages/:pageId/revisions
//    · `backend/routes/businesses.js:3277` POST   …/revisions/:rev/restore
//    · `backend/routes/businessPublicPage.js:62` GET /api/b/:username/:slug
//

import Foundation

// MARK: - Page

/// One row of `BusinessPage`. `GET /pages` selects `*`, so every column the
/// editor cares about is present; unrecognised columns are ignored.
public struct BusinessPageDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let slug: String
    public let title: String
    public let description: String?
    public let isDefault: Bool?
    public let showInNav: Bool?
    public let navOrder: Int?
    public let iconKey: String?
    public let draftRevision: Int?
    public let publishedRevision: Int?
    public let publishedAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, slug, title, description
        case isDefault = "is_default"
        case showInNav = "show_in_nav"
        case navOrder = "nav_order"
        case iconKey = "icon_key"
        case draftRevision = "draft_revision"
        case publishedRevision = "published_revision"
        case publishedAt = "published_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/businesses/:id/pages` → `{ pages: [...] }`.
public struct BusinessPagesResponse: Decodable, Sendable, Hashable {
    public let pages: [BusinessPageDTO]
}

/// `POST /pages` (201) and `PATCH /pages/:pageId` → `{ page }`.
public struct BusinessPageEnvelope: Decodable, Sendable, Hashable {
    public let page: BusinessPageDTO
}

/// Body for `POST /api/businesses/:id/pages`
/// (`createPageSchema`, `backend/routes/businesses.js:262`).
public struct CreateBusinessPageRequest: Encodable, Sendable, Hashable {
    public let slug: String
    public let title: String
    public let description: String?
    public let showInNav: Bool?

    public init(slug: String, title: String, description: String? = nil, showInNav: Bool? = true) {
        self.slug = slug
        self.title = title
        self.description = description
        self.showInNav = showInNav
    }

    enum CodingKeys: String, CodingKey {
        case slug, title, description
        case showInNav = "show_in_nav"
    }
}

// MARK: - Blocks

/// One row of `BusinessPageBlock`. `data` / `settings` are free-form jsonb —
/// they round-trip verbatim so unknown keys survive a save.
public struct BusinessPageBlockDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let blockType: String
    public let schemaVersion: Int?
    public let sortOrder: Int?
    public let data: [String: JSONValue]?
    public let settings: [String: JSONValue]?
    public let locationId: String?
    public let showFrom: String?
    public let showUntil: String?
    public let isVisible: Bool?

    enum CodingKeys: String, CodingKey {
        case id, data, settings
        case blockType = "block_type"
        case schemaVersion = "schema_version"
        case sortOrder = "sort_order"
        case locationId = "location_id"
        case showFrom = "show_from"
        case showUntil = "show_until"
        case isVisible = "is_visible"
    }
}

/// `GET …/blocks` → `{ blocks, revision, draft_revision?, published_revision? }`.
/// The `never_published` early return omits the two revision counters, so
/// both are optional (`backend/routes/businesses.js:3031`).
public struct BusinessPageBlocksResponse: Decodable, Sendable, Hashable {
    public let blocks: [BusinessPageBlockDTO]
    public let revision: Int?
    public let draftRevision: Int?
    public let publishedRevision: Int?

    enum CodingKeys: String, CodingKey {
        case blocks, revision
        case draftRevision = "draft_revision"
        case publishedRevision = "published_revision"
    }
}

/// One element of the `PUT …/blocks` body (`blockSchema`,
/// `backend/routes/businesses.js:286`). `sort_order`, `block_type` and
/// `data` are required by Joi; everything else is optional.
public struct SaveBusinessPageBlockRequest: Encodable, Sendable, Hashable {
    public let blockType: String
    public let schemaVersion: Int
    public let sortOrder: Int
    public let data: [String: JSONValue]
    public let settings: [String: JSONValue]
    public let locationId: String?
    public let showFrom: String?
    public let showUntil: String?
    public let isVisible: Bool

    public init(
        blockType: String,
        schemaVersion: Int,
        sortOrder: Int,
        data: [String: JSONValue],
        settings: [String: JSONValue],
        locationId: String?,
        showFrom: String?,
        showUntil: String?,
        isVisible: Bool
    ) {
        self.blockType = blockType
        self.schemaVersion = schemaVersion
        self.sortOrder = sortOrder
        self.data = data
        self.settings = settings
        self.locationId = locationId
        self.showFrom = showFrom
        self.showUntil = showUntil
        self.isVisible = isVisible
    }

    enum CodingKeys: String, CodingKey {
        case data, settings
        case blockType = "block_type"
        case schemaVersion = "schema_version"
        case sortOrder = "sort_order"
        case locationId = "location_id"
        case showFrom = "show_from"
        case showUntil = "show_until"
        case isVisible = "is_visible"
    }
}

/// Body for `PUT /api/businesses/:id/pages/:pageId/blocks`.
public struct SaveBusinessPageBlocksRequest: Encodable, Sendable, Hashable {
    public let blocks: [SaveBusinessPageBlockRequest]

    public init(blocks: [SaveBusinessPageBlockRequest]) {
        self.blocks = blocks
    }
}

/// `PUT …/blocks` → `{ blocks, draft_revision }`.
public struct SaveBusinessPageBlocksResponse: Decodable, Sendable, Hashable {
    public let blocks: [BusinessPageBlockDTO]
    public let draftRevision: Int?

    enum CodingKeys: String, CodingKey {
        case blocks
        case draftRevision = "draft_revision"
    }
}

/// `POST …/publish` → `{ message, published_revision }`.
public struct PublishBusinessPageResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let publishedRevision: Int?

    enum CodingKeys: String, CodingKey {
        case message
        case publishedRevision = "published_revision"
    }
}

// MARK: - Revisions

/// Publisher join on a revision row (`published_by → User`).
public struct BusinessPageRevisionPublisherDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, username, name
        case profilePictureUrl = "profile_picture_url"
    }
}

/// One row of `BusinessPageRevision`.
public struct BusinessPageRevisionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let revision: Int
    public let publishedAt: String?
    public let notes: String?
    public let publisher: BusinessPageRevisionPublisherDTO?

    enum CodingKeys: String, CodingKey {
        case id, revision, notes, publisher
        case publishedAt = "published_at"
    }
}

/// `GET …/revisions` → `{ revisions: [...] }`.
public struct BusinessPageRevisionsResponse: Decodable, Sendable, Hashable {
    public let revisions: [BusinessPageRevisionDTO]
}

/// `POST …/revisions/:rev/restore` → `{ message, restored_revision, draft_revision }`.
public struct RestoreBusinessPageRevisionResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let restoredRevision: Int?
    public let draftRevision: Int?

    enum CodingKeys: String, CodingKey {
        case message
        case restoredRevision = "restored_revision"
        case draftRevision = "draft_revision"
    }
}

// MARK: - Public page-by-slug

/// The `currentPage` object on `GET /api/b/:username/:slug` — the named page
/// plus its published blocks. Route `backend/routes/businessPublicPage.js:217`.
public struct PublicBusinessPageDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let slug: String?
    public let title: String?
    public let description: String?
    public let blocks: [BusinessPageBlockDTO]?

    enum CodingKeys: String, CodingKey {
        case id, slug, title, description, blocks
    }
}

/// `GET /api/b/:username/:slug`. Only the fields the named-page section
/// needs are decoded — the rest of the payload duplicates the profile read.
public struct PublicBusinessPageResponse: Decodable, Sendable, Hashable {
    public let pages: [BusinessPageDTO]?
    public let currentPage: PublicBusinessPageDTO?

    enum CodingKeys: String, CodingKey {
        case pages
        case currentPage
    }
}
