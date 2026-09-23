@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.recent_activity

/**
 * Typed destination raised when a Recent Activity row is tapped. The
 * host ([app.pantopus.android.ui.screens.root.RootTabScreen]) maps each
 * case onto the matching `ChildRoutes` entry. Mirrors iOS
 * `RecentActivityDestination`.
 */
sealed interface RecentActivityDestination {
    data class GigDetail(val id: String) : RecentActivityDestination

    data class ListingDetail(val id: String) : RecentActivityDestination

    data class MailItemDetail(val id: String) : RecentActivityDestination

    data class PulsePost(val id: String) : RecentActivityDestination

    data class HomeDashboard(val id: String) : RecentActivityDestination

    /**
     * Any other route (e.g. `/app/notifications`, `/app/connections`): the
     * host hands it to [app.pantopus.android.core.routing.DeepLinkRouter],
     * as the Notifications list does, and only falls back to the
     * placeholder when nothing resolves.
     */
    data class Link(val path: String, val label: String) : RecentActivityDestination

    /** A row without a route. */
    data class Placeholder(val label: String) : RecentActivityDestination
}
