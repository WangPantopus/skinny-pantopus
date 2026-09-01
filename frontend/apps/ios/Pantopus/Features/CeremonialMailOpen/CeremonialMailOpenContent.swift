//
//  CeremonialMailOpenContent.swift
//  Pantopus
//
//  Render-only model for the Ceremonial Mail Open screen, refreshed
//  in T6.5d (P22) to match the 4-frame design (Porch arrival ·
//  Opening · Reading · Reply compose handoff). The four phases map
//  1:1 to the frames in `ceremonial-mail-frames.jsx`:
//
//    .sealed    → Frame 1 (porch arrival — envelope rests on porch)
//    .breaking  → Frame 2 (opening mid-state — flap lifted, paper rising)
//    .open      → Frame 3 (reading — paper-bg letter body + voice PS)
//    .replying  → Frame 4 (reply compose handoff to A25)
//

import SwiftUI

public enum CeremonialMailPhase: String, Sendable, Hashable {
    case sealed, breaking, open, replying
}

/// Stationery palette per the design's seasonal themes. The legacy
/// values (`classic_cream`, `midnight_blue`, `linen`, `botanical`)
/// continue to round-trip on the wire so existing drafts keep
/// rendering; new drafts pick one of the seasonal palettes.
public enum CeremonialMailStationeryTone: String, Sendable, Hashable {
    case classicCream = "classic_cream"
    case midnightBlue = "midnight_blue"
    case linen
    case botanical
    case fall
    case winter
    case spring
    case summer
    case evergreen

    public init(wire: String?) {
        switch wire {
        case "midnight_blue": self = .midnightBlue
        case "linen": self = .linen
        case "botanical": self = .botanical
        case "fall": self = .fall
        case "winter": self = .winter
        case "spring": self = .spring
        case "summer": self = .summer
        case "evergreen": self = .evergreen
        default: self = .classicCream
        }
    }

    /// Paper base. Per-tone palette files live alongside this enum;
    /// the hex values are documented as a per-feature palette exception
    /// (paper-stock colors are not on the design-token scale).
    public var paperColor: Color {
        switch self {
        case .classicCream: Color(red: 248 / 255, green: 240 / 255, blue: 222 / 255)
        case .midnightBlue: Color(red: 224 / 255, green: 228 / 255, blue: 240 / 255)
        case .linen: Color(red: 250 / 255, green: 247 / 255, blue: 240 / 255)
        case .botanical: Color(red: 235 / 255, green: 244 / 255, blue: 232 / 255)
        case .fall: Color(red: 240 / 255, green: 226 / 255, blue: 196 / 255)
        case .winter: Color(red: 236 / 255, green: 233 / 255, blue: 226 / 255)
        case .spring: Color(red: 244 / 255, green: 239 / 255, blue: 220 / 255)
        case .summer: Color(red: 246 / 255, green: 230 / 255, blue: 211 / 255)
        case .evergreen: Color(red: 31 / 255, green: 46 / 255, blue: 38 / 255)
        }
    }

    /// Deeper edge tone of the paper, used in the envelope SVG gradient.
    public var paperEdgeColor: Color {
        switch self {
        case .classicCream: Color(red: 220 / 255, green: 210 / 255, blue: 188 / 255)
        case .midnightBlue: Color(red: 200 / 255, green: 206 / 255, blue: 224 / 255)
        case .linen: Color(red: 226 / 255, green: 220 / 255, blue: 206 / 255)
        case .botanical: Color(red: 208 / 255, green: 222 / 255, blue: 204 / 255)
        case .fall: Color(red: 217 / 255, green: 196 / 255, blue: 154 / 255)
        case .winter: Color(red: 211 / 255, green: 207 / 255, blue: 198 / 255)
        case .spring: Color(red: 218 / 255, green: 211 / 255, blue: 184 / 255)
        case .summer: Color(red: 222 / 255, green: 203 / 255, blue: 180 / 255)
        case .evergreen: Color(red: 15 / 255, green: 25 / 255, blue: 20 / 255)
        }
    }

    public var paperShadow: Color {
        Color.black.opacity(0.12)
    }

    /// Porch-background radial gradient sweep for Frame 1 / 2.
    /// Returns a stack of two colors at top + bottom of the porch.
    public var porchTopColor: Color {
        switch self {
        case .fall: Color(red: 244 / 255, green: 201 / 255, blue: 127 / 255)
        case .winter: Color(red: 195 / 255, green: 212 / 255, blue: 226 / 255)
        case .spring: Color(red: 196 / 255, green: 226 / 255, blue: 178 / 255)
        case .summer: Color(red: 244 / 255, green: 196 / 255, blue: 134 / 255)
        case .evergreen: Color(red: 60 / 255, green: 82 / 255, blue: 68 / 255)
        case .midnightBlue: Color(red: 80 / 255, green: 100 / 255, blue: 150 / 255)
        case .linen, .botanical, .classicCream: Color(red: 230 / 255, green: 210 / 255, blue: 180 / 255)
        }
    }

    public var porchBottomColor: Color {
        switch self {
        case .fall: Color(red: 111 / 255, green: 52 / 255, blue: 57 / 255)
        case .winter: Color(red: 56 / 255, green: 70 / 255, blue: 90 / 255)
        case .spring: Color(red: 86 / 255, green: 124 / 255, blue: 78 / 255)
        case .summer: Color(red: 138 / 255, green: 70 / 255, blue: 55 / 255)
        case .evergreen: Color(red: 18 / 255, green: 30 / 255, blue: 24 / 255)
        case .midnightBlue: Color(red: 22 / 255, green: 32 / 255, blue: 70 / 255)
        case .linen, .botanical, .classicCream: Color(red: 130 / 255, green: 90 / 255, blue: 70 / 255)
        }
    }
}

