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

    /** Fallback for routes that don't match a known domain. */
    data class Placeholder(val label: String) : RecentActivityDestination
}
