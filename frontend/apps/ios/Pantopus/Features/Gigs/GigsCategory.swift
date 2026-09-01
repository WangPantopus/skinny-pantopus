//
//  GigsCategory.swift
//  Pantopus
//
//  The nine category enums for the Gigs feed. Each carries the brand
//  color from the design tokens (gigs-frames.jsx CATS). The colors are
//  Gigs-local because no other surface needs the full palette; identity
//  pillars and semantic colors live in `Theme.Color`.
//

import SwiftUI

/// Filter / row category. `all` is a filter-only sentinel — gigs always
/// carry a concrete category in their payload.
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
        }
    }

    /// Brand color for chips, row pills, and the active filter fill.
    /// Sourced from `gigs-frames.jsx` CATS.
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
        }
    }

    /// Map the backend `category` string to one of our chips. Unknown
    /// values fall back to `handyman` so the row still renders a chip.
    public static func from(backendKey raw: String?) -> GigsCategory {
        let key = (raw ?? "")
            .lowercased()
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
        switch key {
        case "all": return .all
        case "handyman", "handy", "repair", "repairs": return .handyman
        case "cleaning", "clean": return .cleaning
        case "moving", "move", "movers": return .moving
        case "petcare", "pet", "pets", "dogwalking", "petsitting": return .petcare
        case "childcare", "child", "babysitting", "nanny": return .childcare
        case "tutoring", "tutor", "lessons", "teaching": return .tutoring
        case "tech", "technology", "it", "computer": return .tech
        case "delivery", "deliveries", "courier": return .delivery
        default: return .handyman
        }
    }
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
