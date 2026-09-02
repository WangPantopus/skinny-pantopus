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
    /**
     * Your Place — the address's page (Wedge v2 D2). Lands on the Place
     * dashboard when a primary home exists, the Hub otherwise. Keeps the
     * legacy `root/home` path so deep links and saved state survive.
     */
    data object Place : PantopusRoute(path = "root/home", label = "Place", icon = PantopusIcon.Home)

    /** Today — the daily habit: weather, air, alerts, and the address calendar. */
    data object Today : PantopusRoute(path = "root/today", label = "Today", icon = PantopusIcon.CloudSun)

    /** Nearby — the density door and its window (the cells map, the meter, what opens). */
    data object Nearby : PantopusRoute(path = "root/nearby", label = "Nearby", icon = PantopusIcon.MapPin)

    /** Mail — the digital mailbox, with Messages as its inbox. */
    data object Mail : PantopusRoute(path = "root/mail", label = "Mail", icon = PantopusIcon.Mailbox)

    // ── Reachable, not in the bar (Wedge v2 D2): the pillars live behind
    // Nearby's door, and Messages lives inside Mail. Their routes stay
    // registered so every existing push still lands.

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
        val entries: List<PantopusRoute> by lazy { listOf(Place, Today, Nearby, Mail) }

        /** Every root destination, bar tabs first — for `fromPath` lookups off the bar. */
        val all: List<PantopusRoute> by lazy { entries + listOf(Pulse, Tasks, Marketplace, Messages) }

        /** Lookup a route by its `path`. Returns null for unknown paths. */
        fun fromPath(path: String?): PantopusRoute? = all.firstOrNull { it.path == path }
    }
}
