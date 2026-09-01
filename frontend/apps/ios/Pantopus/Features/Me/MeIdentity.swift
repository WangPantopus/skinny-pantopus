//
//  MeIdentity.swift
//  Pantopus
//
//  Identity-rebind enum + content model for the Me tab. The same screen
//  chrome (header, stats row, action grid, section groups, destructive
//  card) rebinds data when `MeIdentity` flips between `.personal` /
//  `.home` / `.business`.
//

import Foundation
import SwiftUI

/// Three identity bindings for the Me tab.
public enum MeIdentity: String, CaseIterable, Sendable, Hashable {
    case personal, home, business

    public var label: String {
        switch self {
        case .personal: "Personal"
        case .home: "Home"
        case .business: "Business"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .personal: .user
        case .home: .home
        case .business: .shoppingBag
        }
    }

    /// Header gradient + action-grid accent token.
    public var accent: Color {
        switch self {
        case .personal: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    /// Soft tint used for the pill background + scaffolding.
    public var accentBg: Color {
        switch self {
        case .personal: Theme.Color.primary50
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        }
    }

    /// 3-stop gradient for the header card (per T6.2b design — sky
    /// gets `primary600 → primary500 → primary700`; home and business
    /// mirror with opacity-shifted accents since the theme doesn't
    /// expose 500 / 700 ramps for those identities).
    public var headerGradient: [Color] {
        switch self {
        case .personal:
            [Theme.Color.primary600, Theme.Color.primary500, Theme.Color.primary700]
        case .home:
            [Theme.Color.home, Theme.Color.home.opacity(0.86), Theme.Color.home]
        case .business:
            [Theme.Color.business, Theme.Color.business.opacity(0.86), Theme.Color.business]
        }
    }
}

/// One cell in the stats row.
public struct MeStat: Identifiable, Sendable, Hashable {
    public let id: String
    public let value: String
    public let label: String

    public init(id: String, value: String, label: String) {
        self.id = id
        self.value = value
        self.label = label
    }
}

/// One tile in the 2×3 action grid.
public struct MeActionTile: Identifiable, Sendable, Hashable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let badge: Int?
    /// Routing key — the host (YouTabRoot) maps to a real route or
    /// pushes a labeled placeholder when the destination doesn't exist
    /// yet (see `docs/mobile-wiring-audit.md`).
    public let routeKey: String
    /// Optional per-route arguments (e.g. `["homeId": "abc-123"]`).
    /// Carries the primary home id on home-context tiles so the host
    /// can construct `BillsListView` etc. without re-introspecting the
    /// VM.
    public let routeArgs: [String: String]

    public init(
        id: String,
        icon: PantopusIcon,
        label: String,
        badge: Int? = nil,
        routeKey: String,
        routeArgs: [String: String] = [:]
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.badge = badge
        self.routeKey = routeKey
        self.routeArgs = routeArgs
    }
}

/// One row in a section group.
public struct MeSectionRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let value: String?
    public let routeKey: String
    public let routeArgs: [String: String]
    /// Optional verbatim contract identifier override. When set, the row
    /// renders with this `accessibilityIdentifier` instead of the generated
    /// `meSectionRow_<section>_<row>` one (used for cross-platform entry-point
    /// tags like `savedPlaces.entry.profile`).
    public let accessibilityID: String?

    public init(
        id: String,
        icon: PantopusIcon,
        label: String,
        value: String? = nil,
        routeKey: String,
        routeArgs: [String: String] = [:],
        accessibilityID: String? = nil
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.routeKey = routeKey
        self.routeArgs = routeArgs
        self.accessibilityID = accessibilityID
    }
}

/// A grouped section in the lower stack (Profile & Privacy · Activity ·
/// Help & Legal).
public struct MeSection: Identifiable, Sendable, Hashable {
    public let id: String
    public let header: String
    public let rows: [MeSectionRow]

    public init(id: String, header: String, rows: [MeSectionRow]) {
        self.id = id
        self.header = header
        self.rows = rows
    }
}

/// VM-prepared bundle for a single identity binding.
public struct MeIdentityContent: Sendable, Hashable {
    public let identity: MeIdentity
    public let displayName: String
    public let initials: String
    public let handle: String
    public let locality: String?
    /// Short bio / one-liner under the name. Mapped from
    /// `UserProfile.tagline` (falls back to `bio`) for Personal; home
    /// uses a household summary; business is its tagline copy.
    public let tagline: String?
    public let verified: Bool
    public let stats: [MeStat]
    public let actionTiles: [MeActionTile]
    public let sections: [MeSection]
    /// True when this identity has no backing data (e.g. no claimed
    /// home). The view layer renders an empty-state hint in place of
    /// the stats / actions when set.
    public let isUnbound: Bool

    public init(
        identity: MeIdentity,
        displayName: String,
        initials: String,
        handle: String,
        locality: String?,
        tagline: String?,
        verified: Bool,
        stats: [MeStat],
        actionTiles: [MeActionTile],
        sections: [MeSection],
        isUnbound: Bool = false
    ) {
        self.identity = identity
        self.displayName = displayName
        self.initials = initials
        self.handle = handle
        self.locality = locality
        self.tagline = tagline
        self.verified = verified
        self.stats = stats
        self.actionTiles = actionTiles
        self.sections = sections
        self.isUnbound = isUnbound
    }
}

/// Top-level state for the Me tab.
public enum MeState: Sendable {
    case loading
    case loaded(personal: MeIdentityContent, home: MeIdentityContent, business: MeIdentityContent)
    case error(message: String)
}
