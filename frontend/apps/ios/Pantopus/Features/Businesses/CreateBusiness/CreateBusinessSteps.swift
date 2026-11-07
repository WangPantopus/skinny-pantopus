//
//  CreateBusinessSteps.swift
//  Pantopus
//
//  Step descriptor + category enum for the A12.10 Create Business wizard.
//

import Foundation
import SwiftUI

/// Steps the Create Business wizard advances through.
/// - Step 1: designed A12.10 category picker
/// - Steps 2–4: Form/Wizard token composition (basic info → location/hours → confirm)
public enum CreateBusinessStep: String, CaseIterable, Sendable {
    case pickCategory
    case legalInfo
    case profile
    case confirm
}

public extension CreateBusinessStep {
    /// 1-indexed position used by the wizard's "N of M" readout.
    var stepNumber: Int {
        switch self {
        case .pickCategory: 1
        case .legalInfo: 2
        case .profile: 3
        case .confirm: 4
        }
    }

    /// Total number of steps in the wizard. Stays constant — the audit's
    /// frame 1 explicitly shows `1 of 4`.
    static var totalSteps: Int {
        4
    }
}

/// Category tiles rendered in the 2×4 picker grid. Order is meaningful —
/// the grid renders row-major in this order, with `.other` always last
/// so the "Something else" tile sits in the bottom-right.
///
/// The `accent` color is the per-category swatch used for the icon tile
/// background, the selected ring, the selected check disc, and the
/// selected-tile shadow. It does NOT recolor the wizard chrome — the
/// chrome stays business-violet via `WizardIdentity.business`.
public enum BusinessCategory: String, CaseIterable, Sendable, Identifiable {
    case home
    case personal
    case tech
    case delivery
    case goods
    case rentals
    case vehicles
    case other

    public var id: String {
        rawValue
    }
}

public extension BusinessCategory {
    /// Headline label rendered on the tile.
    var label: String {
        switch self {
        case .home: "Home services"
        case .personal: "Personal services"
        case .tech: "Tech & repair"
        case .delivery: "Delivery & errands"
        case .goods: "Goods & retail"
        case .rentals: "Rentals"
        case .vehicles: "Vehicles & rideshare"
        case .other: "Something else"
        }
    }

    /// Subline rendered under the label.
    var subcopy: String {
        switch self {
        case .home: "Handyman · cleaning · moving"
        case .personal: "Tutoring · childcare · pet care"
        case .tech: "Devices · networks · break-fix"
        case .delivery: "Last-mile · courier · grocery"
        case .goods: "Selling new or pre-loved items"
        case .rentals: "Short or long-term · gear · vehicles"
        case .vehicles: "Driving · towing · fleet"
        case .other: "Tell us what you do"
        }
    }

    /// Lucide icon backing the tile glyph.
    var icon: PantopusIcon {
        switch self {
        case .home: .wrench
        case .personal: .graduationCap
        case .tech: .cpu
        case .delivery: .truck
        case .goods: .shoppingBag
        case .rentals: .keyRound
        case .vehicles: .car
        case .other: .sparkles
        }
    }

    /// Per-category accent color used for the icon tile bg, the selected
    /// ring, the check disc, and the selected-tile shadow. Tokens-only —
    /// every value here is a `Theme.Color` swatch.
    var accent: Color {
        switch self {
        case .home: Theme.Color.handyman
        case .personal: Theme.Color.tutoring
        case .tech: Theme.Color.tech
        case .delivery: Theme.Color.delivery
        case .goods: Theme.Color.goods
        case .rentals: Theme.Color.rentals
        case .vehicles: Theme.Color.vehicles
        case .other: Theme.Color.business
        }
    }

    /// What create-full saves in `categories[]` when this tile is picked
    /// without a more specific listed category. Business pages and the page
    /// editor show categories as written, so it's the tile's name. "Something
    /// else" has none: it saves what the owner types.
    var savedCategoryName: String? {
        self == .other ? nil : label
    }

    /// The name a business page shows for a slug the wizard saved before it
    /// saved names ("home_services" → "Home services"), or nil for any other
    /// category. Android's `BusinessCategory.labelForLegacySlug` matches.
    static func label(forLegacySlug slug: String) -> String? {
        guard let category = allCases.first(where: { $0.legacySlug == slug }) else { return nil }
        return category == .other ? "Other" : category.label
    }

