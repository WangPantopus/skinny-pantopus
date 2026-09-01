//
//  HouseholdTaskCategoryPalette.swift
//  Pantopus
//
//  T6.3c — Per-chore-category visual tokens for the Household tasks row.
//  Lifted from the design at `householdtasks-frames.jsx:55-65`. Feature
//  code (HouseholdTasksListViewModel, etc.) references these typed
//  swatches; no hex literal appears in `Features/**` outside this file.
//
//  Same per-feature-palette exception as `UtilityCategoryPalette.swift`
//  for Bills — these are per-category chip pairs (icon-background +
//  icon-foreground) that don't fit the existing `(name) → (single
//  Color)` semantic token model.
//
//  Category is **client-derived from the task title** — there is no
//  backend `category` field on `HomeTask`. The schema's `task_type`
//  column carries 5 broad buckets (chore / shopping / project /
//  reminder / repair) that don't match the 8 design categories
//  (cleaning / trash / kitchen / laundry / yard / pet / errand / kids),
//  so the inference helper maps the **title** to a category, with the
//  `task_type` as a hint for the `other` fallback. Mirrors the
//  payee-to-category pattern in `UtilityCategoryPalette`.
//

import SwiftUI

/// The 8 designed chore categories + an `other` fallback for any title
/// the inference helper can't classify.
public enum HouseholdTaskCategory: String, CaseIterable, Sendable {
    case cleaning
    case trash
    case kitchen
    case laundry
    case yard
    case pet
    case errand
    case kids
    case other

    /// User-facing label.
    public var label: String {
        switch self {
        case .cleaning: "Cleaning"
        case .trash: "Trash"
        case .kitchen: "Kitchen"
        case .laundry: "Laundry"
        case .yard: "Yard"
        case .pet: "Pets"
        case .errand: "Errand"
        case .kids: "Kids"
        case .other: "Task"
        }
    }

    /// Lucide icon glyph for the 40pt category tile.
    public var icon: PantopusIcon {
        switch self {
        case .cleaning: .sparkles
        case .trash: .trash2
        case .kitchen: .utensils
        case .laundry: .shuffle
        case .yard: .leaf
        case .pet: .pawPrint
        case .errand: .shoppingBag
        case .kids: .baby
        case .other: .checkCircle
        }
    }

    /// Soft-tinted background for the 40pt category tile.
    public var background: Color {
        switch self {
        case .cleaning:
            // CSS dbeafe (sky-100)
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .trash:
            // CSS e2e8f0 (slate-200)
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .kitchen:
            // CSS fef3c7 (amber-100)
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .laundry:
            // CSS ede9fe (violet-100)
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .yard:
            // CSS dcfce7 (green-100)
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .pet:
            // CSS ffedd5 (orange-100)
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .errand:
            // CSS ccfbf1 (teal-100)
            Color(red: 0xCC / 255.0, green: 0xFB / 255.0, blue: 0xF1 / 255.0)
        case .kids:
            // CSS fce7f3 (pink-100)
            Color(red: 0xFC / 255.0, green: 0xE7 / 255.0, blue: 0xF3 / 255.0)
        case .other:
            // CSS f3f4f6 (gray-100)
            Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .cleaning:
            // CSS 1d4ed8 (blue-700)
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .trash:
            // CSS 334155 (slate-700)
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .kitchen:
            // CSS 92400e (amber-800)
            Color(red: 0x92 / 255.0, green: 0x40 / 255.0, blue: 0x0E / 255.0)
        case .laundry:
            // CSS 6d28d9 (violet-700)
            Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)
        case .yard:
            // CSS 15803d (green-700)
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .pet:
            // CSS c2410c (orange-700)
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .errand:
            // CSS 0f766e (teal-700)
            Color(red: 0x0F / 255.0, green: 0x76 / 255.0, blue: 0x6E / 255.0)
        case .kids:
            // CSS be185d (pink-700)
            Color(red: 0xBE / 255.0, green: 0x18 / 255.0, blue: 0x5D / 255.0)
        case .other:
            // CSS 374151 (gray-700)
            Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0)
        }
    }

    // MARK: - Title inference

    /// Client-side inference from a task title + optional `task_type`
    /// (case-insensitive substring match, first-match wins). Returns
    /// `.other` when no pattern matches. Adding a title → category
    /// pattern is a one-line edit to `patterns` plus a test fixture.
    public static func from(title: String?, taskType: String? = nil) -> HouseholdTaskCategory {
        guard let title, !title.isEmpty else {
            // Fall back to task_type when title is absent: shopping →
            // errand, otherwise other.
            if taskType?.lowercased() == "shopping" { return .errand }
            return .other
        }
        let lower = title.lowercased()
        for entry in patterns where entry.matchers.contains(where: { lower.contains($0) }) {
            return entry.category
        }
        // Fall back on task_type hints when title doesn't match.
        switch taskType?.lowercased() {
        case "shopping": return .errand
        case "repair": return .other // No "repair" category in the design palette.
        default: return .other
        }
    }

    private struct Pattern {
        let category: HouseholdTaskCategory
        let matchers: [String]
    }

    /// Ordered pattern table — first match wins. More specific patterns
    /// precede generic ones (e.g. "dishwasher" precedes "dish").
    private static let patterns: [Pattern] = [
        Pattern(
            category: .trash,
            matchers: ["trash", "garbage", "recycle", "recycling", "rubbish", "bin out", "bins out", "compost"]
        ),
        Pattern(
            category: .pet,
            matchers: [
                "walk the dog",
                "walk dog",
                "dog walk",
                "feed the dog",
                "feed the cat",
                "litter box",
                "dog",
                " cat ",
                "puppy",
                " pet ",
                "pet ",
                "vet "
            ]
        ),
        Pattern(
            category: .kitchen,
            matchers: [
                "dishwasher",
                "dishes",
                "dish",
                "cook",
                "meal",
                "fridge",
                "groceries away",
                "stove",
                "oven"
            ]
        ),
        Pattern(
            category: .laundry,
            matchers: [
                "laundry",
                "wash clothes",
                "fold clothes",
                "fold the laundry",
                "dryer",
                "ironing",
                "iron the"
            ]
        ),
        Pattern(
            category: .yard,
            matchers: [
                "water plants",
                "water the plants",
                "plants",
                "garden",
                "mow",
                "lawn",
                "rake",
                "leaves",
                "yard",
                "porch",
                "weed"
            ]
        ),
        Pattern(
            category: .cleaning,
            matchers: [
                "vacuum",
                "clean",
                "dust",
                "mop",
                "wipe",
                "scrub",
                "sweep",
                "tidy",
                "bathroom",
                "bedroom"
            ]
        ),
        Pattern(
            category: .errand,
            matchers: [
                "costco",
                "grocery",
                "groceries",
                "shopping",
                "shop ",
                "pick up",
                "pickup",
                "buy ",
                "errand",
                "store run",
                "post office",
                "pharmacy"
            ]
        ),
        Pattern(
            category: .kids,
            matchers: [
                "kid",
                "kids",
                "school",
                "homework",
                "lunchbox",
                "lunchboxes",
                "daycare",
                "playdate",
                "baby ",
                "diaper"
            ]
        )
    ]
}
