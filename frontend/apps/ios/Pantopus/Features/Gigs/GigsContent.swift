//
//  GigsContent.swift
//  Pantopus
//
//  Render-only content models the Gigs feed view consumes. The
//  view-model projects `GigDTO` into `GigCardContent` so the view never
//  reaches into the network DTO.
//

import Foundation

/// One row in the populated feed.
public struct GigCardContent: Identifiable, Sendable, Hashable {
    public let id: String
    public let category: GigsCategory
    /// "0.2mi · 2h ago" — composed meta line up top, optional pieces.
    public let metaLine: String
    public let title: String
    public let body: String
    /// Free-form price string: "$60", "$22 / walk".
    public let price: String
    /// Bid count when the source payload carries one. `nil` (browse rows)
    /// hides both the amber pill and the "Be the first" affordance.
    public let bidCount: Int?
    /// Right-aligned distance label ("0.2mi"). `nil` hides the row.
    public let distanceLabel: String?
    /// Amber "URGENT" chip next to the category badge.
    public let isUrgent: Bool

    public init(
        id: String,
        category: GigsCategory,
        metaLine: String,
        title: String,
        body: String,
        price: String,
        bidCount: Int?,
        distanceLabel: String?,
        isUrgent: Bool = false
    ) {
        self.id = id
        self.category = category
        self.metaLine = metaLine
        self.title = title
        self.body = body
        self.price = price
        self.bidCount = bidCount
        self.distanceLabel = distanceLabel
        self.isUrgent = isUrgent
    }
}

/// Empty-state content. `radiusMiles` drives the radius-hint pill at the
/// bottom — design spec calls for "Within 1 mi · widen in filter".
public struct GigsFeedEmpty: Sendable, Hashable {
    public let radiusMiles: Double

    public init(radiusMiles: Double = 1) {
        self.radiusMiles = radiusMiles
    }
}

/// Render state for the Gigs feed screen. `.browse` is the sectioned
/// loaded variant rendered when no search / filters / category narrow
/// the feed; `.loaded` is the flat list.
public enum GigsFeedState: Sendable {
    case loading
    case empty(GigsFeedEmpty)
    case loaded([GigCardContent])
    case browse(GigsBrowseContent)
    case error(message: String)
}

// MARK: - Radius suggestion (work item B)

/// "Only N tasks within X mi — search Y mi" banner content. Built when a
/// load completes with fewer than 3 results, no search, and no filters.
public struct GigsRadiusSuggestion: Sendable, Hashable {
    public let resultCount: Int
    public let currentMiles: Double
    public let suggestedMiles: Double

    public init(resultCount: Int, currentMiles: Double, suggestedMiles: Double) {
        self.resultCount = resultCount
        self.currentMiles = currentMiles
        self.suggestedMiles = suggestedMiles
    }
}

// MARK: - Dismiss / hide undo (work item D)

/// Transient undo affordance after a "Not interested" dismissal or a
/// "Hide all <Category>". Auto-expires after ~5s in the view.
public struct GigsFeedUndo: Identifiable, Sendable, Hashable {
    public enum Kind: Sendable, Hashable {
        case dismissedGig(gigId: String)
        case hiddenCategory(backendKey: String)
    }

    public let id = UUID()
    public let message: String
    public let kind: Kind

    public init(message: String, kind: Kind) {
        self.message = message
        self.kind = kind
    }
}

// MARK: - Browse sections (work item F)

/// Loaded browse-mode content — sections in render order, each only
/// present when non-empty, plus the cluster chip grid and total count.
public struct GigsBrowseContent: Sendable, Hashable {
    public let bestMatches: [GigCardContent]
    public let urgentRail: [GigRailCardContent]
    public let newToday: [GigCardContent]
    public let highPayingRail: [GigRailCardContent]
    public let quickJobs: [GigCardContent]
    public let clusters: [GigClusterChipContent]
    public let totalActive: Int

    public init(
        bestMatches: [GigCardContent] = [],
        urgentRail: [GigRailCardContent] = [],
        newToday: [GigCardContent] = [],
        highPayingRail: [GigRailCardContent] = [],
        quickJobs: [GigCardContent] = [],
        clusters: [GigClusterChipContent] = [],
        totalActive: Int = 0
    ) {
        self.bestMatches = bestMatches
        self.urgentRail = urgentRail
        self.newToday = newToday
        self.highPayingRail = highPayingRail
        self.quickJobs = quickJobs
        self.clusters = clusters
        self.totalActive = totalActive
    }

    /// True when no section has anything to render.
    public var isEmpty: Bool {
        bestMatches.isEmpty && urgentRail.isEmpty && newToday.isEmpty
            && highPayingRail.isEmpty && quickJobs.isEmpty && clusters.isEmpty
    }
}

/// Compact horizontal rail card (~240pt) — category-colored leading
/// tile, 2-line title, price + distance. Mirrors the Tasks-map rail card.
public struct GigRailCardContent: Identifiable, Sendable, Hashable {
    public let id: String
    public let category: GigsCategory
    public let title: String
    public let price: String
    public let distanceLabel: String?
    /// Browse `first_image` — replaces the glyph tile when present.
    public let imageUrl: String?

    public init(
        id: String,
        category: GigsCategory,
        title: String,
        price: String,
        distanceLabel: String?,
        imageUrl: String? = nil
    ) {
        self.id = id
        self.category = category
        self.title = title
        self.price = price
        self.distanceLabel = distanceLabel
        self.imageUrl = imageUrl
    }
}

/// One "Browse by category" chip — tapping selects that category via the
/// existing `selectCategory` flow. `backendKey` keeps the raw cluster
/// category so two unknown categories collapsing onto the same chip enum
/// still get unique ids.
public struct GigClusterChipContent: Identifiable, Sendable, Hashable {
    public let backendKey: String
    public let category: GigsCategory
    public let count: Int
    /// "From $20" style price hint, optional.
    public let priceHint: String?

    public var id: String {
        backendKey
    }

    public init(backendKey: String, category: GigsCategory, count: Int, priceHint: String?) {
        self.backendKey = backendKey
        self.category = category
        self.count = count
        self.priceHint = priceHint
    }
}
