//
//  BusinessPageBlockModel.swift
//  Pantopus
//
//  C4 — the typed model behind the business page-block builder. Mirrors RN
//  `src/components/business/blocks/blockRegistry.ts` +
//  `BlockEditor.tsx`'s `BlockData`.
//
//  `BusinessPageBlockKind` is a sum type with an explicit `.unknown(raw:)`
//  case so a block type the backend grows later renders as an inert row
//  instead of crashing the editor, and `data` / `settings` round-trip as raw
//  `JSONValue` maps so saving a page never destroys keys this build doesn't
//  understand.
//

// swiftlint:disable cyclomatic_complexity file_length function_body_length

import Foundation

// MARK: - Kind

/// Block types accepted by `VALID_BLOCK_TYPES`
/// (`backend/routes/businesses.js:85`), plus a graceful `unknown` case.
public enum BusinessPageBlockKind: Sendable, Hashable {
    case hero
    case text
    case gallery
    case catalogGrid
    case hours
    case locationsMap
    case cta
    case faq
    case reviews
    case embed
    case divider
    case stats
    case team
    case contactForm
    case postsFeed
    /// A `block_type` this build doesn't know. Rendered read-only.
    case unknown(raw: String)

    /// Wire value sent back to `PUT …/blocks`.
    public var rawValue: String {
        switch self {
        case .hero: "hero"
        case .text: "text"
        case .gallery: "gallery"
        case .catalogGrid: "catalog_grid"
        case .hours: "hours"
        case .locationsMap: "locations_map"
        case .cta: "cta"
        case .faq: "faq"
        case .reviews: "reviews"
        case .embed: "embed"
        case .divider: "divider"
        case .stats: "stats"
        case .team: "team"
        case .contactForm: "contact_form"
        case .postsFeed: "posts_feed"
        case let .unknown(raw): raw
        }
    }

    public init(rawValue: String) {
        switch rawValue {
        case "hero": self = .hero
        case "text": self = .text
        case "gallery": self = .gallery
        case "catalog_grid": self = .catalogGrid
        case "hours": self = .hours
        case "locations_map": self = .locationsMap
        case "cta": self = .cta
        case "faq": self = .faq
        case "reviews": self = .reviews
        case "embed": self = .embed
        case "divider": self = .divider
        case "stats": self = .stats
        case "team": self = .team
        case "contact_form": self = .contactForm
        case "posts_feed": self = .postsFeed
        default: self = .unknown(raw: rawValue)
        }
    }

    /// Order of the "Add block" picker — matches RN's registry order.
    public static let pickable: [BusinessPageBlockKind] = [
        .hero, .text, .gallery, .catalogGrid, .hours, .locationsMap, .cta,
        .faq, .reviews, .stats, .team, .contactForm, .embed, .postsFeed, .divider
    ]
}

// MARK: - Registry

/// Label / icon / description / seed data for one block kind.
public struct BusinessPageBlockRegistryEntry: Sendable, Hashable {
    public let label: String
    public let icon: PantopusIcon
    public let summary: String
    public let defaultData: [String: JSONValue]
}

