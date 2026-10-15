package app.pantopus.android.ui.screens.place

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A household shortcut under Home tools. Each shows only when the person's access at the Home carries the permission
 * Home tools gates it on. Mirrors the iOS `PlaceHomeShortcut`.
 */
enum class PlaceHomeShortcut(
    val title: String,
    val icon: PantopusIcon,
    val permission: String,
    val tag: String,
) {
    TASKS("Tasks", PantopusIcon.ListChecks, "tasks.view", "tasks"),
    MEMBERS("Members", PantopusIcon.Users, "members.view", "members"),
    DOCUMENTS("Documents", PantopusIcon.FileText, "docs.view", "documents"),
    EMERGENCY("Emergency", PantopusIcon.Siren, "sensitive.view", "emergency"),
    ;

    companion object {
        /** The shortcuts [authority] allows, in this order; none without access. */
        fun allowedBy(authority: HomeDashboardAuthorityDto?): List<PlaceHomeShortcut> =
            if (authority?.hasAccess == true) entries.filter { it.permission in authority.permissions } else emptyList()
    }
}
