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
     * Your Place — the person's place (Wedge v2 D2): Your Place for a Home
     * they can open, the address they saved, or the address-first screen.
     * Keeps the legacy `root/home` path so deep links and saved state survive.
     */
    data object Place : PantopusRoute(path = "root/home", label = "Place", icon = PantopusIcon.Home)

    /** Today — the daily habit: weather, air, alerts, and the address calendar. */
    data object Today : PantopusRoute(path = "root/today", label = "Today", icon = PantopusIcon.CloudSun)

    /**
     * Pulse — what neighbors are saying and asking: the Pulse page, its composer and its conversations (Pulse build
     * S3). With the Pulse redesign on it replaced the Nearby tab and opens on the feed; with it off (launch cut 11) it
     * is the October 13 feed, opened from Nearby. Keeps the `root/pulse` path.
     */
    data object Pulse : PantopusRoute(path = "root/pulse", label = "Pulse", icon = PantopusIcon.Activity)

    /**
     * Plans — what's on nearby and what you're going to: the Plans map and list, hosting, requests and Your plans. A
     * tab only while the Pulse redesign and the `plans` switch are on for the person ([barTabs]); with the redesign
     * off the Plans map is the Nearby tab, as on October 13.
     */
    data object Plans : PantopusRoute(path = "root/plans", label = "Plans", icon = PantopusIcon.Calendar)

    /**
     * Mail — the digital mailbox, with Messages as its inbox. While Mailbox is off for launch (contract §9,
     * 2026-10-09) this tab is Messages: the conversation list itself, with a chat bubble. Its path and the
     * `tab.mail` test tag stay, so links, saved state and UI tests keep working.
     */
    data object Mail : PantopusRoute(path = "root/mail", label = "Mail", icon = PantopusIcon.Mailbox) {
        override val label: String get() = if (LaunchFeatures.mailbox) "Mail" else "Messages"
        override val icon: PantopusIcon get() = if (LaunchFeatures.mailbox) PantopusIcon.Mailbox else PantopusIcon.MessageCircle
    }

    // ── Reachable, not in the bar: Nearby stays only so `pantopus://nearby` links, pushes and saved state resolve
    // (to Pulse); the pillars open from Pulse and Messages lives inside Mail. Their routes stay registered so every
    // existing push still lands. With the Pulse redesign off, Nearby is the tab and Pulse sits behind it instead.

    /**
     * Nearby — the density door and its window (the cells map, the meter, what opens): the tab while the Pulse
     * redesign is off (October 13). With it on Nearby is no longer a tab (Pulse build S3): its Pulse, Connections and
     * neighborhood meter moved into the Pulse tab, the route stays registered, and opening it opens Pulse.
     */
    data object Nearby : PantopusRoute(path = "root/nearby", label = "Nearby", icon = PantopusIcon.MapPin)

    /** Neighbour gigs — browse, bid, and post tasks. */
    data object Tasks : PantopusRoute(path = "root/tasks", label = "Tasks", icon = PantopusIcon.Briefcase)

    /** Local marketplace — buy, sell, and rent nearby. */
    data object Marketplace : PantopusRoute(path = "root/marketplace", label = "Marketplace", icon = PantopusIcon.ShoppingBag)

    /** Direct messages and group chats. */
    data object Messages : PantopusRoute(path = "root/messages", label = "Messages", icon = PantopusIcon.MessageCircle)

    companion object {
        /**
         * Bottom-bar destinations in display order, with every tab the app can show: Place · Today · Pulse · Plans ·
         * Mail with the Pulse redesign on, and the October 13 Place · Today · Nearby · Mail while it is off (launch cut
         * 11). Plans shows only while its switch is on: read [barTabs] for what the bar draws.
         */
        val entries: List<PantopusRoute> get() = if (LaunchFeatures.pulseRedesign) redesignTabs else launchTabs

        /*
         * `by lazy` is intentional: when these lists are built eagerly, the
         * companion's <clinit> runs while `PantopusRoute`'s own class init
         * is still in flight, so `Home.INSTANCE` etc. resolve to null and
         * downstream callers crash with NPE. Deferring construction until
         * first access lets every `data object` finish initialising first.
         */
        private val redesignTabs: List<PantopusRoute> by lazy { listOf(Place, Today, Pulse, Plans, Mail) }
        private val launchTabs: List<PantopusRoute> by lazy { listOf(Place, Today, Nearby, Mail) }

        /** The tabs the bar draws: five while the `plans` switch is [plansOn], four (without Plans) while it is off. */
        fun barTabs(plansOn: Boolean): List<PantopusRoute> = if (plansOn) entries else entries - Plans

        /** Every root destination, bar tabs first — for `fromPath` lookups off the bar. */
        val all: List<PantopusRoute> get() = if (LaunchFeatures.pulseRedesign) redesignRoots else launchRoots

        private val redesignRoots: List<PantopusRoute> by lazy { redesignTabs + listOf(Nearby, Tasks, Marketplace, Messages) }
        private val launchRoots: List<PantopusRoute> by lazy { launchTabs + listOf(Pulse, Plans, Tasks, Marketplace, Messages) }

        /** Lookup a route by its `path`. Returns null for unknown paths. */
        fun fromPath(path: String?): PantopusRoute? = all.firstOrNull { it.path == path }

        /**
         * Where "open my conversations" lands: the Messages tab itself while Mailbox is off, so chat pushes and
         * Hub taps share the tab's list, Back and re-tap; else the Messages root inside Mail.
         */
        val messagesTab: PantopusRoute get() = if (LaunchFeatures.mailbox) Messages else Mail

        /**
         * The bar tab that owns [route]: bar tabs own themselves, the old Nearby door and the pillars behind it
         * (Tasks, Marketplace) belong to Pulse, and Messages sits inside Mail. With the Pulse redesign off, Pulse,
         * Plans and the pillars sit behind Nearby, as on October 13.
         */
        fun barTabFor(route: PantopusRoute): PantopusRoute =
            if (LaunchFeatures.pulseRedesign) {
                when (route) {
                    Nearby, Tasks, Marketplace -> Pulse
                    Messages -> Mail
                    else -> route
                }
            } else {
                when (route) {
                    Pulse, Plans, Tasks, Marketplace -> Nearby
                    Messages -> Mail
                    else -> route
                }
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
