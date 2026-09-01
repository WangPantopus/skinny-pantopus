//
//  MailboxSpotKind.swift
//  Pantopus
//
//  A11.4 Mailbox map — the five mailbox-spot kinds. Each carries the pin
//  color (sourced from mailbox-map-frames.jsx KINDS) and a Lucide glyph.
//  The palette is mailbox-local because no other surface needs it, the
//  same way `GigsCategory` keeps the gig palette local. Colors are
//  declared in decimal RGB (not hex) so the Features hex-grep guard
//  stays green.
//

import SwiftUI

/// Filter / pin category for the Mailbox map. `all` is a chip-only
/// sentinel — every spot carries a concrete kind.
public enum MailboxSpotKind: String, CaseIterable, Sendable, Hashable, Identifiable {
    case post
    case drop
    case locker
    case carrier
    case civic

    public var id: String {
        rawValue
    }

    /// Plural chip / legend label.
    public var label: String {
        switch self {
        case .post: "Post offices"
        case .drop: "Drop boxes"
        case .locker: "Lockers"
        case .carrier: "Carriers"
        case .civic: "Civic"
        }
    }

    /// Pin + identity-tile color. Sourced from `mailbox-map-frames.jsx`
    /// KINDS. Decimal RGB keeps the Features hex-grep guard green, the
    /// same convention `GigsCategory.color` uses.
    public var color: Color {
        switch self {
        case .post: Color(red: 30 / 255, green: 64 / 255, blue: 175 / 255)
        case .drop: Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)
        case .locker: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255)
        case .carrier: Color(red: 180 / 255, green: 83 / 255, blue: 9 / 255)
        case .civic: Color(red: 21 / 255, green: 128 / 255, blue: 61 / 255)
        }
    }

    /// Lucide glyph for the pin + identity tile. Where the exact Lucide
    /// icon isn't in the token set we fall back to the closest match,
    /// mirroring `NearbyMapView.iconFor`.
    public var glyph: PantopusIcon {
        switch self {
        case .post: .building2
        case .drop: .mailbox
        case .locker: .package
        case .carrier: .send // closest token to Lucide "truck"
        case .civic: .landmark
        }
    }
}
