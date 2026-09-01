//
//  MailItemCategory.swift
//  Pantopus
//
//  20-category enum for mailbox items. Each case carries its accent
//  color for the 4pt top strip.
//

import SwiftUI

/// A mailbox item's category. Maps 1:1 onto the backend `mail.mail_type`
/// field; an unknown value falls through to `.general`.
public enum MailItemCategory: String, Sendable, CaseIterable {
    case package
    case coupon
    case booklet
    case certified
    case community
    case notice
    case bill
    case statement
    case insurance
    case tax
    case subscription
    case legal
    case healthcare
    case membership
    case delivery
    case social
    case gig
    case memory
    case party
    case records
    case general

    /// 4pt accent strip color sitting at the top of the detail shell.
    public var accent: Color {
        switch self {
        case .package: Theme.Color.delivery
        case .coupon: Theme.Color.childCare
        case .booklet: Theme.Color.moving // violet token per P18 FrameBooklet
        case .certified: Theme.Color.primary600 // primary token per P18 FrameCertified
        case .community: Theme.Color.cleaning
        case .notice: Theme.Color.warning
        case .bill: Theme.Color.error
        case .statement: Theme.Color.tutoring
        case .insurance: Theme.Color.info
        case .tax: Theme.Color.vehicles
        case .subscription: Theme.Color.goods
        case .legal: Theme.Color.moving
        case .healthcare: Theme.Color.petCare
        case .membership: Theme.Color.personal
        case .delivery: Theme.Color.handyman
        case .social: Theme.Color.cleaning
        case .gig: Theme.Color.handyman // "cat-gigs" orange per A17.6 gig accent
        case .memory: Theme.Color.warning // sun-amber per A17.7 stationery-summer accent
        case .party: Theme.Color.categoryParty // A17.9 party-invite accent token
        case .records: Theme.Color.categoryRecords // slate-600 per A17.10 archival accent
        case .general: Theme.Color.appTextSecondary
        }
    }

    /// Lucide icon for the 40pt category tile rendered on the list row's
    /// `RowLeading.typeIcon` slot. Per `mailbox.jsx:4-16` per-category
    /// accents; icons picked to mirror the design's row imagery.
    public var icon: PantopusIcon {
        switch self {
        case .package: .package
        case .coupon: .tag
        case .booklet: .fileText
        case .certified: .badgeCheck
        case .community: .users
        case .notice: .alertCircle
        case .bill: .receipt
        case .statement: .fileText
        case .insurance: .shield
        case .tax: .receipt
        case .subscription: .arrowsRepeat
        case .legal: .gavel
        case .healthcare: .heartPulse
        case .membership: .badgeCheck
        case .delivery: .package
        case .social: .users
        case .gig: .handCoins
        case .memory: .heart
        case .party: .partyPopper
        case .records: .archive
        case .general: .mailbox
        }
    }

    /// Soft-tinted background for the 40pt list-row tile.
    public var rowBackground: Color {
        switch self {
        case .package: Theme.Color.appSurfaceSunken
        case .coupon: Theme.Color.businessBg
        case .booklet: Theme.Color.personalBg
        case .certified: Theme.Color.primary50
        case .community: Theme.Color.successBg
        case .notice: Theme.Color.warningBg
        case .bill: Theme.Color.errorBg
        case .statement: Theme.Color.personalBg
        case .insurance: Theme.Color.infoBg
        case .tax: Theme.Color.warningBg
        case .subscription: Theme.Color.businessBg
        case .legal: Theme.Color.businessBg
        case .healthcare: Theme.Color.errorBg
        case .membership: Theme.Color.personalBg
        case .delivery: Theme.Color.appSurfaceSunken
        case .social: Theme.Color.homeBg
        case .gig: Theme.Color.warningBg
        case .memory: Theme.Color.warningBg
        case .party: Theme.Color.errorBg // soft rose-50 tint pairs with the categoryParty accent
        case .records: Theme.Color.categoryRecordsBg
        case .general: Theme.Color.appSurfaceSunken
        }
    }

