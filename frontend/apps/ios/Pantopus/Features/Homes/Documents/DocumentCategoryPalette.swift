//
//  DocumentCategoryPalette.swift
//  Pantopus
//
//  T6.4b — Per-category visual tokens for the DocumentsView section
//  headers + row chips. Lifted from `docs-frames.jsx:65-73`. Documented
//  exception to the no-hex rule (palette file, per iOS `CLAUDE.md`).
//
//  Maps the ten backend `HomeDocument.doc_type` enum values onto the
//  seven design categories:
//    lease → lease
//    insurance → insurance
//    warranty, manual → warranty
//    permit, floor_plan → permit
//    receipt → tax (receipts are tax-adjacent)
//    photo, paint_color, other → other (catch-all bucket, slate tile)
//

import SwiftUI

/// The seven designed categories plus an `other` catch-all bucket for
/// backend types the design doesn't enumerate (paint_color / photo /
/// other).
public enum DocumentCategory: String, CaseIterable, Sendable {
    case lease
    case insurance
    case warranty
    case tax
    case permit
    case hoa
    case identity = "id"
    case other

    /// Long-form label rendered on the section header.
    public var label: String {
        switch self {
        case .lease: "Lease & ownership"
        case .insurance: "Insurance"
        case .warranty: "Warranties & manuals"
        case .tax: "Tax & financial"
        case .permit: "Permits & inspections"
        case .hoa: "HOA & community"
        case .identity: "Identity proof"
        case .other: "Other"
        }
    }

    /// Glyph rendered on the 22pt section-header disc + row category chip.
    public var icon: PantopusIcon {
        switch self {
        case .lease: .fileSignature
        case .insurance: .shieldCheck
        case .warranty: .badgeCheck
        case .tax: .landmark
        case .permit: .stamp
        case .hoa: .building2
        case .identity: .idCard
        case .other: .file
        }
    }

    /// Soft-tinted background for the 22pt section disc + row chip.
    public var background: Color {
        switch self {
        case .lease:
            // CSS dcfce7
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .insurance:
            // CSS ccfbf1
            Color(red: 0xCC / 255.0, green: 0xFB / 255.0, blue: 0xF1 / 255.0)
        case .warranty:
            // CSS fef3c7
            Color(red: 0xFE / 255.0, green: 0xF3 / 255.0, blue: 0xC7 / 255.0)
        case .tax:
            // CSS e0e7ff
            Color(red: 0xE0 / 255.0, green: 0xE7 / 255.0, blue: 0xFF / 255.0)
        case .permit:
            // CSS ffedd5
            Color(red: 0xFF / 255.0, green: 0xED / 255.0, blue: 0xD5 / 255.0)
        case .hoa:
            // CSS dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .identity:
            // CSS fce7f3
            Color(red: 0xFC / 255.0, green: 0xE7 / 255.0, blue: 0xF3 / 255.0)
        case .other:
            // CSS e2e8f0 (slate — matches the FileType.archive tile so
            // the "other" bucket reads as neutral rather than as a real
            // category).
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        }
    }

    /// Foreground tint for the icon glyph inside the section disc + chip.
    public var foreground: Color {
        switch self {
        case .lease:
            // CSS 15803d
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .insurance:
            // CSS 0f766e
            Color(red: 0x0F / 255.0, green: 0x76 / 255.0, blue: 0x6E / 255.0)
        case .warranty:
            // CSS a16207
            Color(red: 0xA1 / 255.0, green: 0x62 / 255.0, blue: 0x07 / 255.0)
        case .tax:
            // CSS 4338ca
            Color(red: 0x43 / 255.0, green: 0x38 / 255.0, blue: 0xCA / 255.0)
        case .permit:
            // CSS c2410c
            Color(red: 0xC2 / 255.0, green: 0x41 / 255.0, blue: 0x0C / 255.0)
        case .hoa:
            // CSS 1d4ed8
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .identity:
            // CSS be185d
            Color(red: 0xBE / 255.0, green: 0x18 / 255.0, blue: 0x5D / 255.0)
        case .other:
            // CSS 334155
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        }
    }

    // MARK: - Backend type mapping

    /// Map a `HomeDocument.doc_type` enum value to the design category.
    /// The seven design categories don't 1:1 cover the ten backend
    /// types — `manual` rolls into `warranty`, `floor_plan` into
    /// `permit`, `receipt` into `tax`, and `paint_color` / `photo` /
    /// `other` collapse to `.other`.
    public static func from(docType: String) -> DocumentCategory {
        switch docType {
        case "lease": .lease
        case "insurance": .insurance
        case "warranty", "manual": .warranty
        case "permit", "floor_plan": .permit
        case "receipt": .tax
        default: .other
        }
    }

    /// Sort weight so sections render in the design's order
    /// (lease → insurance → warranty → tax → permit → hoa → id → other).
    public var sortOrder: Int {
        switch self {
        case .lease: 0
        case .insurance: 1
        case .warranty: 2
        case .tax: 3
        case .permit: 4
        case .hoa: 5
        case .identity: 6
        case .other: 7
        }
    }
}
