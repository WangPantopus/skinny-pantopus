@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.team

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Per-role chip palette + grouping helpers for the Business Team screen.
 * Cloned from `ui/screens/homes/members/MemberRolePalette.kt` but keyed to
 * the business role tiers rather than home occupancy roles.
 *
 * Backend roles (see `backend/utils/businessPermissions.js`
 * BUSINESS_ROLE_RANK): viewer (10) · staff (20) · editor (30) · admin (40)
 * · owner (50). Colours mirror the web Team tab. Unknown / null roles
 * collapse to [Viewer].
 */
enum class BusinessRole(
    /** Wire role string (`role_base`). */
    val wire: String,
    val label: String,
    val pluralLabel: String,
    val rank: Int,
    val icon: PantopusIcon,
    val tileSubcopy: String,
) {
    Owner("owner", "Owner", "Owners", 50, PantopusIcon.Crown, "Full control over the business."),
    Admin("admin", "Admin", "Admins", 40, PantopusIcon.Shield, "Manages team, finances, and settings."),
    Editor("editor", "Editor", "Editors", 30, PantopusIcon.Edit2, "Edits profile, catalog, pages, reviews."),
    Staff("staff", "Staff", "Staff", 20, PantopusIcon.Briefcase, "Day-to-day operations — catalog, gigs."),
    Viewer("viewer", "Viewer", "Viewers", 10, PantopusIcon.Eye, "Read-only access to business info."),
    ;

    /** (background, foreground) pair for the role chip. */
    val palette: BusinessRolePalette
        get() =
            when (this) {
                Owner ->
                    BusinessRolePalette(
                        background = PantopusColors.businessBg,
                        foreground = PantopusColors.business,
                    )
                Admin ->
                    BusinessRolePalette(
                        background = PantopusColors.primary50,
                        foreground = PantopusColors.primary700,
                    )
                Editor ->
                    BusinessRolePalette(
                        background = PantopusColors.successBg,
                        foreground = PantopusColors.success,
                    )
                Staff ->
                    BusinessRolePalette(
                        background = PantopusColors.warningBg,
                        foreground = PantopusColors.warning,
                    )
                Viewer ->
                    BusinessRolePalette(
                        background = PantopusColors.appSurfaceSunken,
                        foreground = PantopusColors.appTextSecondary,
                    )
            }

    companion object {
        /** Roles the owner can assign through the invite wizard — all but
         *  `owner` (promoting to owner is a separate owner-only path). */
        val assignableRoles: List<BusinessRole> = listOf(Admin, Editor, Staff, Viewer)

        /** Map a wire role string to a typed [BusinessRole]. */
        fun parse(raw: String?): BusinessRole =
            when (raw?.lowercase()) {
                "owner" -> Owner
                "admin" -> Admin
                "editor" -> Editor
                "staff" -> Staff
                "viewer" -> Viewer
                else -> Viewer
            }
    }
}

/** Background + foreground colour pair for a role chip. */
data class BusinessRolePalette(
    val background: Color,
    val foreground: Color,
)

/**
 * Six-tone palette for team avatars. Stable mapping from an id so the same
 * person always renders the same colour across sessions. Mirrors the iOS
 * `BusinessTeamAvatarTone`.
 */
enum class BusinessTeamAvatarTone {
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
        fun toneFor(id: String): BusinessTeamAvatarTone {
            val palette = entries
            var hash = 0
            for (ch in id) hash += ch.code
            val index = (hash % palette.size + palette.size) % palette.size
            return palette[index]
        }
    }
}
