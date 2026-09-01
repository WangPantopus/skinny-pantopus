//
//  SpeciesPalette.swift
//  Pantopus
//
//  T5.2.1 — Per-species visual tokens for the Pets row. Lifted from the
//  design at `more-designed-pages/pets-frames.jsx:22-30`. Feature code
//  (PetsListViewModel, etc.) references these typed swatches; no hex
//  literal ever appears in `Features/**`.
//
//  Why not in `Theme.Color`? These are gradient stops + per-species chip
//  pairs that don't fit the existing `(name) → (single Color)` semantic
//  token model. Lifting them into their own palette file keeps `Theme`
//  semantic-only and keeps Pets free of ad-hoc hex literals.
//

import SwiftUI

/// Backend species enum from `backend/routes/home.js:6766` (`createPetSchema`).
/// Kept lowercase to match the wire format.
public enum PetSpecies: String, CaseIterable, Sendable {
    case dog
    case cat
    case bird
    case fish
    case reptile
    case rabbit
    case hamster
    case other

    /// Title-case label rendered in the inline species chip.
    public var label: String {
        switch self {
        case .dog: "Dog"
        case .cat: "Cat"
        case .bird: "Bird"
        case .fish: "Fish"
        case .reptile: "Reptile"
        case .rabbit: "Rabbit"
        case .hamster: "Hamster"
        case .other: "Other"
        }
    }

    /// Visual bucket — the design ships five canonical palettes (Dog, Cat,
    /// Bird, Reptile, Fish) plus one `Other` fallback. Rabbit + hamster
    /// + any unknown future species collapse to `.other`.
    public var palette: SpeciesPalette {
        switch self {
        case .dog: .dog
        case .cat: .cat
        case .bird: .bird
        case .fish: .fish
        case .reptile: .reptile
        case .rabbit, .hamster, .other: .other
        }
    }

    /// Best-effort parser for the wire value (lowercase enum) plus the
    /// Title-case label the design uses for display.
    public static func parse(_ raw: String?) -> PetSpecies {
        guard let raw, !raw.isEmpty else { return .other }
        return PetSpecies(rawValue: raw.lowercased()) ?? .other
    }
}

/// Six canonical species swatches from the design. Each carries:
///   - `iconBackground` — 2-stop linear gradient (135°) painted into the
///     64pt rounded-square leading thumbnail
///   - `iconForeground` — fallback icon tint (also the chip text colour
///     of the species pill — they're the same value in the design)
///   - `chipBackground` — light tint for the inline species chip
///   - `icon` — fallback `PantopusIcon` rendered when no `photo_url`
public enum SpeciesPalette: Sendable, CaseIterable {
    case dog
    case cat
    case bird
    case reptile
    case fish
    case other

    /// Gradient pair painted as `LinearGradient` from topLeading to
    /// bottomTrailing (135° in CSS terms).
    public var iconBackground: GradientPair {
        switch self {
        case .dog:
            // #fed7aa → #fb923c
            GradientPair(
                start: Color(red: 0xFE / 255.0, green: 0xD7 / 255.0, blue: 0xAA / 255.0),
                end: Color(red: 0xFB / 255.0, green: 0x92 / 255.0, blue: 0x3C / 255.0)
            )
        case .cat:
            // #ddd6fe → #a78bfa
            GradientPair(
                start: Color(red: 0xDD / 255.0, green: 0xD6 / 255.0, blue: 0xFE / 255.0),
                end: Color(red: 0xA7 / 255.0, green: 0x8B / 255.0, blue: 0xFA / 255.0)
            )
        case .bird:
            // #bfdbfe → #60a5fa
            GradientPair(
                start: Color(red: 0xBF / 255.0, green: 0xDB / 255.0, blue: 0xFE / 255.0),
                end: Color(red: 0x60 / 255.0, green: 0xA5 / 255.0, blue: 0xFA / 255.0)
            )
        case .reptile:
            // #bbf7d0 → #4ade80
            GradientPair(
                start: Color(red: 0xBB / 255.0, green: 0xF7 / 255.0, blue: 0xD0 / 255.0),
                end: Color(red: 0x4A / 255.0, green: 0xDE / 255.0, blue: 0x80 / 255.0)
            )
        case .fish:
            // #a5f3fc → #22d3ee
            GradientPair(
                start: Color(red: 0xA5 / 255.0, green: 0xF3 / 255.0, blue: 0xFC / 255.0),
                end: Color(red: 0x22 / 255.0, green: 0xD3 / 255.0, blue: 0xEE / 255.0)
            )
        case .other:
            // #e5e7eb → #9ca3af
            GradientPair(
                start: Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0),
                end: Color(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0)
            )
        }
    }

    /// Foreground tint for the icon glyph (and the species chip text).
    public var iconForeground: Color {
        switch self {
        case .dog:
            // #7c2d12
            Color(red: 0x7C / 255.0, green: 0x2D / 255.0, blue: 0x12 / 255.0)
        case .cat:
            // #4c1d95
            Color(red: 0x4C / 255.0, green: 0x1D / 255.0, blue: 0x95 / 255.0)
        case .bird:
            // #1e3a8a
            Color(red: 0x1E / 255.0, green: 0x3A / 255.0, blue: 0x8A / 255.0)
        case .reptile:
            // #14532d
            Color(red: 0x14 / 255.0, green: 0x53 / 255.0, blue: 0x2D / 255.0)
        case .fish:
            // #155e75
            Color(red: 0x15 / 255.0, green: 0x5E / 255.0, blue: 0x75 / 255.0)
        case .other:
            // #1f2937
            Color(red: 0x1F / 255.0, green: 0x29 / 255.0, blue: 0x37 / 255.0)
        }
    }

    /// Light-tint chip background for the inline species pill beside the
    /// pet name. Paired with `chipForeground` (= `iconForeground`'s darker
    /// sibling per design).
    public var chipBackground: Color {
        switch self {
        case .dog:
            // #ffedd5
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .cat:
            // #ede9fe
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .bird:
            // #dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .reptile:
            // #dcfce7
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .fish:
            // #cffafe
            Color(red: 0xCF / 255.0, green: 0xFA / 255.0, blue: 0xFE / 255.0)
        case .other:
            // #f3f4f6
            Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
        }
    }

    /// Chip text colour — design uses a darker shade than `iconForeground`
    /// to read well on `chipBackground`.
    public var chipForeground: Color {
        switch self {
        case .dog:
            // #9a3412
            Color(red: 0x9A / 255.0, green: 0x34 / 255.0, blue: 0x12 / 255.0)
        case .cat:
            // #5b21b6
            Color(red: 0x5B / 255.0, green: 0x21 / 255.0, blue: 0xB6 / 255.0)
        case .bird:
            // #1e40af
            Color(red: 0x1E / 255.0, green: 0x40 / 255.0, blue: 0xAF / 255.0)
        case .reptile:
            // #166534
            Color(red: 0x16 / 255.0, green: 0x65 / 255.0, blue: 0x34 / 255.0)
        case .fish:
            // #155e75
            Color(red: 0x15 / 255.0, green: 0x5E / 255.0, blue: 0x75 / 255.0)
        case .other:
            // #374151
            Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0)
        }
    }

    /// Fallback `PantopusIcon` drawn over the gradient when the pet has
    /// no `photo_url`.
    public var icon: PantopusIcon {
        switch self {
        case .dog: .dog
        case .cat: .cat
        case .bird: .bird
        case .reptile: .turtle
        case .fish: .fish
        case .other: .pawPrint
        }
    }
}
