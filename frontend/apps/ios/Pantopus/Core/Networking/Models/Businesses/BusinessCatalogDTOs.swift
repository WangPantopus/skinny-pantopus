//
//  BusinessCatalogDTOs.swift
//  Pantopus
//
//  Wire models for owner-side catalog management — categories + items +
//  reorder. The read-only `BusinessCatalogItemDTO` in `BusinessDTOs.swift`
//  is the *public* projection (name / price / featured) used by the
//  Services tab; the owner catalog manager needs the editable columns
//  too (`status`, `sort_order`, `category_id`, `duration_minutes`), so it
//  decodes the same rows through `BusinessCatalogManagedItemDTO`.
//
//  Routes (all under `backend/routes/businesses.js`):
//    · categories  GET 2247 · POST 2215 · PATCH 2277 · DELETE 2308
//    · items       GET 2386 · POST 2339 · PATCH 2425 · DELETE 2469
//    · reorder     POST 2504
//

import Foundation

// MARK: - Categories

/// One `BusinessCatalogCategory` row. Soft-deleted rows come back with
/// `is_active = false`; the list endpoint already filters them out.
public struct BusinessCatalogCategoryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let slug: String?
    public let sortOrder: Int?
    public let isActive: Bool?

    public init(
        id: String,
        name: String,
        description: String? = nil,
        slug: String? = nil,
        sortOrder: Int? = nil,
        isActive: Bool? = nil
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.slug = slug
        self.sortOrder = sortOrder
        self.isActive = isActive
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, description, slug
        case sortOrder = "sort_order"
        case isActive = "is_active"
    }
}

/// `GET /api/businesses/:businessId/catalog/categories` envelope.
/// Route `backend/routes/businesses.js:2247`.
public struct BusinessCatalogCategoriesResponse: Decodable, Sendable, Hashable {
    public let categories: [BusinessCatalogCategoryDTO]

    private enum CodingKeys: String, CodingKey {
        case categories
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        categories = try c.decodeIfPresent([BusinessCatalogCategoryDTO].self, forKey: .categories) ?? []
    }
}

/// `POST` / `PATCH` category envelope — `{ category }`.
/// Routes `backend/routes/businesses.js:2215` + `:2277`.
public struct BusinessCatalogCategoryResponse: Decodable, Sendable, Hashable {
    public let category: BusinessCatalogCategoryDTO?
}

/// Body for category create / rename. `createCategorySchema`
/// (`backend/routes/businesses.js:226`) accepts snake_case
/// `name / description / slug / sort_order`; nils are dropped so a rename
/// never clears the description.
public struct BusinessCatalogCategoryRequest: Encodable, Sendable, Hashable {
    public let name: String?
    public let description: String?
    public let sortOrder: Int?

    public init(name: String? = nil, description: String? = nil, sortOrder: Int? = nil) {
        self.name = name
        self.description = description
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case name, description
        case sortOrder = "sort_order"
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(sortOrder, forKey: .sortOrder)
    }
}

// MARK: - Items

/// Nested `category:category_id (id, name, slug)` join emitted by the
/// owner item list. Route `backend/routes/businesses.js:2400`.
public struct BusinessCatalogItemCategoryRefDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let name: String?
    public let slug: String?
}

/// The owner-editable projection of a `BusinessCatalogItem` row.
public struct BusinessCatalogManagedItemDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let kind: String?
    public let status: String?
    public let priceCents: Int?
    public let priceMaxCents: Int?
    public let priceUnit: String?
    public let currency: String?
    public let durationMinutes: Int?
    public let isFeatured: Bool?
    public let taxDeductible: Bool?
    public let suggestedAmounts: [Int]?
    public let sortOrder: Int?
    public let categoryId: String?
    public let category: BusinessCatalogItemCategoryRefDTO?

    private enum CodingKeys: String, CodingKey {
        case id, name, description, kind, status, currency, category
        case priceCents = "price_cents"
        case priceMaxCents = "price_max_cents"
        case priceUnit = "price_unit"
        case durationMinutes = "duration_minutes"
        case isFeatured = "is_featured"
        case taxDeductible = "tax_deductible"
        case suggestedAmounts = "suggested_amounts"
        case sortOrder = "sort_order"
        case categoryId = "category_id"
    }
}

