//
//  AccessCategoryPalette.swift
//  Pantopus
//
//  T6.4a — Per-category visual tokens for the Access codes row. Lifted
//  from the design at `access-frames.jsx:47-54`, extended with the
//  `smart_lock` category called out in the T6.4a brief.
//
//  Feature code (AccessCodesViewModel, etc.) references these typed
//  swatches; no hex literal appears in `Features/**` outside this file.
//  Same rationale as `UtilityCategoryPalette`: per-category chip pairs
//  don't fit `Theme.Color`'s single-color semantic-token model.
//

import SwiftUI

/// The 6 categories surfaced on the Access codes screen. Raw values
/// match the backend `HomeAccessSecret.access_type` enum string.
public enum AccessCategory: String, CaseIterable, Sendable, Hashable {
    case wifi
    case alarm
    case gate
    case lockbox
    case garage
    case smartLock = "smart_lock"

    /// User-facing label.
    public var label: String {
        switch self {
        case .wifi: "Wi-Fi"
        case .alarm: "Alarm"
        case .gate: "Gate"
        case .lockbox: "Lockbox"
        case .garage: "Garage"
        case .smartLock: "Smart lock"
        }
    }

    /// Display order on the screen — same order the chip strip renders
    /// the filter chips in.
    public static let displayOrder: [AccessCategory] = [
        .wifi, .alarm, .gate, .lockbox, .garage, .smartLock
    ]

    /// Lucide icon glyph for the 40pt category tile. Maps to the closest
    /// available `PantopusIcon` case — visual signal is reinforced by
    /// the per-category background tint.
    public var icon: PantopusIcon {
        switch self {
        case .wifi: .wifi
        case .alarm: .shieldAlert
        case .gate: .shield
        case .lockbox: .lock
        case .garage: .building2
        case .smartLock: .shieldCheck
        }
    }

    /// Soft-tinted background for the 40pt category tile.
    public var background: Color {
        switch self {
        case .wifi:
            // CSS dbeafe — sky-100
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .alarm:
            // CSS fee2e2 — red-100
            Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)
        case .gate:
            // CSS e0e7ff — indigo-100
            Color(red: 0xE0 / 255.0, green: 0xE7 / 255.0, blue: 0xFF / 255.0)
        case .lockbox:
            // CSS fef3c7 — amber-100
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .garage:
            // CSS e2e8f0 — slate-200
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .smartLock:
            // CSS ccfbf1 — teal-100
            Color(red: 0xCC / 255.0, green: 0xFB / 255.0, blue: 0xF1 / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .wifi:
            // CSS 1d4ed8 — blue-700
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .alarm:
            // CSS b91c1c — red-700
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        case .gate:
            // CSS 4338ca — indigo-700
            Color(red: 0x43 / 255.0, green: 0x38 / 255.0, blue: 0xCA / 255.0)
        case .lockbox:
            // CSS 92400e — amber-800
            Color(red: 0x92 / 255.0, green: 0x40 / 255.0, blue: 0x0E / 255.0)
        case .garage:
            // CSS 334155 — slate-700
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .smartLock:
            // CSS 0f766e — teal-700
            Color(red: 0x0F / 255.0, green: 0x76 / 255.0, blue: 0x6E / 255.0)
        }
    }

    /// Map a backend `access_type` string onto a typed category. Unknown
    /// values fall back to `.lockbox` so the row still renders. The
    /// fallback is documented in the parity audit so server-side renames
    /// surface as an empty category rather than a crash.
    public static func from(accessType: String?) -> AccessCategory {
        guard let accessType else { return .lockbox }
        let key = accessType.lowercased()
        return AccessCategory(rawValue: key) ?? fallback(for: key)
    }

    private static func fallback(for key: String) -> AccessCategory {
        if key.contains("wifi") || key.contains("network") { return .wifi }
        if key.contains("alarm") || key.contains("siren") { return .alarm }
        if key.contains("gate") || key.contains("fence") { return .gate }
        if key.contains("garage") || key.contains("opener") { return .garage }
        if key.contains("smart") || key.contains("digital") { return .smartLock }
        return .lockbox
    }

    /// Wire string sent to the backend on POST / PUT. The database
    /// CHECK constraint at `HomeAccessSecret_type_chk` only accepts
    /// `('wifi','door_code','gate_code','lockbox','garage','alarm','other')`
    /// so the two extra UI-side categories (`gate`, `smart_lock`) round-
    /// trip through the closest allowed strings (`gate_code`, `other`).
    public var backendAccessType: String {
        switch self {
        case .wifi: "wifi"
        case .alarm: "alarm"
        case .gate: "gate_code"
        case .lockbox: "lockbox"
        case .garage: "garage"
        case .smartLock: "other"
        }
    }
}