    /// The slug the wizard saved before it saved names; businesses created
    /// then still carry it.
    private var legacySlug: String {
        switch self {
        case .home: "home_services"
        case .personal: "personal_services"
        case .tech: "tech_repair"
        case .delivery: "delivery_errands"
        case .goods: "goods_retail"
        case .rentals: "rentals"
        case .vehicles: "vehicles_rideshare"
        case .other: "other"
        }
    }

    /// Sensible `business_type` entity for create-full. Home maps to
    /// `home_service`; everything else defaults to `for_profit`.
    var entityType: String {
        switch self {
        case .home: "home_service"
        default: "for_profit"
        }
    }
}

/// A logo picked in the wizard, held in memory until create-full returns a
/// business id (`POST /api/upload/business-media/:businessId` needs one).
/// The filename is randomised at pick time so the photo library's
/// `IMG_xxxx` name never reaches S3 — same firewall RN applies in
/// `src/utils/mediaFirewall.ts`.
public struct CreateBusinessLogoPick: Sendable, Equatable {
    public let data: Data
    public let fileName: String
    public let mimeType: String

    public init(data: Data, fileName: String, mimeType: String) {
        self.data = data
        self.fileName = fileName
        self.mimeType = mimeType
    }
}

/// Live username-availability state for the basic-info step.
public enum UsernameCheckStatus: Sendable, Equatable {
    case idle
    case checking
    case available
    case unavailable(reason: String?)
}

/// One weekday row in the create-business hours editor (Sun=0 … Sat=6).
public struct BusinessHoursDay: Sendable, Equatable, Identifiable, Hashable {
    public var dayOfWeek: Int
    public var openTime: String
    public var closeTime: String
    public var isClosed: Bool

    public var id: Int {
        dayOfWeek
    }

    public static let shortLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// Weekdays 09:00–17:00; weekends closed — matches RN defaults.
    public static func defaultWeek() -> [BusinessHoursDay] {
        (0..<7).map { day in
            let weekday = day >= 1 && day <= 5
            return BusinessHoursDay(
                dayOfWeek: day,
                openTime: weekday ? "09:00" : "",
                closeTime: weekday ? "17:00" : "",
                isClosed: !weekday
            )
        }
    }

    public var shortLabel: String {
        guard dayOfWeek >= 0, dayOfWeek < Self.shortLabels.count else { return "?" }
        return Self.shortLabels[dayOfWeek]
    }
}

/// One row inside the "What you'll get" preview strip shown beneath the
/// selected category tile.
public struct WhatYouGetItem: Sendable, Equatable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let subcopy: String
}

/// One typeahead match in the search frame: a listed category
/// (`CreateBusinessCategoryCatalog.listed`) or one of the eight tiles.
public struct CategorySearchHit: Sendable, Equatable, Identifiable {
    public let id: String
    /// The tile it's filed under.
    public let category: BusinessCategory
    /// What create-full saves and business pages show ("Plumbing").
    public let name: String
    /// Sub-area shown after the name in results ("K-12, test prep, music").
    public let detail: String?
    /// Other lowercase names people search for it by ("plumber").
    public let keywords: [String]
    /// True for a tile's own row: picking it picks the tile alone.
    public let isTile: Bool

    public init(
        id: String,
        category: BusinessCategory,
        name: String,
        detail: String? = nil,
        keywords: [String] = []
    ) {
        self.id = id
        self.category = category
        self.name = name
        self.detail = detail
        self.keywords = keywords
        isTile = false
    }

    /// The row for a tile, so "home" or "rentals" finds the tile itself.
    public init(tile: BusinessCategory) {
        id = "category-\(tile.rawValue)"
        category = tile
        name = tile.label
        detail = nil
        keywords = []
        isTile = true
    }

    /// Row text: the name, then the sub-area when there is one.
    public var label: String {
        guard let detail else { return name }
        return "\(name) · \(detail)"
    }
}

/// Outbound events the wizard view must react to.
public enum CreateBusinessOutboundEvent: Sendable, Equatable {
    case dismiss
    case openBusinessDashboard(businessId: String)
}
