//
//  BusinessProfileContent.swift
//  Pantopus
//
//  A10.6 — Render-only models for the single-scroll Business Profile.
//  The view-model projects `BusinessDetailResponse` (+ optional
//  `BusinessPublicResponse` + `PublicProfile`) onto these so the view
//  layer never touches DTOs directly.
//
//  B3.1 reshape: the screen moved from a tabbed profile to a single
//  scroll of sections — banner header, stat strip, category chips,
//  About, Hours, Service area, Services, Recent work, Reviews, and a
//  sticky Contact / Book (or Call) dock. The data primitives below back
//  both the populated frame and the newly-claimed + closed secondary
//  frame (`EmptyBlock`s for unfilled sections).
//

import Foundation

// MARK: - Header

/// Banner-header content. Rendered through the shared `BizBannerHeader`
/// primitive (cover banner + overlapping logo + verified disc + chips).
public struct BusinessProfileHeader: Sendable, Hashable {
    public let displayName: String
    public let handle: String?
    public let locality: String?
    public let isVerified: Bool
    /// Optional logo glyph (sample frames use `sparkles` / `pawPrint`);
    /// `nil` falls back to initials derived from `displayName`.
    public let logoIcon: PantopusIcon?

    public init(
        displayName: String,
        handle: String?,
        locality: String?,
        isVerified: Bool,
        logoIcon: PantopusIcon? = nil
    ) {
        self.displayName = displayName
        self.handle = handle
        self.locality = locality
        self.isVerified = isVerified
        self.logoIcon = logoIcon
    }
}

// MARK: - Stat strip

/// Tint applied to a stat cell's value (and its leading star).
public enum BusinessStatTint: Sendable, Hashable {
    /// Neutral ink — the default for counts like "Jobs done".
    case standard
    /// Amber star tint for the rating cell.
    case star
    /// Business-violet — the "New" / "On Pantopus" cell.
    case business
    /// Muted ink for an absent value ("—").
    case muted
}

/// One cell in the stat strip — rating · jobs done · followers / "New".
public struct BusinessStatCell: Sendable, Hashable, Identifiable {
    public let id: String
    public let value: String
    public let label: String
    /// Renders a leading star glyph (filled for `.star`, outline for `.muted`).
    public let leadingStar: Bool
    public let tint: BusinessStatTint

    public init(
        id: String,
        value: String,
        label: String,
        leadingStar: Bool = false,
        tint: BusinessStatTint = .standard
    ) {
        self.id = id
        self.value = value
        self.label = label
        self.leadingStar = leadingStar
        self.tint = tint
    }
}

// MARK: - Category chips

/// Per-category accent. The lead category is tinted; the rest are neutral.
public enum BusinessCategoryAccent: Sendable, Hashable {
    case business
    case cleaning
    case handyman
    case pet
    case neutral
}

/// One category chip in the `CategoryRow`.
public struct BusinessCategoryChip: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon?
    public let accent: BusinessCategoryAccent

    public init(id: String, label: String, icon: PantopusIcon?, accent: BusinessCategoryAccent) {
        self.id = id
        self.label = label
        self.icon = icon
        self.accent = accent
    }
}

// MARK: - About

/// A trust chip under the About copy ("Bonded & insured", "Since 2019").
public struct BusinessAboutChip: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon

    public init(id: String, label: String, icon: PantopusIcon) {
        self.id = id
        self.label = label
        self.icon = icon
    }
}

// MARK: - Hours

/// Open / Closed status header for the Hours table + banner status chip.
public struct BusinessOpenState: Sendable, Hashable {
    public let isOpen: Bool
    /// "Open now" / "Closed now".
    public let statusLabel: String
    /// "Closes 6:00 PM" / "Opens tomorrow at 8:00 AM".
    public let statusDetail: String
    /// Banner chip label: "Open now" / "Closed · opens 8 AM".
    public let chipLabel: String

