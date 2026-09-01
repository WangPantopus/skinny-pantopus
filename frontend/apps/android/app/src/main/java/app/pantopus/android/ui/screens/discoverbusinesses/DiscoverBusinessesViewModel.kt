@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.discoverbusinesses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businessdiscovery.BusinessDiscoveryItem
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businessdiscovery.BusinessDiscoveryRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ChipStripConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SearchBarConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Stable chip ids — id doubles as the backend `categories` filter value. */
object DiscoverBusinessesChip {
    const val ALL = "all"
    const val HANDYMAN = "handyman"
    const val CLEANING = "cleaning"
    const val PET_CARE = "pet-care"
    const val PLUMBING = "plumbing"
    const val TUTORING = "tutoring"
    const val CHILDCARE = "childcare"
    const val MOVING = "moving"
    const val LAWN_CARE = "lawn-care"

    /** Canonical chip order; "All" first. Mirrors iOS. */
    val ORDER: List<String> =
        listOf(
            ALL,
            HANDYMAN,
            CLEANING,
            PET_CARE,
            PLUMBING,
            TUTORING,
            CHILDCARE,
            MOVING,
            LAWN_CARE,
        )
}

object DiscoverBusinessesSection {
    /** Catch-all bucket for categories the chip strip doesn't surface. */
    const val OTHER = "other"
}

/** Outbound routing target emitted by row taps + top-bar action + empty-state CTA. */
sealed interface DiscoverBusinessesTarget {
    data class Business(val businessId: String, val name: String) : DiscoverBusinessesTarget

    /** No-location empty state — host pushes the Add Home wizard. Radius
     * widening for the no-results state stays in the top-bar filter sheet. */
    data object SetHomeAddress : DiscoverBusinessesTarget

    data object InviteBusiness : DiscoverBusinessesTarget
}

/**
 * Per-category visual spec. Pure data so tests can assert against the
 * id directly without unwrapping the `CategoryGradientIcon` payload.
 */
data class DiscoverBusinessesCategorySpec(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val gradient: GradientPair,
)

/**
 * T5.4.2 — Discover businesses. Drives a businesses-only browse list
 * on the shared `ListOfRows` archetype.
 *
 * Mirrors iOS `DiscoverBusinessesViewModel` exactly:
 *  - Top-bar trailing `sliders-horizontal` icon (filter).
 *  - Search bar above the chip strip.
 *  - Horizontal chip strip with category filters. Selecting a non-"All"
 *    chip collapses the list to a single section + passes
 *    `categories=<chip-id>` to the search endpoint.
 *  - When "All" is selected, results group into multiple `RowSection`s
 *    by primary category in chip-strip order (unrecognised categories
 *    fall into the "Other" bucket at the end).
 *  - Each row: 40dp category-tinted gradient icon leading + name title
 *    + meta subtitle (description · open-now · distance) + chevron.
 *  - No FAB (matches the visual frame).
 *
 * Backend: `GET /api/businesses/search` —
 * `backend/routes/businessDiscovery.js:436`.
 */
