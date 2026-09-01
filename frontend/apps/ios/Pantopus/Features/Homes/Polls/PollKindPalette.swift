//
//  PollKindPalette.swift
//  Pantopus
//
//  T6.3e — Per-poll-kind visual tokens for the Polls row. Lifted from
//  the design at `polls-frames.jsx:50-55`. Feature code (PollsListViewModel,
//  PollDetailView) references these typed swatches; no hex literal appears
//  in `Features/**` outside this file.
//
//  Why not in `Theme.Color`? These are per-kind tile pairs (background +
//  foreground) that don't fit the existing `(name) → (single Color)`
//  semantic token model. Lifting them into their own palette file keeps
//  `Theme` semantic-only.
//
//  Kind classification is client-derived: the backend's `poll_type` enum
//  (`single_choice / multiple_choice / yes_no / ranking`) maps to a kind,
//  and the title is sniffed for schedule keywords (`when`, `date`,
//  `weekend`, day-of-week names) to upgrade `single_choice` polls into
//  `schedule` when appropriate. The backend has no separate `kind` field
//  today; this inference is the source of truth.
//

import SwiftUI

/// The 4 designed poll kinds. Drives the leading-tile palette + icon.
public enum PollKind: String, CaseIterable, Sendable, Hashable {
    /// Multiple labelled options — pick one (e.g. paint colours).
    case decision
    /// Day / date picker — pick one schedule slot.
    case schedule
    /// Binary yes/no vote.
    case yesno
    /// Open-ended — multiple selections allowed.
    case open

    /// User-facing label (rendered in the row's archetype overline).
    public var label: String {
        switch self {
        case .decision: "Decision"
        case .schedule: "Schedule"
        case .yesno: "Yes/No"
        case .open: "Open"
        }
    }

    /// Lucide icon glyph for the 40pt kind tile. Mapped to the closest
    /// available `PantopusIcon` case (we don't have `list-checks`,
    /// `calendar-days`, or `scale` glyphs — `.clipboardList`,
    /// `.calendar`, `.checkCircle` are the in-palette substitutes).
    public var icon: PantopusIcon {
        switch self {
        case .decision: .clipboardList
        case .schedule: .calendar
        case .yesno: .checkCircle
        case .open: .messageCircle
        }
    }

    /// Soft-tinted background for the 40pt tile.
    public var background: Color {
        switch self {
        case .decision:
            // CSS ede9fe — violet-100
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .schedule:
            // CSS dbeafe — blue-100
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .yesno:
            // CSS dcfce7 — green-100
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .open:
            // CSS e2e8f0 — slate-200
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .decision:
            // CSS 6d28d9 — violet-700
            Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)
        case .schedule:
            // CSS 1d4ed8 — blue-700
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .yesno:
            // CSS 15803d — green-700
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .open:
            // CSS 334155 — slate-700
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        }
    }

    // MARK: - Inference

    /// Derive a `PollKind` from the backend's `poll_type` + title. Used
    /// by the row mapper. `poll_type == "yes_no"` always wins; everything
    /// else falls through the title sniff (schedule keywords) before
    /// defaulting to `decision` (for single/ranking) or `open` (for
    /// multiple_choice).
    public static func from(pollType: String, title: String) -> PollKind {
        let normalisedType = pollType.lowercased().replacingOccurrences(of: "-", with: "_")
        if normalisedType == "yes_no" || normalisedType == "yesno" {
            return .yesno
        }
        if isScheduleTitle(title) {
            return .schedule
        }
        switch normalisedType {
        case "multiple_choice": return .open
        case "ranking", "single_choice": return .decision
        default: return .decision
        }
    }

    /// Lightweight keyword sniff — first-match wins. Keywords are
    /// substrings (case-insensitive) of the title.
    private static let scheduleKeywords: [String] = [
        "when ", "what day", "what date", "which day", "which date",
        "weekend", "schedule", "saturday", "sunday", "monday", "tuesday",
        "wednesday", "thursday", "friday", " date ", " date?", "date?"
    ]

    private static func isScheduleTitle(_ title: String) -> Bool {
        let lower = " " + title.lowercased() + " "
        return scheduleKeywords.contains { lower.contains($0) }
    }
}

/// Neutral slate tint used by the "Leading: <option>" chip on active
/// poll rows. Lives in the palette file so feature code stays
/// hex-literal-free per universal convention.
public enum PollLeadingChipTint {
    /// CSS f1f5f9 — slate-100. Pill background.
    public static let background =
        Color(red: 0xF1 / 255.0, green: 0xF5 / 255.0, blue: 0xF9 / 255.0)
    /// CSS 334155 — slate-700. Pill foreground (icon + text).
    public static let foreground =
        Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
}
