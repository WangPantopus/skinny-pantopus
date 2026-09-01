package app.pantopus.android.ui.screens.hub

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.theme.PantopusIcon
import java.util.Locale

/**
 * Top-level hub lifecycle state. Marked `@Immutable` so Compose treats
 * the parent `HubScreen` as skippable when neither the state nor the
 * intent handler changed.
 */
@Immutable
sealed interface HubUiState {
    /** Initial skeleton / refresh state. */
    data object Skeleton : HubUiState

    /** First-run content for new users. */
    data class FirstRun(
        val content: FirstRunContent,
    ) : HubUiState

    /** Fully-assembled hub. */
    data class Populated(
        val content: PopulatedContent,
    ) : HubUiState

    /** Transport / server error. */
    data class Error(
        val message: String,
    ) : HubUiState
}

/** First-run projection. */
@Immutable
data class FirstRunContent(
    val greeting: String,
    val name: String,
    val avatarInitials: String,
    val identity: IdentityPillar,
    val ringProgress: Float,
    val profileCompleteness: Float,
    val stepsDone: Int,
    val stepsTotal: Int,
    val steps: List<SetupStep>,
    val pillars: List<PillarTile>,
    val discovery: List<DiscoveryCardContent>,
)

/** Assembled hub bundle. */
@Immutable
data class PopulatedContent(
    val topBar: TopBarContent,
    val actionChips: List<ActionChipContent>,
    /**
     * Server-driven "Needs attention" strip — `GET /api/hub`'s
     * `statusItems[]` (`backend/routes/hub.js:24`). Mirrors RN
     * `src/components/hub/HubActionStrip.tsx`.
     */
    val statusItems: List<StatusStripItem> = emptyList(),
    /**
     * Neighbor-density pill + milestone banner. `null` when the viewer
     * has no home or the backend omits the block.
     */
    val neighborDensity: NeighborDensityContent? = null,
    val setupBanner: SetupBannerContent?,
    val today: TodaySummary?,
    val pillars: List<PillarTile>,
    val discovery: List<DiscoveryCardContent>,
    val jumpBackIn: List<JumpBackItem>,
    val activity: List<ActivityEntry>,
)

/**
 * One pill in the hub's "Needs attention" strip, projected from
 * `GET /api/hub`'s `statusItems[]`. The backend owns the copy, the
 * severity and the tap route; the client only owns the dismissal.
 */
@Immutable
data class StatusStripItem(
    val id: String,
    val title: String,
    val subtitle: String?,
    val severity: Severity,
    val icon: PantopusIcon,
    /** Canonical web route the host maps to a native destination. */
    val route: String,
) {
    /** Server severity, drives the pill tint. */
    enum class Severity {
        Critical,
        Warning,
        Info,
        ;

        companion object {
            fun fromRaw(raw: String): Severity =
                when (raw.lowercase()) {
                    "critical" -> Critical
                    "warning" -> Warning
                    else -> Info
                }
        }
    }
}

/**
 * Neighbor-density pill + optional milestone banner — `GET /api/hub`'s
 * `neighborDensity` block. Mirrors RN
 * `src/components/hub/NeighborDensity.tsx`.
 */
@Immutable
data class NeighborDensityContent(
    /** Verified neighbors inside [radiusMiles]. */
    val count: Int,
    val radiusMiles: Double,
    /** Server-authored celebration copy; `null` hides the banner. */
    val milestone: String?,
    /**
     * Home the dismissal is recorded against. `null` disables the
     * dismiss call (the banner still hides locally).
     */
    val homeId: String?,
) {
    /** "12 verified neighbors within 1 mi". */
    val pillText: String
        get() {
            val noun = if (count == 1) "neighbor" else "neighbors"
            return "$count verified $noun within ${formatRadius(radiusMiles)}"
        }

    private fun formatRadius(miles: Double): String =
        if (miles == Math.floor(miles)) "${miles.toInt()} mi" else String.format(Locale.US, "%.1f mi", miles)
}

/** Setup-step row. */
@Immutable
data class SetupStep(
    val id: String,
    val title: String,
    val done: Boolean,
)

/** Hub top-bar payload. */
@Immutable
data class TopBarContent(
    val greeting: String,
    val name: String,
    val avatarInitials: String,
    /** Identity pillar that tints the avatar ring. */
    val identity: IdentityPillar = IdentityPillar.Personal,
    val ringProgress: Float,
    val unreadCount: Int,
    /**
     * S5 — unread count in the Beacon (audience) firewall zone, read from
     * `GET /api/notifications/unread-count`'s `byContext.audience`
     * (`backend/routes/notifications.js:187-193`). Drives the megaphone
     * shortcut next to the bell, mirroring RN's `hub-bell-audience`
     * button. `0` hides the shortcut.
     */
    val audienceUnreadCount: Int = 0,
)

/** Chip in the action strip. */
@Immutable
data class ActionChipContent(
    val kind: Kind,
    val label: String,
    val icon: PantopusIcon,
    val active: Boolean,
) {
    /** Well-known chip identifiers. */
    enum class Kind { PostTask, SnapAndSell, ScanMail, AddHome }
}

/** Amber setup banner payload. */
@Immutable
data class SetupBannerContent(
    val title: String = "Verify your address",
    val ctaTitle: String = "Start",
)

