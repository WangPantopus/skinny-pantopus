//
//  SkyHome+Place.swift
//  Pantopus
//
//  Reads the Your Home section's outline (`PlaceHouseShape`, from the
//  county record) into the house the Today sky draws. App only: the
//  home-screen widget draws the scene's first house and has no Place data.
//

import Foundation

extension SkyHome {
    /// From the Your Home section: its outline, or its `home_type` without one.
    init(shape: PlaceHouseShape?, homeType: String?) {
        self.init(homeType)
        guard let shape else { return }
        kind = Self.kind(shape.kind) ?? kind
        stories = shape.stories.map { min(max($0, 1), 3) }
        let footprint: Double = switch shape.footprint {
        case "small": 34
        case "large": 50
        default: 40
        }
        // Two storeys stand a little wider, so they read as a house, not a tower.
        width = footprint + ((stories ?? 1) >= 2 ? 6 : 0)
        roof = switch shape.roof {
        case "hip": .hip
        case "flat": .flat
        default: .gable
        }
        garage = switch shape.garage {
        case "attached": .attached
        case "detached": .detached
        case "carport": .carport
        default: .none
        }
        garageSpaces = min(max(shape.garageSpaces ?? 2, 1), 3)
        chimney = (kind == .house || kind == .townhouse) && shape.fireplace != false
        pool = kind == .house && shape.pool == true
    }
}
