//
//  EmergencyCategoryPalette.swift
//  Pantopus
//
//  T6.4b — Per-emergency-category visual tokens for the
//  EmergencyInfoView row. Lifted from `emergency-frames.jsx:54-59`.
//  Feature code references typed swatches; no hex literal lives in
//  `Features/**` outside this palette file (documented exception per
//  the iOS `CLAUDE.md` token rules).
//
//  Legacy household records and current form categories share these
//  visual tokens. Unknown records stay in Other instead of implying
//  they contain a contact or a phone number.
//

import SwiftUI

/// An emergency category — drives section grouping,
/// chip-strip filter ids, leading-tile colour, and the per-category
/// action icon on the row's trailing slot.
public enum EmergencyCategory: String, CaseIterable, Sendable {
    case shutoff
    case contact
    case evac
    case medical
    case other

    /// User-facing label rendered on the section header + chip.
    public var label: String {
        switch self {
        case .shutoff: "Shutoffs"
        case .contact: "Contacts"
        case .evac: "Evacuation"
        case .medical: "Medical"
        case .other: "Other"
        }
    }

    /// Short label rendered on the chip-strip filter pill.
    public var chipLabel: String {
        switch self {
        case .shutoff: "Shutoffs"
        case .contact: "Contacts"
        case .evac: "Evac"
        case .medical: "Medical"
        case .other: "Other"
        }
    }

    /// Category-default glyph rendered on the 22pt section-header disc
    /// and as a fallback when the row's specific `type` doesn't map to
    /// a more descriptive item glyph.
    public var icon: PantopusIcon {
        switch self {
        case .shutoff: .power
        case .contact: .phone
        case .evac: .navigation
        case .medical: .heartPulse
        case .other: .info
        }
    }

    /// Soft-tinted background for the 40pt leading tile + section disc.
    public var background: Color {
        switch self {
        case .shutoff, .other:
            // CSS e2e8f0
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .contact:
            // CSS dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .evac:
            // CSS ffedd5
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .medical:
            // CSS fee2e2
            Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt leading tile.
    public var foreground: Color {
        switch self {
        case .shutoff, .other:
            // CSS 334155
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .contact:
            // CSS 1d4ed8
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .evac:
            // CSS c2410c
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .medical:
            // CSS b91c1c
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        }
    }

    // MARK: - Backend type mapping

    /// Preserve both legacy types and the categories accepted by the form.
    public static func from(type: String) -> EmergencyCategory {
        switch type {
        case "shutoff_water", "shutoff_gas", "shutoff_electric", "breaker_map":
            .shutoff
        case "emergency_contacts", "contact":
            .contact
        case "evac_plan":
            .evac
        case "first_aid", "extinguisher", "allergy", "medical_condition", "medication", "pet_medical":
            .medical
        default:
            .other
        }
    }

    /// Per-`type` row glyph — more descriptive than the category default
    /// when the backend has finer detail. Maps the nine type constants
    /// to a per-row icon; uses the category default for `other`.
    public static func glyph(for type: String) -> PantopusIcon {
        switch type {
        case "shutoff_water": .droplet
        case "shutoff_gas": .flame
        case "shutoff_electric": .zap
        case "breaker_map": .power
        case "extinguisher": .flameKindling
        case "first_aid": .cross
        case "evac_plan": .flag
        case "emergency_contacts": .phone
        default: EmergencyFormCategory.from(type: type)?.icon ?? from(type: type).icon
        }
    }
}