    public init(isOpen: Bool, statusLabel: String, statusDetail: String, chipLabel: String) {
        self.isOpen = isOpen
        self.statusLabel = statusLabel
        self.statusDetail = statusDetail
        self.chipLabel = chipLabel
    }
}

/// One Hours-table day row.
public struct BusinessHoursRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let dayLabel: String
    public let timeLabel: String
    public let isClosed: Bool
    public let isToday: Bool

    public init(id: String, dayLabel: String, timeLabel: String, isClosed: Bool, isToday: Bool = false) {
        self.id = id
        self.dayLabel = dayLabel
        self.timeLabel = timeLabel
        self.isClosed = isClosed
        self.isToday = isToday
    }
}

// MARK: - Service area

/// Service-area card content (a `MapPreview` + address summary + directions).
public struct BusinessServiceArea: Sendable, Hashable {
    /// Headline line ("Based near 5th & Birch" / "Cedar Heights").
    public let title: String
    /// Secondary line ("Exact address shared after booking").
    public let detail: String?
    /// Coverage line ("Serves Elm Park & Cedar Heights — within 4 mi").
    public let serviceArea: String?
    public let latitude: Double?
    public let longitude: Double?

    public init(
        title: String,
        detail: String?,
        serviceArea: String?,
        latitude: Double?,
        longitude: Double?
    ) {
        self.title = title
        self.detail = detail
        self.serviceArea = serviceArea
        self.latitude = latitude
        self.longitude = longitude
    }

    public var hasCoordinates: Bool {
        latitude != nil && longitude != nil
    }
}

// MARK: - Services

/// One priced service offering.
public struct BusinessServiceRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let detail: String?
    public let priceLabel: String
    /// Price sub-line ("per visit", "flat").
    public let unit: String?
    public let icon: PantopusIcon

    public init(
        id: String,
        name: String,
        detail: String?,
        priceLabel: String,
        unit: String? = nil,
        icon: PantopusIcon = .tag
    ) {
        self.id = id
        self.name = name
        self.detail = detail
        self.priceLabel = priceLabel
        self.unit = unit
        self.icon = icon
    }
}

// MARK: - Gallery

/// Tint role for a "Recent work" gallery tile placeholder.
public enum BusinessGalleryTint: Sendable, Hashable {
    case primary
    case success
    case slate
    case deep
}

/// One "Recent work" gallery item. Maps to the `GalleryStrip` primitive's
/// `GalleryTile` in the view layer (keeps this model SwiftUI-free).
public struct BusinessGalleryItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String?
    public let tint: BusinessGalleryTint
    public let imageURL: URL?
    /// When non-nil the tile renders a dark "+N" see-all overlay.
    public let moreCount: Int?

    public init(
        id: String,
        label: String?,
        tint: BusinessGalleryTint = .slate,
        imageURL: URL? = nil,
        moreCount: Int? = nil
    ) {
        self.id = id
        self.label = label
        self.tint = tint
        self.imageURL = imageURL
        self.moreCount = moreCount
    }
}

// MARK: - Reviews

/// Rating histogram summary for the Reviews section.
public struct BusinessReviewSummary: Sendable, Hashable {
    public let average: Double
    public let count: Int
    /// Five fractions in `0...1`, ordered 5★→1★.
    public let distribution: [Double]

    public init(average: Double, count: Int, distribution: [Double]) {
        self.average = average
        self.count = count
        self.distribution = distribution
    }
}

/// One review card.
public struct BusinessReviewCard: Sendable, Hashable, Identifiable {
    public let id: String
    public let reviewerName: String
    public let reviewerAvatarURL: URL?
    public let rating: Int
    public let body: String
    /// Relative timestamp + optional service context ("1w · Standard clean").
    public let timestamp: String
    public let verified: Bool

