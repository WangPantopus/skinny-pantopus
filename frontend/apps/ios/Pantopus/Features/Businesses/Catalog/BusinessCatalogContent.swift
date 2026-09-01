//
//  BusinessCatalogContent.swift
//  Pantopus
//
//  Render models for the owner catalog manager (A10.7 → Services →
//  "Manage"). Mirrors the React Native `CatalogTab`
//  (`src/components/business/tabs/CatalogTab.tsx`) field-for-field:
//  create / edit / archive items, create / rename / delete categories,
//  and move-up / move-down reorder.
//
//  Android twin: `ui/screens/businesses/catalog/BusinessCatalogContent.kt`.
//

import Foundation

// MARK: - Kinds + statuses

/// `CATALOG_ITEM_KINDS` — `backend/routes/businesses.js:93`.
public enum BusinessCatalogKind: String, CaseIterable, Sendable, Hashable {
    case service
    case product
    case menuItem = "menu_item"
    case classSession = "class"
    case rental
    case membership
    case donation
    case event
    case other

    /// Chip / row label. RN renders `kind.replace('_', ' ')`.
    public var label: String {
        switch self {
        case .service: "Service"
        case .product: "Product"
        case .menuItem: "Menu item"
        case .classSession: "Class"
        case .rental: "Rental"
        case .membership: "Membership"
        case .donation: "Donation"
        case .event: "Event"
        case .other: "Other"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .service: .wrench
        case .product: .package
        case .menuItem: .shoppingBag
        case .classSession: .users
        case .rental: .clock
        case .membership: .star
        case .donation: .heart
        case .event: .calendar
        case .other: .tag
        }
    }

    public static func from(_ raw: String?) -> BusinessCatalogKind {
        guard let raw, let kind = BusinessCatalogKind(rawValue: raw) else { return .service }
        return kind
    }
}

/// `CATALOG_ITEM_STATUSES` — `backend/routes/businesses.js:94`. `archived`
/// never reaches the manager (delete archives, and archived rows are
/// filtered out of the list).
public enum BusinessCatalogStatus: String, Sendable, Hashable {
    case active
    case draft
    case archived
}

// MARK: - Rows

/// One category row in the category manager sheet.
public struct BusinessCatalogCategoryRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let detail: String?

    public init(id: String, name: String, detail: String? = nil) {
        self.id = id
        self.name = name
        self.detail = detail
    }
}

/// One catalog item row. Carries both the rendered strings and the raw
/// values the editor seeds from, so the sheet never re-parses labels.
public struct BusinessCatalogItemRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let kind: BusinessCatalogKind
    public let status: BusinessCatalogStatus
    public let priceCents: Int?
    public let priceMaxCents: Int?
    public let priceUnit: String?
    public let durationMinutes: Int?
    public let isFeatured: Bool
    public let taxDeductible: Bool
    public let suggestedAmounts: [Int]
    public let categoryId: String?
    public let categoryName: String?

    public init(
        id: String,
        name: String,
        description: String? = nil,
        kind: BusinessCatalogKind,
        status: BusinessCatalogStatus,
        priceCents: Int? = nil,
        priceMaxCents: Int? = nil,
        priceUnit: String? = nil,
        durationMinutes: Int? = nil,
        isFeatured: Bool = false,
        taxDeductible: Bool = false,
        suggestedAmounts: [Int] = [],
        categoryId: String? = nil,
        categoryName: String? = nil
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.kind = kind
        self.status = status
        self.priceCents = priceCents
        self.priceMaxCents = priceMaxCents
        self.priceUnit = priceUnit
        self.durationMinutes = durationMinutes
        self.isFeatured = isFeatured
        self.taxDeductible = taxDeductible
        self.suggestedAmounts = suggestedAmounts
        self.categoryId = categoryId
        self.categoryName = categoryName
    }

    /// "Service · 60 min" — the RN sub-line.
    public var metaLabel: String {
        var parts = [kind.label]
        if let durationMinutes, durationMinutes > 0 {
            parts.append("\(durationMinutes) min")
        }
        return parts.joined(separator: " · ")
    }

    /// "$15.00", "$15.00–$40.00/hour", "Open amount" for donations, or
    /// `nil` when the item has no price at all.
    public var priceLabel: String? {
        if kind == .donation { return "Open amount" }
        guard let priceCents else { return nil }
        var label = Self.money(priceCents)
        if let priceMaxCents, priceMaxCents > priceCents {
            label += "–\(Self.money(priceMaxCents))"
        }
        if let priceUnit, !priceUnit.isEmpty {
            label += "/\(priceUnit)"
        }
        return label
    }

    static func money(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100)
    }
}

