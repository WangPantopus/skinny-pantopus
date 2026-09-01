//
//  MaintenanceCategoryPalette.swift
//  Pantopus
//
//  T6.3b / P10 — Per-task-category visual tokens for the Maintenance
//  row. Lifted from the design at `maintenance-frames.jsx:49-63`
//  (the `TASK` map). Feature code (`MaintenanceListViewModel`, etc.)
//  references these typed swatches; no hex literal appears in
//  `Features/**` outside this file.
//
//  Why not in `Theme.Color`? These are per-category chip pairs (icon-
//  background + icon-foreground) that don't fit the existing
//  `(name) → (single Color)` semantic token model. Lifting them into
//  their own palette file keeps `Theme` semantic-only — same rationale
//  documented on `UtilityCategoryPalette.swift`.
//
//  Inference is client-side from the `task` string (case-insensitive
//  substring match, first-match wins). Backend has a richer
//  `HomeMaintenanceTemplate.maint_type` enum at
//  `backend/database/schema.sql:6431`, but the new `HomeMaintenanceLog`
//  rows don't carry a typed category column — the design relies on the
//  task title for visual signal, and the inference table here covers
//  the 12 most common annual maintenance jobs.
//

import SwiftUI

/// The 12 designed task categories + a `generic` fallback for any
/// task title the inference helper can't classify. The fallback is
/// rendered with the wrench glyph + primary sky tint — same default
/// the prompt spec calls out ("use wrench icon by default").
public enum MaintenanceCategory: String, CaseIterable, Sendable {
    case hvac
    case plumbing
    case electrical
    case roof
    case gutter
    case appliance
    case pest
    case landscape
    case cleaning
    case painting
    case safety
    case chimney
    case generic

    /// User-facing label (matches the design `TASK` map labels).
    public var label: String {
        switch self {
        case .hvac: "HVAC"
        case .plumbing: "Plumbing"
        case .electrical: "Electrical"
        case .roof: "Roof"
        case .gutter: "Gutters"
        case .appliance: "Appliance"
        case .pest: "Pest"
        case .landscape: "Landscape"
        case .cleaning: "Cleaning"
        case .painting: "Painting"
        case .safety: "Safety"
        case .chimney: "Chimney"
        case .generic: "Other"
        }
    }

    /// Lucide icon glyph for the 40pt category tile.
    public var icon: PantopusIcon {
        switch self {
        case .hvac: .fan
        case .plumbing: .wrench
        case .electrical: .zap
        case .roof: .home
        case .gutter: .cloudRain
        case .appliance: .refrigerator
        case .pest: .bug
        case .landscape: .trees
        case .cleaning: .sparkles
        case .painting: .paintRoller
        case .safety: .bellRing
        case .chimney: .flame
        case .generic: .wrench
        }
    }