public enum BusinessPageBlockRegistry {
    /// Registry entry for a kind. Unknown kinds fall back to a neutral
    /// package glyph labelled with the raw type — the RN behaviour.
    public static func entry(for kind: BusinessPageBlockKind) -> BusinessPageBlockRegistryEntry {
        switch kind {
        case .hero:
            BusinessPageBlockRegistryEntry(
                label: "Hero",
                icon: .image,
                summary: "Full-width banner with headline and CTAs",
                defaultData: ["headline": .string(""), "subhead": .string(""), "cta": .array([])]
            )
        case .text:
            BusinessPageBlockRegistryEntry(
                label: "Text",
                icon: .fileText,
                summary: "Heading and body text section",
                defaultData: ["heading": .string(""), "body": .string("")]
            )
        case .gallery:
            BusinessPageBlockRegistryEntry(
                label: "Gallery",
                icon: .camera,
                summary: "Image gallery display",
                defaultData: [
                    "heading": .string("Gallery"),
                    "images": .array([]),
                    "image_count": .number(6)
                ]
            )
        case .catalogGrid:
            BusinessPageBlockRegistryEntry(
                label: "Catalog",
                icon: .grid3x3,
                summary: "Product or service catalog grid",
                defaultData: [
                    "heading": .string("Our Services"),
                    "filter_kind": .string(""),
                    "max_items": .number(8)
                ]
            )
        case .hours:
            BusinessPageBlockRegistryEntry(
                label: "Hours",
                icon: .clock,
                summary: "Business hours from your locations",
                defaultData: ["heading": .string("Business Hours")]
            )
        case .locationsMap:
            BusinessPageBlockRegistryEntry(
                label: "Locations",
                icon: .mapPin,
                summary: "Map of your business locations",
                defaultData: ["heading": .string("Our Locations")]
            )
        case .cta:
            BusinessPageBlockRegistryEntry(
                label: "Call to Action",
                icon: .megaphone,
                summary: "Section with buttons and actions",
                defaultData: [
                    "heading": .string("Ready to get started?"),
                    "subhead": .string(""),
                    "buttons": .array([
                        .object(["label": .string("Contact Us"), "action": .string("message")])
                    ])
                ]
            )
        case .faq:
            BusinessPageBlockRegistryEntry(
                label: "FAQ",
                icon: .helpCircle,
                summary: "Frequently asked questions",
                defaultData: [
                    "heading": .string("FAQ"),
                    "items": .array([.object(["q": .string(""), "a": .string("")])])
                ]
            )
        case .reviews:
            BusinessPageBlockRegistryEntry(
                label: "Reviews",
                icon: .star,
                summary: "Customer reviews from your profile",
                defaultData: ["heading": .string("Customer Reviews")]
            )
        case .stats:
            BusinessPageBlockRegistryEntry(
                label: "Stats",
                icon: .barChart3,
                summary: "Key numbers and statistics",
                defaultData: [
                    "stats": .array([
                        .object(["label": .string("Customers"), "value": .string("1,000+")])
                    ])
                ]
            )
        case .team:
            BusinessPageBlockRegistryEntry(
                label: "Team",
                icon: .usersRound,
                summary: "Team members from your settings",
                defaultData: ["heading": .string("Our Team")]
            )
        case .contactForm:
            BusinessPageBlockRegistryEntry(
                label: "Contact Form",
                icon: .mail,
                summary: "Contact form sent to your email",
                defaultData: ["heading": .string("Contact Us")]
            )
        case .embed:
            BusinessPageBlockRegistryEntry(
                label: "Embed",
                icon: .externalLink,
                summary: "YouTube, Vimeo, Google Maps, etc.",
                defaultData: ["url": .string("")]
            )
        case .postsFeed:
            BusinessPageBlockRegistryEntry(
                label: "Pulse",
                icon: .rss,
                summary: "Recent posts and updates",
                defaultData: ["heading": .string("Latest Updates"), "max_items": .number(5)]
            )
        case .divider:
            BusinessPageBlockRegistryEntry(
                label: "Divider",
                icon: .minus,
                summary: "Horizontal separator",
                defaultData: [:]
            )
        case let .unknown(raw):
            BusinessPageBlockRegistryEntry(
                label: raw,
                icon: .package,
                summary: "",
                defaultData: [:]
            )
        }
    }
}

// MARK: - Editor form shape

/// Which field set the block editor sheet renders. A sum type so an unknown
/// block type lands on `.unsupported` instead of a crash.
public enum BusinessPageBlockForm: Sendable, Hashable {
    case hero
    case text
    case gallery
    case catalog
    case cta
    case faq
    case stats
    case embed
    case postsFeed
    /// Blocks whose body is server-derived — only a heading is editable.
    case headingOnly(hint: String)
    /// No editable fields (divider).
    case note(String)
    case unsupported(type: String)

    public init(kind: BusinessPageBlockKind) {
        switch kind {
        case .hero: self = .hero
        case .text: self = .text
        case .gallery: self = .gallery
        case .catalogGrid: self = .catalog
        case .cta: self = .cta
        case .faq: self = .faq
        case .stats: self = .stats
        case .embed: self = .embed
        case .postsFeed: self = .postsFeed
        case .hours: self = .headingOnly(hint: "Hours data is pulled from your business locations")
        case .locationsMap: self = .headingOnly(hint: "Locations are pulled from your business settings")
        case .reviews: self = .headingOnly(hint: "Reviews are automatically pulled from your profile")
        case .team: self = .headingOnly(hint: "Team members are pulled from your team settings")
        case .contactForm: self = .headingOnly(hint: "Messages will be sent to your business email")
        case .divider: self = .note("A horizontal separator between sections. No settings needed.")
        case let .unknown(raw): self = .unsupported(type: raw)
        }
    }
}

