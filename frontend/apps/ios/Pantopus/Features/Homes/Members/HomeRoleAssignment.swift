//
//  HomeRoleAssignment.swift
//  Pantopus
//
//  Which roles the current viewer may assign to a given member.
//
//  Mirrors the backend's rank model exactly so the picker never offers
//  something the server will 403:
//
//    • `ROLE_RANK` (`backend/utils/homePermissions.js:31`)
//        guest 10 · restricted_member 20 · member 30 · manager 40 ·
//        admin 50 · owner 60
//    • `assertCanMutateTarget` (`backend/utils/homePermissions.js:282`)
//        – only an owner may modify another owner
//        – an owner may mutate anyone
//        – a non-owner may not touch a target of equal or higher rank
//    • `POST /:id/members/:userId/role` (`backend/routes/homeIam.js:212`)
//        – requires `members.manage`
//        – only an owner may promote to `owner`
//        – an owner may not demote themselves (transfer instead)
//        – the new role must itself pass `assertCanMutateTarget`
//

import Foundation

/// A role the backend accepts in the `role_base` field of the change-role
/// body. Deliberately narrower than `MemberRole` — `lease_resident` is an
/// occupancy *label*, not a `ROLE_RANK` key, so it is not assignable.
public enum HomeAssignableRole: String, CaseIterable, Sendable, Hashable {
    case owner
    case admin
    case manager
    case member
    case restrictedMember = "restricted_member"
    case guest

    /// Rank from `backend/utils/homePermissions.js:31`.
    public var rank: Int {
        switch self {
        case .guest: 10
        case .restrictedMember: 20
        case .member: 30
        case .manager: 40
        case .admin: 50
        case .owner: 60
        }
    }

    /// The chip vocabulary shared with the roster rows.
    public var displayRole: MemberRole {
        MemberRole.parse(rawValue)
    }

    public var label: String {
        displayRole.label
    }

    public var icon: PantopusIcon {
        displayRole.icon
    }

    /// Short description shown under the label in the picker.
    public var summary: String {
        switch self {
        case .owner: "Full control, including deleting the home."
        case .admin: "Manages members, access, bills, and tasks."
        case .manager: "Runs day-to-day tasks and access for the home."
        case .member: "A regular household member."
        case .restrictedMember: "Limited view — no finance or sensitive info."
        case .guest: "Short-term, time-boxed access only."
        }
    }

    /// Parse a wire `role_base`. Unknown values (e.g. `lease_resident`)
    /// return `nil` — they exist as occupancy roles but can't be assigned.
    public static func parse(_ raw: String?) -> HomeAssignableRole? {
        guard let raw, !raw.isEmpty else { return nil }
        return HomeAssignableRole(rawValue: raw.lowercased())
    }
}

/// Pure rank rules, shared by the view-model and its tests.
public enum HomeRoleAssignment {
    /// Rank of an arbitrary wire role — non-`ROLE_RANK` strings score 0,
    /// exactly like `getRoleRank`'s `|| 0` fallback.
    public static func rank(of rawRole: String?) -> Int {
        HomeAssignableRole.parse(rawRole)?.rank ?? 0
    }

    /// `assertCanMutateTarget(actor, target)` — can the actor act on this
    /// member at all (role change or removal)?
    public static func canMutate(actorRole: String?, targetRole: String?) -> Bool {
        let actor = actorRole?.lowercased()
        let target = targetRole?.lowercased()
        if target == "owner", actor != "owner" { return false }
        if actor == "owner" { return true }
        return rank(of: target) < rank(of: actor)
    }

    /// Roles the actor may assign to `targetRole`, minus the role the
    /// member already holds. Returns `[]` when the actor may not touch
    /// this member at all.
    ///
    /// - Parameters:
    ///   - actorRole: viewer's `role_base` from `GET /:id/me`.
    ///   - actorIsOwner: viewer's `is_owner` from the same payload — the
    ///     backend treats a verified owner as owner-ranked even when the
    ///     occupancy row still says something else.
    ///   - targetRole: the member's current `role`.
    ///   - isSelf: whether the member row is the viewer themselves.
    public static func assignableRoles(
        actorRole: String?,
        actorIsOwner: Bool,
        targetRole: String?,
        isSelf: Bool
    ) -> [HomeAssignableRole] {
        let effectiveActor = actorIsOwner ? "owner" : actorRole?.lowercased()
        let isOwnerActor = effectiveActor == "owner"

        // Self-service: an owner can't demote themselves (the backend
        // rejects it with "Transfer ownership instead"). Nobody else has
        // a reason to re-role themselves from this screen.
        if isSelf { return [] }

        guard canMutate(actorRole: effectiveActor, targetRole: targetRole) else { return [] }

        let current = HomeAssignableRole.parse(targetRole)
        return HomeAssignableRole.allCases.filter { candidate in
            if candidate == current { return false }
            // Only an owner may promote to owner.
            if candidate == .owner { return isOwnerActor }
            if isOwnerActor { return true }
            // Non-owner: the assigned role must sit strictly below them.
            return candidate.rank < rank(of: effectiveActor)
        }
    }
}
