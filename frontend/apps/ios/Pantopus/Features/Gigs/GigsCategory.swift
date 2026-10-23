//
//  GigsCategory.swift
//  Pantopus
//
//  The task categories for the Gigs feed: every category the backend
//  accepts (`VALID_CATEGORIES` in backend/services/magicTaskService.js,
//  web's `GIG_CATEGORIES`) plus the `all` filter. Each carries a brand
//  color: the first eight from the design tokens (gigs-frames.jsx CATS),
//  the rest from the same Tailwind 600-level scale. The colors are
//  Gigs-local because no other surface needs the full palette; identity
//  pillars and semantic colors live in `Theme.Color`.
//

import SwiftUI

/// Filter / row category. `all` is a filter-only sentinel — gigs always
/// carry a concrete category in their payload. `other` comes last so
/// pickers that list `allCases` end with it.
public enum GigsCategory: String, CaseIterable, Sendable, Hashable {
    case all
    case handyman
    case cleaning
    case moving
    case petcare
    case childcare
    case tutoring
    case tech
    case delivery
    case photography
    case cooking
    case gardening
    case eventHelp = "eventhelp"
    case errands
    case groceryPickup = "grocerypickup"
    case plumbing
    case electrical
    case hvac
    case roofing
    case generalContractor = "generalcontractor"
    case landscapingPro = "landscapingpro"
    case homeInspector = "homeinspector"
    case paintingPro = "paintingpro"
    case flooring
    case other

    /// What the chip rows and the filter sheet offer: web's browse list
    /// (`GIG_BROWSE_CATEGORIES`) after `all`. The errand and pro-service
    /// categories show on rows, cards and the detail, as on web.
    public static let filterCases: [GigsCategory] = [
        .all, .handyman, .cleaning, .moving, .petcare, .childcare, .tutoring, .tech, .delivery,
        .photography, .cooking, .gardening, .eventHelp, .other
    ]

    /// `filterCases`, plus `active` at the end while it's a category
    /// reached another way (a browse cluster or a saved search).
    public static func filterCases(including active: GigsCategory) -> [GigsCategory] {
        filterCases.contains(active) ? filterCases : filterCases + [active]
    }

    /// Display label for the chip and the row pill.
    public var label: String {
        switch self {
        case .all: "All"
        case .handyman: "Handyman"
        case .cleaning: "Cleaning"
        case .moving: "Moving"
        case .petcare: "Pet care"
        case .childcare: "Child care"
        case .tutoring: "Tutoring"
        case .tech: "Tech"
        case .delivery: "Delivery"
        case .photography: "Photography"
        case .cooking: "Cooking"
        case .gardening: "Gardening"
        case .eventHelp: "Event help"
        case .errands: "Errands"
        case .groceryPickup: "Grocery pickup"
        case .plumbing: "Plumbing"
        case .electrical: "Electrical"
        case .hvac: "HVAC"
        case .roofing: "Roofing"
        case .generalContractor: "General contractor"
        case .landscapingPro: "Landscaping pro"
        case .homeInspector: "Home inspector"
        case .paintingPro: "Painting pro"
        case .flooring: "Flooring"
        case .other: "Other"
        }
    }

