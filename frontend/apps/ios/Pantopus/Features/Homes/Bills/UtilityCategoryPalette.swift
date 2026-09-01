//
//  UtilityCategoryPalette.swift
//  Pantopus
//
//  T6.0a — Per-utility-category visual tokens for the Bills row. Lifted
//  from the design at `bills-frames.jsx:53-62`. Feature code
//  (BillsListViewModel, etc.) references these typed swatches; no hex
//  literal appears in `Features/**` outside this file.
//
//  Why not in `Theme.Color`? These are per-category chip pairs (icon-
//  background + icon-foreground) that don't fit the existing
//  `(name) → (single Color)` semantic token model. Lifting them into
//  their own palette file keeps `Theme` semantic-only.
//
//  Per the T6 open-question Q2 decision (see
//  `docs/t6-open-questions-decisions.md`), category is **client-derived
//  from the payee string** — there is no backend `category` field today
//  on `HomeBill`. `UtilityCategory.from(payee:)` is the canonical
//  inference helper, used by iOS, Android, and web in parallel.
//

import SwiftUI

/// The 8 designed utility categories + a `generic` fallback for any
/// payee the inference helper can't classify.
public enum UtilityCategory: String, CaseIterable, Sendable {
    case electric
    case gas
    case water
    case internetService = "internet"
    case hoa
    case insurance
    case trash
    case phone
    case generic

    /// User-facing label.
    public var label: String {
        switch self {
        case .electric: "Electric"
        case .gas: "Gas"
        case .water: "Water"
        case .internetService: "Internet"
        case .hoa: "HOA"
        case .insurance: "Insurance"
        case .trash: "Trash"
        case .phone: "Phone"
        case .generic: "Bill"
        }
    }

    /// Lucide icon glyph for the 40pt category tile.
    public var icon: PantopusIcon {
        switch self {
        case .electric: .zap
        case .gas: .flame
        case .water: .droplet
        case .internetService: .wifi
        case .hoa: .building2
        case .insurance: .shieldCheck
        case .trash: .trash2
        case .phone: .smartphone
        case .generic: .receipt
        }
    }

    /// Soft-tinted background for the 40pt category tile.
    public var background: Color {
        switch self {
        case .electric:
            // CSS fef9c3
            Color(red: 0xFE / 255.0, green: 0xF9 / 255.0, blue: 0xC3 / 255.0)
        case .gas:
            // CSS ffedd5
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .water:
            // CSS dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .internetService:
            // CSS ede9fe
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .hoa:
            // CSS dcfce7
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .insurance:
            // CSS ccfbf1
            Color(red: 0xCC / 255.0, green: 0xFB / 255.0, blue: 0xF1 / 255.0)
        case .trash:
            // CSS e2e8f0
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .phone:
            // CSS fee2e2
            Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)
        case .generic:
            // primary50 — matches Theme.Color.primary50 token.
            Color(red: 0xF0 / 255.0, green: 0xF9 / 255.0, blue: 0xFF / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .electric:
            // CSS a16207
            Color(red: 0xA1 / 255.0, green: 0x62 / 255.0, blue: 0x07 / 255.0)
        case .gas:
            // CSS c2410c
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .water:
            // CSS 1d4ed8
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .internetService:
            // CSS 6d28d9
            Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)
        case .hoa:
            // CSS 15803d
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .insurance:
            // CSS 0f766e
            Color(red: 0x0F / 255.0, green: 0x76 / 255.0, blue: 0x6E / 255.0)
        case .trash:
            // CSS 334155
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .phone:
            // CSS b91c1c
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        case .generic:
            // primary600 — matches Theme.Color.primary600 token.
            Color(red: 0x02 / 255.0, green: 0x84 / 255.0, blue: 0xC7 / 255.0)
        }
    }

    // MARK: - Payee inference

    /// Client-side inference from a payee string (case-insensitive
    /// substring match, first-match wins). Returns `.generic` when no
    /// pattern matches. Per the T6 Q2 decision, this is the source of
    /// truth for category until/unless the backend exposes a typed
    /// field on `HomeBill`.
    ///
    /// Patterns are explicit constants here so future categories bolt on
    /// without touching the row mapper. Adding a payee → category
    /// pattern is a one-line edit to `patterns` plus a test fixture.
    public static func from(payee: String?) -> UtilityCategory {
        guard let payee, !payee.isEmpty else { return .generic }
        let lower = payee.lowercased()
        for entry in patterns where entry.matchers.contains(where: { lower.contains($0) }) {
            return entry.category
        }
        return .generic
    }

    /// Ordered pattern table. **Order matters** — first match wins, so
    /// more-specific patterns sit before generic ones (e.g. "verizon
    /// wireless" precedes "verizon"; "comcast" precedes "att" so a
    /// fictitious "att comcast" string lands on internet not phone).
    private struct Pattern {
        let category: UtilityCategory
        let matchers: [String]
    }

    private static let patterns: [Pattern] = [
        // Gas — branded gas providers first, then generic.
        Pattern(
            category: .gas,
            matchers: [
                "national grid gas", "socalgas", "southern california gas",
                "atmos", "centerpoint", "national fuel", "spire",
                "natural gas", "gas company", "gas bill", " gas"
            ]
        ),
        // Electric — utility brands first, generic "electric" last.
        Pattern(
            category: .electric,
            matchers: [
                "pg&e", "pge", "coned", "con ed", "edison",
                "dominion", "duke energy", "eversource",
                "national grid", "pacificorp", "xcel",
                "electric"
            ]
        ),
        // Water — water board / municipal water + sewer.
        Pattern(
            category: .water,
            matchers: [
                "water board", "water works", "municipal water",
                "aqua", "sewer", "wastewater", "water"
            ]
        ),
        // Internet — ISPs + fiber brands.
        Pattern(
            category: .internetService,
            matchers: [
                "comcast", "xfinity", "spectrum", "fios",
                "starlink", "google fiber", "earthlink", "cox",
                "frontier", "centurylink", "viasat", "hughesnet",
                "internet"
            ]
        ),
        // HOA + condo associations.
        Pattern(
            category: .hoa,
            matchers: [
                "hoa", "homeowners association", "homeowners assoc",
                "condo assn", "condo association", "strata"
            ]
        ),
        // Insurance — branded carriers + generic.
        Pattern(
            category: .insurance,
            matchers: [
                "state farm", "geico", "allstate", "progressive",
                "liberty mutual", "farmers insurance", "nationwide",
                "aaa auto", "metlife", "insurance"
            ]
        ),
        // Trash + refuse + recycling.
        Pattern(
            category: .trash,
            matchers: [
                "waste management", "republic services", "recology",
                "refuse", "trash", "garbage", "recycling"
            ]
        ),
        // Phone — branded carriers + generic.
        Pattern(
            category: .phone,
            matchers: [
                "t-mobile", "tmobile", "sprint", "mint mobile",
                "google fi", "boost mobile", "cricket",
                "wireless", "cell phone", "phone bill", "phone"
            ]
        )
    ]
}
