@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.discoverhub

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.hub.DiscoveryItem
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.HubRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.ChipStripConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailImage
import app.pantopus.android.ui.screens.shared.list_of_rows.ThumbnailSize
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Stable chip ids exposed for tests + the screen. */
object DiscoverHubChip {
    const val NEARBY = "nearby"
    const val NEW_TODAY = "new-today"
    const val VERIFIED = "verified"
    const val FREE_OR_WANTED = "free-or-wanted"
}

/** Stable section ids — match iOS string values for telemetry parity. */
object DiscoverHubSection {
    const val PEOPLE = "people"
    const val BUSINESSES = "businesses"
    const val GIGS = "gigs"
    const val LISTINGS = "listings"
}

/** Outbound routing target emitted by row taps + section see-all CTAs. */
sealed interface DiscoverHubTarget {
    data class Person(val userId: String, val displayName: String) : DiscoverHubTarget

    data class Business(val businessId: String, val name: String) : DiscoverHubTarget

    data class Gig(val gigId: String) : DiscoverHubTarget

    data class Listing(val listingId: String) : DiscoverHubTarget

    data class Post(val postId: String) : DiscoverHubTarget

    data object SeeAllPeople : DiscoverHubTarget

    data object SeeAllBusinesses : DiscoverHubTarget

    data object SeeAllGigs : DiscoverHubTarget

    data object SeeAllListings : DiscoverHubTarget

    data object SeeAllPosts : DiscoverHubTarget
}

/**
 * Six-tone palette for category-icon backgrounds + thumbnail gradients.
 * Stable per-id so the same item always renders the same colour.
 */
enum class DiscoverHubTone {
    Sky,
    Teal,
    Amber,
    Rose,
    Violet,
    Slate,
    ;

    val gradient: GradientPair
        get() =
            when (this) {
                Sky -> GradientPair(PantopusColors.primary500, PantopusColors.primary700)
                Teal -> GradientPair(PantopusColors.success, PantopusColors.home)
                Amber -> GradientPair(PantopusColors.warning, PantopusColors.handyman)
                Rose -> GradientPair(PantopusColors.error, PantopusColors.vehicles)
                Violet -> GradientPair(PantopusColors.business, PantopusColors.goods)
                Slate -> GradientPair(PantopusColors.appTextSecondary, PantopusColors.appTextStrong)
            }

    companion object {
        fun toneFor(id: String): DiscoverHubTone {
            val palette = entries
            var hash = 0
            for (ch in id) hash += ch.code
            val index = (hash % palette.size + palette.size) % palette.size
            return palette[index]
        }
    }
}

/**
 * T5.4.1 — Discover hub. Drives the typed discovery list (People ·
 * Businesses · Gigs · Listings) on the shared `ListOfRows` archetype.
 *
 * Mirrors iOS `DiscoverHubViewModel` exactly:
 *  - Top-bar trailing `sliders-horizontal` icon presents the
 *    `DiscoveryFilterSheet` (P5.2) with an active-filter count badge.
 *    Filters are persisted in [filters] and applied via [applyFilters].
 *  - Chip-strip filter row (Nearby / New today / Verified / Free /
 *    wanted). Selection re-fetches all four types with the matching
 *    query params; `Trending` is omitted (no engagement signal in the
 *    `/api/hub/discovery` response today).
 *  - Body: four typed `RowSection`s rendered as cards with hairline
 *    separators (P1's `SectionStyle.Card`). Section header carries a
 *    `count` and a `See all` CTA (`RowSection.onSeeAll`).
 *  - Empty section is hidden (per the design's empty frame flow). When
 *    all four return zero items the screen renders the whole-screen
 *    empty state (`compass` + "Nothing to discover yet").
 *
 * Backend (existing — `backend/routes/hub.js:757`, additive T5.4.1
 * fields). The fan-out is four parallel `HubRepository.discovery`
 * calls per chip selection — no composite `/api/discover/hub`
 * endpoint exists today.
 */