// MARK: - Block

/// A page block as the editor holds it. `data` / `settings` stay raw so
/// unrecognised keys survive the round-trip through `PUT …/blocks`.
public struct BusinessPageBlock: Sendable, Hashable, Identifiable {
    /// Server id, nil for a block added in this session.
    public let serverId: String?
    /// Stable identity for `ForEach` (server id, else a local uuid).
    public let localId: String
    public var kind: BusinessPageBlockKind
    public var schemaVersion: Int
    public var sortOrder: Int
    public var data: [String: JSONValue]
    public var settings: [String: JSONValue]
    public var locationId: String?
    public var showFrom: String?
    public var showUntil: String?
    public var isVisible: Bool

    public var id: String {
        localId
    }

    public init(
        serverId: String?,
        localId: String = UUID().uuidString,
        kind: BusinessPageBlockKind,
        schemaVersion: Int = 1,
        sortOrder: Int,
        data: [String: JSONValue],
        settings: [String: JSONValue] = [:],
        locationId: String? = nil,
        showFrom: String? = nil,
        showUntil: String? = nil,
        isVisible: Bool = true
    ) {
        self.serverId = serverId
        self.localId = localId
        self.kind = kind
        self.schemaVersion = schemaVersion
        self.sortOrder = sortOrder
        self.data = data
        self.settings = settings
        self.locationId = locationId
        self.showFrom = showFrom
        self.showUntil = showUntil
        self.isVisible = isVisible
    }

    /// Decode from the wire. Missing `sort_order` falls back to the index,
    /// matching RN's `b.sort_order ?? i`.
    public init(dto: BusinessPageBlockDTO, index: Int) {
        self.init(
            serverId: dto.id,
            localId: dto.id ?? UUID().uuidString,
            kind: BusinessPageBlockKind(rawValue: dto.blockType),
            schemaVersion: dto.schemaVersion ?? 1,
            sortOrder: dto.sortOrder ?? index,
            data: dto.data ?? [:],
            settings: dto.settings ?? [:],
            locationId: dto.locationId,
            showFrom: dto.showFrom,
            showUntil: dto.showUntil,
            isVisible: dto.isVisible != false
        )
    }

    /// Seed a brand-new block of `kind` from the registry defaults.
    public static func newBlock(kind: BusinessPageBlockKind, sortOrder: Int) -> BusinessPageBlock {
        BusinessPageBlock(
            serverId: nil,
            kind: kind,
            sortOrder: sortOrder,
            data: BusinessPageBlockRegistry.entry(for: kind).defaultData
        )
    }

    /// Request element for `PUT …/blocks`. Empty strings are kept — the Joi
    /// schema only requires `data` to be an object.
    public func saveRequest(sortOrder: Int) -> SaveBusinessPageBlockRequest {
        SaveBusinessPageBlockRequest(
            blockType: kind.rawValue,
            schemaVersion: schemaVersion,
            sortOrder: sortOrder,
            data: data,
            settings: settings,
            locationId: locationId,
            showFrom: showFrom,
            showUntil: showUntil,
            isVisible: isVisible
        )
    }

    // MARK: Typed reads over the raw `data` map

    public var heading: String {
        string("heading")
    }

    public var headline: String {
        string("headline")
    }

    public var subhead: String {
        string("subhead")
    }

    public var body: String {
        string("body")
    }

    public var url: String {
        string("url")
    }

    public var filterKind: String {
        string("filter_kind")
    }

    public var imageCount: Int {
        int("image_count") ?? 6
    }

    public var maxItems: Int {
        int("max_items") ?? 8
    }

    /// `[{ label, action }]` used by hero (`cta`) and CTA (`buttons`).
    public func buttonList(key: String) -> [BusinessPageBlockButton] {
        (data[key]?.arrayValue ?? []).map { value in
            let dict = value.dictValue ?? [:]
            return BusinessPageBlockButton(
                label: dict["label"]?.stringValue ?? "",
                action: dict["action"]?.stringValue ?? "message"
            )
        }
    }

