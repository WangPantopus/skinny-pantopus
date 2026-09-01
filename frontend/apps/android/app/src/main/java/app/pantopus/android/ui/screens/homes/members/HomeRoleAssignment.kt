@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Which roles the current viewer may assign to a given member.
 *
 * Mirrors the backend's rank model exactly so the picker never offers
 * something the server will 403:
 *
 *  - `ROLE_RANK` (`backend/utils/homePermissions.js:31`)
 *      guest 10 · restricted_member 20 · member 30 · manager 40 ·
 *      admin 50 · owner 60
 *  - `assertCanMutateTarget` (`backend/utils/homePermissions.js:282`)
 *      – only an owner may modify another owner
 *      – an owner may mutate anyone
 *      – a non-owner may not touch a target of equal or higher rank
 *  - `POST /:id/members/:userId/role` (`backend/routes/homeIam.js:212`)
 *      – requires `members.manage`
 *      – only an owner may promote to `owner`
 *      – an owner may not demote themselves (transfer instead)
 *      – the new role must itself pass `assertCanMutateTarget`
 *
 * Deliberately narrower than [MemberRole]: `lease_resident` is an
 * occupancy *label*, not a `ROLE_RANK` key, so it is not assignable.
 */
enum class HomeAssignableRole(
    /** Wire value sent in the `role_base` field. */
    val wire: String,
    /** Rank from `backend/utils/homePermissions.js:31`. */
    val rank: Int,
    /** Short description shown under the label in the picker. */
    val summary: String,
) {
    Owner(wire = "owner", rank = 60, summary = "Full control, including deleting the home."),
    Admin(wire = "admin", rank = 50, summary = "Manages members, access, bills, and tasks."),
    Manager(wire = "manager", rank = 40, summary = "Runs day-to-day tasks and access for the home."),
    Member(wire = "member", rank = 30, summary = "A regular household member."),
    RestrictedMember(
        wire = "restricted_member",
        rank = 20,
        summary = "Limited view — no finance or sensitive info.",
    ),
    Guest(wire = "guest", rank = 10, summary = "Short-term, time-boxed access only."),
    ;

    /** The chip vocabulary shared with the roster rows. */
    val displayRole: MemberRole
        get() = MemberRole.parse(wire)

    val label: String
        get() = displayRole.label

    val icon: PantopusIcon
        get() = displayRole.icon

    companion object {
        /**
         * Parse a wire `role_base`. Unknown values (e.g. `lease_resident`)
         * return null — they exist as occupancy roles but can't be assigned.
         */
        fun parse(raw: String?): HomeAssignableRole? {
            if (raw.isNullOrEmpty()) return null
            val lower = raw.lowercase()
            return entries.firstOrNull { it.wire == lower }
        }
    }
}

/** Pure rank rules, shared by the view-model and its tests. */
object HomeRoleAssignment {
    /**
     * Rank of an arbitrary wire role — non-`ROLE_RANK` strings score 0,
     * exactly like `getRoleRank`'s `|| 0` fallback.
     */
    fun rankOf(rawRole: String?): Int = HomeAssignableRole.parse(rawRole)?.rank ?: 0

    /**
     * `assertCanMutateTarget(actor, target)` — may the actor act on this
     * member at all (role change or removal)?
     */
    fun canMutate(
        actorRole: String?,
        targetRole: String?,
    ): Boolean {
        val actor = actorRole?.lowercase()
        val target = targetRole?.lowercase()
        if (target == "owner" && actor != "owner") return false
        if (actor == "owner") return true
        return rankOf(target) < rankOf(actor)
    }

    /**
     * Roles the actor may assign to [targetRole], minus the role the
     * member already holds. Empty when the actor may not touch this
     * member at all.
     *
     * @param actorRole viewer's `role_base` from `GET /:id/me`.
     * @param actorIsOwner viewer's `is_owner` from the same payload — the
     *   backend treats a verified owner as owner-ranked even when the
     *   occupancy row still says something else.
     * @param targetRole the member's current `role`.
     * @param isSelf whether the row is the viewer themselves.
     */
    fun assignableRoles(
        actorRole: String?,
        actorIsOwner: Boolean,
        targetRole: String?,
        isSelf: Boolean,
    ): List<HomeAssignableRole> {
        // Self-service: an owner can't demote themselves (the backend
        // rejects it with "Transfer ownership instead"). Nobody else has
        // a reason to re-role themselves from this screen.
        if (isSelf) return emptyList()

        val effectiveActor = if (actorIsOwner) "owner" else actorRole?.lowercase()
        val isOwnerActor = effectiveActor == "owner"
        if (!canMutate(actorRole = effectiveActor, targetRole = targetRole)) return emptyList()

        val current = HomeAssignableRole.parse(targetRole)
        return HomeAssignableRole.entries.filter { candidate ->
            when {
                candidate == current -> false
                // Only an owner may promote to owner.
                candidate == HomeAssignableRole.Owner -> isOwnerActor
                isOwnerActor -> true
                // Non-owner: the assigned role must sit strictly below them.
                else -> candidate.rank < rankOf(effectiveActor)
            }
        }
    }
}
