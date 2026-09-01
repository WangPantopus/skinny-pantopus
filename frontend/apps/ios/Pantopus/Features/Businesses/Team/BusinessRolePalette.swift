//
//  BusinessRolePalette.swift
//  Pantopus
//
//  Per-role chip palette + grouping helpers for the Business Team screen.
//  Cloned from `Features/Homes/Members/MemberRolePalette.swift` (the
//  documented feature-palette exception) but keyed to the business role
//  tiers rather than the home occupancy roles.
//
//  Backend roles (see `backend/utils/businessPermissions.js`
//  BUSINESS_ROLE_RANK):
//      viewer (10) · staff (20) · editor (30) · admin (40) · owner (50)
//
//  Wire role strings map to a stable display label + icon + chip tint.
//  Colours mirror the web Team tab (owner=violet, admin=blue,
//  editor=emerald, staff=amber, viewer=grey). Unknown / null roles
//  collapse to `.viewer`.
//

import SwiftUI

/// Stable identity for a single business team role chip.
public enum BusinessRole: String, CaseIterable, Sendable, Hashable {
    case owner
    case admin
    case editor
    case staff
    case viewer

    /// Roles the owner can assign through the invite wizard — everything
    /// except `owner` (promoting to owner is a separate owner-only path).
    public static let assignableRoles: [BusinessRole] = [.admin, .editor, .staff, .viewer]

    /// Higher rank sorts first in the grouped list (owner → viewer).
    public var rank: Int {
        switch self {
        case .owner: 50
        case .admin: 40
        case .editor: 30
        case .staff: 20
        case .viewer: 10
        }
    }

    /// Map a wire role string to a typed `BusinessRole`. Unknown / null
    /// inputs fall through to `.viewer` so the chip still renders.
    public static func parse(_ raw: String?) -> BusinessRole {
        guard let raw, !raw.isEmpty else { return .viewer }
        switch raw.lowercased() {
        case "owner": return .owner
        case "admin": return .admin
        case "editor": return .editor
        case "staff": return .staff
        case "viewer": return .viewer
        default: return .viewer
        }
    }

    /// Title-case label rendered inside the chip + section header.
    public var label: String {
        switch self {
        case .owner: "Owner"
        case .admin: "Admin"
        case .editor: "Editor"
        case .staff: "Staff"
        case .viewer: "Viewer"
        }
    }

    /// Plural label for the grouped section header (e.g. "Admins").
    public var pluralLabel: String {
        switch self {
        case .owner: "Owners"
        case .admin: "Admins"
        case .editor: "Editors"
        case .staff: "Staff"
        case .viewer: "Viewers"
        }
    }

    /// Short description used by the invite wizard role tiles.
    public var tileSubcopy: String {
        switch self {
        case .owner: "Full control over the business."
        case .admin: "Manages team, finances, and settings."
        case .editor: "Edits profile, catalog, pages, reviews."
        case .staff: "Day-to-day operations — catalog, gigs."
        case .viewer: "Read-only access to business info."
        }
    }

    /// PantopusIcon for the chip's leading glyph.
    public var icon: PantopusIcon {
        switch self {
        case .owner: .crown
        case .admin: .shield
        case .editor: .edit2
        case .staff: .briefcase
        case .viewer: .eye
        }
    }

    /// Token-only background + foreground pair for the chip.
    public var palette: BusinessRolePalette {
        switch self {
        case .owner:
            // Business-pillar violet: this person owns the business context.
            BusinessRolePalette(
                background: Theme.Color.businessBg,
                foreground: Theme.Color.business
            )
        case .admin:
            // Sky primary: delegated control.
            BusinessRolePalette(
                background: Theme.Color.primary50,
                foreground: Theme.Color.primary700
            )
        case .editor:
            // Success green: content editing.
            BusinessRolePalette(
                background: Theme.Color.successBg,
                foreground: Theme.Color.success
            )
        case .staff:
            // Warning amber: operational staff.
            BusinessRolePalette(
                background: Theme.Color.warningBg,
                foreground: Theme.Color.warning
            )
        case .viewer:
            // Neutral sunken: read-only.
            BusinessRolePalette(
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextSecondary
            )
        }
    }
}

/// (background, foreground) colour pair for a role chip.
public struct BusinessRolePalette: Sendable, Hashable {
    public let background: Color
    public let foreground: Color

    public init(background: Color, foreground: Color) {
        self.background = background
        self.foreground = foreground
    }
}

// MARK: - Avatar tone palette (deterministic from id)

/// Six-tone palette for team avatars. Stable mapping from an id so the same
/// person always renders the same colour across sessions. Mirrors
/// `MemberAvatarTone` but lives here to keep the Team feature self-contained.
public enum BusinessTeamAvatarTone: Sendable, Hashable, CaseIterable {
    case sky, teal, amber, rose, violet, slate

    public static func tone(for id: String) -> BusinessTeamAvatarTone {
        let palette = BusinessTeamAvatarTone.allCases
        let hash = id.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }
        let index = abs(hash) % palette.count
        return palette[index]
    }

    public var gradient: GradientPair {
        switch self {
        case .sky: GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
        case .teal: GradientPair(start: Theme.Color.success, end: Theme.Color.home)
        case .amber: GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman)
        case .rose: GradientPair(start: Theme.Color.error, end: Theme.Color.vehicles)
        case .violet: GradientPair(start: Theme.Color.business, end: Theme.Color.goods)
        case .slate: GradientPair(start: Theme.Color.appTextSecondary, end: Theme.Color.appTextStrong)
        }
    }
}
