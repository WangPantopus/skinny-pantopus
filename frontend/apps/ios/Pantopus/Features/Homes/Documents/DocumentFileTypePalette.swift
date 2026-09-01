//
//  DocumentFileTypePalette.swift
//  Pantopus
//
//  T6.4b — Per-MIME-type visual tokens for the DocumentsView row's
//  leading tile. Lifted from `docs-frames.jsx:54-62`. Documented
//  exception to the no-hex rule (palette file, per iOS `CLAUDE.md`).
//
//  Derived client-side from `HomeDocument.mime_type` because the
//  backend stores the raw MIME string with no normalised file-type
//  column — mirrors the Bills `UtilityCategory.from(payee:)` pattern.
//

import SwiftUI

/// Display-only file-type bucket — drives the leading 40×48 tile's
/// colour pair, icon glyph, and tiny extension stamp.
public enum DocumentFileType: String, CaseIterable, Sendable {
    case pdf
    case image
    case doc
    case sheet
    case archive
    case scan

    /// Three-letter stamp printed in the bottom of the tile.
    public var stamp: String {
        switch self {
        case .pdf: "PDF"
        case .image: "JPG"
        case .doc: "DOC"
        case .sheet: "XLS"
        case .archive: "ZIP"
        case .scan: "PDF"
        }
    }

    /// Glyph rendered above the stamp inside the tile.
    public var icon: PantopusIcon {
        switch self {
        case .pdf: .fileText
        case .image: .image
        case .doc: .fileType
        case .sheet: .fileSpreadsheet
        case .archive: .archive
        case .scan: .scanLine
        }
    }

    /// Soft-tinted background for the 40×48 file-type tile.
    public var background: Color {
        switch self {
        case .pdf:
            // CSS fee2e2
            Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0)
        case .image:
            // CSS dbeafe
            Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0)
        case .doc:
            // CSS e0e7ff
            Color(red: 0xE0 / 255.0, green: 0xE7 / 255.0, blue: 0xFF / 255.0)
        case .sheet:
            // CSS dcfce7
            Color(red: 0xDC / 255.0, green: 0xFC / 255.0, blue: 0xE7 / 255.0)
        case .archive:
            // CSS e2e8f0
            Color(red: 0xE2 / 255.0, green: 0xE8 / 255.0, blue: 0xF0 / 255.0)
        case .scan:
            // CSS ede9fe
            Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0)
        }
    }

    /// Foreground tint for the glyph + stamp inside the tile.
    public var foreground: Color {
        switch self {
        case .pdf:
            // CSS b91c1c
            Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0)
        case .image:
            // CSS 1d4ed8
            Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0)
        case .doc:
            // CSS 4338ca
            Color(red: 0x43 / 255.0, green: 0x38 / 255.0, blue: 0xCA / 255.0)
        case .sheet:
            // CSS 15803d
            Color(red: 0x15 / 255.0, green: 0x80 / 255.0, blue: 0x3D / 255.0)
        case .archive:
            // CSS 334155
            Color(red: 0x33 / 255.0, green: 0x41 / 255.0, blue: 0x55 / 255.0)
        case .scan:
            // CSS 6d28d9
            Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0)
        }
    }

    // MARK: - Inference

    /// Infer the file-type bucket from a backend `mime_type` string.
    /// Defaults to `.pdf` for unknown MIME types because PDFs dominate
    /// the populated design and the red tile is the most legible
    /// fallback. Filename extensions take precedence over MIME when
    /// the MIME is missing or generic (e.g. `application/octet-stream`).
    public static func from(mimeType: String?, filename: String? = nil) -> DocumentFileType {
        let mime = mimeType?.lowercased() ?? ""
        if !mime.isEmpty, mime != "application/octet-stream" {
            if mime == "application/pdf" { return .pdf }
            if mime.hasPrefix("image/") { return .image }
            if mime == "application/msword"
                || mime.hasPrefix("application/vnd.openxmlformats-officedocument.wordprocessingml")
                || mime == "application/vnd.oasis.opendocument.text" {
                return .doc
            }
            if mime == "application/vnd.ms-excel"
                || mime.hasPrefix("application/vnd.openxmlformats-officedocument.spreadsheetml")
                || mime == "text/csv"
                || mime == "application/vnd.oasis.opendocument.spreadsheet" {
                return .sheet
            }
            if mime == "application/zip"
                || mime == "application/x-zip-compressed"
                || mime == "application/x-tar"
                || mime == "application/x-gzip" {
                return .archive
            }
        }
        // Fallback: inspect the filename extension if MIME was empty or
        // generic.
        let ext = (filename ?? "")
            .lowercased()
            .split(separator: ".")
            .last
            .map(String.init) ?? ""
        switch ext {
        case "pdf": return .pdf
        case "jpg", "jpeg", "png", "gif", "heic", "webp", "tiff": return .image
        case "doc", "docx", "odt", "rtf", "txt": return .doc
        case "xls", "xlsx", "csv", "ods", "numbers": return .sheet
        case "zip", "tar", "gz", "rar", "7z": return .archive
        default: return .pdf
        }
    }
}
