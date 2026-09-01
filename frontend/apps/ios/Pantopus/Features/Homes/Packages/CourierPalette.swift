//
//  CourierPalette.swift
//  Pantopus
//
//  T6.3d (P14) — Per-courier visual tokens for the Packages row. Lifted
//  from the design at `packages-frames.jsx:51-63`. Feature code
//  (`PackagesListViewModel`, etc.) references these typed swatches; no
//  hex literal appears in `Features/Homes/Packages/**` outside this
//  file (mirrors the `UtilityCategoryPalette` exception model — these
//  are per-courier chip pairs that don't fit `Theme.Color`'s
//  `name → single Color` semantic model).
//
//  Courier inference: client-side substring match on
//  `PackageDTO.carrier` (the backend column is free-form text — no
//  enum). Returns `.generic` when the string is empty or doesn't match
//  any known carrier.
//

import SwiftUI

/// The 7 designed courier tints + a `generic` fallback for any carrier
/// the inference helper can't classify.
public enum CourierKind: String, CaseIterable, Sendable {
    case amazon
    case ups
    case usps
    case fedex
    case dhl
    case ontrac
    case local
    case generic

    /// User-facing display label.
    public var label: String {
        switch self {
        case .amazon: "Amazon"
        case .ups: "UPS"
        case .usps: "USPS"
        case .fedex: "FedEx"
        case .dhl: "DHL"
        case .ontrac: "OnTrac"
        case .local: "Local"
        case .generic: "Other"
        }
    }

    /// 4-letter short code displayed on the courier tile. Kept short so
    /// the 40pt leading tile reads at a glance.
    public var code: String {
        switch self {
        case .amazon: "AMZN"
        case .ups: "UPS"
        case .usps: "USPS"
        case .fedex: "FDX"
        case .dhl: "DHL"
        case .ontrac: "OTC"
        case .local: "LCL"
        case .generic: "PKG"
        }
    }

    /// Lucide icon glyph for the 40pt courier tile.
    public var icon: PantopusIcon {
        switch self {
        case .amazon: .package
        case .ups: .package
        case .usps: .mailbox
        case .fedex: .package
        case .dhl: .package
        case .ontrac: .package
        case .local: .package
        case .generic: .package
        }
    }

    /// Soft-tinted background for the 40pt courier tile.
    public var background: Color {
        switch self {
        case .amazon:
            // CSS fef3c7
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .ups:
            // CSS f5e8da
            Color(red: 0xF5 / 255.0, green: 0xE8 / 255.0, blue: 0xDA / 255.0)
        case .usps:
            // CSS dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .fedex:
            // CSS ede9fe
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        case .dhl:
            // CSS fef9c3
            Color(red: 0xFE / 255.0, green: 0xF9 / 255.0, blue: 0xC3 / 255.0)
        case .ontrac:
            // CSS ffedd5
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .local:
            // CSS dcfce7
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .generic:
            // primary50 — matches Theme.Color.primary50 token.
            Color(red: 0xF0 / 255.0, green: 0xF9 / 255.0, blue: 0xFF / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the 40pt tile.
    public var foreground: Color {
        switch self {
        case .amazon:
            // CSS c2410c
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .ups:
            // CSS 7c3a0f
            Color(red: 0x7C / 255.0, green: 0x3A / 255.0, blue: 0x0F / 255.0)
        case .usps:
            // CSS 1d4ed8
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .fedex:
            // CSS 5b21b6
            Color(red: 0x5B / 255.0, green: 0x21 / 255.0, blue: 0xB6 / 255.0)
        case .dhl:
            // CSS a16207
            Color(red: 0xA1 / 255.0, green: 0x62 / 255.0, blue: 0x07 / 255.0)
        case .ontrac:
            // CSS c2410c
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .local:
            // CSS 15803d
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .generic:
            // primary600 — matches Theme.Color.primary600 token.
            Color(red: 0x02 / 255.0, green: 0x84 / 255.0, blue: 0xC7 / 255.0)
        }
    }

    // MARK: - Carrier inference

    /// Client-side inference from the free-form `carrier` text on
    /// `PackageDTO`. Case-insensitive substring match, first match wins.
    /// Returns `.generic` when no pattern matches.
    public static func from(carrier: String?) -> CourierKind {
        guard let carrier, !carrier.isEmpty else { return .generic }
        let lower = carrier.lowercased()
        for entry in patterns where entry.matchers.contains(where: { lower.contains($0) }) {
            return entry.kind
        }
        return .generic
    }

    private struct Pattern {
        let kind: CourierKind
        let matchers: [String]
    }

    /// **Order matters** — branded patterns before generic substrings.
    /// "ups store" before "ups"; "amazon logistics" matches under
    /// "amazon" via substring scan.
    private static let patterns: [Pattern] = [
        Pattern(kind: .amazon, matchers: ["amazon", "amzl"]),
        Pattern(kind: .fedex, matchers: ["fedex", "fed ex"]),
        Pattern(kind: .usps, matchers: ["usps", "united states postal", "us postal"]),
        Pattern(kind: .dhl, matchers: ["dhl"]),
        Pattern(kind: .ontrac, matchers: ["ontrac", "lasership"]),
        Pattern(kind: .ups, matchers: ["ups"]),
        Pattern(kind: .local, matchers: ["local", "courier", "messenger", "bike"])
    ]
}
