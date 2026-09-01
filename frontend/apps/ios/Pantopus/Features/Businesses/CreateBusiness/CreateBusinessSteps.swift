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

    /// Backend `categories[]` slug for create-full. Kept distinct from
    /// `rawValue` so the wire format isn't coupled to the Swift case name.
    var backendSlug: String {
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

/// One typeahead match returned by the search frame's filter. Carries the
/// owning category plus a sub-area sentence — what the audit calls the
/// "tutoring · K-12, test prep, music" line under each result.
public struct CategorySearchHit: Sendable, Equatable, Identifiable {
    public let id: String
    public let category: BusinessCategory
    public let label: String
}

/// Outbound events the wizard view must react to.
public enum CreateBusinessOutboundEvent: Sendable, Equatable {
    case dismiss
    case openBusinessDashboard(businessId: String)
}
