//
//  PlanKind+Style.swift
//  Pantopus
//
//  Nearby Plans board P1: each kind's name, color, tint and glyph. The
//  colors are the `cat-plan-*` tokens; the glyphs are the four Plans icons.
//

import SwiftUI

extension PlanKind {
    /// The kind's name, as tags and chips show it.
    var title: String {
        switch self {
        case .watchParty: "Watch party"
        case .playdate: "Playdate"
        case .pickupGame: "Pickup game"
        case .walkCoffee: "Walk & coffee"
        }
    }

    /// The name VoiceOver reads ("Walk and coffee", not "Walk ampersand coffee").
    var spokenTitle: String {
        self == .walkCoffee ? "Walk and coffee" : title
    }

    /// The pin, swatch and tile glyph color.
    var color: Color {
        switch self {
        case .watchParty: Theme.Color.categoryPlanWatch
        case .playdate: Theme.Color.categoryPlanPlaydate
        case .pickupGame: Theme.Color.categoryPlanPickup
        case .walkCoffee: Theme.Color.categoryPlanWalk
        }
    }

    /// The soft fill behind tiles, tags and the type card.
    var tint: Color {
        switch self {
        case .watchParty: Theme.Color.categoryPlanWatchTint
        case .playdate: Theme.Color.categoryPlanPlaydateTint
        case .pickupGame: Theme.Color.categoryPlanPickupTint
        case .walkCoffee: Theme.Color.categoryPlanWalkTint
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .watchParty: .planWatch
        case .playdate: .planPlaydate
        case .pickupGame: .planPickup
        case .walkCoffee: .planWalk
        }
    }

    /// The order of the map's type chips and the host's type grid.
    static let displayOrder: [PlanKind] = [.watchParty, .playdate, .pickupGame, .walkCoffee]
}
