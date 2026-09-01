@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.marketplace

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.data.api.models.listings.ListingsNearbyResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
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
 * Backs the Marketplace tab (T2.5). Fetches `/api/listings/nearby` with
 * the active layer + free filter and projects each row into a
 * `MarketplaceCardContent`.
 *
 * Reliability contract mirrors iOS `MarketplaceViewModel`:
 * - every fetch carries a generation token; stale responses are
 *   discarded instead of clobbering a newer chip tap / search,
 * - chip tap, search submit, and radius widen flip to the loading
 *   skeleton; pull-to-refresh and refresh-on-return keep the grid,
 * - offset pagination dedups by id and trusts `pagination.hasMore`.
 */
@HiltViewModel
class MarketplaceViewModel
    @Inject
    constructor(
        private val repo: ListingsRepository,
        private val location: LocationProvider,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MarketplaceUiState>(MarketplaceUiState.Loading)
        val state: StateFlow<MarketplaceUiState> = _state.asStateFlow()

        private val _activeCategory = MutableStateFlow(MarketplaceCategory.All)
        val activeCategory: StateFlow<MarketplaceCategory> = _activeCategory.asStateFlow()

        private val _searchText = MutableStateFlow("")
        val searchText: StateFlow<String> = _searchText.asStateFlow()

        /** True while a pagination fetch is in flight — two tail skeletons. */
        private val _isLoadingMore = MutableStateFlow(false)
        val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

        /** True while a pull-to-refresh fetch is in flight — grid stays live. */
        private val _isRefreshing = MutableStateFlow(false)
        val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

        /** False only before the first fetch completes — drives the
         *  A08 cold-load chrome skeleton (search bar + chip row). */
        var hasLoadedOnce = false
            private set

        private var radiusMiles: Double = 2.0
        private var loadedItems: List<ListingDto> = emptyList()
        private var hasMore = false

        /** Monotonic fetch token. A response only applies when its
         *  generation is still current — a boolean `loading` guard
         *  dropped refetches and let stale responses land. */
        private var fetchGeneration = 0

        /** Empty-state pill steps: 2 → 5 → 10 → 25 mi. */
        val canWidenRadius: Boolean
            get() = RADIUS_STEPS.any { it > radiusMiles }

        fun configureRadius(miles: Double) {
            radiusMiles = miles
        }

        /**
         * First composition fetches cold; later compositions (popping
         * back from the wizard or a listing detail) re-fetch so a
         * just-posted listing appears, keeping the grid while in flight.
         */
        fun load() = fetch()

        /** Pull-to-refresh / error retry — keeps the current frame live. */
        fun refresh() {
            _isRefreshing.value = true
            fetch()
        }

        fun selectCategory(category: MarketplaceCategory) {
            if (_activeCategory.value == category) return
            _activeCategory.value = category
            _state.value = MarketplaceUiState.Loading
            fetch()
        }

        fun setSearchText(value: String) {
            _searchText.value = value
        }

        fun submitSearch() {
            _state.value = MarketplaceUiState.Loading
            fetch()
        }

        /** Empty-state pill tap — widen to the next radius step and refetch. */
        fun widenRadius() {
            val next = RADIUS_STEPS.firstOrNull { it > radiusMiles } ?: return
            radiusMiles = next
            _state.value = MarketplaceUiState.Loading
            fetch()
        }

        /** Near-tail trigger — fires when one of the last four cards composes. */
        fun loadMoreIfNeeded(currentId: String) {
            if (!hasMore || _isLoadingMore.value) return
            if (_state.value !is MarketplaceUiState.Loaded) return
            if (loadedItems.takeLast(LOAD_MORE_LOOKAHEAD).none { it.id == currentId }) return
            fetchNextPage()
        }

        private fun fetch() {
            fetchGeneration += 1
            val generation = fetchGeneration
            _isLoadingMore.value = false
            viewModelScope.launch {
                val result = nearbyPage(offset = 0)
                if (generation != fetchGeneration) return@launch
                _isRefreshing.value = false
                hasLoadedOnce = true
                when (result) {
                    is NetworkResult.Success -> {
                        loadedItems = result.data.listings
                        hasMore = result.data.pagination?.hasMore ?: false
                        _state.value =
                            if (loadedItems.isEmpty()) {
                                MarketplaceUiState.Empty(radiusMiles = radiusMiles)
                            } else {
                                MarketplaceUiState.Loaded(rows = loadedItems.map(::projectCard))
                            }
                    }
                    is NetworkResult.Failure -> {
                        _state.value = MarketplaceUiState.Error(result.error.displayMessage("Couldn't load Marketplace."))
                    }
                }
            }
        }

        private fun fetchNextPage() {
            fetchGeneration += 1
            val generation = fetchGeneration
            _isLoadingMore.value = true
            viewModelScope.launch {
                val result = nearbyPage(offset = loadedItems.size)
                if (generation != fetchGeneration) return@launch
                _isLoadingMore.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        val knownIds = loadedItems.map { it.id }.toSet()
                        val fresh = result.data.listings.filter { it.id !in knownIds }
                        loadedItems = loadedItems + fresh
                        hasMore =
                            (result.data.pagination?.hasMore ?: false) &&
                            result.data.listings.isNotEmpty()
                        _state.value = MarketplaceUiState.Loaded(rows = loadedItems.map(::projectCard))
                    }
                    is NetworkResult.Failure -> {
                        // Keep the loaded grid; the near-tail trigger retries
                        // on the next scroll.
                    }
                }
            }
        }

        private suspend fun nearbyPage(offset: Int): NetworkResult<ListingsNearbyResponse> {
            val coord = location.cachedCoordinate() ?: location.requestCurrent()
            val center = coord ?: UserCoordinate(40.7484, -73.9857, 100.0)
            val category = _activeCategory.value
            return repo.nearby(
                latitude = center.latitude,
                longitude = center.longitude,
                radiusMiles = radiusMiles,
                layer = category.layerParam,
                isFree = if (category == MarketplaceCategory.Free) true else null,
                search = _searchText.value.takeIf { it.isNotEmpty() },
                sort = "newest",
                limit = PAGE_SIZE,
                offset = offset,
            )
        }

        private fun projectCard(row: ListingDto): MarketplaceCardContent {
            val imageUrl = row.firstImage ?: row.mediaUrls?.firstOrNull()
            val gradient = ListingGradient.from(row.id)
            val icon = placeholderIcon(category = row.category, layer = row.layer)
            val isFree = row.isFree ?: false
            val price = priceLabel(row.price, isFree, row.layer, row.listingType)
            val distance = distanceLabel(row.distanceMeters)
            val age = ageLabel(row.createdAt)
            val meta = listOfNotNull(distance, age).joinToString(" · ")
            val badge = conditionBadge(row.condition, row.layer, isFree)
            return MarketplaceCardContent(
                id = row.id,
                title = row.title ?: "Listing",
                imageUrl = imageUrl,
                placeholderGradient = gradient,
                placeholderIcon = icon,
                price = price,
                isFree = isFree,
                metaLine = meta,
                conditionBadge = badge,
            )
        }

        private fun priceLabel(
            price: Double?,
            isFree: Boolean,
            layer: String?,
            listingType: String?,
        ): String {
            if (isFree) return "Free"
            if (price == null) return "—"
            val base =
                if (price % 1.0 == 0.0) {
                    "$${price.toInt()}"
                } else {
                    String.format("$%.2f", price)
                }
            val isRental = layer == "rentals" || listingType == "rent_sublet" || listingType == "vehicle_rent"
            return if (isRental) "$base / wk" else base
        }

        private fun distanceLabel(meters: Double?): String? {
            if (meters == null) return null
            val miles = meters / 1609.344
            return when {
                miles < 0.1 -> "< 0.1mi"
                miles < 10 -> String.format("%.1fmi", miles)
                else -> "${miles.toInt()}mi"
            }
        }

        private fun ageLabel(iso: String?): String? {
            if (iso.isNullOrEmpty()) return null
            return runCatching {
                val instant = Instant.parse(iso)
                val seconds = Duration.between(instant, Instant.now()).seconds
                when {
                    seconds < 60 -> "now"
                    seconds < 3_600 -> "${seconds / 60}m"
                    seconds < 86_400 -> "${seconds / 3_600}h"
                    seconds < 604_800 -> "${seconds / 86_400}d"
                    else -> "${seconds / 604_800}w"
                }
            }.getOrNull()
        }

        private fun conditionBadge(
            condition: String?,
            layer: String?,
            isFree: Boolean,
        ): String? {
            if (layer == "rentals" || isFree) return null
            if (condition.isNullOrEmpty()) return null
            return when (condition) {
                "new" -> "New"
                "like_new" -> "Like new"
                "good" -> "Good"
                "fair" -> "Fair"
                "for_parts" -> "For parts"
                else -> condition.replace("_", " ").replaceFirstChar { it.uppercase() }
            }
        }

        companion object {
            /** Empty-state widening ladder, in miles. Mirrors iOS `radiusSteps`. */
            private val RADIUS_STEPS = listOf(2.0, 5.0, 10.0, 25.0)

            /** `/api/listings/nearby` page size. */
            private const val PAGE_SIZE = 30

            /** How close to the tail a card must be to trigger load-more. */
            private const val LOAD_MORE_LOOKAHEAD = 4
        }

        private fun placeholderIcon(
            category: String?,
            layer: String?,
        ): PantopusIcon {
            if (layer == "vehicles") return PantopusIcon.Send
            if (layer == "rentals") return PantopusIcon.Calendar
            return when (category) {
                "furniture" -> PantopusIcon.Home
                "electronics" -> PantopusIcon.Lightbulb
                "clothing" -> PantopusIcon.ShoppingBag
                "kids_baby" -> PantopusIcon.Heart
                "tools" -> PantopusIcon.Hammer
                "home_garden" -> PantopusIcon.Sun
                "sports_outdoors" -> PantopusIcon.Star
                "vehicles" -> PantopusIcon.Send
                "books_media" -> PantopusIcon.File
                "appliances" -> PantopusIcon.Lightbulb
                "food_baked_goods" -> PantopusIcon.Heart
                "plants_garden" -> PantopusIcon.Sun
                "pet_supplies" -> PantopusIcon.Heart
                "arts_crafts" -> PantopusIcon.Pencil
                "tickets_events" -> PantopusIcon.Calendar
                "free_stuff" -> PantopusIcon.ShoppingBag
                else -> PantopusIcon.ShoppingBag
            }
        }
    }
