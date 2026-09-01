//
//  OwnerProofPalette.swift
//  Pantopus
//
//  P15 / T6.3g — Per-feature palette for the Owners row proof chip.
//  The design at `owners-frames.jsx:59-64` ships a four-tone matrix
//  ({Deed, Title, Document, Pending} × {bg, fg, icon}); each tone maps
//  cleanly to an existing semantic token so this file is reference-only
//  — no hex literals appear.
//
//  Why a per-feature palette file? The Owners proof tones are derived
//  from a non-trivial join of the `HomeOwner.owner_status` +
//  `verification_tier` enums. Lifting the mapping out of the view-model
//  keeps the projection table colocated with the design source.
//

import SwiftUI

/// Proof tone displayed on the row chip. Maps the `HomeOwner` row
/// (status + verification tier) onto one of four design buckets.
public enum OwnerProof: Sendable, CaseIterable {
    /// Gold-standard — county-recorded deed on file.
    case deed
    /// Title document on file.
    case title
    /// Manually uploaded document.
    case document
    /// Awaiting verification.
    case pending

    /// Chip label rendered in the inline proof pill.
    public var label: String {
        switch self {
        case .deed: "Deed"
        case .title: "Title"
        case .document: "Document"
        case .pending: "Pending"
        }
    }

    /// Verbose body line rendered under the subtitle (e.g. "Deed on
    /// file"). Mirrors the user-facing wording specified in the P15
    /// brief.
    public var bodyLabel: String {
        switch self {
        case .deed: "Deed on file"
        case .title: "Title on file"
        case .document: "Document on file"
        case .pending: "Pending review"
        }
    }

    /// Glyph rendered in the chip and the body row.
    public var icon: PantopusIcon {
        switch self {
        case .deed: .shieldCheck
        case .title: .file
        case .document: .fileText
        case .pending: .clock
        }
    }

    /// Chip background.
    public var chipBackground: Color {
        switch self {
        case .deed: Theme.Color.homeBg
        case .title: Theme.Color.primary50
        case .document: Theme.Color.warningBg
        case .pending: Theme.Color.appSurfaceSunken
        }
    }

    /// Chip foreground / icon tint.
    public var chipForeground: Color {
        switch self {
        case .deed: Theme.Color.home
        case .title: Theme.Color.primary700
        case .document: Theme.Color.warning
        case .pending: Theme.Color.appTextStrong
        }
    }

    /// Map a `(owner_status, verification_tier)` pair to a proof tone.
    /// Status precedence wins — a `pending` row always reads as Pending
    /// regardless of the verification tier its claim happens to carry.
    ///
    /// Verification tier values mirror the
    /// `owner_verification_tier` enum at
    /// `backend/database/schema.sql:491` (`weak / standard / strong /
    /// legal`).
    public static func resolve(ownerStatus: String, verificationTier: String) -> OwnerProof {
        switch ownerStatus.lowercased() {
        case "pending":
            return .pending
        case "disputed", "revoked":
            return .document
        default:
            break
        }
        switch verificationTier.lowercased() {
        case "legal", "strong":
            return .deed
        case "standard":
            return .title
        default:
            return .document
        }
    }
}

/// Identity-tone avatar background palette for an Owner row. Indexed by
/// the row's position so co-owners get distinguishable hues. Lifted from
/// the design at `owners-frames.jsx:72-77`, but mapped onto existing
/// semantic tokens — home-green for owner 1 (matches the screen's home
/// identity), sky for owner 2, amber for owner 3, business-violet for
/// owner 4. Beyond index 3 we wrap.
public enum OwnerTone: Sendable, CaseIterable {
    case home
    case sky
    case amber
    case violet

    /// 2-stop gradient pair for the avatar circular fill.
    public var gradient: GradientPair {
        switch self {
        case .home:
            GradientPair(start: Theme.Color.home, end: Theme.Color.successBg)
        case .sky:
            GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
        case .amber:
            GradientPair(start: Theme.Color.warning, end: Theme.Color.warningLight)
        case .violet:
            GradientPair(start: Theme.Color.business, end: Theme.Color.businessBg)
        }
    }

    /// Cycle through the four tones by row index.
    public static func at(_ index: Int) -> OwnerTone {
        let all = OwnerTone.allCases
        return all[(index % all.count + all.count) % all.count]
    }
}
