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
//  The four design categories collapse the nine backend
//  `HomeEmergency.type` enum values:
//    shutoff_water · shutoff_gas · shutoff_electric · breaker_map →
//      `shutoff` (slate tile, view-photo action)
//    emergency_contacts → `contact` (sky tile, tap-to-call action)
//    evac_plan → `evac` (amber tile, open-in-maps action)
//    first_aid · extinguisher → `medical` (rose tile, tap-to-call action)
//    other → `contact` fallback (a contact is the safest default)
//

import SwiftUI

/// One of the four design categories — drives section grouping,
/// chip-strip filter ids, leading-tile colour, and the per-category
/// action icon on the row's trailing slot.
public enum EmergencyCategory: String, CaseIterable, Sendable {
    case shutoff
    case contact
    case evac
    case medical

    /// User-facing label rendered on the section header + chip.
    public var label: String {
        switch self {
        case .shutoff: "Shutoffs"
        case .contact: "Contacts"
        case .evac: "Evacuation"
        case .medical: "Medical"
        }
    }

    /// Short label rendered on the chip-strip filter pill.
    public var chipLabel: String {
        switch self {
        case .shutoff: "Shutoffs"
        case .contact: "Contacts"
        case .evac: "Evac"
        case .medical: "Medical"
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
        }
    }

    /// Soft-tinted background for the 40pt leading tile + section disc.
    public var background: Color {
        switch self {
        case .shutoff:
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
        case .shutoff:
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

    /// The per-row trailing affordance for this category. The design
    /// (`emergency-frames.jsx:54-59`) varies the icon by intent:
    ///   shutoff → view photo
    ///   contact → tap-to-call
    ///   evac    → open in maps
    ///   medical → tap-to-call
    public var actionIcon: PantopusIcon {
        switch self {
        case .shutoff: .image
        case .contact: .phoneCall
        case .evac: .mapPin
        case .medical: .phoneCall
        }
    }

    /// Spoken accessibility label for the action button.
    public var actionAccessibilityLabel: String {
        switch self {
        case .shutoff: "View shutoff photo"
        case .contact: "Call"
        case .evac: "Open in Maps"
        case .medical: "Call"
        }
    }

    // MARK: - Backend type mapping

    /// Map a `HomeEmergency.type` enum value to the design category.
    /// Backend has 9 type constants; the 4-bucket design rolls them up.
    /// Falls back to `.contact` for `other` and unknown strings — a
    /// contact is the safest default for a household emergency item.
    public static func from(type: String) -> EmergencyCategory {
        switch type {
        case "shutoff_water", "shutoff_gas", "shutoff_electric", "breaker_map":
            .shutoff
        case "emergency_contacts":
            .contact
        case "evac_plan":
            .evac
        case "first_aid", "extinguisher":
            .medical
        default:
            .contact
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
        default: from(type: type).icon
        }
    }
}
