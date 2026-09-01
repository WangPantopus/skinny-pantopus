//
//  ContentDetailContent.swift
//  Pantopus
//
//  Render-only models for the T2.6 Transactional Detail shell.
//  `ContentDetailContent` is a flat description the shell consumes —
//  the per-entity view-models (gig / listing / invoice) project their
//  backend payload into one of these. Modules are an open enum so
//  the backend's jsonb_modules[] can extend the middle section
//  without touching the shell.
//

import Foundation

/// Which entity is being shown. Drives a few subtle treatments — the
/// listing variant gets a full-bleed cover image, the invoice variant
/// gets a full-width pay dock without a secondary button.
public enum ContentDetailKind: String, Sendable, Hashable {
    case gig
    case listing
    case invoice
}

/// Cover image for the listing variant (gradient placeholder + glyph
/// until the first photo loads). Optional — gigs and invoices skip
/// the cover slot.
public struct ContentDetailCover: Sendable, Hashable {
    public let imageUrl: URL?
    public let gradient: ListingGradient
    public let placeholderIcon: PantopusIcon
    public let pageCount: Int
    public let activePage: Int
    /// Sold treatment: desaturates the hero + stamps a tilted SOLD badge.
    public let sold: Bool
    /// Decorative glass action chips overlaid top-right (share / bookmark).
    /// Render-only for now — live wiring lands with the share + save flows.
    public let glassActions: [PantopusIcon]

    public init(
        imageUrl: URL?,
        gradient: ListingGradient,
        placeholderIcon: PantopusIcon,
        pageCount: Int = 1,
        activePage: Int = 0,
        sold: Bool = false,
        glassActions: [PantopusIcon] = []
    ) {
        self.imageUrl = imageUrl
        self.gradient = gradient
        self.placeholderIcon = placeholderIcon
        self.pageCount = pageCount
        self.activePage = activePage
        self.sold = sold
        self.glassActions = glassActions
    }
}

/// Top-of-content status pill — "Open · 4 bids", "Due in 3 days", etc.
public struct ContentDetailPill: Sendable, Hashable, Identifiable {
    public enum Tone: Sendable, Hashable { case info, success, warning, business, neutral, error }

    public let id: String
    public let label: String
    public let icon: PantopusIcon?
    public let tone: Tone

    public init(id: String = UUID().uuidString, label: String, icon: PantopusIcon? = nil, tone: Tone = .info) {
        self.id = id
        self.label = label
        self.icon = icon
        self.tone = tone
    }
}

/// Hero block under the status pill. `subtitle` is the category chip +
/// meta line; `priceLine` is the big number; `priceCaption` is the
/// faded suffix ("budget", "due", etc).
public struct ContentDetailHero: Sendable, Hashable {
    /// Drives the colour of the big price number. `auto` resolves to
    /// `primary600` for listings and `appText` elsewhere; `success`
    /// recolours it green for the invoice paid state.
    public enum PriceTone: Sendable, Hashable { case auto, success }

    public let title: String
    public let categoryChip: ContentDetailCategoryChip?
    public let meta: String?
    public let monoId: String?
    public let priceLine: String?
    public let priceCaption: String?
    public let priceTone: PriceTone
    /// Strikes through the price (listing sold — original asking price).
    public let priceStrikethrough: Bool
    /// Green sale tag rendered next to a struck-through price ("Sold for $385").
    public let saleTag: String?
    /// Right-aligned faded label trailing the price ("paid in full").
    public let priceTrailingLabel: String?
    /// Green check disc rendered after the price (invoice paid).
    public let priceCheckDisc: Bool
    /// Pill row rendered directly under the price (listing condition / pickup / distance).
    public let inlinePills: [ContentDetailPill]

    public init(
        title: String,
        categoryChip: ContentDetailCategoryChip? = nil,
        meta: String? = nil,
        monoId: String? = nil,
        priceLine: String? = nil,
        priceCaption: String? = nil,
        priceTone: PriceTone = .auto,
        priceStrikethrough: Bool = false,
        saleTag: String? = nil,
        priceTrailingLabel: String? = nil,
        priceCheckDisc: Bool = false,
        inlinePills: [ContentDetailPill] = []
    ) {
        self.title = title
        self.categoryChip = categoryChip
        self.meta = meta
        self.monoId = monoId
        self.priceLine = priceLine
        self.priceCaption = priceCaption
        self.priceTone = priceTone
        self.priceStrikethrough = priceStrikethrough
        self.saleTag = saleTag
        self.priceTrailingLabel = priceTrailingLabel
        self.priceCheckDisc = priceCheckDisc
        self.inlinePills = inlinePills
    }
}

