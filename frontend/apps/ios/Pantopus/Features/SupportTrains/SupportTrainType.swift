//
//  SupportTrainType.swift
//  Pantopus
//
//  The support train archetypes and their tile palette, shared by the trains
//  list, search and detail screens.
//

import SwiftUI

// MARK: - Train type palette

/// Per-archetype tile palette. The icon + gradient pair drives the
/// 40pt leading tile rendered by `RowLeading.categoryGradientIcon`.
public enum SupportTrainType: Sendable, Hashable, CaseIterable {
    case meals
    case rides
    case childcare
    case petcare
    case errands
    case visits
    case generic

    /// Backend `support_train_type` enum mirror. Falls back to
    /// `.generic` when the column is empty so My-trains rows (which
    /// don't yet project the type column) render a neutral mutual-aid
    /// glyph instead of mis-labeling every train as "Meal train". The
    /// Nearby RPC populates the field and the tile lights up.
    public static func from(_ raw: String?) -> SupportTrainType {
        switch raw ?? "" {
        case "meal_support", "meals": .meals
        case "ride_support", "rides": .rides
        case "childcare": .childcare
        case "pet_care", "petcare", "pet": .petcare
        case "errands", "errand_support": .errands
        case "visits", "visit_support": .visits
        default: .generic
        }
    }

    public var label: String {
        switch self {
        case .meals: "Meal train"
        case .rides: "Ride train"
        case .childcare: "Childcare"
        case .petcare: "Pet care"
        case .errands: "Errand train"
        case .visits: "Visit train"
        case .generic: "Support train"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .meals: .utensils
        case .rides: .navigation
        case .childcare: .baby
        case .petcare: .pawPrint
        case .errands: .shoppingBag
        case .visits: .heart
        case .generic: .handCoins
        }
    }

    /// Per-archetype gradient pulled from existing category / identity
    /// tokens — no hex literals at the call site. Designers can later
    /// promote any of these to first-class tokens if reused elsewhere.
    public var gradient: GradientPair {
        switch self {
        case .meals:
            GradientPair(start: Theme.Color.handyman, end: Theme.Color.error)
        case .rides:
            GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
        case .childcare:
            GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman)
        case .petcare:
            GradientPair(start: Theme.Color.error, end: Theme.Color.business)
        case .errands:
            GradientPair(start: Theme.Color.business, end: Theme.Color.goods)
        case .visits:
            GradientPair(start: Theme.Color.error, end: Theme.Color.business)
        case .generic:
            GradientPair(start: Theme.Color.appTextSecondary, end: Theme.Color.appTextStrong)
        }
    }
}