public enum CeremonialMailInkTone: String, Sendable, Hashable {
    case walnut, navy, sepia, forest
    case iron
    case mahogany
    case ivory

    public init(wire: String?) {
        switch wire {
        case "navy": self = .navy
        case "sepia": self = .sepia
        case "forest": self = .forest
        case "iron": self = .iron
        case "mahogany": self = .mahogany
        case "ivory": self = .ivory
        default: self = .walnut
        }
    }

    public var color: Color {
        switch self {
        case .walnut: Color(red: 92 / 255, green: 56 / 255, blue: 32 / 255)
        case .navy: Color(red: 30 / 255, green: 56 / 255, blue: 96 / 255)
        case .sepia: Color(red: 110 / 255, green: 75 / 255, blue: 40 / 255)
        case .forest: Color(red: 38 / 255, green: 70 / 255, blue: 44 / 255)
        case .iron: Color(red: 42 / 255, green: 38 / 255, blue: 32 / 255)
        case .mahogany: Color(red: 59 / 255, green: 36 / 255, blue: 24 / 255)
        case .ivory: Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255)
        }
    }
}

public enum CeremonialMailSealTone: String, Sendable, Hashable {
    case waxRed = "wax_red"
    case waxBlue = "wax_blue"
    case waxBlack = "wax_black"
    case fall
    case winter
    case spring
    case summer
    case evergreen
    case none

    public init(wire: String?) {
        switch wire {
        case "wax_blue": self = .waxBlue
        case "wax_black": self = .waxBlack
        case "fall": self = .fall
        case "winter": self = .winter
        case "spring": self = .spring
        case "summer": self = .summer
        case "evergreen": self = .evergreen
        case "none": self = .none
        default: self = .waxRed
        }
    }

    public var color: Color {
        switch self {
        case .waxRed: Color(red: 168 / 255, green: 32 / 255, blue: 38 / 255)
        case .waxBlue: Color(red: 32 / 255, green: 64 / 255, blue: 130 / 255)
        case .waxBlack: Color(red: 30 / 255, green: 30 / 255, blue: 30 / 255)
        case .fall: Color(red: 140 / 255, green: 59 / 255, blue: 42 / 255)
        case .winter: Color(red: 75 / 255, green: 100 / 255, blue: 120 / 255)
        case .spring: Color(red: 107 / 255, green: 142 / 255, blue: 78 / 255)
        case .summer: Color(red: 179 / 255, green: 97 / 255, blue: 63 / 255)
        case .evergreen: Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255)
        case .none: Color.clear
        }
    }
}

public struct CeremonialSenderCard: Sendable, Hashable {
    public let displayName: String
    public let handle: String?
    public let trustLabel: String?
    public let avatarUrl: String?

    public init(displayName: String, handle: String?, trustLabel: String?, avatarUrl: String?) {
        self.displayName = displayName
        self.handle = handle
        self.trustLabel = trustLabel
        self.avatarUrl = avatarUrl
    }
}

public struct CeremonialOutcomeCTA: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon
    public let style: Style

    public enum Style: String, Sendable { case primary, ghost }

    public init(id: String, label: String, icon: PantopusIcon, style: Style) {
        self.id = id
        self.label = label
        self.icon = icon
        self.style = style
    }
}

public struct CeremonialMailLetter: Sendable, Hashable {
    public let mailId: String
    public let sender: CeremonialSenderCard
    public let category: String
    public let subject: String
    public let bodyParagraphs: [String]
    public let stationery: CeremonialMailStationeryTone
    public let ink: CeremonialMailInkTone
    public let seal: CeremonialMailSealTone
    public let voicePostscriptUri: String?
    public let receivedAt: String?
    public let outcomeCtas: [CeremonialOutcomeCTA]

    public init(
        mailId: String,
        sender: CeremonialSenderCard,
        category: String,
        subject: String,
        bodyParagraphs: [String],
        stationery: CeremonialMailStationeryTone,
        ink: CeremonialMailInkTone,
        seal: CeremonialMailSealTone,
        voicePostscriptUri: String?,
        receivedAt: String?,
        outcomeCtas: [CeremonialOutcomeCTA]
    ) {
        self.mailId = mailId
        self.sender = sender
        self.category = category
        self.subject = subject
        self.bodyParagraphs = bodyParagraphs
        self.stationery = stationery
        self.ink = ink
        self.seal = seal
        self.voicePostscriptUri = voicePostscriptUri
        self.receivedAt = receivedAt
        self.outcomeCtas = outcomeCtas
    }
}

public enum CeremonialMailOpenState: Sendable {
    case loading
    case loaded(CeremonialMailLetter, phase: CeremonialMailPhase)
    case error(message: String)
}

public extension CeremonialMailLetter {
    /// Stock CTAs every open letter ships with: Write back (primary)
    /// + Save (ghost) + Just read (ghost).
    static func defaultOutcomeCtas() -> [CeremonialOutcomeCTA] {
        [
            CeremonialOutcomeCTA(id: "write_back", label: "Write back", icon: .send, style: .primary),
            CeremonialOutcomeCTA(id: "save", label: "Save to records", icon: .check, style: .ghost),
            CeremonialOutcomeCTA(id: "just_read", label: "Just read", icon: .check, style: .ghost)
        ]
    }
}
