//
//  ContentDetailModules.swift
//  Pantopus
//
//  Module-payload models for the T2.6 / A09 Transactional Detail shell.
//  Split out of `ContentDetailContent.swift` (which keeps the top-level
//  `ContentDetailContent` + chrome models) to stay under the file-length
//  limit. The `ContentDetailModule` enum is open so the backend's
//  `jsonb_modules[]` can extend the variable middle section without
//  touching the shell.
//

import Foundation

// MARK: - Module variants

/// One row in the variable middle section. Open enum so the
/// backend's `jsonb_modules[]` can extend without touching the shell.
public enum ContentDetailModule: Sendable, Hashable, Identifiable {
    case description(ContentDetailDescription)
    case detailRow(ContentDetailDetailRow)
    case captionedText(ContentDetailCaptionedText)
    case twoStop(ContentDetailTwoStop)
    case photoStrip(ContentDetailPhotoStrip)
    case capsuleRow(ContentDetailCapsuleRow)
    case detailsGrid(ContentDetailDetailsGrid)
    case similarItems(ContentDetailSimilarStrip)
    case bids(ContentDetailBidsModule)
    case callout(ContentDetailCallout)
    case fromTo(ContentDetailFromTo)
    case lineItems(ContentDetailLineItems)
    case summary(ContentDetailSummary)
    case locationMap(ContentDetailLocationMap)

    public var id: String {
        switch self {
        case let .description(m): "description_\(m.title)"
        case let .detailRow(m): "detail_\(m.title)"
        case let .captionedText(m): "caption_\(m.title)"
        case let .twoStop(m): "twostop_\(m.title)"
        case let .photoStrip(m): "photos_\(m.title)"
        case let .capsuleRow(m): "capsules_\(m.id)"
        case let .detailsGrid(m): "details_\(m.title)"
        case let .similarItems(m): "similar_\(m.title)"
        case let .bids(m): "bids_\(m.title)"
        case let .callout(m): "callout_\(m.identifier)"
        case let .fromTo(m): "fromto_\(m.from.name)"
        case let .lineItems(m): "lineitems_\(m.title)"
        case .summary: "summary"
        case .locationMap: "location_map"
        }
    }
}

/// Long paragraph with section title. Used for gigs "What needs doing"
/// and listings "Description".
public struct ContentDetailDescription: Sendable, Hashable {
    public let title: String
    public let icon: PantopusIcon?
    public let body: String

    public init(title: String, icon: PantopusIcon?, body: String) {
        self.title = title
        self.icon = icon
        self.body = body
    }
}

/// One-line row with map-pin / icon and trailing label (e.g. "Where").
public struct ContentDetailDetailRow: Sendable, Hashable {
    public let title: String
    public let sectionIcon: PantopusIcon?
    public let rowIcon: PantopusIcon
    public let label: String
    public let trailing: String?

    public init(title: String, sectionIcon: PantopusIcon?, rowIcon: PantopusIcon, label: String, trailing: String?) {
        self.title = title
        self.sectionIcon = sectionIcon
        self.rowIcon = rowIcon
        self.label = label
        self.trailing = trailing
    }
}

/// Free-text caption ("Sat Nov 9 — Sun Nov 10 · flexible morning").
public struct ContentDetailCaptionedText: Sendable, Hashable {
    public let title: String
    public let icon: PantopusIcon?
    public let label: String

    public init(title: String, icon: PantopusIcon?, label: String) {
        self.title = title
        self.icon = icon
        self.label = label
    }
}

/// Two-stop pickup → drop-off card (Magic Task V2). A/B discs over a
/// muted card with a connector line. Used by the gig V2 "Pickup → drop-off"
/// module.
public struct ContentDetailTwoStop: Sendable, Hashable {
    public enum StopTone: Sendable, Hashable { case primary, success }

    public struct Stop: Sendable, Hashable, Identifiable {
        public let id: String
        public let letter: String
        public let tone: StopTone
        public let address: String
        public let distance: String?

        public init(id: String = UUID().uuidString, letter: String, tone: StopTone, address: String, distance: String?) {
            self.id = id
            self.letter = letter
            self.tone = tone
            self.address = address
            self.distance = distance
        }
    }

    public let title: String
    public let icon: PantopusIcon?
    public let stops: [Stop]

    public init(title: String, icon: PantopusIcon? = .mapPin, stops: [Stop]) {
        self.title = title
        self.icon = icon
        self.stops = stops
    }
}