/// `GET /api/businesses/:businessId/catalog/items` envelope decoded with
/// the owner-editable row shape. Route `backend/routes/businesses.js:2386`.
public struct BusinessCatalogManagedItemsResponse: Decodable, Sendable, Hashable {
    public let items: [BusinessCatalogManagedItemDTO]

    private enum CodingKeys: String, CodingKey {
        case items
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decodeIfPresent([BusinessCatalogManagedItemDTO].self, forKey: .items) ?? []
    }
}

/// `POST` / `PATCH` item envelope — `{ item }`.
/// Routes `backend/routes/businesses.js:2339` + `:2425`.
public struct BusinessCatalogItemEnvelope: Decodable, Sendable, Hashable {
    public let item: BusinessCatalogManagedItemDTO?
}

/// Body for item create / update. Mirrors `createCatalogItemSchema`
/// (`backend/routes/businesses.js:233`) — snake_case keys.
///
/// The catalog editor is a *full-form* editor: every key it owns is always
/// sent, and a cleared field goes out as an explicit JSON `null` (which the
/// schema allows) so clearing a price / duration / category actually
/// sticks. Android serialises the identical shape through
/// `BusinessCatalogItemRequestJsonAdapter`.
public struct BusinessCatalogItemRequest: Encodable, Sendable, Hashable {
    public let name: String
    public let description: String?
    public let kind: String
    public let status: String
    public let priceCents: Int?
    public let priceMaxCents: Int?
    public let priceUnit: String?
    public let durationMinutes: Int?
    public let isFeatured: Bool
    public let categoryId: String?

    public init(
        name: String,
        description: String?,
        kind: String,
        status: String,
        priceCents: Int?,
        priceMaxCents: Int?,
        priceUnit: String?,
        durationMinutes: Int?,
        isFeatured: Bool,
        categoryId: String?
    ) {
        self.name = name
        self.description = description
        self.kind = kind
        self.status = status
        self.priceCents = priceCents
        self.priceMaxCents = priceMaxCents
        self.priceUnit = priceUnit
        self.durationMinutes = durationMinutes
        self.isFeatured = isFeatured
        self.categoryId = categoryId
    }

    private enum CodingKeys: String, CodingKey {
        case name, description, kind, status
        case priceCents = "price_cents"
        case priceMaxCents = "price_max_cents"
        case priceUnit = "price_unit"
        case durationMinutes = "duration_minutes"
        case isFeatured = "is_featured"
        case categoryId = "category_id"
    }

    /// Explicit — the synthesized encoder would `encodeIfPresent` the
    /// optionals and silently drop the nulls that clear a field.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(description, forKey: .description)
        try container.encode(kind, forKey: .kind)
        try container.encode(status, forKey: .status)
        try container.encode(priceCents, forKey: .priceCents)
        try container.encode(priceMaxCents, forKey: .priceMaxCents)
        try container.encode(priceUnit, forKey: .priceUnit)
        try container.encode(durationMinutes, forKey: .durationMinutes)
        try container.encode(isFeatured, forKey: .isFeatured)
        try container.encode(categoryId, forKey: .categoryId)
    }
}

// MARK: - Reorder

/// One `{ id, sort_order }` pair in the reorder body.
public struct BusinessCatalogReorderEntry: Encodable, Sendable, Hashable {
    public let id: String
    public let sortOrder: Int

    public init(id: String, sortOrder: Int) {
        self.id = id
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case sortOrder = "sort_order"
    }
}

/// `POST …/catalog/items/reorder` body — `{ items: [{ id, sort_order }] }`.
/// Route `backend/routes/businesses.js:2504`.
public struct BusinessCatalogReorderRequest: Encodable, Sendable, Hashable {
    public let items: [BusinessCatalogReorderEntry]

    public init(items: [BusinessCatalogReorderEntry]) {
        self.items = items
    }
}
