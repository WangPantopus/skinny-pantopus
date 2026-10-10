@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.recent_activity

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.hub.HubActivityItem
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/**
 * P1.5 — drives the standalone Recent Activity log reached from the
 * Hub's `HubRecentActivity` "See all" CTA. Fetches the same
 * `/api/hub` overview the Hub does and projects the full `activity[]`
 * window (up to 10 items the backend returns) into the shared
 * `ListOfRows` archetype. Mirrors iOS `RecentActivityViewModel`.
 */
@HiltViewModel
class RecentActivityViewModel
    @Inject
    constructor(
        private val repo: HubRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        /** Host-supplied router. Set by the screen before the first row tap. */
        var onOpen: (RecentActivityDestination) -> Unit = {}

        private val _refreshing = MutableStateFlow(false)

        /** True only while a pull or Retry reads with the rows on screen. */
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        init {
            // Instant Screens: the Hub's overview (one shared copy in the screens' store) is the first frame.
            repo.overviewCopy()?.let { apply(it.activity) }
        }

        /** Entry: the stored activity shows at once and is read again only once the store says it is out of date. */
        fun load() = fetch(force = false)

        /** Pull and Retry: reads now; the rows stay on screen. */
        fun refresh() = fetch(force = true)

        fun loadMoreIfNeeded() {
            // No-op: backend caps activity at 10 per `/api/hub` response;
            // no pagination cursor is exposed.
        }

        private fun fetch(force: Boolean) {
            val shown = _state.value is ListOfRowsUiState.Loaded || _state.value is ListOfRowsUiState.Empty
            if (!shown) _state.value = ListOfRowsUiState.Loading
            _refreshing.value = force && shown
            viewModelScope.launch {
                val stored = repo.overviewStored(force)
                _refreshing.value = false
                _refreshNotice.value = RefreshNotice(stored.fetchedAt, ::refresh).takeIf { stored.showsRefreshFailure(StoreKind.HOMES) }
                val hub = stored.data
                val failure = stored.failure
                when {
                    hub != null -> apply(hub.activity)
                    // A failed read keeps the rows; only an empty screen, or the server's refusal, shows the error.
                    failure != null && (!shown ||
                        failure is NetworkError.Forbidden ||
                        failure == NetworkError.NotFound ||
                        failure == NetworkError.Unauthorized) ->
                        _state.value = ListOfRowsUiState.Error(failure.displayMessage("Couldn't load the list."))
                }
            }
        }

        private fun apply(activity: List<HubActivityItem>) {
            // Launch cut (2026-09-27): activity from features hidden for the first launch is left out.
            val items = activity.filter { DeepLinkRouter.isLaunchAvailable(it.notificationType, it.route) }
            if (items.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Bell,
                        headline = "No activity yet",
                        subcopy =
                            "Check back later — replies, claims, gigs, and " +
                                "mail events will show up here.",
                    )
                return
            }
            val now = Instant.now()
            val rows = items.map { item -> row(item, now) { onOpen(destinationFor(item)) } }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "all", rows = rows)),
                    hasMore = false,
                )
        }

        companion object {
            /** Map an activity item's `route` to a typed destination case. */
            fun destinationFor(item: HubActivityItem): RecentActivityDestination {
                val path = DeepLinkRouter.notificationPath(item.notificationType, item.route) ?: item.route
                val gigId = idAfter(path, "/gigs/", "/app/gigs/", "/gig/")
                val listingId = idAfter(path, "/listings/", "/app/listings/", "/listing/", "/marketplace/")
                val mailId = idAfter(path, "/mail/", "/mailbox/item/", "/app/mailbox/item/", "/app/mail/")
                val postId = idAfter(path, "/posts/", "/post/", "/app/posts/", "/app/post/")
                val homeId = idAfter(path, "/app/homes/", "/homes/")
                return when {
                    gigId != null -> RecentActivityDestination.GigDetail(gigId)
                    listingId != null -> RecentActivityDestination.ListingDetail(listingId)
                    mailId != null -> RecentActivityDestination.MailItemDetail(mailId)
                    postId != null -> RecentActivityDestination.PulsePost(postId)
                    homeId != null -> RecentActivityDestination.HomeDashboard(homeId)
                    path.isBlank() -> RecentActivityDestination.Placeholder(item.title)
                    else -> RecentActivityDestination.Link(path, item.title)
                }
            }

            /** Project one DTO into a `RowModel`. Public so tests + the
             *  Paparazzi harness can drive the projection directly. */
            fun row(
                item: HubActivityItem,
                now: Instant,
                onSelect: () -> Unit,
            ): RowModel {
                val category = ActivityCategory.fromRoute(item.route)
                return RowModel(
                    id = item.id,
                    title = item.title,
                    template = RowTemplate.StatusChip,
                    leading =
                        RowLeading.TypeIcon(
                            icon = category.icon,
                            background = category.tint.backgroundColor,
                            foreground = category.tint.color,
                        ),
                    trailing = RowTrailing.None,
                    onTap = onSelect,
                    // A single category chip carries the row's tint +
                    // label and lets the shared chip-row renderer place
                    // `timeMeta` at the right edge (the shell only emits
                    // the chip row when chips / bidderStack / splitWith
                    // is set).
                    chips =
                        listOf(
                            RowChip(
                                text = category.label,
                                icon = category.icon,
                                tint =
                                    RowChip.Tint.Custom(
                                        background = category.tint.backgroundColor,
                                        foreground = category.tint.color,
                                    ),
                            ),
                        ),
                    timeMeta = relative(item.at, now),
                    highlight = if (!item.read) RowHighlight.Unread else null,
                )
            }

            /** Compact relative time used by the trailing timestamp. */
            fun relative(
                timestamp: String,
                now: Instant,
            ): String =
                runCatching {
                    val then = Instant.parse(timestamp)
                    val delta = Duration.between(then, now).seconds
                    when {
                        delta < 60 -> "now"
                        delta < 60 * 60 -> "${delta / 60}m"
                        delta < 60 * 60 * 24 -> "${delta / 60 / 60}h"
                        else -> "${delta / 60 / 60 / 24}d"
                    }
                }.getOrDefault(timestamp)

            private fun idAfter(
                path: String,
                vararg prefixes: String,
            ): String? {
                for (prefix in prefixes) {
                    if (path.startsWith(prefix)) {
                        val segment = path.removePrefix(prefix).substringBefore('/')
                        return segment.takeIf { it.isNotEmpty() }
                    }
                }
                return null
            }
        }
    }