/** Today card. */
@Immutable
data class TodaySummary(
    val temperatureFahrenheit: Int? = null,
    val conditions: String? = null,
    val aqiLabel: String? = null,
    val commuteLabel: String? = null,
)

/** One of the 4 pillar tiles. */
@Immutable
data class PillarTile(
    val pillar: Pillar,
    val label: String,
    val icon: PantopusIcon,
    val tint: IdentityPillar,
    val chip: String?,
    val chipSetupState: Boolean,
    /** 10.5pt fg3 caption below the label (design's per-tile context). */
    val caption: String? = null,
) {
    enum class Pillar { Pulse, Marketplace, Gigs, Mail }
}

/**
 * The Discover section's filter tabs. Each entry is a `filter` query value
 * accepted by `GET /api/hub/discovery`
 * (`backend/routes/hub.js:783-1009`) — the handler 400s on anything
 * outside `gigs | people | businesses | posts | listings`.
 * Mirrors RN `src/components/hub/HubDiscovery.tsx:9-14`.
 */
enum class HubDiscoveryFilter(
    val queryValue: String,
    val label: String,
) {
    Gigs("gigs", "Tasks"),
    People("people", "People"),
    Businesses("businesses", "Businesses"),
    Posts("posts", "Posts"),
}

/**
 * Kind of entity surfaced by a Hub discovery card. Used by the
 * navigation host to dispatch a tap to the matching detail screen.
 */
enum class DiscoveryKind {
    Gig,
    Person,
    Business,
    Post,
    Unknown,
    ;

    companion object {
        fun fromRawType(raw: String): DiscoveryKind =
            when (raw.lowercase()) {
                "gig" -> Gig
                "person" -> Person
                "business" -> Business
                "post" -> Post
                else -> Unknown
            }
    }
}

/** Discovery rail card. */
@Immutable
data class DiscoveryCardContent(
    val id: String,
    val title: String,
    val meta: String,
    val category: String,
    val avatarInitials: String,
    val kind: DiscoveryKind,
    /** Pillar tint that drives the top-half gradient + chip color. */
    val tint: IdentityPillar = IdentityPillar.Personal,
)

/**
 * Jump-back-in rail card. `route` is the canonical web path returned by
 * `GET /api/hub` (e.g. `/app/mailbox?scope=home&homeId=…`); the
 * navigation host parses it to pick the native destination.
 */
@Immutable
data class JumpBackItem(
    val id: String,
    val title: String,
    val icon: PantopusIcon,
    val route: String,
    /** Pillar tint that drives the icon disk + progress bar fill. */
    val tint: IdentityPillar = IdentityPillar.Personal,
    /** Uppercase overline above the title — design uses "In progress" / "Draft". */
    val kicker: String = "In progress",
    /** Progress text line below the bar; optional. */
    val progressLabel: String? = null,
    /** 0..1 fraction for the progress bar; optional (hides when nil). */
    val progressFraction: Float? = null,
)

/** Recent-activity row. */
@Immutable
data class ActivityEntry(
    val id: String,
    val title: String,
    val timeAgo: String,
    val icon: PantopusIcon,
    val tint: IdentityPillar,
)

/** Outbound navigation intent. */
sealed interface HubNavigationIntent {
    data object OpenNotifications : HubNavigationIntent

    /**
     * S5 — megaphone shortcut straight into the Beacon (audience)
     * notification zone. The host navigates to
     * `ChildRoutes.notificationsZone("audience")`.
     */
    data object OpenAudienceNotifications : HubNavigationIntent

    data object OpenMenu : HubNavigationIntent

    data object OpenProfile : HubNavigationIntent

    data object StartVerification : HubNavigationIntent

    data class ActionTapped(
        val kind: ActionChipContent.Kind,
    ) : HubNavigationIntent

    data class PillarTapped(
        val pillar: PillarTile.Pillar,
    ) : HubNavigationIntent

    data class DiscoveryTapped(
        val item: DiscoveryCardContent,
    ) : HubNavigationIntent

    /**
     * Tap on a server-driven "Needs attention" pill. The host resolves
     * `item.route` the same way it resolves a jump-back-in route.
     */
    data class StatusItemTapped(
        val item: StatusStripItem,
    ) : HubNavigationIntent

    /** Hub Discovery rail "See all" CTA — pushes the typed Discover hub
     *  screen (T5.4.1 / P11). */
    data object OpenDiscoverHub : HubNavigationIntent

    /** Discover header "Explore Map" link — RN `(tabs)/index.tsx:505`. */
    data object OpenExploreMap : HubNavigationIntent

    /** Discover header "Find Businesses" link — RN `(tabs)/index.tsx:506`. */
    data object OpenFindBusinesses : HubNavigationIntent

    data class JumpBackTapped(
        val item: JumpBackItem,
    ) : HubNavigationIntent

    /**
     * Today-card tap. Design destination is home calendar (P11), so this
     * is a no-op at the host until that lands.
     */
    data object OpenToday : HubNavigationIntent

    /** P1.5 — Recent activity "See all" CTA. Pushes the standalone log. */
    data object OpenRecentActivity : HubNavigationIntent
}