/// Interactive mini map for task location — tap to open a full-screen
/// explorer with pan and zoom (mirrors the RN / web gig detail map).
public struct ContentDetailLocationMap: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    /// When true, render a ~500m privacy circle instead of an exact pin.
    public let isApproximate: Bool
    public let footnote: String
    public let category: GigsCategory

    public init(
        latitude: Double,
        longitude: Double,
        isApproximate: Bool,
        footnote: String,
        category: GigsCategory
    ) {
        self.latitude = latitude
        self.longitude = longitude
        self.isApproximate = isApproximate
        self.footnote = footnote
        self.category = category
    }
}

/// Inline wrap of trust/status capsules placed mid-flow (gig V2 trust
/// row sits between the photo strip and the bid list).
public struct ContentDetailCapsuleRow: Sendable, Hashable {
    public let id: String
    public let capsules: [ContentDetailPill]

    public init(id: String = "trust", capsules: [ContentDetailPill]) {
        self.id = id
        self.capsules = capsules
    }
}

/// Key/value detail grid (listing "Details" — Brand / Frame size / …).
public struct ContentDetailDetailsGrid: Sendable, Hashable {
    public struct Row: Sendable, Hashable, Identifiable {
        public let id: String
        public let key: String
        public let value: String

        public init(id: String = UUID().uuidString, key: String, value: String) {
            self.id = id
            self.key = key
            self.value = value
        }
    }

    public let title: String
    public let icon: PantopusIcon?
    public let rows: [Row]

    public init(title: String, icon: PantopusIcon? = .info, rows: [Row]) {
        self.title = title
        self.icon = icon
        self.rows = rows
    }
}

/// Flexible callout card. Covers the awarded banner, the Pantopus Pay
/// receipt capsule, the "Alert me when similar appears" row, and the
/// no-bids "Be the first to bid" empty capsule.
public struct ContentDetailCallout: Sendable, Hashable {
    /// `banner` is a leading-icon row; `empty` is a centred dashed capsule.
    public enum Style: Sendable, Hashable { case banner, empty }
    /// Card background / border family.
    public enum Tone: Sendable, Hashable { case success, neutral, dashed }
    /// Leading icon disc treatment.
    public enum IconTone: Sendable, Hashable { case success, successOutline, primary }

    public let identifier: String
    public let style: Style
    public let tone: Tone
    public let icon: PantopusIcon
    public let iconTone: IconTone
    public let title: String
    public let subtitle: String?
    public let subtitleMono: Bool
    public let trailingActionLabel: String?
    public let footerPill: String?

    public init(
        identifier: String,
        style: Style = .banner,
        tone: Tone = .success,
        icon: PantopusIcon,
        iconTone: IconTone = .success,
        title: String,
        subtitle: String? = nil,
        subtitleMono: Bool = false,
        trailingActionLabel: String? = nil,
        footerPill: String? = nil
    ) {
        self.identifier = identifier
        self.style = style
        self.tone = tone
        self.icon = icon
        self.iconTone = iconTone
        self.title = title
        self.subtitle = subtitle
        self.subtitleMono = subtitleMono
        self.trailingActionLabel = trailingActionLabel
        self.footerPill = footerPill
    }
}

/// Horizontal strip of square gradient tiles (no real images yet).
public struct ContentDetailPhotoStrip: Sendable, Hashable {
    public let title: String
    public let icon: PantopusIcon?
    public let countLabel: String?
    public let tiles: [ContentDetailPhotoTile]

    public init(title: String, icon: PantopusIcon? = .camera, countLabel: String? = nil, tiles: [ContentDetailPhotoTile]) {
        self.title = title
        self.icon = icon
        self.countLabel = countLabel
        self.tiles = tiles
    }
}

public struct ContentDetailPhotoTile: Sendable, Hashable, Identifiable {
    public let id: String
    public let gradient: ListingGradient
    public let icon: PantopusIcon
    /// Real attachment image. When set the tile renders the photo and
    /// falls back to the gradient + glyph while loading / on failure.
    public let imageURL: URL?

    public init(
        id: String = UUID().uuidString,
        gradient: ListingGradient,
        icon: PantopusIcon,
        imageURL: URL? = nil
    ) {
        self.id = id
        self.gradient = gradient
        self.icon = icon
        self.imageURL = imageURL
    }
}

/// Horizontal carousel of similar items (listing detail).
public struct ContentDetailSimilarStrip: Sendable, Hashable {
    public let title: String
    public let sub: String?
    public let items: [ContentDetailSimilarItem]

    public init(title: String, sub: String? = nil, items: [ContentDetailSimilarItem]) {
        self.title = title
        self.sub = sub
        self.items = items
    }
}

