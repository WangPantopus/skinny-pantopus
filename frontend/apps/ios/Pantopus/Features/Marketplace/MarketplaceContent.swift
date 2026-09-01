//
//  MarketplaceContent.swift
//  Pantopus
//
//  Content models the Marketplace view consumes. The view-model
//  projects `ListingDTO` rows into `MarketplaceCardContent` so the
//  view never reaches into the network DTO.
//

import Foundation
import SwiftUI

/// Top-level chip on the Marketplace tab. Five categories: All / Goods
/// / Rentals / Free / Vehicles. Maps onto backend `layer` + `is_free`
/// query params.
public enum MarketplaceCategory: String, CaseIterable, Sendable, Hashable {
    case all
    case goods
    case rentals
    case free
    case vehicles

    public var label: String {
        switch self {
        case .all: "All"
        case .goods: "Goods"
        case .rentals: "Rentals"
        case .free: "Free"
        case .vehicles: "Vehicles"
        }
    }

    /// Backend `layer` query param. `.all` and `.free` don't constrain
    /// layer; `.free` instead toggles the `isFree=true` query.
    public var layerParam: String? {
        switch self {
        case .goods: "goods"
        case .rentals: "rentals"
        case .vehicles: "vehicles"
        case .all, .free: nil
        }
    }

    /// Suppresses the condition badge — Rentals and Free are not
    /// "used-condition" enough to render the chip on the image (per
    /// the design's spec).
    public var suppressesConditionBadge: Bool {
        switch self {
        case .rentals, .free: true
        default: false
        }
    }
}

/// One marketplace card.
public struct MarketplaceCardContent: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    /// `firstImage` URL when the listing has photos, otherwise `nil`
    /// → the view renders the gradient placeholder + glyph.
    public let imageUrl: URL?
    public let placeholderGradient: ListingGradient
    public let placeholderIcon: PantopusIcon
    /// Free-form price string ("$320", "$45 / wk").
    public let price: String
    public let isFree: Bool
    public let metaLine: String
    /// "Like new", "Good", etc — `nil` when the chip is suppressed
    /// (rentals / free) or when the listing has no condition set.
    public let conditionBadge: String?
    public let category: MarketplaceCategory

    public init(
        id: String,
        title: String,
        imageUrl: URL?,
        placeholderGradient: ListingGradient,
        placeholderIcon: PantopusIcon,
        price: String,
        isFree: Bool,
        metaLine: String,
        conditionBadge: String?,
        category: MarketplaceCategory
    ) {
        self.id = id
        self.title = title
        self.imageUrl = imageUrl
        self.placeholderGradient = placeholderGradient
        self.placeholderIcon = placeholderIcon
        self.price = price
        self.isFree = isFree
        self.metaLine = metaLine
        self.conditionBadge = conditionBadge
        self.category = category
    }
}

/// Gradient pair for the listing image placeholder. Each listing
/// inherits a stable gradient from a hash of its id so the grid stays
/// visually settled across re-renders.
public struct ListingGradient: Sendable, Hashable {
    public let start: Color
    public let end: Color

    public init(start: Color, end: Color) {
        self.start = start
        self.end = end
    }

    /// One of six design-spec gradient pairs (from
    /// `marketplace-frames.jsx`). Hashed by `id` so the same listing
    /// always lands on the same gradient.
    public static func from(id: String) -> ListingGradient {
        let palette: [(Color, Color)] = [
            (Color(red: 186 / 255, green: 230 / 255, blue: 253 / 255), Color(red: 2 / 255, green: 132 / 255, blue: 199 / 255)),
            (Color(red: 254 / 255, green: 243 / 255, blue: 199 / 255), Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)),
            (Color(red: 221 / 255, green: 214 / 255, blue: 254 / 255), Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255)),
            (Color(red: 209 / 255, green: 250 / 255, blue: 229 / 255), Color(red: 5 / 255, green: 150 / 255, blue: 105 / 255)),
            (Color(red: 254 / 255, green: 202 / 255, blue: 202 / 255), Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)),
            (Color(red: 224 / 255, green: 242 / 255, blue: 254 / 255), Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255))
        ]
        let index = abs(id.hashValue) % palette.count
        return ListingGradient(start: palette[index].0, end: palette[index].1)
    }
}

/// Render state for the Marketplace screen.
public enum MarketplaceState: Sendable {
    case loading
    case empty(MarketplaceEmpty)
    case loaded([MarketplaceCardContent])
    case error(message: String)
}

/// Empty-state content. `radiusMiles` drives the bottom hint pill
/// ("Showing within 2 mi · widen in filter").
public struct MarketplaceEmpty: Sendable, Hashable {
    public let radiusMiles: Double

    public init(radiusMiles: Double = 2) {
        self.radiusMiles = radiusMiles
    }
}
