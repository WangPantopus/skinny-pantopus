package app.pantopus.android.ui.screens.root

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Typed bottom-bar destination. Exposes both the NavController `path` used
 * by the NavHost and the label / icon that render in [PantopusBottomBar].
 *
 * Listed in display order — new tabs must keep the ordering stable so the
 * bar doesn't shuffle between releases.
 */
sealed class PantopusRoute(
    val path: String,
    val label: String,
    val icon: PantopusIcon,
) {
    /** Primary hub — the personalised landing surface (Prompt P7). */
    data object Home : PantopusRoute(path = "root/home", label = "Home", icon = PantopusIcon.Home)

    /** Neighborhood feed — Pulse posts near you. */
    data object Pulse : PantopusRoute(path = "root/pulse", label = "Pulse", icon = PantopusIcon.Rss)

    /** Neighbour gigs — browse, bid, and post tasks. */
    data object Tasks : PantopusRoute(path = "root/tasks", label = "Tasks", icon = PantopusIcon.Briefcase)

    /** Local marketplace — buy, sell, and rent nearby. */
    data object Marketplace : PantopusRoute(path = "root/marketplace", label = "Marketplace", icon = PantopusIcon.ShoppingBag)

    /** Direct messages and group chats. */
    data object Messages : PantopusRoute(path = "root/messages", label = "Messages", icon = PantopusIcon.MessageCircle)

    companion object {
        /**
         * Bottom-bar destinations in display order.
         *
         * `by lazy` is intentional: when this list is built eagerly, the
         * companion's <clinit> runs while `PantopusRoute`'s own class init
         * is still in flight, so `Home.INSTANCE` etc. resolve to null and
         * downstream callers crash with NPE. Deferring construction until
         * first access lets every `data object` finish initialising first.
         */
        val entries: List<PantopusRoute> by lazy { listOf(Home, Pulse, Tasks, Marketplace, Messages) }

        /** Lookup a route by its `path`. Returns null for unknown paths. */
        fun fromPath(path: String?): PantopusRoute? = entries.firstOrNull { it.path == path }
    }
}