    /// `[{ q, a }]` for the FAQ block.
    public var faqItems: [BusinessPageBlockFaqItem] {
        (data["items"]?.arrayValue ?? []).map { value in
            let dict = value.dictValue ?? [:]
            return BusinessPageBlockFaqItem(
                question: dict["q"]?.stringValue ?? "",
                answer: dict["a"]?.stringValue ?? ""
            )
        }
    }

    /// `[{ label, value }]` for the stats block.
    public var stats: [BusinessPageBlockStat] {
        (data["stats"]?.arrayValue ?? []).map { value in
            let dict = value.dictValue ?? [:]
            return BusinessPageBlockStat(
                label: dict["label"]?.stringValue ?? "",
                value: dict["value"]?.stringValue ?? ""
            )
        }
    }

    /// One-line summary under the block title in the builder list. Mirrors
    /// RN `blockPreviewText`.
    public var summaryLine: String {
        switch kind {
        case .hero:
            headline.isEmpty ? "No headline" : headline
        case .text:
            if !heading.isEmpty { heading } else if !body.isEmpty { String(body.prefix(40)) } else { "No content" }
        case .gallery:
            heading.isEmpty ? "\(imageCount) images" : heading
        case .catalogGrid:
            heading.isEmpty ? "\(maxItems) items" : heading
        case .cta:
            heading.isEmpty ? "No heading" : heading
        case .faq:
            "\(faqItems.count) questions"
        case .stats:
            "\(stats.count) stats"
        case .embed:
            url.isEmpty ? "No URL" : url
        case .postsFeed:
            heading.isEmpty ? "\(int("max_items") ?? 5) posts" : heading
        case .divider:
            "Separator"
        case .hours, .locationsMap, .reviews, .team, .contactForm:
            heading.isEmpty ? BusinessPageBlockRegistry.entry(for: kind).label : heading
        case let .unknown(raw):
            heading.isEmpty ? raw : heading
        }
    }

    private func string(_ key: String) -> String {
        data[key]?.stringValue ?? ""
    }

    private func int(_ key: String) -> Int? {
        if let number = data[key]?.numberValue { return Int(number) }
        if let text = data[key]?.stringValue { return Int(text) }
        return nil
    }
}

/// A CTA / hero button pair.
public struct BusinessPageBlockButton: Sendable, Hashable {
    public var label: String
    public var action: String

    public init(label: String, action: String) {
        self.label = label
        self.action = action
    }

    public var json: JSONValue {
        .object(["label": .string(label), "action": .string(action)])
    }
}

/// One FAQ question/answer pair.
public struct BusinessPageBlockFaqItem: Sendable, Hashable {
    public var question: String
    public var answer: String

    public init(question: String, answer: String) {
        self.question = question
        self.answer = answer
    }

    public var json: JSONValue {
        .object(["q": .string(question), "a": .string(answer)])
    }
}

/// One stat tile.
public struct BusinessPageBlockStat: Sendable, Hashable {
    public var label: String
    public var value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }

    public var json: JSONValue {
        .object(["label": .string(label), "value": .string(value)])
    }
}

// MARK: - Option lists (mirror RN blockRegistry.ts)

public enum BusinessPageBlockOptions {
    public static let catalogFilterKinds: [(key: String, label: String)] = [
        ("", "All Items"),
        ("service", "Services"),
        ("product", "Products"),
        ("menu_item", "Menu Items"),
        ("class", "Classes"),
        ("rental", "Rentals")
    ]

    public static let ctaActions: [(key: String, label: String)] = [
        ("message", "Send Message"),
        ("call", "Call"),
        ("directions", "Get Directions"),
        ("link", "Open Link"),
        ("book", "Book Now")
    ]

    public static let padding: [(key: String, label: String)] = [
        ("none", "None"),
        ("small", "Small"),
        ("default", "Default"),
        ("large", "Large")
    ]

    public static let background: [(key: String, label: String)] = [
        ("default", "White"),
        ("gray", "Gray"),
        ("brand", "Brand"),
        ("transparent", "Transparent")
    ]
}