// MARK: - Draft (editor seed)

/// The editable pose of a catalog item. Strings mirror the text fields so
/// a partially-typed price never has to round-trip through `Int`.
public struct BusinessCatalogItemDraft: Sendable, Hashable {
    public var name: String
    public var description: String
    public var kind: BusinessCatalogKind
    public var priceCents: String
    public var priceMaxCents: String
    public var priceUnit: String
    public var durationMinutes: String
    public var isFeatured: Bool
    public var isDraft: Bool
    public var categoryId: String?

    public init(
        name: String = "",
        description: String = "",
        kind: BusinessCatalogKind = .service,
        priceCents: String = "",
        priceMaxCents: String = "",
        priceUnit: String = "",
        durationMinutes: String = "",
        isFeatured: Bool = false,
        isDraft: Bool = false,
        categoryId: String? = nil
    ) {
        self.name = name
        self.description = description
        self.kind = kind
        self.priceCents = priceCents
        self.priceMaxCents = priceMaxCents
        self.priceUnit = priceUnit
        self.durationMinutes = durationMinutes
        self.isFeatured = isFeatured
        self.isDraft = isDraft
        self.categoryId = categoryId
    }

    /// Seed an editor from an existing row (RN `startEditCatalogItem`).
    public init(row: BusinessCatalogItemRow) {
        self.init(
            name: row.name,
            description: row.description ?? "",
            kind: row.kind,
            priceCents: row.priceCents.map(String.init) ?? "",
            priceMaxCents: row.priceMaxCents.map(String.init) ?? "",
            priceUnit: row.priceUnit ?? "",
            durationMinutes: row.durationMinutes.map(String.init) ?? "",
            isFeatured: row.isFeatured,
            isDraft: row.status == .draft,
            categoryId: row.categoryId
        )
    }

    public var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Donation items reject a fixed price server-side
    /// (`DONATION_NO_FIXED_PRICE`, `backend/routes/businesses.js:2350`),
    /// so the price is nulled rather than sent and 400'd.
    public func asRequest() -> BusinessCatalogItemRequest {
        let isDonation = kind == .donation
        return BusinessCatalogItemRequest(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            kind: kind.rawValue,
            status: (isDraft ? BusinessCatalogStatus.draft : .active).rawValue,
            priceCents: isDonation ? nil : Int(priceCents.trimmingCharacters(in: .whitespaces)),
            priceMaxCents: isDonation ? nil : Int(priceMaxCents.trimmingCharacters(in: .whitespaces)),
            priceUnit: priceUnit.trimmingCharacters(in: .whitespacesAndNewlines),
            durationMinutes: Int(durationMinutes.trimmingCharacters(in: .whitespaces)),
            isFeatured: isFeatured,
            categoryId: categoryId
        )
    }
}

// MARK: - Top-level payload + state

/// Loaded catalog payload — items in `sort_order`, plus the categories the
/// editor's picker offers.
public struct BusinessCatalogContent: Sendable, Hashable {
    public let items: [BusinessCatalogItemRow]
    public let categories: [BusinessCatalogCategoryRow]

    public init(items: [BusinessCatalogItemRow], categories: [BusinessCatalogCategoryRow]) {
        self.items = items
        self.categories = categories
    }
}

/// Four render states for the catalog manager.
public enum BusinessCatalogState: Sendable, Equatable {
    case loading
    /// No items yet — the categories still load so "Add item" can assign one.
    case empty(categories: [BusinessCatalogCategoryRow])
    case loaded(BusinessCatalogContent)
    case error(message: String)

    /// Categories regardless of which loaded-ish state we're in.
    public var categories: [BusinessCatalogCategoryRow] {
        switch self {
        case let .empty(categories): categories
        case let .loaded(content): content.categories
        case .loading, .error: []
        }
    }

    public var items: [BusinessCatalogItemRow] {
        if case let .loaded(content) = self { return content.items }
        return []
    }
}