    /// Brand color for chips, row pills, and the active filter fill.
    /// The first eight are sourced from `gigs-frames.jsx` CATS.
    public var color: Color {
        switch self {
        case .all: Theme.Color.primary600
        case .handyman: Color(red: 234 / 255, green: 88 / 255, blue: 12 / 255)
        case .cleaning: Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)
        case .moving: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255)
        case .petcare: Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)
        case .childcare: Color(red: 219 / 255, green: 39 / 255, blue: 119 / 255)
        case .tutoring: Color(red: 202 / 255, green: 138 / 255, blue: 4 / 255)
        case .tech: Color(red: 71 / 255, green: 85 / 255, blue: 105 / 255)
        case .delivery: Color(red: 8 / 255, green: 145 / 255, blue: 178 / 255)
        // indigo-600
        case .photography: Color(red: 79 / 255, green: 70 / 255, blue: 229 / 255)
        // red-600
        case .cooking: Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
        // lime-600
        case .gardening: Color(red: 101 / 255, green: 163 / 255, blue: 13 / 255)
        // rose-600
        case .eventHelp: Color(red: 225 / 255, green: 29 / 255, blue: 72 / 255)
        // cyan-700, next to delivery
        case .errands: Color(red: 14 / 255, green: 116 / 255, blue: 144 / 255)
        // emerald-600
        case .groceryPickup: Color(red: 5 / 255, green: 150 / 255, blue: 105 / 255)
        // blue-600
        case .plumbing: Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)
        // amber-600
        case .electrical: Color(red: 217 / 255, green: 119 / 255, blue: 6 / 255)
        // teal-600
        case .hvac: Color(red: 13 / 255, green: 148 / 255, blue: 136 / 255)
        // stone-600
        case .roofing: Color(red: 87 / 255, green: 83 / 255, blue: 78 / 255)
        // amber-700
        case .generalContractor: Color(red: 180 / 255, green: 83 / 255, blue: 9 / 255)
        // green-700
        case .landscapingPro: Color(red: 21 / 255, green: 128 / 255, blue: 61 / 255)
        // purple-600
        case .homeInspector: Color(red: 147 / 255, green: 51 / 255, blue: 234 / 255)
        // fuchsia-600
        case .paintingPro: Color(red: 192 / 255, green: 38 / 255, blue: 211 / 255)
        // orange-800
        case .flooring: Color(red: 154 / 255, green: 52 / 255, blue: 18 / 255)
        // gray-500
        case .other: Color(red: 107 / 255, green: 114 / 255, blue: 128 / 255)
        }
    }

    /// Map the backend `category` string to one of our chips. Unknown
    /// values fall back to `other` so the row still renders a chip.
    public static func from(backendKey raw: String?) -> GigsCategory {
        GigsCategory(backendKey: raw) ?? .other
    }

    // swiftlint:disable cyclomatic_complexity
    /// Map the backend `category` string to one of our chips, or `nil`
    /// for a value the backend's list doesn't have. Web labels
    /// ("Pet Care", "Event Help") match too.
    public init?(backendKey raw: String?) {
        let key = (raw ?? "")
            .lowercased()
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: " ", with: "")
        switch key {
        case "all": self = .all
        case "handyman", "handy", "repair", "repairs": self = .handyman
        case "cleaning", "clean": self = .cleaning
        case "moving", "move", "movers": self = .moving
        case "petcare", "pet", "pets", "dogwalking", "petsitting": self = .petcare
        case "childcare", "child", "babysitting", "nanny": self = .childcare
        case "tutoring", "tutor", "lessons", "teaching": self = .tutoring
        case "tech", "technology", "techsupport", "it", "computer": self = .tech
        case "delivery", "deliveries", "courier": self = .delivery
        case "photography", "photo", "photos", "photographer": self = .photography
        case "cooking", "cook", "chef", "meals", "mealprep": self = .cooking
        case "gardening", "garden", "yard", "yardwork", "lawn", "lawncare": self = .gardening
        case "eventhelp", "event", "events": self = .eventHelp
        case "errands", "errand": self = .errands
        case "grocerypickup", "grocery", "groceries": self = .groceryPickup
        case "plumbing", "plumber": self = .plumbing
        case "electrical", "electric", "electrician": self = .electrical
        case "hvac", "heating", "cooling": self = .hvac
        case "roofing", "roof", "roofer": self = .roofing
        case "generalcontractor", "contractor": self = .generalContractor
        case "landscapingpro", "landscaping", "landscaper": self = .landscapingPro
        case "homeinspector", "homeinspection", "inspector", "inspection": self = .homeInspector
        case "paintingpro", "painting", "painter": self = .paintingPro
        case "flooring", "floors": self = .flooring
        case "other", "general": self = .other
        default: return nil
        }
    }
    // swiftlint:enable cyclomatic_complexity
}

/// Sort options for the Gigs feed (matches backend `sort` enum).
/// `urgency` (deadline-soonest) backs the browse "Urgent nearby"
/// section's See-all jump.
public enum GigsSort: String, CaseIterable, Sendable, Hashable, Identifiable {
    case newest
    case closest
    case highestPay = "highest_pay"
    case fewestBids = "fewest_bids"
    case urgency

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .newest: "Newest"
        case .closest: "Closest"
        case .highestPay: "Highest pay"
        case .fewestBids: "Fewest bids"
        case .urgency: "Urgent first"
        }
    }
}
