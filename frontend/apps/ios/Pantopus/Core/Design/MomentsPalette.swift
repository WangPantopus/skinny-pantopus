//
//  MomentsPalette.swift
//  Pantopus
//
//  Moments' own colours (design canvas "Pantopus Moments Screens", 2026-11-08):
//  the ring around someone with a Moment new to you (sky to green), the grey
//  of one already watched, the surface the rings and bubbles sit on, the six
//  text-card backgrounds, and the soft initials discs the boards give people
//  without a photo. Kept here, like `SkyPalette`, so no hex literal reaches
//  `Features/**`.
//

import SwiftUI
import UIKit

public enum MomentsPalette {
    /// The ring of a Moment new to you runs from sky (top leading) to green.
    public static let ringStart = rgb(0x0EA5E9)
    public static let ringEnd = rgb(0x10B981)

    public static var ringGradient: LinearGradient {
        LinearGradient(colors: [ringStart, ringEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    /// A ring whose Moments you have all watched.
    public static let ringSeen = dynamic(light: 0xC4CAD3, dark: 0x4B5563)
    /// The posting ring's track, under its progress.
    public static let ringTrack = dynamic(light: 0xE5E7EB, dark: 0x2B313B)
    /// The disc under a ring, the bubble's fill and the pin's tail.
    public static let pinSurface = dynamic(light: 0xFFFFFF, dark: 0x161B22)
    /// The tint behind "21h left" and "Replied" in Seen by, and the empty card's icon.
    public static let tint = dynamic(light: 0xE0F2FE, dark: 0x122A3D)

    /// A text card's two gradient stops (160°, top to bottom), by its background name.
    public static func card(_ name: String?) -> (top: Color, bottom: Color) {
        switch name {
        case "sky": (rgb(0x0369A1), rgb(0x075985))
        case "green": (rgb(0x15803D), rgb(0x166534))
        case "amber": (rgb(0xB45309), rgb(0x92400E))
        case "rose": (rgb(0xBE123C), rgb(0x9F1239))
        case "slate": (rgb(0x334155), rgb(0x1E293B))
        default: (rgb(0x0F766E), rgb(0x115E59))
        }
    }

    /// A floating pin's shadow on the map (part D, board F1): a deep blue-black, never pure black.
    public static let floatShadow = rgb(0x0E1622)

    /// A height band's colour (board H2's key), on the map's tag and in the key; always beside the number or a name.
    public static func height(_ band: MomentHeightBand) -> Color {
        switch band {
        case .low: dynamic(light: 0x15803D, dark: 0x22C55E)
        case .hills: dynamic(light: 0x84CC16, dark: 0xA3E635)
        case .mountain: dynamic(light: 0xF59E0B, dark: 0xFBBF24)
        case .peak: dynamic(light: 0xBE123C, dark: 0xFB7185)
        case .flying: dynamic(light: 0x0284C7, dark: 0x38BDF8)
        }
    }

    /// A soft initials disc: its fill and its ink, light and dark.
    public enum Tone: Int, CaseIterable, Sendable {
        case blue, green, amber, rose, slate, teal, violet

        public var fill: Color {
            switch self {
            case .blue: dynamic(light: 0xDBEAFE, dark: 0x122036)
            case .green: dynamic(light: 0xDCFCE7, dark: 0x102A1C)
            case .amber: dynamic(light: 0xFEF3C7, dark: 0x2A2110)
            case .rose: dynamic(light: 0xFFE4E6, dark: 0x2A1418)
            case .slate: dynamic(light: 0xE2E8F0, dark: 0x1E2530)
            case .teal: dynamic(light: 0xCCFBF1, dark: 0x0D211E)
            case .violet: dynamic(light: 0xF3E8FF, dark: 0x221833)
            }
        }

        public var ink: Color {
            switch self {
            case .blue: dynamic(light: 0x0369A1, dark: 0x38BDF8)
            case .green: dynamic(light: 0x15803D, dark: 0x4ADE80)
            case .amber: dynamic(light: 0xB45309, dark: 0xFBBF24)
            case .rose: dynamic(light: 0xBE123C, dark: 0xFB7185)
            case .slate: dynamic(light: 0x334155, dark: 0xCBD5E1)
            case .teal: dynamic(light: 0x0F766E, dark: 0x5EEAD4)
            case .violet: dynamic(light: 0x7C3AED, dark: 0xA78BFA)
            }
        }

        /// The same tone for the same person every time (and on Android):
        /// a 31-multiplier sum of the id's characters, modulo the tones.
        public static func of(_ id: String) -> Tone {
            let sum = id.unicodeScalars.reduce(0) { ($0 * 31 + Int($1.value)) % 1_000_003 }
            return Tone(rawValue: sum % allCases.count) ?? .blue
        }
    }

    // MARK: - Helpers

    static func rgb(_ value: UInt32) -> Color {
        Color(uiColor: uiColor(value))
    }

    static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            uiColor(traits.userInterfaceStyle == .dark ? dark : light)
        })
    }

    private static func uiColor(_ value: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}