/**
 * Visual category for a Recent Activity row. Drives icon + tile tint
 * per the design's row template (leading 40dp tile + title + chevron).
 * Mirrors iOS `ActivityCategory`.
 */
enum class ActivityCategory(
    val icon: PantopusIcon,
    val tint: IdentityPillar,
    val label: String,
) {
    Gig(PantopusIcon.Briefcase, IdentityPillar.Personal, "Gig"),
    Listing(PantopusIcon.Tag, IdentityPillar.Business, "Listing"),
    Mail(PantopusIcon.Mailbox, IdentityPillar.Home, "Mail"),
    Post(PantopusIcon.Megaphone, IdentityPillar.Personal, "Post"),
    Home(PantopusIcon.Home, IdentityPillar.Home, "Home"),
    Other(PantopusIcon.Bell, IdentityPillar.Personal, "Update"),
    ;

    companion object {
        fun fromRoute(route: String): ActivityCategory =
            when {
                route.contains("/gigs") || route.contains("/gig/") -> Gig
                route.contains("/listings") ||
                    route.contains("/listing/") ||
                    route.contains("/marketplace") -> Listing
                route.contains("/mail") || route.contains("/mailbox") -> Mail
                route.contains("/posts") || route.contains("/post/") -> Post
                route.contains("/homes") || route.contains("/home/") -> Home
                else -> Other
            }
    }
}