    /// User-facing label (Capitalised) for the chip on the row + the
    /// eyebrow on the detail top bar.
    public var label: String {
        switch self {
        case .package: "Package"
        case .coupon: "Coupon"
        case .booklet: "Booklet"
        case .certified: "Certified"
        case .community: "Community"
        case .notice: "Notice"
        case .bill: "Bill"
        case .statement: "Statement"
        case .insurance: "Insurance"
        case .tax: "Tax"
        case .subscription: "Subscription"
        case .legal: "Legal"
        case .healthcare: "Healthcare"
        case .membership: "Membership"
        case .delivery: "Delivery"
        case .social: "Social"
        case .gig: "Gig"
        case .memory: "Memory"
        case .party: "Party"
        case .records: "Records"
        case .general: "Mail"
        }
    }

    /// Maps a [`MailTrust`] / DTO to the design's `MailDetailTrust` dot
    /// kind used by the A17 shell's top-bar eyebrow.
    public var detailTrust: MailDetailTrust {
        switch self {
        case .certified, .community, .legal, .tax, .memory, .records: .verified
        case .notice, .bill: .warning
        case .party: .celebration
        default: .neutral
        }
    }

    /// Matches a backend `mail_type` / `type` string onto a typed case.
    public static func fromRaw(_ raw: String?) -> MailItemCategory {
        guard let raw = raw?.lowercased() else { return .general }
        return MailItemCategory(rawValue: raw) ?? .general
    }
}

/// Trust level for the sender pill.
public enum MailTrust: String, Sendable, CaseIterable {
    /// `verified_gov`, `verified_utility`, `verified_business` on the wire.
    case verified
    case partial
    case unverified
    /// Sender is a known Pantopus user.
    case chain
    /// Certified mail / chain-of-custody — primary tint, longer label.
    /// Set by the VM when category is `.certified`; not derived from the
    /// wire `sender_trust` field today.
    case certifiedChain

    /// Icon rendered in the pill.
    public var icon: PantopusIcon {
        switch self {
        case .verified: .shieldCheck
        case .partial: .shield
        case .unverified: .shield
        case .chain: .shieldCheck
        case .certifiedChain: .shieldCheck
        }
    }

    /// Pill background / foreground pair.
    public var background: Color {
        switch self {
        case .verified: Theme.Color.successBg
        case .partial: Theme.Color.warningBg
        case .unverified: Theme.Color.appSurfaceSunken
        case .chain: Theme.Color.infoBg
        case .certifiedChain: Theme.Color.infoBg
        }
    }

    /// Foreground tint.
    public var foreground: Color {
        switch self {
        case .verified: Theme.Color.success
        case .partial: Theme.Color.warning
        case .unverified: Theme.Color.appTextSecondary
        case .chain: Theme.Color.primary600
        case .certifiedChain: Theme.Color.primary600
        }
    }

    /// Human-readable label.
    public var label: String {
        switch self {
        case .verified: "Verified"
        case .partial: "Partial"
        case .unverified: "Unverified"
        case .chain: "Pantopus user"
        case .certifiedChain: "Certified · Chain of custody"
        }
    }

    /// Maps the backend `sender_trust` string onto a pill state.
    public static func fromRaw(_ raw: String?) -> MailTrust {
        switch raw {
        case "verified_gov", "verified_utility", "verified_business": .verified
        case "pantopus_user": .chain
        case "partial": .partial
        default: .unverified
        }
    }

    /// Conversion to the [`MailDetailTrust`] enum the A17 shell expects.
    /// `chain` / `certifiedChain` collapse to `.verified`; `unverified`
    /// collapses to `.neutral` (the dot is informational, not a warning).
    public var detailTrust: MailDetailTrust {
        switch self {
        case .verified, .chain, .certifiedChain: .verified
        case .partial: .warning
        case .unverified: .neutral
        }
    }
}
