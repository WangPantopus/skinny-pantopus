//
//  PulseSafetyAlertKind.swift
//  Pantopus
//
//  Alert sub-types for Heads Up posts. Crime and suspicion kinds (theft,
//  vandalism, suspicious, scam) can't be created any more (Pulse S1; the
//  server refuses them with `ALERT_KIND_NOT_ALLOWED`); an existing post's
//  stored kind stays unchanged unless its author selects a supported kind.
//

import Foundation

/// Backend `safetyAlertKind` values a resident may create (contract §1).
public enum PulseSafetyAlertKind: String, CaseIterable, Sendable, Hashable {
    case roadHazard = "road_hazard"
    case powerOutage = "power_outage"
    case weatherDamage = "weather_damage"
    case missingPet = "missing_pet"
    case hazard
    case other

    public var label: String {
        switch self {
        case .roadHazard: "Road hazard"
        case .powerOutage: "Power outage"
        case .weatherDamage: "Weather damage"
        case .missingPet: "Missing pet"
        case .hazard: "Hazard"
        case .other: "Other"
        }
    }
}