public struct ContentDetailSimilarItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let price: String
    public let gradient: ListingGradient

    public init(id: String, title: String, price: String, gradient: ListingGradient) {
        self.id = id
        self.title = title
        self.price = price
        self.gradient = gradient
    }
}

/// Bid list (gig detail, owner-only — empty array hides the section).
/// `sub` carries the low/high range (open) or "closed" (awarded).
public struct ContentDetailBidsModule: Sendable, Hashable {
    public let title: String
    public let sub: String?
    public let bids: [ContentDetailBidRow]

    public init(title: String, sub: String? = nil, bids: [ContentDetailBidRow]) {
        self.title = title
        self.sub = sub
        self.bids = bids
    }
}

public struct ContentDetailBidRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let initials: String
    public let displayName: String
    public let avatarColor: String
    public let ratingLine: String
    public let amount: String
    public let verified: Bool
    /// Optional tag pill ("fastest reply" / "has van" — V2; "Winner" is
    /// derived from `won`).
    public let tag: String?
    /// Winning bid in the awarded state — green row tint + Winner pill +
    /// green amount.
    public let won: Bool
    /// Losing bid in the awarded state — 55% opacity + struck-through amount.
    public let dimmed: Bool

    public init(
        id: String,
        initials: String,
        displayName: String,
        avatarColor: String,
        ratingLine: String,
        amount: String,
        verified: Bool,
        tag: String? = nil,
        won: Bool = false,
        dimmed: Bool = false
    ) {
        self.id = id
        self.initials = initials
        self.displayName = displayName
        self.avatarColor = avatarColor
        self.ratingLine = ratingLine
        self.amount = amount
        self.verified = verified
        self.tag = tag
        self.won = won
        self.dimmed = dimmed
    }
}

/// Invoice-only — two side-by-side party cards (From / To).
public struct ContentDetailFromTo: Sendable, Hashable {
    public let from: ContentDetailParty
    public let to: ContentDetailParty

    public init(from: ContentDetailParty, to: ContentDetailParty) {
        self.from = from
        self.to = to
    }
}

public struct ContentDetailParty: Sendable, Hashable {
    public enum Accent: Sendable, Hashable { case business, personal, neutral }

    public let label: String
    public let name: String
    public let sub: String
    public let accent: Accent

    public init(label: String, name: String, sub: String, accent: Accent) {
        self.label = label
        self.name = name
        self.sub = sub
        self.accent = accent
    }
}

/// Invoice-only — line items table. Per the A09.4 design the fees/tax
/// block and the grand-total row live in a muted footer *inside* this
/// same card, so they're modelled here rather than as a separate summary.
public struct ContentDetailLineItems: Sendable, Hashable {
    public enum TotalTone: Sendable, Hashable { case primary, success }

    public let title: String
    public let icon: PantopusIcon?
    public let rows: [ContentDetailLineItem]
    public let fees: [ContentDetailSummaryRow]
    public let totalLabel: String?
    public let totalValue: String?
    public let totalTone: TotalTone

    public init(
        title: String,
        icon: PantopusIcon? = .file,
        rows: [ContentDetailLineItem],
        fees: [ContentDetailSummaryRow] = [],
        totalLabel: String? = nil,
        totalValue: String? = nil,
        totalTone: TotalTone = .primary
    ) {
        self.title = title
        self.icon = icon
        self.rows = rows
        self.fees = fees
        self.totalLabel = totalLabel
        self.totalValue = totalValue
        self.totalTone = totalTone
    }
}

public struct ContentDetailLineItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let item: String
    public let qty: String
    public let unit: String
    public let total: String

    public init(id: String = UUID().uuidString, item: String, qty: String, unit: String, total: String) {
        self.id = id
        self.item = item
        self.qty = qty
        self.unit = unit
        self.total = total
    }
}

/// Invoice-only — subtotal / tax / total summary card. `totalTone`
/// recolours the total (success green when paid).
public struct ContentDetailSummary: Sendable, Hashable {
    public enum TotalTone: Sendable, Hashable { case primary, success }

    public let rows: [ContentDetailSummaryRow]
    public let totalLabel: String
    public let totalValue: String
    public let totalTone: TotalTone

    public init(rows: [ContentDetailSummaryRow], totalLabel: String, totalValue: String, totalTone: TotalTone = .primary) {
        self.rows = rows
        self.totalLabel = totalLabel
        self.totalValue = totalValue
        self.totalTone = totalTone
    }
}

public struct ContentDetailSummaryRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let value: String

    public init(id: String = UUID().uuidString, label: String, value: String) {
        self.id = id
        self.label = label
        self.value = value
    }
}