@HiltViewModel
class DiscoverBusinessesViewModel
    @Inject
    constructor(
        private val repo: BusinessDiscoveryRepository,
    ) : ViewModel() {
        private val pageSize: Int = 50

        private var results: List<BusinessDiscoveryItem> = emptyList()
        private var loadedOnce: Boolean = false
        private var searchDebounceJob: Job? = null

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedChip = MutableStateFlow(DiscoverBusinessesChip.ALL)
        val selectedChip: StateFlow<String> = _selectedChip.asStateFlow()

        private val _searchText = MutableStateFlow("")
        val searchText: StateFlow<String> = _searchText.asStateFlow()

        /** Persisted filter-sheet selection. Default = no filters. */
        private val _filters = MutableStateFlow(DiscoverBusinessFilters.Default)
        val filters: StateFlow<DiscoverBusinessFilters> = _filters.asStateFlow()

        /** Whether the filter sheet is shown. */
        private val _showFilterSheet = MutableStateFlow(false)
        val showFilterSheet: StateFlow<Boolean> = _showFilterSheet.asStateFlow()

        private val _chipStrip = MutableStateFlow(makeChipStrip(DiscoverBusinessesChip.ALL))
        val chipStrip: StateFlow<ChipStripConfig> = _chipStrip.asStateFlow()

        private val _searchBar = MutableStateFlow(makeSearchBar(""))
        val searchBar: StateFlow<SearchBarConfig> = _searchBar.asStateFlow()

        private val _topBarAction = MutableStateFlow<TopBarAction?>(makeTopBarAction())
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        /**
         * Routing callback. Set by the screen before [load]. Defaults to a
         * no-op so the VM is safe to construct in isolation.
         */
        var onSelect: (DiscoverBusinessesTarget) -> Unit = {}
            set(value) {
                field = value
                _topBarAction.value = makeTopBarAction()
                applyState()
            }

        fun load() {
            if (loadedOnce) return
            reload()
        }

        fun refresh() = reload()

        fun selectChip(id: String) {
            if (_selectedChip.value == id) return
            _selectedChip.value = id
            _chipStrip.value = makeChipStrip(id)
            reload()
        }

        fun setSearchText(next: String) {
            _searchText.value = next
            _searchBar.value = makeSearchBar(next)
            searchDebounceJob?.cancel()
            searchDebounceJob =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    reload()
                }
        }

        fun submitSearch() {
            searchDebounceJob?.cancel()
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
         * Apply a new filter selection and re-fetch. Category / distance /
         * open-now / rating all map to `GET /api/businesses/search` params.
         */
        fun applyFilters(newFilters: DiscoverBusinessFilters) {
            _filters.value = newFilters
            _topBarAction.value = makeTopBarAction()
            reload()
        }

        /**
         * Union of the chip-strip category (when not "All") and the
         * filter sheet's coarse category multi-select. Sent as
         * `categories=` (backend matches via array overlap). `null` when
         * empty; sorted for a stable request shape.
         */
        private fun combinedCategories(): List<String>? {
            val set = _filters.value.categories.toMutableSet()
            if (_selectedChip.value != DiscoverBusinessesChip.ALL) {
                set.add(_selectedChip.value)
            }
            return set.takeIf { it.isNotEmpty() }?.sorted()
        }

        private fun reload() {
            if (!loadedOnce) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val q = _searchText.value.takeIf { it.isNotEmpty() }
                val filters = _filters.value
                val radiusParam =
                    filters.radiusMiles.takeIf { it != DiscoverBusinessFilters.DEFAULT_RADIUS_MILES }
                val result =
                    repo.search(
                        q = q,
                        categories = combinedCategories(),
                        pageSize = pageSize,
                        radiusMiles = radiusParam,
                        openNow = if (filters.openNow) true else null,
                        ratingMin = filters.ratingFloor,
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        results = result.data.results
                        loadedOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        val err = result.error
                        if (err is NetworkError.ClientError && err.code == 400) {
                            // "Location required" — viewer has no resolved
                            // home and didn't pass explicit lat/lon.
                            loadedOnce = true
                            _state.value = noLocationEmpty()
                        } else {
                            _state.value =
                                ListOfRowsUiState.Error("Couldn't load businesses. Try again.")
                        }
                    }
                }
            }
        }

        internal fun applyState() {
            if (results.isEmpty()) {
                _state.value = noResultsEmpty()
                return
            }

            if (_selectedChip.value != DiscoverBusinessesChip.ALL) {
                val spec = categorySpec(_selectedChip.value)
                val rows = results.map { rowForBusiness(it, categoryOverride = _selectedChip.value) }
                _state.value =
                    ListOfRowsUiState.Loaded(
                        sections =
                            listOf(
                                RowSection(
                                    id = _selectedChip.value,
                                    header = spec.label,
                                    rows = rows,
                                    count = rows.size,
                                    style = SectionStyle.Card,
                                ),
                            ),
                        hasMore = false,
                    )
                return
            }

            // "All" — group by primary category in chip order.
            val grouped = LinkedHashMap<String, MutableList<BusinessDiscoveryItem>>()
            for (item in results) {
                val key = primaryCategoryKey(item.categories)
                grouped.getOrPut(key) { mutableListOf() }.add(item)
            }
            val chipOrder = DiscoverBusinessesChip.ORDER
            val sortedKeys =
                grouped.keys.sortedBy { key ->
                    val idx = chipOrder.indexOf(key)
                    if (idx == -1) Int.MAX_VALUE else idx
                }
            val sections =
                sortedKeys.mapNotNull { key ->
                    val items = grouped[key] ?: return@mapNotNull null
                    val spec = categorySpec(key)
                    val rows = items.map { rowForBusiness(it, categoryOverride = key) }
                    RowSection(
                        id = key,
                        header = spec.label,
                        rows = rows,
                        count = rows.size,
                        style = SectionStyle.Card,
                    )
                }
            _state.value = ListOfRowsUiState.Loaded(sections = sections, hasMore = false)
        }

        private fun noResultsEmpty(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.Compass,
                headline = "No verified businesses nearby yet",
                subcopy =
                    "Widen your search radius, or invite a business you trust on " +
                        "the block. They'll show up here once they verify their address.",
                ctaTitle = "Invite a business",
                onCta = { onSelect(DiscoverBusinessesTarget.InviteBusiness) },
            )

        private fun noLocationEmpty(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.MapPin,
                headline = "Set a home address",
                subcopy =
                    "We need a verified home address to surface businesses near " +
                        "you. Add one in your profile and they'll appear here.",
                ctaTitle = "Set a home address",
                onCta = { onSelect(DiscoverBusinessesTarget.SetHomeAddress) },
            )

        // MARK: - Row mapping (pure projection)

        internal fun rowForBusiness(
            item: BusinessDiscoveryItem,
            categoryOverride: String? = null,
        ): RowModel {
            val key = categoryOverride ?: primaryCategoryKey(item.categories)
            val spec = categorySpec(key)
            val businessId = item.businessUserId
            val name = item.name
            return RowModel(
                id = "business-$businessId",
                title = name,
                subtitle = subtitleFor(item),
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.CategoryGradientIcon(
                        icon = spec.icon,
                        gradient = spec.gradient,
                    ),
                trailing = RowTrailing.Chevron,
                onTap = {
                    onSelect(
                        DiscoverBusinessesTarget.Business(businessId = businessId, name = name),
                    )
                },
            )
        }

        // MARK: - Chrome builders

        private fun makeChipStrip(selectedId: String): ChipStripConfig =
            ChipStripConfig(
                chips =
                    DiscoverBusinessesChip.ORDER.map { id ->
                        ChipStripConfig.Chip(id = id, label = categorySpec(id).label)
                    },
                selectedId = selectedId,
                onSelect = { selectChip(it) },
            )

        private fun makeSearchBar(value: String): SearchBarConfig =
            SearchBarConfig(
                placeholder = "Search businesses or services",
                text = value,
                onChange = { setSearchText(it) },
                onSubmit = { submitSearch() },
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

        // MARK: - Helpers (pure)

        companion object {
            private const val SEARCH_DEBOUNCE_MS: Long = 300

            /**
             * Pick the row's primary category key. Returns the first
             * category from the backend `categories[]` that maps to a
             * known chip id; falls back to [DiscoverBusinessesSection.OTHER].
             */
            internal fun primaryCategoryKey(categories: List<String>): String {
                val known = DiscoverBusinessesChip.ORDER.toSet()
                for (raw in categories) {
                    val normalized = normalize(raw)
                    if (known.contains(normalized)) return normalized
                }
                return DiscoverBusinessesSection.OTHER
            }

            internal fun normalize(raw: String): String =
                raw
                    .trim()
                    .lowercase()
                    .replace('_', '-')
                    .replace(' ', '-')

            /** Build the row's subtitle from the available DTO fields. */
            internal fun subtitleFor(item: BusinessDiscoveryItem): String? {
                val parts = mutableListOf<String>()
                item.description?.trim()?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
                if (item.isOpenNow == true) parts.add("Open now")
                val distance = item.distanceMiles
                if (distance > 0.0) parts.add(formatDistance(distance))
                return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
            }

            internal fun formatDistance(miles: Double): String {
                if (miles < 0.1) return "Nearby"
                val rounded = (miles * 10).toInt() / 10.0
                return "$rounded mi"
            }

            /** Per-category visual spec — token-only colours. */
            internal fun categorySpec(id: String): DiscoverBusinessesCategorySpec =
                when (id) {
                    DiscoverBusinessesChip.ALL ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "All",
                            icon = PantopusIcon.Briefcase,
                            gradient = GradientPair(PantopusColors.primary500, PantopusColors.primary700),
                        )
                    DiscoverBusinessesChip.HANDYMAN ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Handyman",
                            icon = PantopusIcon.Hammer,
                            gradient = GradientPair(PantopusColors.warning, PantopusColors.handyman),
                        )
                    DiscoverBusinessesChip.CLEANING ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Cleaning",
                            icon = PantopusIcon.Sparkles,
                            gradient = GradientPair(PantopusColors.success, PantopusColors.cleaning),
                        )
                    DiscoverBusinessesChip.PET_CARE ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Pet Care",
                            icon = PantopusIcon.PawPrint,
                            gradient = GradientPair(PantopusColors.error, PantopusColors.petCare),
                        )
                    DiscoverBusinessesChip.PLUMBING ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Plumbing",
                            icon = PantopusIcon.Hammer,
                            gradient = GradientPair(PantopusColors.primary500, PantopusColors.tech),
                        )
                    DiscoverBusinessesChip.TUTORING ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Tutoring",
                            icon = PantopusIcon.Lightbulb,
                            gradient = GradientPair(PantopusColors.info, PantopusColors.tutoring),
                        )
                    DiscoverBusinessesChip.CHILDCARE ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Childcare",
                            icon = PantopusIcon.Heart,
                            gradient = GradientPair(PantopusColors.warning, PantopusColors.childCare),
                        )
                    DiscoverBusinessesChip.MOVING ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Moving",
                            icon = PantopusIcon.Package,
                            gradient = GradientPair(PantopusColors.business, PantopusColors.moving),
                        )
                    DiscoverBusinessesChip.LAWN_CARE ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Lawn Care",
                            icon = PantopusIcon.Sparkles,
                            gradient = GradientPair(PantopusColors.success, PantopusColors.home),
                        )
                    else ->
                        DiscoverBusinessesCategorySpec(
                            id = id,
                            label = "Other",
                            icon = PantopusIcon.Briefcase,
                            gradient =
                                GradientPair(
                                    PantopusColors.appTextSecondary,
                                    PantopusColors.appTextStrong,
                                ),
                        )
                }
        }
    }