    /// Soft-tinted background for the 40pt category tile. Hex values
    /// mirror `maintenance-frames.jsx:49-63` exactly.
    public var background: Color {
        switch self {
        case .hvac:
            // CSS fef3c7 — yellow-100
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .plumbing:
            // CSS dbeafe — blue-100
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .electrical:
            // CSS fef9c3 — yellow-100 (electrical bolt)
            Color(red: 0xFE / 255.0, green: 0xF9 / 255.0, blue: 0xC3 / 255.0)
        case .roof:
            // CSS e2e8f0 — slate-200
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .gutter:
            // CSS ccfbf1 — teal-100
            Color(red: 0xCC / 255.0, green: 0xFB / 255.0, blue: 0xF1 / 255.0)
        case .appliance:
            // CSS e0e7ff — indigo-100
            Color(red: 0xE0 / 255.0, green: 0xE7 / 255.0, blue: 0xFF / 255.0)
        case .pest:
            // CSS fee2e2 — red-100
            Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)
        case .landscape:
            // CSS dcfce7 — green-100
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .cleaning:
            // CSS cffafe — cyan-100
            Color(red: 0xCF / 255.0, green: 0xFA / 255.0, blue: 0xFE / 255.0)
        case .painting:
            // CSS ede9fe — violet-100
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .safety:
            // CSS fed7aa — orange-200
            Color(red: 0xFE / 255.0, green: 0xD7 / 255.0, blue: 0xAA / 255.0)
        case .chimney:
            // CSS fecaca — red-200
            Color(red: 0xFE / 255.0, green: 0xCA / 255.0, blue: 0xCA / 255.0)
        case .generic:
            // primary50 — matches Theme.Color.primary50 token.
            Color(red: 0xF0 / 255.0, green: 0xF9 / 255.0, blue: 0xFF / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .hvac:
            // CSS a16207 — yellow-700
            Color(red: 0xA1 / 255.0, green: 0x62 / 255.0, blue: 0x07 / 255.0)
        case .plumbing:
            // CSS 1d4ed8 — blue-700
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .electrical:
            // CSS a16207 — yellow-700
            Color(red: 0xA1 / 255.0, green: 0x62 / 255.0, blue: 0x07 / 255.0)
        case .roof:
            // CSS 334155 — slate-700
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .gutter:
            // CSS 0f766e — teal-700
            Color(red: 0x0F / 255.0, green: 0x76 / 255.0, blue: 0x6E / 255.0)
        case .appliance:
            // CSS 4338ca — indigo-700
            Color(red: 0x43 / 255.0, green: 0x38 / 255.0, blue: 0xCA / 255.0)
        case .pest:
            // CSS b91c1c — red-700
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        case .landscape:
            // CSS 15803d — green-700
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .cleaning:
            // CSS 0e7490 — cyan-700
            Color(red: 0x0E / 255.0, green: 0x74 / 255.0, blue: 0x90 / 255.0)
        case .painting:
            // CSS 6d28d9 — violet-700
            Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)
        case .safety:
            // CSS c2410c — orange-700
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .chimney:
            // CSS b91c1c — red-700
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        case .generic:
            // primary600 — matches Theme.Color.primary600 token.
            Color(red: 0x02 / 255.0, green: 0x84 / 255.0, blue: 0xC7 / 255.0)
        }
    }

    // MARK: - Task title inference

    /// Client-side inference from a task title (case-insensitive
    /// substring match, first-match wins). Returns `.generic` when no
    /// pattern matches — the design's spec defaults to the wrench
    /// glyph and primary tint, which `.generic` carries.
    ///
    /// Patterns are explicit constants here so future categories bolt
    /// on without touching the row mapper.
    public static func from(task: String?) -> MaintenanceCategory {
        guard let task, !task.isEmpty else { return .generic }
        let lower = task.lowercased()
        for entry in patterns where entry.matchers.contains(where: { lower.contains($0) }) {
            return entry.category
        }
        return .generic
    }

    private struct Pattern {
        let category: MaintenanceCategory
        let matchers: [String]
    }

    /// Ordered pattern table. **Order matters** — first match wins, so
    /// more-specific patterns sit before generic ones (e.g. "chimney
    /// sweep" wins over "sweep" which could otherwise hit cleaning).
    private static let patterns: [Pattern] = [
        // Chimney — fireplaces / soot. First so "chimney sweep" doesn't
        // hit the cleaning branch below.
        Pattern(
            category: .chimney,
            matchers: ["chimney", "fireplace", "flue", "soot"]
        ),
        // Plumbing — water lines, drains, water heater.
        Pattern(
            category: .plumbing,
            matchers: [
                "plumbing", "plumber", "leak", "drain", "faucet",
                "water heater", "toilet", "pipe", "sump pump"
            ]
        ),
        // HVAC — heating + cooling + air filtration. Kept after
        // plumbing so "water heater" wins before generic "heater".
        Pattern(
            category: .hvac,
            matchers: [
                "hvac", "furnace", "air condition", "ac unit", "heater",
                "boiler", "thermostat", "duct", "vent",
                "filter swap", "filter change", "air filter"
            ]
        ),
        // Electrical — circuits + outlets.
        Pattern(
            category: .electrical,
            matchers: [
                "electrical", "electrician", "wiring", "outlet",
                "breaker", "panel", "circuit"
            ]
        ),
        // Roof — shingles, flashing.
        Pattern(
            category: .roof,
            matchers: ["roof", "shingle", "flashing"]
        ),
        // Gutter / downspout.
        Pattern(
            category: .gutter,
            matchers: ["gutter", "downspout"]
        ),
        // Appliance.
        Pattern(
            category: .appliance,
            matchers: [
                "appliance", "fridge", "refrigerator", "dishwasher",
                "washer", "dryer", "oven", "microwave", "disposal"
            ]
        ),
        // Pest control.
        Pattern(
            category: .pest,
            matchers: [
                "pest", "exterminate", "termite", "rodent", "ant",
                "roach", "mouse", "rats"
            ]
        ),
        // Landscaping + yard.
        Pattern(
            category: .landscape,
            matchers: [
                "landscape", "yard", "lawn", "mow", "garden",
                "tree", "hedge", "mulch", "irrigation"
            ]
        ),
        // Cleaning.
        Pattern(
            category: .cleaning,
            matchers: ["clean", "wash", "pressure wash", "deep clean"]
        ),
        // Painting.
        Pattern(
            category: .painting,
            matchers: ["paint", "stain", "primer"]
        ),
        // Safety — smoke + CO alarms, fire extinguishers.
        Pattern(
            category: .safety,
            matchers: [
                "alarm", "smoke detector", "co detector", "carbon monoxide",
                "fire extinguisher", "safety check"
            ]
        )
    ]
}
