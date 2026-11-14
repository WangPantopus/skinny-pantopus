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
     * tab only while the `plans` switch is on for the person ([barTabs]), with the Pulse redesign on or off (founder,
     * 2026-10-17: with it off the bar is Place · Today · Nearby · Plans · Messages, and Nearby stays the October 13
     * screen).
     */
    data object Plans : PantopusRoute(path = "root/plans", label = "Plans", icon = PantopusIcon.Calendar)

    /**
     * Moments — photos, short videos and text cards people post where they are, for 1 to 48 hours, on their own map
     * (founder, 2026-11-08). A tab only while the `moments` switch is on for the person ([barTabs]), between Pulse and
     * Plans, the other two map tabs.
     */
    data object Moments : PantopusRoute(path = "root/moments", label = "Moments", icon = PantopusIcon.CircleDashed)

    /**
     * Mail — the digital mailbox, its own tab (founder, 2026-10-26), third on the bar after Place and Today (founder
     * decision 2026-11-13). While Mailbox is off for launch (contract §9, 2026-10-09) this tab is Messages: the
     * conversation list itself, with a chat bubble, off the bar. Its path and the `tab.mail` test tag stay, so links,
     * saved state and UI tests keep working.
     */
    data object Mail : PantopusRoute(path = "root/mail", label = "Mail", icon = PantopusIcon.Mailbox) {
        override val label: String get() = if (LaunchFeatures.mailbox) "Mail" else "Messages"
        override val icon: PantopusIcon get() = if (LaunchFeatures.mailbox) PantopusIcon.Mailbox else PantopusIcon.MessageCircle
    }

    // ── Reachable, not in the bar: Nearby stays only so `pantopus://nearby` links, pushes and saved state resolve
    // (to Pulse); the pillars open from Pulse. Their routes stay registered so every existing push still lands. With
    // the Pulse redesign off, Nearby is the tab and Pulse sits behind it instead. Messages is a tab while Mailbox is
    // on; with it off its route stays registered and belongs to Mail, which is the conversation list then.

    /**
     * The bar's Pulse tab while the Pulse redesign is off (October 13): the feed under its List | Map switch. It was
     * named Nearby until the founder's November 7 decision, which also moved its density window to Place ("Verified
     * homes nearby"); the path and the `tab.nearby` test tag stay, so links, saved state and UI tests keep working. With
     * the redesign on it is no longer a tab (Pulse build S3): the route stays registered, and opening it opens Pulse.
     */
    data object Nearby : PantopusRoute(path = "root/nearby", label = "Pulse", icon = PantopusIcon.Activity)

    /** Neighbour gigs — browse, bid, and post tasks. */
    data object Tasks : PantopusRoute(path = "root/tasks", label = "Tasks", icon = PantopusIcon.Briefcase)

    /** Local marketplace — buy, sell, and rent nearby. */
    data object Marketplace : PantopusRoute(path = "root/marketplace", label = "Marketplace", icon = PantopusIcon.ShoppingBag)

    /** Direct messages and group chats: off the bar, opened by the chat button while Mailbox is on (2026-11-08). */
    data object Messages : PantopusRoute(path = "root/messages", label = "Messages", icon = PantopusIcon.MessageCircle)

    companion object {
        /**
         * Bottom-bar destinations in display order, with every tab the app can show: Place · Today · Mail · Pulse ·
         * Moments · Plans with the Pulse redesign on, and Place · Today · Mail · Nearby · Moments · Plans while it is off
         * (launch cut 11; the October 13 bar with Plans added, 2026-10-17, and Moments, 2026-11-08). Founder decision
         * 2026-11-13: Mail is third, so your home, your day and your mailbox come first, then the tabs about what's
         * around you. Messages isn't on the bar (founder decision 2026-11-08): the chat button at the top right of every
         * tab but Mail opens it. With Mailbox off, Mail is the conversation list itself, so it leaves the bar too and the
         * order is unchanged. Plans and Moments show only while their switches are on: read [barTabs] for what the bar
         * draws.
         */
        val entries: List<PantopusRoute>
            get() {
                val tabs = if (LaunchFeatures.pulseRedesign) redesignTabs else launchTabs
                return if (LaunchFeatures.mailbox) tabs else tabs - Mail
            }

        /*
         * `by lazy` is intentional: when these lists are built eagerly, the
         * companion's <clinit> runs while `PantopusRoute`'s own class init
         * is still in flight, so `Home.INSTANCE` etc. resolve to null and
         * downstream callers crash with NPE. Deferring construction until
         * first access lets every `data object` finish initialising first.
         */
        // Founder decision 2026-11-13: Mail is third (it was last, after the three tabs that need people nearby).
        private val redesignTabs: List<PantopusRoute> by lazy { listOf(Place, Today, Mail, Pulse, Moments, Plans) }
        private val launchTabs: List<PantopusRoute> by lazy { listOf(Place, Today, Mail, Nearby, Moments, Plans) }

        /**
         * The tabs the bar draws: the [entries] tabs, without Plans while the `plans` switch is off ([plansOn]) and
         * without Moments while the `moments` switch is off ([momentsOn]).
         */
        fun barTabs(
            plansOn: Boolean,
            momentsOn: Boolean = false,
        ): List<PantopusRoute> = entries.filter { (it != Plans || plansOn) && (it != Moments || momentsOn) }

        /** Every root destination, bar tabs first — for `fromPath` lookups off the bar. */
        val all: List<PantopusRoute>
            get() {
                val tabs = entries
                val offBar = if (LaunchFeatures.pulseRedesign) redesignOffBar else launchOffBar
                return tabs + offBar.filterNot { it in tabs }
            }

        private val redesignOffBar: List<PantopusRoute> by lazy { listOf(Nearby, Tasks, Marketplace, Messages, Mail) }
        private val launchOffBar: List<PantopusRoute> by lazy { listOf(Pulse, Tasks, Marketplace, Messages, Mail) }

        /** Lookup a route by its `path`. Returns null for unknown paths. */
        fun fromPath(path: String?): PantopusRoute? = all.firstOrNull { it.path == path }

        /**
         * Where "open my conversations" lands: the Messages tab. While Mailbox is off that is Mail, which shows the
         * conversation list, so chat pushes and Hub taps share the tab's list, Back and re-tap.
         */
        val messagesTab: PantopusRoute get() = if (LaunchFeatures.mailbox) Messages else Mail

        /** Where a Plans entry point lands while the `plans` switch is off: Pulse, or Nearby with the Pulse redesign off. */
        val plansOffTab: PantopusRoute get() = if (LaunchFeatures.pulseRedesign) Pulse else Nearby

        /** Where someone standing on Moments lands when its switch turns off: Pulse, as for Plans. */
        val momentsOffTab: PantopusRoute get() = plansOffTab

        /**
         * The bar tab that owns [route]: bar tabs own themselves, the old Nearby door and the pillars behind it
         * (Tasks, Marketplace) belong to Pulse, and Messages is its own tab (Mail, the conversation list, while
         * Mailbox is off). With the Pulse redesign off, Pulse and the pillars sit behind Nearby, as on October 13,
         * and Plans is its own tab.
         */
        fun barTabFor(route: PantopusRoute): PantopusRoute =
            if (LaunchFeatures.pulseRedesign) {
                when (route) {
                    Nearby, Tasks, Marketplace -> Pulse
                    Messages -> messagesTab
                    else -> route
                }
            } else {
                when (route) {
                    Pulse, Tasks, Marketplace -> Nearby
                    Messages -> messagesTab
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
