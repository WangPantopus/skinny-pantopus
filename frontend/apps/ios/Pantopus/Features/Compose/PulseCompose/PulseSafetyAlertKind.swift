//
//  PulseSafetyAlertKind.swift
//  Pantopus
//
//  Alert sub-types for Heads Up posts. Crime and suspicion kinds (theft,
//  vandalism, suspicious, scam) can't be created any more (Pulse S1; the
//  server refuses them with `ALERT_KIND_NOT_ALLOWED`); old posts of those
//  kinds still read fine, since the feed and post page never decode this enum.
//

import Foundation

/// Backend `safetyAlertKind` values a resident may create (contract §1).
public enum PulseSafetyAlertKind: String, CaseIterable, Sendable, Hashable {
    case hazard
    case roadHazard = "road_hazard"
    case powerOutage = "power_outage"
    case weatherDamage = "weather_damage"
    case missingPet = "missing_pet"
    case other

    public var label: String {
        switch self {
        case .hazard: "Hazard"
        case .roadHazard: "Road hazard"
        case .powerOutage: "Power outage"
        case .weatherDamage: "Weather damage"
        case .missingPet: "Missing pet"
        case .other: "Other"
        }
    }
}
