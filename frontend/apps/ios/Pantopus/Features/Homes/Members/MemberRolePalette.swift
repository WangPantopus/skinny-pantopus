//
//  MemberRolePalette.swift
//  Pantopus
//
//  Per-role chip palette + tab-bucketing helpers for the Members
//  screen. Lives next to the feature (parallel to SpeciesPalette.swift
//  for Pets and UtilityCategoryPalette.swift for Bills) — the
//  documented exception in `docs/mobile-screen-definition-of-done.md`
//  for feature palette files that need to encode a per-category
//  background+foreground pair.
//
//  Backend roles (see `backend/utils/homePermissions.js` ROLE_RANK):
//      owner / admin / manager / member / restricted_member / guest
//
//  Wire role strings to a stable display label + icon + chip tint.
//  Unknown / null roles collapse to `.member`.
//

import SwiftUI

/// Stable identity for a single member's role chip.
public enum MemberRole: String, CaseIterable, Sendable, Hashable {
    case owner
    case admin
    case manager
    case member
    case restricted
    case tenant
    case guest

    /// Roles routed to the **Guests** tab. Everything else lands in
    /// the **Members** tab (assuming an active occupancy).
    public static let guestRoles: Set<MemberRole> = [.guest]

    /// Map a wire role string to a typed `MemberRole`. Unknown / null
    /// inputs fall through to `.member` so the chip still renders.
    public static func parse(_ raw: String?) -> MemberRole {
        guard let raw, !raw.isEmpty else { return .member }
        switch raw.lowercased() {
        case "owner": return .owner
        case "admin": return .admin
        case "manager": return .manager
        case "member": return .member
        case "restricted_member", "restricted", "limited": return .restricted
        case "tenant", "lease_resident": return .tenant
        case "guest": return .guest
        default: return .member
        }
    }

    /// Title-case label rendered inside the chip.
    public var label: String {
        switch self {
        case .owner: "Owner"
        case .admin: "Admin"
        case .manager: "Manager"
        case .member: "Member"
        case .restricted: "Limited"
        case .tenant: "Tenant"
        case .guest: "Guest"
        }
    }

    /// PantopusIcon for the chip's leading glyph.
    public var icon: PantopusIcon {
        switch self {
        case .owner: .home
        case .admin: .shield
        case .manager: .shieldCheck
        case .member: .user
        case .restricted: .lock
        case .tenant: .fileText
        case .guest: .clock
        }
    }

    /// Token-only background + foreground pair for the chip.
    public var palette: MemberRolePalette {
        switch self {
        case .owner:
            // Home-pillar green: this person owns the home context.
            MemberRolePalette(
                background: Theme.Color.homeBg,
                foreground: Theme.Color.home
            )
        case .admin:
            // Sky primary: delegated control.
            MemberRolePalette(
                background: Theme.Color.primary50,
                foreground: Theme.Color.primary700
            )
        case .manager:
            // Info blue: distinct from admin so the eye separates them.
            MemberRolePalette(
                background: Theme.Color.infoBg,
                foreground: Theme.Color.info
            )
        case .member:
            // Neutral sunken: every household has many of these.
            MemberRolePalette(
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextStrong
            )
        case .restricted:
            // Warning amber: reduced access.
            MemberRolePalette(
                background: Theme.Color.warningBg,
                foreground: Theme.Color.warning
            )
        case .tenant:
            // Business violet: a rental relationship (closest neutral
            // identity tint we have without inventing a new token).
            MemberRolePalette(
                background: Theme.Color.businessBg,
                foreground: Theme.Color.business
            )
        case .guest:
            // Neutral sunken with darker fg — short-term, low-trust.
            MemberRolePalette(
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextSecondary
            )
        }
    }
}

/// (background, foreground) colour pair for a role chip.
public struct MemberRolePalette: Sendable, Hashable {
    public let background: Color
    public let foreground: Color

    public init(background: Color, foreground: Color) {
        self.background = background
        self.foreground = foreground
    }
}

// MARK: - Avatar tone palette (deterministic from id)

/// Six-tone palette for member avatars. Stable mapping from user id so
/// the same person always renders the same colour across sessions.
/// Mirrors the `ConnectionAvatarTone` palette but lives here to avoid
/// importing one feature's enum into another.
public enum MemberAvatarTone: Sendable, Hashable, CaseIterable {
    case sky, teal, amber, rose, violet, slate

    public static func tone(for id: String) -> MemberAvatarTone {
        let palette = MemberAvatarTone.allCases
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