@HiltViewModel
class DiscoverHubViewModel
    @Inject
    constructor(
        private val repo: HubRepository,
    ) : ViewModel() {
        private val perTypeLimit: Int = 5

        private var people: List<DiscoveryItem> = emptyList()
        private var businesses: List<DiscoveryItem> = emptyList()
        private var gigs: List<DiscoveryItem> = emptyList()
        private var listings: List<DiscoveryItem> = emptyList()
        private var loadedOnce: Boolean = false

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _magazineState =
            MutableStateFlow<DiscoverHubMagazineUiState>(DiscoverHubMagazineUiState.Loading)
        val magazineState: StateFlow<DiscoverHubMagazineUiState> = _magazineState.asStateFlow()

        private val _selectedMagazineFilter = MutableStateFlow<DiscoverHubMapKind?>(null)
        val selectedMagazineFilter: StateFlow<DiscoverHubMapKind?> = _selectedMagazineFilter.asStateFlow()

        private val _selectedChip = MutableStateFlow(DiscoverHubChip.NEARBY)
        val selectedChip: StateFlow<String> = _selectedChip.asStateFlow()

        /** Persisted filter-sheet selection. Default = no filters. */
        private val _filters = MutableStateFlow(DiscoverHubFilters.Default)
        val filters: StateFlow<DiscoverHubFilters> = _filters.asStateFlow()

        /** Whether the filter sheet is shown. */
        private val _showFilterSheet = MutableStateFlow(false)
        val showFilterSheet: StateFlow<Boolean> = _showFilterSheet.asStateFlow()

        private val _chipStrip = MutableStateFlow(makeChipStrip(DiscoverHubChip.NEARBY))
        val chipStrip: StateFlow<ChipStripConfig> = _chipStrip.asStateFlow()

        private val _topBarAction = MutableStateFlow<TopBarAction?>(makeTopBarAction())
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        /**
         * Routing callback. Set by the screen via [onSelect] before
         * [load]. Defaults to a no-op so the VM is safe to construct in
         * isolation (tests, previews).
         */
        var onSelect: (DiscoverHubTarget) -> Unit = {}
            set(value) {
                field = value
                _topBarAction.value = makeTopBarAction()
                applyState()
            }

        /** Initial load. Idempotent — re-running won't refetch when already loaded. */
        fun load() {
            if (loadedOnce) return
            reload()
        }

        /** Pull-to-refresh. */
        fun refresh() = reload()

        // MARK: - A11.3 Magazine state

        fun loadMagazine(scenario: DiscoverHubMagazineScenario = DiscoverHubMagazineScenario.Populated) {
            _magazineState.value = DiscoverHubMagazineUiState.Loading
            _magazineState.value =
                when (scenario) {
                    DiscoverHubMagazineScenario.Loading -> DiscoverHubMagazineUiState.Loading
                    DiscoverHubMagazineScenario.Empty -> DiscoverHubMagazineUiState.Empty
                    DiscoverHubMagazineScenario.Populated ->
                        DiscoverHubMagazineUiState.Populated(DiscoverHubSampleData.populated)
                    DiscoverHubMagazineScenario.Error ->
                        DiscoverHubMagazineUiState.Error("Couldn't load discovery. Try again.")
                }
        }

        fun refreshMagazine() = loadMagazine()

        fun selectMagazineFilter(filter: DiscoverHubMapKind?) {
            _selectedMagazineFilter.value = filter
        }

        fun selectTask(id: String) {
            onSelect(DiscoverHubTarget.Gig(id))
        }

        fun selectMarketplaceItem(id: String) {
            onSelect(DiscoverHubTarget.Listing(id))
        }

        fun selectPost(id: String) {
            onSelect(DiscoverHubTarget.Post(id))
        }

        fun seeAllTasks() {
            onSelect(DiscoverHubTarget.SeeAllGigs)
        }

        fun seeAllMarketplace() {
            onSelect(DiscoverHubTarget.SeeAllListings)
        }

        fun seeAllPosts() {
            onSelect(DiscoverHubTarget.SeeAllPosts)
        }

        fun notifyWhenActive() {
            // A11.3 empty-frame escape hatch. Notification persistence lands
            // with the eventual alerts service; no network call is made here.
        }

        /** Update the live chip selection. Triggers a refetch. */
        fun selectChip(id: String) {
            if (_selectedChip.value == id) return
            _selectedChip.value = id
            _chipStrip.value = makeChipStrip(id)
            reload()
        }

        // MARK: - Filters

        /** Open the filter sheet (top-bar action handler). */
        fun presentFilters() {
            _showFilterSheet.value = true
        }

        /** Dismiss the filter sheet. */
        fun dismissFilters() {
            _showFilterSheet.value = false
        }

        /**
         * Apply a new filter selection: re-fetch (verified-only is a
         * server param) then re-project (content-type + newest-first are
         * client-side).
         */
        fun applyFilters(newFilters: DiscoverHubFilters) {
            _filters.value = newFilters
            _topBarAction.value = makeTopBarAction()
            reload()
        }

        // MARK: - Fetching

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val sinceParam = if (_selectedChip.value == DiscoverHubChip.NEW_TODAY) "today" else null
                val verifiedParam =
                    if (_selectedChip.value == DiscoverHubChip.VERIFIED || _filters.value.verifiedOnly) {
                        true
                    } else {
                        null
                    }
                val freeOrWantedParam =
                    if (_selectedChip.value == DiscoverHubChip.FREE_OR_WANTED) true else null

                val peopleAsync =
                    async {
                        repo.discovery(
                            filter = "people",
                            limit = perTypeLimit,
                            since = sinceParam,
                            verified = verifiedParam,
                            freeOrWanted = freeOrWantedParam,
                        )
                    }
                val businessesAsync =
                    async {
                        repo.discovery(
                            filter = "businesses",
                            limit = perTypeLimit,
                            since = sinceParam,
                            verified = verifiedParam,
                            freeOrWanted = freeOrWantedParam,
                        )
                    }
                val gigsAsync =
                    async {
                        repo.discovery(
                            filter = "gigs",
                            limit = perTypeLimit,
                            since = sinceParam,
                            verified = verifiedParam,
                            freeOrWanted = freeOrWantedParam,
                        )
                    }
                val listingsAsync =
                    async {
                        repo.discovery(
                            filter = "listings",
                            limit = perTypeLimit,
                            since = sinceParam,
                            verified = verifiedParam,
                            freeOrWanted = freeOrWantedParam,
                        )
                    }
                val peopleResult = peopleAsync.await()
                val businessesResult = businessesAsync.await()
                val gigsResult = gigsAsync.await()
                val listingsResult = listingsAsync.await()

                val allFailed =
                    peopleResult is NetworkResult.Failure &&
                        businessesResult is NetworkResult.Failure &&
                        gigsResult is NetworkResult.Failure &&
                        listingsResult is NetworkResult.Failure
                if (allFailed) {
                    _state.value = ListOfRowsUiState.Error("Couldn't load discovery. Try again.")
                    return@launch
                }
                people = (peopleResult as? NetworkResult.Success)?.data?.items ?: emptyList()
                businesses = (businessesResult as? NetworkResult.Success)?.data?.items ?: emptyList()
                gigs = (gigsResult as? NetworkResult.Success)?.data?.items ?: emptyList()
                listings = (listingsResult as? NetworkResult.Success)?.data?.items ?: emptyList()
                loadedOnce = true
                applyState()
            }
        }

        // MARK: - State projection

        /**
         * Build the section list. Hides empty sections per the design's
         * "section disappears if zero" rule; falls back to the
         * whole-screen empty state when all four are empty.
         */
        internal fun applyState() {
            val sections = mutableListOf<RowSection>()
            val peopleItems = recencySorted(people)
            val businessItems = recencySorted(businesses)
            val gigItems = recencySorted(gigs)
            val listingItems = recencySorted(listings)
            if (includes(DiscoverHubSection.PEOPLE) && peopleItems.isNotEmpty()) {
                sections.add(
                    RowSection(
                        id = DiscoverHubSection.PEOPLE,
                        header = "People",
                        rows = peopleItems.map { rowForPerson(it) },
                        count = peopleItems.size,
                        onSeeAll = { onSelect(DiscoverHubTarget.SeeAllPeople) },
                        style = SectionStyle.Card,
                    ),
                )
            }
            if (includes(DiscoverHubSection.BUSINESSES) && businessItems.isNotEmpty()) {
                sections.add(
                    RowSection(
                        id = DiscoverHubSection.BUSINESSES,
                        header = "Businesses",
                        rows = businessItems.map { rowForBusiness(it) },
                        count = businessItems.size,
                        onSeeAll = { onSelect(DiscoverHubTarget.SeeAllBusinesses) },
                        style = SectionStyle.Card,
                    ),
                )
            }
            if (includes(DiscoverHubSection.GIGS) && gigItems.isNotEmpty()) {
                sections.add(
                    RowSection(
                        id = DiscoverHubSection.GIGS,
                        header = "Gigs",
                        rows = gigItems.map { rowForGig(it) },
                        count = gigItems.size,
                        onSeeAll = { onSelect(DiscoverHubTarget.SeeAllGigs) },
                        style = SectionStyle.Card,
                    ),
                )
            }
            if (includes(DiscoverHubSection.LISTINGS) && listingItems.isNotEmpty()) {
                sections.add(
                    RowSection(
                        id = DiscoverHubSection.LISTINGS,
                        header = "Listings",
                        rows = listingItems.map { rowForListing(it) },
                        count = listingItems.size,
                        onSeeAll = { onSelect(DiscoverHubTarget.SeeAllListings) },
                        style = SectionStyle.Card,
                    ),
                )
            }
            if (sections.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Compass,
                        headline = "Nothing to discover yet",
                        subcopy =
                            "You're early to this block. People, businesses, gigs, and " +
                                "listings will appear here as neighbors verify and join. " +
                                "Check back soon.",
                    )
                return
            }
            _state.value = ListOfRowsUiState.Loaded(sections = sections, hasMore = false)
        }

        // MARK: - Row mapping (pure projections, internal for tests)

        internal fun rowForPerson(item: DiscoveryItem): RowModel {
            val displayName = item.title
            val userId = item.id
            val subtitle = item.subtitle ?: item.meta.takeIf { it.isNotEmpty() }
            return RowModel(
                id = "person-${item.id}",
                title = displayName,
                subtitle = subtitle,
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = displayName,
                        imageUrl = item.avatarUrl,
                        background = AvatarBackground.Gradient(DiscoverHubTone.toneFor(item.id).gradient),
                        size = AvatarBadgeSize.Small,
                        verified = item.verified == true,
                    ),
                trailing = RowTrailing.Chevron,
                onTap = { onSelect(DiscoverHubTarget.Person(userId = userId, displayName = displayName)) },
            )
        }

        internal fun rowForBusiness(item: DiscoveryItem): RowModel {
            val businessId = item.id
            val name = item.title
            val subtitle = item.subtitle ?: item.meta.takeIf { it.isNotEmpty() }
            return RowModel(
                id = "business-${item.id}",
                title = name,
                subtitle = subtitle,
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.CategoryGradientIcon(
                        icon = iconForBusinessCategory(item.category),
                        gradient = DiscoverHubTone.toneFor(item.id).gradient,
                    ),
                trailing = RowTrailing.Chevron,
                onTap = { onSelect(DiscoverHubTarget.Business(businessId = businessId, name = name)) },
            )
        }

        internal fun rowForGig(item: DiscoveryItem): RowModel {
            val gigId = item.id
            val subtitle = item.subtitle ?: item.meta.takeIf { it.isNotEmpty() }
            val trailing: RowTrailing =
                item.price?.let { RowTrailing.PriceStack(amount = it) } ?: RowTrailing.Chevron
            return RowModel(
                id = "gig-${item.id}",
                title = item.title,
                subtitle = subtitle,
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.CategoryGradientIcon(
                        icon = iconForGigCategory(item.category),
                        gradient = DiscoverHubTone.toneFor(item.id).gradient,
                    ),
                trailing = trailing,
                onTap = { onSelect(DiscoverHubTarget.Gig(gigId = gigId)) },
            )
        }

        internal fun rowForListing(item: DiscoveryItem): RowModel {
            val listingId = item.id
            val subtitle = item.subtitle ?: item.meta.takeIf { it.isNotEmpty() }
            val icon = iconForListingCategory(item.category)
            val gradient = DiscoverHubTone.toneFor(item.id).gradient
            val image: ThumbnailImage =
                item.avatarUrl?.takeIf { it.isNotEmpty() }?.let {
                    ThumbnailImage.Remote(url = it, fallback = icon, gradient = gradient)
                } ?: ThumbnailImage.IconOnGradient(icon = icon, gradient = gradient)
            val trailing: RowTrailing =
                item.price?.let { RowTrailing.PriceStack(amount = it) } ?: RowTrailing.Chevron
            return RowModel(
                id = "listing-${item.id}",
                title = item.title,
                subtitle = subtitle,
                template = RowTemplate.FileChevron,
                leading = RowLeading.Thumbnail(image = image, size = ThumbnailSize.Medium),
                trailing = trailing,
                onTap = { onSelect(DiscoverHubTarget.Listing(listingId = listingId)) },
            )
        }

        // MARK: - Chrome builders

        private fun makeChipStrip(selectedId: String): ChipStripConfig =
            ChipStripConfig(
                chips =
                    listOf(
                        ChipStripConfig.Chip(id = DiscoverHubChip.NEARBY, label = "Nearby", icon = PantopusIcon.MapPin),
                        ChipStripConfig.Chip(id = DiscoverHubChip.NEW_TODAY, label = "New today"),
                        ChipStripConfig.Chip(
                            id = DiscoverHubChip.VERIFIED,
                            label = "Verified",
                            icon = PantopusIcon.BadgeCheck,
                        ),
                        ChipStripConfig.Chip(id = DiscoverHubChip.FREE_OR_WANTED, label = "Free / wanted"),
                    ),
                selectedId = selectedId,
                onSelect = { selectChip(it) },
            )

        private fun makeTopBarAction(): TopBarAction {
            val count = _filters.value.activeCount
            return TopBarAction(
                icon = PantopusIcon.SlidersHorizontal,
                contentDescription =
                    if (count > 0) "Filter discovery, $count active" else "Filter discovery",
                badgeCount = if (count > 0) count else null,
                onClick = { presentFilters() },
            )
        }

        /** Whether a content type passes the active content-type filter. */
        private fun includes(type: String): Boolean {
            val types = _filters.value.contentTypes
            return types.isEmpty() || types.contains(type)
        }

        /** Sort items newest-first when the filter is on (by `createdAt`). */
        private fun recencySorted(items: List<DiscoveryItem>): List<DiscoveryItem> {
            if (!_filters.value.newestFirst) return items
            return items.sortedByDescending { it.createdAt ?: "" }
        }

        // MARK: - Helpers (pure)

        companion object {
            internal fun iconForBusinessCategory(category: String?): PantopusIcon {
                val key = (category ?: "").lowercase()
                return when {
                    key.contains("handy") || key.contains("repair") || key.contains("contract") ->
                        PantopusIcon.Hammer
                    key.contains("pet") -> PantopusIcon.PawPrint
                    key.contains("clean") -> PantopusIcon.Sparkles
                    key.contains("home") -> PantopusIcon.Home
                    else -> PantopusIcon.Briefcase
                }
            }

            internal fun iconForGigCategory(category: String?): PantopusIcon {
                val key = (category ?: "").lowercase()
                return when {
                    key.contains("clean") -> PantopusIcon.Sparkles
                    key.contains("handy") || key.contains("assemble") || key.contains("repair") ->
                        PantopusIcon.Hammer
                    key.contains("pet") -> PantopusIcon.PawPrint
                    key.contains("delivery") || key.contains("pickup") -> PantopusIcon.Package
                    else -> PantopusIcon.Briefcase
                }
            }

            internal fun iconForListingCategory(category: String?): PantopusIcon {
                val key = (category ?: "").lowercase()
                return when {
                    key.contains("furniture") || key.contains("home") -> PantopusIcon.Home
                    else -> PantopusIcon.Package
                }
            }
        }
    }
