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
    case other

    public var label: String {
        switch self {
        case .hazard: "Hazard"
        case .other: "Other"
        }
    }
}
