@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.members

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Per-role chip palette + tab-bucketing helpers for the Members screen.
 * Lives next to the feature (parallel to `SpeciesPalette.kt` for Pets
 * and the utility-category palette for Bills) — the documented
 * exception in `docs/mobile-screen-definition-of-done.md` for feature
 * palette files that need to encode a per-category background +
 * foreground pair.
 *
 * Backend roles (see `backend/utils/homePermissions.js` ROLE_RANK):
 *   owner / admin / manager / member / restricted_member / guest
 *
 * Wire role strings → typed [MemberRole] → display label + icon + chip
 * tint. Unknown / null roles collapse to [MemberRole.Member].
 */
enum class MemberRole(
    /** Wire token sent back when inviting (`relationship` field). */
    val wire: String,
    val label: String,
    val icon: PantopusIcon,
) {
    Owner(wire = "owner", label = "Owner", icon = PantopusIcon.Home),
    Admin(wire = "admin", label = "Admin", icon = PantopusIcon.Shield),
    Manager(wire = "manager", label = "Manager", icon = PantopusIcon.ShieldCheck),
    Member(wire = "member", label = "Member", icon = PantopusIcon.User),
    Restricted(wire = "restricted_member", label = "Limited", icon = PantopusIcon.Lock),
    Tenant(wire = "lease_resident", label = "Tenant", icon = PantopusIcon.FileText),
    Guest(wire = "guest", label = "Guest", icon = PantopusIcon.Clock),
    ;

    /** (background, foreground) pair for the role chip. */
    val palette: MemberRolePalette
        get() =
            when (this) {
                Owner ->
                    MemberRolePalette(
                        background = PantopusColors.homeBg,
                        foreground = PantopusColors.home,
                    )
                Admin ->
                    MemberRolePalette(
                        background = PantopusColors.primary50,
                        foreground = PantopusColors.primary700,
                    )
                Manager ->
                    MemberRolePalette(
                        background = PantopusColors.infoBg,
                        foreground = PantopusColors.info,
                    )
                Member ->
                    MemberRolePalette(
                        background = PantopusColors.appSurfaceSunken,
                        foreground = PantopusColors.appTextStrong,
                    )
                Restricted ->
                    MemberRolePalette(
                        background = PantopusColors.warningBg,
                        foreground = PantopusColors.warning,
                    )
                Tenant ->
                    MemberRolePalette(
                        background = PantopusColors.businessBg,
                        foreground = PantopusColors.business,
                    )
                Guest ->
                    MemberRolePalette(
                        background = PantopusColors.appSurfaceSunken,
                        foreground = PantopusColors.appTextSecondary,
                    )
            }

    companion object {
        /** Roles routed to the Guests tab. Everything else lands in
         *  Members (assuming an active occupancy). */
        val guestRoles: Set<MemberRole> = setOf(Guest)

        /** Map a wire role string to a typed [MemberRole]. */
        fun parse(raw: String?): MemberRole =
            when (raw?.lowercase()) {
                "owner" -> Owner
                "admin" -> Admin
                "manager" -> Manager
                "member" -> Member
                "restricted_member", "restricted", "limited" -> Restricted
                "tenant", "lease_resident" -> Tenant
                "guest" -> Guest
                else -> Member
            }
    }
}

/** Background + foreground colour pair for a role chip. */
data class MemberRolePalette(
    val background: Color,
    val foreground: Color,
)

/**
 * Six-tone palette for member avatars. Stable mapping from user id so
 * the same person always renders the same colour across sessions.
 * Mirrors the iOS `MemberAvatarTone` palette.
 */
enum class MemberAvatarTone {
    Sky,
    Teal,
    Amber,
    Rose,
    Violet,
    Slate,
    ;

    val gradient: GradientPair
        get() =
            when (this) {
                Sky -> GradientPair(PantopusColors.primary500, PantopusColors.primary700)
                Teal -> GradientPair(PantopusColors.success, PantopusColors.home)
                Amber -> GradientPair(PantopusColors.warning, PantopusColors.handyman)
                Rose -> GradientPair(PantopusColors.error, PantopusColors.vehicles)
                Violet -> GradientPair(PantopusColors.business, PantopusColors.goods)
                Slate -> GradientPair(PantopusColors.appTextSecondary, PantopusColors.appTextStrong)
            }

    companion object {
        fun toneFor(id: String): MemberAvatarTone {
            val palette = entries
            var hash = 0
            for (ch in id) hash += ch.code
            val index = (hash % palette.size + palette.size) % palette.size
            return palette[index]
        }
    }
}