    public init(
        id: String,
        reviewerName: String,
        reviewerAvatarURL: URL?,
        rating: Int,
        body: String,
        timestamp: String,
        verified: Bool = false
    ) {
        self.id = id
        self.reviewerName = reviewerName
        self.reviewerAvatarURL = reviewerAvatarURL
        self.rating = max(0, min(5, rating))
        self.body = body
        self.timestamp = timestamp
        self.verified = verified
    }
}

// MARK: - Action dock

/// The sticky bottom dock. Primary is always "Contact" (message); the
/// secondary swaps between "Book" (open, established) and "Call"
/// (newly-claimed / closed), with an optional closed note.
public struct BusinessActionDock: Sendable, Hashable {
    public enum Secondary: Sendable, Hashable {
        case book
        case call
    }

    public let secondary: Secondary
    /// Closed note ("Closed now — messages answered at 8 AM"); `nil` when open.
    public let note: String?

    public init(secondary: Secondary, note: String?) {
        self.secondary = secondary
        self.note = note
    }
}

// MARK: - Top-level payload

/// Top-level content payload emitted by `BusinessProfileViewModel`.
public struct BusinessProfileContent: Sendable, Hashable {
    public let businessId: String
    public let header: BusinessProfileHeader
    public let stats: [BusinessStatCell]
    public let categories: [BusinessCategoryChip]
    public let about: String?
    public let aboutChips: [BusinessAboutChip]
    public let status: BusinessOpenState?
    public let hours: [BusinessHoursRow]
    public let serviceArea: BusinessServiceArea?
    public let services: [BusinessServiceRow]
    public let gallery: [BusinessGalleryItem]
    public let reviewSummary: BusinessReviewSummary?
    public let reviews: [BusinessReviewCard]
    public let dock: BusinessActionDock
    /// Seed for the Saved Places bookmark affordance when this profile has a saveable location.
    public let savedPlace: PendingSavePlace?
    /// Drives the "Just opened on Pantopus" trust note + empty sections.
    public let isNewlyClaimed: Bool
    /// Used by the "Call" dock action (`tel:` link).
    public let phoneNumber: String?
    /// Surfaced for the overflow "Share" / external link.
    public let websiteURL: URL?
    /// Surfaced so the host can switch chrome (Edit) when the viewer owns
    /// the business. B3.1 doesn't render owner chrome (that's B3.2 / A10.7).
    public let viewerIsOwner: Bool

    public init(
        businessId: String,
        header: BusinessProfileHeader,
        stats: [BusinessStatCell],
        categories: [BusinessCategoryChip],
        about: String?,
        aboutChips: [BusinessAboutChip],
        status: BusinessOpenState?,
        hours: [BusinessHoursRow],
        serviceArea: BusinessServiceArea?,
        services: [BusinessServiceRow],
        gallery: [BusinessGalleryItem],
        reviewSummary: BusinessReviewSummary?,
        reviews: [BusinessReviewCard],
        dock: BusinessActionDock,
        savedPlace: PendingSavePlace? = nil,
        isNewlyClaimed: Bool,
        phoneNumber: String?,
        websiteURL: URL?,
        viewerIsOwner: Bool
    ) {
        self.businessId = businessId
        self.header = header
        self.stats = stats
        self.categories = categories
        self.about = about
        self.aboutChips = aboutChips
        self.status = status
        self.hours = hours
        self.serviceArea = serviceArea
        self.services = services
        self.gallery = gallery
        self.reviewSummary = reviewSummary
        self.reviews = reviews
        self.dock = dock
        self.savedPlace = savedPlace
        self.isNewlyClaimed = isNewlyClaimed
        self.phoneNumber = phoneNumber
        self.websiteURL = websiteURL
        self.viewerIsOwner = viewerIsOwner
    }
}

/// Top-level render state for the Business Profile screen.
public enum BusinessProfileState: Sendable, Equatable {
    case loading
    case loaded(BusinessProfileContent)
    case notFound
    case error(message: String)
}
