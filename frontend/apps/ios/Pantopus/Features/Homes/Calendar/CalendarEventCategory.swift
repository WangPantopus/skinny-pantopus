//
//  CalendarEventCategory.swift
//  Pantopus
//
//  T6.4c — Per-event-type visual tokens for the Home calendar row.
//  Lifted from the design at `calendar-frames.jsx:53-66`. Feature code
//  (HomeCalendarViewModel, etc.) references these typed swatches; no
//  hex literal appears anywhere else in `Features/Homes/Calendar/**`.
//
//  Per the buildout-plan convention (CLAUDE.md "Token discipline"),
//  per-feature category palettes are an explicit exception to the
//  "no hex outside Theme" rule — same pattern as `UtilityCategoryPalette`
//  for Bills and `SpeciesPalette` for Pets.
//
//  Category is **client-derived from the backend `event_type` string**.
//  `CalendarEventCategory.from(eventType:)` is the canonical inference
//  helper, used by iOS, Android, and web in parallel.
//

import SwiftUI

/// The designed event categories + a `generic` fallback for any
/// `event_type` the inference helper can't classify.
public enum CalendarEventCategory: String, CaseIterable, Sendable {
    case chore
    case maintenance
    case delivery
    case family
    case birthday
    case social
    case school
    case pet
    case bill
    case medical
    case meal
    case trash
    /// Vendor/guest visits scheduled via F13 (`event_type` vendor|guest).
    case visit
    case generic

    /// User-facing label rendered in the inline event-type chip.
    public var label: String {
        switch self {
        case .chore: "Chore"
        case .maintenance: "Repair"
        case .delivery: "Delivery"
        case .family: "Family"
        case .birthday: "Birthday"
        case .social: "Social"
        case .school: "School"
        case .pet: "Pet"
        case .bill: "Bill"
        case .medical: "Medical"
        case .meal: "Meal"
        case .trash: "Trash day"
        case .visit: "Visit"
        case .generic: "Event"
        }
    }

    /// Label used by the Home add/edit-event category picker. The picker
    /// surfaces the design's 5-category vocabulary (health/chore/meal/family/
    /// school — `add-event-frames.jsx:8`, `CAT` in `home-shell.jsx`) where the
    /// copy differs from the agenda `label` ("Health" vs "Medical",
    /// pluralised "Chores"/"Meals").
    public var pickerLabel: String {
        switch self {
        case .medical: "Health"
        case .chore: "Chores"
        case .meal: "Meals"
        case .family: "Family"
        case .school: "School"
        default: label
        }
    }

    /// Lucide icon glyph for the 40pt category tile.
    public var icon: PantopusIcon {
        switch self {
        case .chore: .sparkles
        case .maintenance: .wrench
        case .delivery: .package
        case .family: .usersRound
        case .birthday: .gift
        case .social: .partyPopper
        case .school: .graduationCap
        case .pet: .pawPrint
        case .bill: .receipt
        case .medical: .stethoscope
        case .meal: .utensils
        case .trash: .trash2
        case .visit: .doorOpen
        case .generic: .calendar
        }
    }