/// Small category chip rendered next to the hero subtitle. Re-uses the
/// Gigs category palette (T2.3) so the vocabulary stays consistent.
public struct ContentDetailCategoryChip: Sendable, Hashable {
    public let label: String
    public let category: GigsCategory

    public init(label: String, category: GigsCategory) {
        self.label = label
        self.category = category
    }
}

/// One cell in the 3-up stat strip (gigs). Skipping the strip is fine
/// — empty array hides it.
public struct ContentDetailStat: Sendable, Hashable, Identifiable {
    public let id: String
    public let top: String
    public let bottom: String

    public init(id: String = UUID().uuidString, top: String, bottom: String) {
        self.id = id
        self.top = top
        self.bottom = bottom
    }
}

/// Counterparty card (avatar + name + identity + rating + message
/// button). Used by the listing variant for the seller; gigs surface
/// the bidder list as a module rather than a single counterparty.
public struct ContentDetailCounterparty: Sendable, Hashable {
    public let displayName: String
    public let initials: String
    public let avatarUrl: URL?
    public let identityKind: String? // "personal" | "business" | nil
    public let verified: Bool
    public let rating: Double?
    public let trailing: String?
    public let showsMessageButton: Bool

    public init(
        displayName: String,
        initials: String,
        avatarUrl: URL? = nil,
        identityKind: String?,
        verified: Bool,
        rating: Double?,
        trailing: String?,
        showsMessageButton: Bool = true
    ) {
        self.displayName = displayName
        self.initials = initials
        self.avatarUrl = avatarUrl
        self.identityKind = identityKind
        self.verified = verified
        self.rating = rating
        self.trailing = trailing
        self.showsMessageButton = showsMessageButton
    }
}

/// Trust capsule rendered in a wrap below the hero. Tone matches the
/// status-pill enum.
public typealias ContentDetailTrustCapsule = ContentDetailPill

/// Sticky dock button. `enabled == false` renders the disabled treatment
/// (sunken fill, muted text, no shadow) — used for the awarded gig's
/// "Bidding closed" lock CTA.
public struct ContentDetailDockButton: Sendable, Hashable {
    public let label: String
    public let icon: PantopusIcon?
    public let enabled: Bool

    public init(label: String, icon: PantopusIcon? = nil, enabled: Bool = true) {
        self.label = label
        self.icon = icon
        self.enabled = enabled
    }
}

/// Sticky dock CTA. `secondary == nil` → primary spans full width.
public struct ContentDetailDock: Sendable, Hashable {
    public let secondary: ContentDetailDockButton?
    public let primary: ContentDetailDockButton

    public init(secondary: ContentDetailDockButton? = nil, primary: ContentDetailDockButton) {
        self.secondary = secondary
        self.primary = primary
    }
}

// MARK: - Top-level content

/// Render-only content the shell consumes. The per-entity view-models
/// produce one of these from their backend payload.
public struct ContentDetailContent: Sendable, Hashable {
    public let kind: ContentDetailKind
    public let cover: ContentDetailCover?
    public let statusPill: ContentDetailPill?
    public let hero: ContentDetailHero
    public let statStrip: [ContentDetailStat]
    public let counterparty: ContentDetailCounterparty?
    public let modules: [ContentDetailModule]
    public let trustCapsules: [ContentDetailTrustCapsule]
    public let dock: ContentDetailDock

    public init(
        kind: ContentDetailKind,
        cover: ContentDetailCover? = nil,
        statusPill: ContentDetailPill? = nil,
        hero: ContentDetailHero,
        statStrip: [ContentDetailStat] = [],
        counterparty: ContentDetailCounterparty? = nil,
        modules: [ContentDetailModule] = [],
        trustCapsules: [ContentDetailTrustCapsule] = [],
        dock: ContentDetailDock
    ) {
        self.kind = kind
        self.cover = cover
        self.statusPill = statusPill
        self.hero = hero
        self.statStrip = statStrip
        self.counterparty = counterparty
        self.modules = modules
        self.trustCapsules = trustCapsules
        self.dock = dock
    }
}

/// Render state for the shell. View-models populate one of these.
public enum ContentDetailState: Sendable {
    case loading
    case loaded(ContentDetailContent)
    case error(message: String)
}
