//
//  PulseSafetyAlertKind.swift
//  Pantopus
//
//  Alert sub-types for Heads Up posts — mirrors mobile `SAFETY_KINDS`.
//

import Foundation

/// Backend `safetyAlertKind` values accepted by `createPostSchema`.
public enum PulseSafetyAlertKind: String, CaseIterable, Sendable, Hashable {
    case theft
    case vandalism
    case suspicious
    case hazard
    case scam
    case other

    public var label: String {
        switch self {
        case .theft: "Theft"
        case .vandalism: "Vandalism"
        case .suspicious: "Suspicious"
        case .hazard: "Hazard"
        case .scam: "Scam"
        case .other: "Other"
        }
    }
}