    /// Soft-tinted background for the 40pt category tile.
    public var background: Color {
        switch self {
        case .chore:
            // CSS fef3c7
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .maintenance:
            // CSS ffedd5
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .delivery:
            // CSS e2e8f0
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .family:
            // CSS dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .birthday:
            // CSS fce7f3
            Color(red: 0xFC / 255.0, green: 0xE7 / 255.0, blue: 0xF3 / 255.0)
        case .social:
            // CSS ede9fe
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .school:
            // CSS cffafe
            Color(red: 0xCF / 255.0, green: 0xFA / 255.0, blue: 0xFE / 255.0)
        case .pet:
            // CSS dcfce7 — same as homeBg, matches the Pet pillar.
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .bill:
            // CSS f0fdf4
            Color(red: 0xF0 / 255.0, green: 0xFD / 255.0, blue: 0xF4 / 255.0)
        case .medical:
            // CSS fee2e2
            Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)
        case .meal:
            // CSS fef3c7 — warm amber, pairs with the design meal dot d97706.
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .trash:
            // CSS e2e8f0
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .visit:
            // CSS ccfbf1 — soft teal, pairs with the design visit dot 0d9488.
            Color(red: 0xCC / 255.0, green: 0xFB / 255.0, blue: 0xF1 / 255.0)
        case .generic:
            // primary50
            Color(red: 0xF0 / 255.0, green: 0xF9 / 255.0, blue: 0xFF / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .chore:
            // CSS a16207
            Color(red: 0xA1 / 255.0, green: 0x62 / 255.0, blue: 0x07 / 255.0)
        case .maintenance:
            // CSS c2410c
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .delivery:
            // CSS 334155
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .family:
            // CSS 1d4ed8
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .birthday:
            // CSS be185d
            Color(red: 0xBE / 255.0, green: 0x18 / 255.0, blue: 0x5D / 255.0)
        case .social:
            // CSS 6d28d9
            Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)
        case .school:
            // CSS 0e7490
            Color(red: 0x0E / 255.0, green: 0x74 / 255.0, blue: 0x90 / 255.0)
        case .pet:
            // CSS 15803d — pairs with .home for the pet pillar.
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .bill:
            // CSS 15803d
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .medical:
            // CSS b91c1c
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        case .meal:
            // CSS d97706 — design meal accent.
            Color(red: 0xD9 / 255.0, green: 0x77 / 255.0, blue: 0x06 / 255.0)
        case .trash:
            // CSS 334155
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .visit:
            // CSS 0f766e — teal 700
            Color(red: 0x0F / 255.0, green: 0x76 / 255.0, blue: 0x6E / 255.0)
        case .generic:
            // primary600
            Color(red: 0x02 / 255.0, green: 0x84 / 255.0, blue: 0xC7 / 255.0)
        }
    }

    /// Solid category dot rendered in the Home add/edit-event picker pill.
    /// Mirrors the design's `CAT[*].c` swatch (`home-shell.jsx:28-35`) for the
    /// five picker categories; other categories reuse `foreground`.
    public var dotColor: Color {
        switch self {
        case .medical:
            // CSS e11d48 — design "health" dot.
            Color(red: 0xE1 / 255.0, green: 0x1D / 255.0, blue: 0x48 / 255.0)
        case .chore:
            // CSS f97316 — design "chore" dot.
            Color(red: 0xF9 / 255.0, green: 0x73 / 255.0, blue: 0x16 / 255.0)
        case .meal:
            // CSS d97706 — design "meal" dot.
            Color(red: 0xD9 / 255.0, green: 0x77 / 255.0, blue: 0x06 / 255.0)
        case .family:
            // CSS 7c3aed — design "family" dot.
            Color(red: 0x7C / 255.0, green: 0x3A / 255.0, blue: 0xED / 255.0)
        case .school:
            // CSS 2980b9 — design "school" dot.
            Color(red: 0x29 / 255.0, green: 0x80 / 255.0, blue: 0xB9 / 255.0)
        case .visit:
            // CSS 0d9488 — design "visit" dot (CAT.visit, home-shell.jsx:34).
            Color(red: 0x0D / 255.0, green: 0x94 / 255.0, blue: 0x88 / 255.0)
        default:
            foreground
        }
    }

    // MARK: - Inference

    /// Map a backend `event_type` string to one of the designed
    /// categories. Case-insensitive substring match — unknown strings
    /// fall back to `.generic`. Mirrors the iOS / Android / web inference
    /// pattern documented in `docs/t6-buildout-plan.md`.
    public static func from(eventType: String?) -> CalendarEventCategory {
        guard let raw = eventType?.lowercased(), !raw.isEmpty else {
            return .generic
        }
        return rawTypeMap[raw] ?? heuristicCategory(for: raw)
    }

    /// Exact-match table. Tries the wire string verbatim first.
    private static let rawTypeMap: [String: CalendarEventCategory] = [
        "chore": .chore,
        "cleaning": .chore,
        "task": .chore,
        "maintenance": .maintenance,
        "repair": .maintenance,
        "service": .maintenance,
        "delivery": .delivery,
        "package": .delivery,
        "amazon": .delivery,
        "family": .family,
        "kids": .family,
        "birthday": .birthday,
        "anniversary": .birthday,
        "social": .social,
        "party": .social,
        "school": .school,
        "education": .school,
        "pet": .pet,
        "vet": .pet,
        "bill": .bill,
        "payment": .bill,
        "medical": .medical,
        "doctor": .medical,
        "appointment": .medical,
        "meal": .meal,
        "breakfast": .meal,
        "lunch": .meal,
        "dinner": .meal,
        "trash": .trash,
        "garbage": .trash,
        "recycling": .trash,
        "visit": .visit,
        "vendor": .visit,
        "guest": .visit,
        "general": .generic
    ]

    /// Ordered keyword table backing `heuristicCategory` — first rule whose
    /// keyword substring-matches wins, so ordering is load-bearing (e.g.
    /// "vet_visit" must hit `.pet` before the `.visit` rule).
    private static let heuristicRules: [(keywords: [String], category: CalendarEventCategory)] = [
        (["birthday", "anniversary"], .birthday),
        (["vet", "pet"], .pet),
        (["bill", "payment"], .bill),
        (["doctor", "medical", "dentist"], .medical),
        (["trash", "garbage", "recycling"], .trash),
        (["school", "class"], .school),
        (["delivery", "package", "amazon"], .delivery),
        (["meal", "breakfast", "lunch", "dinner", "brunch", "supper"], .meal),
        (["party", "social"], .social),
        (["visit", "vendor", "guest"], .visit),
        (["repair", "maintenance", "plumber", "electrician", "hvac"], .maintenance),
        (["chore", "clean"], .chore),
        (["family", "kids"], .family)
    ]

    /// Fallback heuristics for noisier backend strings (`"vet_appt"`,
    /// `"birthday_party"`, etc.). First substring match wins.
    private static func heuristicCategory(for raw: String) -> CalendarEventCategory {
        for rule in heuristicRules where rule.keywords.contains(where: raw.contains) {
            return rule.category
        }
        return .generic
    }
}
