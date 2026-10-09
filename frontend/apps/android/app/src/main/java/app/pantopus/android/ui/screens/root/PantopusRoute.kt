package app.pantopus.android.ui.screens.root

import app.pantopus.android.core.LaunchFeatures
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
    open val label: String,
    open val icon: PantopusIcon,
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

    /**
     * Mail — the digital mailbox, with Messages as its inbox. While Mailbox is off for launch (contract §9,
     * 2026-10-09) this tab is Messages: the conversation list itself, with a chat bubble. Its path and the
     * `tab.mail` test tag stay, so links, saved state and UI tests keep working.
     */
    data object Mail : PantopusRoute(path = "root/mail", label = "Mail", icon = PantopusIcon.Mailbox) {
        override val label: String get() = if (LaunchFeatures.mailbox) "Mail" else "Messages"
        override val icon: PantopusIcon get() = if (LaunchFeatures.mailbox) PantopusIcon.Mailbox else PantopusIcon.MessageCircle
    }

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

        /**
         * Where "open my conversations" lands: the Messages tab itself while Mailbox is off, so chat pushes and
         * Hub taps share the tab's list, Back and re-tap; else the Messages root inside Mail.
         */
        val messagesTab: PantopusRoute get() = if (LaunchFeatures.mailbox) Messages else Mail

        /**
         * The bar tab that owns [route]: bar tabs own themselves, the pillars
         * (Pulse, Tasks, Marketplace) sit behind Nearby, and Messages sits
         * inside Mail.
         */
        fun barTabFor(route: PantopusRoute): PantopusRoute =
            when (route) {
                Pulse, Tasks, Marketplace -> Nearby
                Messages -> Mail
                else -> route
            }

        /**
         * The bar tab to highlight: the top destination's own tab when it is a
         * root, else the tab owning the root destinations beneath it, so child
         * screens keep their tab lit. Tab switches pop back to Place first, so
         * at most one other tab's roots are on the stack.
         */
        fun barTabFor(
            top: PantopusRoute?,
            rootsOnStack: List<PantopusRoute>,
        ): PantopusRoute = top?.let(::barTabFor) ?: rootsOnStack.map(::barTabFor).firstOrNull { it != Place } ?: Place
    }
}
