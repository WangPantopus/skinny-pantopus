//
//  EmergencySeverity.swift
//  Pantopus
//
//  P2.8 — Severity chip used by the Add Emergency Info form + detail.
//  Three levels driven by the design pack's semantic tokens:
//    info     → primary50 bg / primary700 fg          (info glyph)
//    caution  → warningBg / warning                   (alert-circle)
//    critical → errorBg / error                       (alert-triangle)
//
//  Critical rows pair the error-bg chip with the alert-triangle glyph
//  per the acceptance check ("critical items render with the error-bg
//  chip and a small alert icon").
//

import SwiftUI

public enum EmergencySeverity: String, CaseIterable, Sendable, Identifiable {
    case info
    case caution
    case critical

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .info: "Info"
        case .caution: "Caution"
        case .critical: "Critical"
        }
    }

    /// Soft chip background token.
    public var background: Color {
        switch self {
        case .info: Theme.Color.primary50
        case .caution: Theme.Color.warningBg
        case .critical: Theme.Color.errorBg
        }
    }

    /// Chip foreground / icon tint.
    public var foreground: Color {
        switch self {
        case .info: Theme.Color.primary700
        case .caution: Theme.Color.warning
        case .critical: Theme.Color.error
        }
    }

    /// Glyph rendered inside the chip.
    public var icon: PantopusIcon {
        switch self {
        case .info: .info
        case .caution: .alertCircle
        case .critical: .alertTriangle
        }
    }

    /// Resolve a severity from a stored details-map string. Returns
    /// `nil` for absent / unknown values so the chip is omitted.
    public static func from(rawValue value: String?) -> EmergencySeverity? {
        guard let value, let parsed = EmergencySeverity(rawValue: value) else {
            return nil
        }
        return parsed
    }
}
