@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.gigs.tasks_map

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.screens.gigs.GigFilterCriteria
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.gigs.GigsSort
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapAnchor
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapClusterPin
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridCameraRequest
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridRegion
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPin
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPinState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * A11.1 Tasks map view-model. `load()` hits `GET /api/gigs/in-bounds`
 * (`GigsRepository.inBounds`) for a ~1.3 km viewport around the anchor
 * and projects the gigs into pin↔card [TaskMapItem]s. The live category
 * filter + sheet-header sort run client-side on the fetched set. Owns
 * the pin↔card selection link, the "Search this area" visibility state
 * machine, the empty-state widen → jump-to-activity ladder, and the
 * camera requests (clusters / focus / pan) — all maps-SDK-free via
 * [MapListHybridRegion] so it stays unit-testable.
 *
 * Mirrors iOS `TasksMapViewModel`.
 */
@HiltViewModel
class TasksMapViewModel
    @Inject
    constructor(
        private val repo: GigsRepository,
        private val location: LocationProvider,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val _anchor =
            MutableStateFlow<MapAnchor?>(
                location.cachedCoordinate()?.toMapAnchor(),
            )

        /** "You are here" anchor handed to the shell. */
        val anchor: StateFlow<MapAnchor?> = _anchor.asStateFlow()

        /** The task set currently driving the map — fetched from in-bounds. */
        private var items: List<TaskMapItem> = emptyList()

        private val _state = MutableStateFlow<TasksMapUiState>(TasksMapUiState.Loading)
        val state: StateFlow<TasksMapUiState> = _state.asStateFlow()

        // Match by exact category key, defaulting to All for a missing /
        // unknown arg — mirrors iOS `GigsCategory(rawValue:) ?? .all`.
        private val _activeCategory =
            MutableStateFlow(
                GigsCategory.entries.firstOrNull { it.key == savedStateHandle.get<String>(CATEGORY_KEY) }
                    ?: GigsCategory.All,
            )
        val activeCategory: StateFlow<GigsCategory> = _activeCategory.asStateFlow()

        private val _activeSort = MutableStateFlow(GigsSort.Closest)
        val activeSort: StateFlow<GigsSort> = _activeSort.asStateFlow()

        private val _selectedId = MutableStateFlow<String?>(null)
        val selectedId: StateFlow<String?> = _selectedId.asStateFlow()

        /** "Search this area" pill visibility — set when the camera settles
         * significantly away from the last-fetched region. */
        private val _showsSearchThisArea = MutableStateFlow(false)
        val showsSearchThisArea: StateFlow<Boolean> = _showsSearchThisArea.asStateFlow()

        /** Outgoing camera move — the shell applies it whenever the token
         * changes (cluster zoom, rail pan, widen, jump, focus-on-pins). */
        private val _cameraTarget = MutableStateFlow<MapListHybridCameraRequest?>(null)
        val cameraTarget: StateFlow<MapListHybridCameraRequest?> = _cameraTarget.asStateFlow()

        /** Individually rendered pins + cluster markers after the
         * clustering pass at the current zoom. */
        private val _mapPins = MutableStateFlow<List<MapPin>>(emptyList())
        val mapPins: StateFlow<List<MapPin>> = _mapPins.asStateFlow()

        private val _mapClusters = MutableStateFlow<List<MapClusterPin>>(emptyList())
        val mapClusters: StateFlow<List<MapClusterPin>> = _mapClusters.asStateFlow()

        /** Which secondary CTA the empty sheet offers (widen vs jump). */
        private val _emptyAction = MutableStateFlow<TasksMapEmptyAction>(TasksMapEmptyAction.Widen)
        val emptyAction: StateFlow<TasksMapEmptyAction> = _emptyAction.asStateFlow()

        /** Last settled camera viewport (shell → [cameraSettled]). */
        var visibleRegion: MapListHybridRegion? = null
            private set

        /** How many times the empty-state "Widen search" ran since the
         * last populated fetch — drives the jump-to-activity ladder. */
        var widenAttempts: Int = 0
            private set

        /** Backend recenter hint, only populated when a fetch came back
         * with zero gigs in the viewport (gigs.js `nearest_activity_center`). */
        var nearestActivityCenter: MapAnchor? = null
            private set

        /** Region the current `items` were fetched for — the "Search this
         * area" comparison baseline. */
        private var lastFetchedRegion: MapListHybridRegion? = null

        /** Set after every (re)fetch: the next camera settle adopts the
         * camera's actual region as the baseline instead of comparing —
         * the fetch box and the camera's fitted region differ by device
         * aspect. */
        private var awaitingBaselineSync = false
        private var cameraToken = 0

        fun load() {
            viewModelScope.launch {
                _state.value = TasksMapUiState.Loading
                resolveLocation(refresh = false)
                fetchInBounds(defaultRegion(_anchor.value ?: FALLBACK_ANCHOR))
            }
        }

        fun refresh() = load()

        /** Re-resolve GPS and re-fetch the viewport around the updated anchor. */
        fun locate() {
            viewModelScope.launch {
                resolveLocation(refresh = true)
                fetchInBounds(defaultRegion(_anchor.value ?: FALLBACK_ANCHOR))
            }
        }

        fun selectCategory(category: GigsCategory) {
            if (category == _activeCategory.value) return
            _activeCategory.value = category
            recompute()
        }

        fun selectSort(sort: GigsSort) {
            if (sort == _activeSort.value) return
            _activeSort.value = sort
            recompute()
        }

        /** P2 follow-up — structured criteria from the layers sheet, applied
         * client-side to the fetched pins. The filters badge rides
         * `criteria.activeCount`. */
        private val _filterCriteria = MutableStateFlow(GigFilterCriteria())
        val filterCriteria: StateFlow<GigFilterCriteria> = _filterCriteria.asStateFlow()

        fun applyFilters(criteria: GigFilterCriteria) {
            if (criteria == _filterCriteria.value) return
            _filterCriteria.value = criteria
            recompute()
        }

        /** Pin↔card link — the shell fires this on pin tap; the screen also
         * snaps the sheet to Standard so the matching card surfaces. No
         * camera move (the pin is already on screen). */
        fun select(id: String) {
            _selectedId.value = id
        }

        // ── Pin↔card sync ─────────────────────────────────────────────

        /** Tasks currently on the map / in the sheet (populated only). */
        val visibleItems: List<TaskMapItem>
            get() = (_state.value as? TasksMapUiState.Populated)?.items.orEmpty()

        /** Rail-page index of the selection — drives the pagination dots
         * and the rail's scroll-to-card sync. */
        val selectedIndex: Int?
            get() =
                visibleItems
                    .indexOfFirst { it.id == _selectedId.value }
                    .takeIf { it >= 0 }

        /** Rail page change → select that pin + pan the camera to it
         * (span preserved). Counterpart of [select] for the card → pin
         * direction of the sync. */
        fun selectIndex(index: Int) {
            val item = visibleItems.getOrNull(index) ?: return
            if (item.id == _selectedId.value) return
            _selectedId.value = item.id
            requestCamera(currentRegion().recentered(item.latitude, item.longitude))
        }

        // ── Clustering ────────────────────────────────────────────────

        /** Cluster tap → zoom one step (halve the span) centered on it. */
        fun tapCluster(id: String) {
            val cluster = _mapClusters.value.firstOrNull { it.id == id } ?: return
            val zoomed =
                currentRegion()
                    .recentered(cluster.latitude, cluster.longitude)
                    .scaled(0.5)
            visibleRegion = zoomed
            requestCamera(zoomed)
            recluster()
        }

        /** Fit the camera to every loaded pin with padding (the maximize
         * map control). */
        fun focusOnPins() {
            val region = TasksMapGeometry.fittingRegion(visibleItems.map { it.toPin() }) ?: return
            requestCamera(region)
        }

        private fun recluster() {
            val span =
                (visibleRegion ?: lastFetchedRegion)?.longitudeSpan
                    ?: DEFAULT_LON_SPAN
            val result = TasksMapGeometry.buildClusteredPins(visibleItems.map { it.toPin() }, span)
            _mapPins.value = result.singles
            _mapClusters.value = result.clusters
        }

        // ── Search this area ──────────────────────────────────────────

        /** Camera settle hook — the shell forwards the idle camera region
         * (Google Maps' isMoving=false stands in for the design's ~350 ms
         * debounce). */
        fun cameraSettled(region: MapListHybridRegion) {
            visibleRegion = region
            recluster()
            if (awaitingBaselineSync) {
                lastFetchedRegion = region
                awaitingBaselineSync = false
                _showsSearchThisArea.value = false
                return
            }
            val baseline = lastFetchedRegion
            if (baseline == null) {
                lastFetchedRegion = region
                return
            }
            _showsSearchThisArea.value = TasksMapGeometry.regionChangedSignificantly(baseline, region)
        }

        /** "Search this area" tap — refetch in-bounds for the settled
         * viewport and hide the pill. Keeps the current content on screen
         * while the refetch is in flight (no skeleton flash on the map). */
        fun searchThisArea() {
            val region = visibleRegion ?: return
            _showsSearchThisArea.value = false
            viewModelScope.launch { fetchInBounds(region) }
        }

        // ── Empty-state ladder ────────────────────────────────────────

        /** "Widen search" — zoom the camera out (span ×2.5) and refetch
         * the widened viewport. Attempts accumulate until a fetch comes
         * back populated. */
        fun widenSearch() {
            widenAttempts += 1
            val widened = currentRegion().scaled(2.5)
            visibleRegion = widened
            requestCamera(widened)
            viewModelScope.launch { fetchInBounds(widened) }
        }

        /** "Jump to activity" — animate the camera to the backend's
         * nearest activity center and refetch around it. */
        fun jumpToActivity() {
            val center = nearestActivityCenter ?: return
            val region = defaultRegion(MapAnchor(center.latitude, center.longitude))
            visibleRegion = region
            requestCamera(region)
            viewModelScope.launch { fetchInBounds(region) }
        }

        // ── Location / camera ─────────────────────────────────────────

        private suspend fun resolveLocation(refresh: Boolean) {
            val coordinate =
                when {
                    refresh -> location.requestCurrent()
                    _anchor.value != null -> location.cachedCoordinate() ?: location.requestCurrent()
                    else -> location.requestCurrent()
                }
            coordinate?.let { _anchor.value = it.toMapAnchor() }
        }

        private fun defaultRegion(center: MapAnchor): MapListHybridRegion =
            MapListHybridRegion(
                centerLatitude = center.latitude,
                centerLongitude = center.longitude,
                latitudeSpan = DEFAULT_LAT_SPAN,
                longitudeSpan = DEFAULT_LON_SPAN,
            )

        private fun currentRegion(): MapListHybridRegion =
            visibleRegion
                ?: lastFetchedRegion
                ?: defaultRegion(_anchor.value ?: FALLBACK_ANCHOR)

        private fun requestCamera(region: MapListHybridRegion) {
            cameraToken += 1
            _cameraTarget.value = MapListHybridCameraRequest(token = cameraToken, region = region)
        }

        // ── Fetch ─────────────────────────────────────────────────────

        /**
         * Hit `GET /api/gigs/in-bounds` for *all* categories in the given
         * viewport. The category chips are an instant client-side filter
         * ([recompute]), so an initial category scope can widen back to
         * "All" without a re-fetch.
         */
        private suspend fun fetchInBounds(region: MapListHybridRegion) {
            val result =
                repo.inBounds(
                    minLat = region.minLatitude,
                    minLon = region.minLongitude,
                    maxLat = region.maxLatitude,
                    maxLon = region.maxLongitude,
                )
            when (result) {
                is NetworkResult.Success -> {
                    val center =
                        _anchor.value
                            ?: MapAnchor(region.centerLatitude, region.centerLongitude)
                    items = result.data.gigs.mapNotNull { project(it, center) }
                    nearestActivityCenter =
                        result.data.nearestActivityCenter
                            ?.let { hint ->
                                val lat = hint.latitude ?: return@let null
                                val lon = hint.longitude ?: return@let null
                                MapAnchor(lat, lon)
                            }
                    lastFetchedRegion = region
                    awaitingBaselineSync = true
                    _showsSearchThisArea.value = false
                    if (items.isNotEmpty()) {
                        // Populated fetch resets the empty-state ladder.
                        widenAttempts = 0
                        nearestActivityCenter = null
                    }
                    recompute()
                }
                is NetworkResult.Failure -> {
                    _state.value = TasksMapUiState.Error(result.error.displayMessage("Couldn't load the map."))
                }
            }
        }

        /**
         * Recompute the visible window. Empty either because the area has
         * no tasks or the active filter excludes them — both render the
         * in-sheet empty hero.
         */
        private fun recompute() {
            val visible = filteredSorted()
            if (visible.isEmpty()) {
                _selectedId.value = null
                _emptyAction.value =
                    nearestActivityCenter
                        ?.takeIf { widenAttempts > 0 }
                        ?.let { TasksMapEmptyAction.JumpToActivity(it.latitude, it.longitude) }
                        ?: TasksMapEmptyAction.Widen
                _state.value = TasksMapUiState.Empty
                _mapPins.value = emptyList()
                _mapClusters.value = emptyList()
                return
            }
            // Keep the selection if it survives the filter, else pick the
            // first visible task so exactly one pin pulses (design default).
            if (_selectedId.value == null || visible.none { it.id == _selectedId.value }) {
                _selectedId.value = visible.first().id
            }
            _state.value = TasksMapUiState.Populated(visible)
            recluster()
        }

        private fun filteredSorted(): List<TaskMapItem> {
            val criteria = _filterCriteria.value
            val nowEpochSeconds = System.currentTimeMillis() / MILLIS_PER_SECOND
            val filtered =
                items
                    .filter { _activeCategory.value == GigsCategory.All || it.category == _activeCategory.value }
                    .filter { item ->
                        criteria.matches(
                            category = item.category,
                            price = item.priceValue,
                            scheduleType = item.scheduleType,
                            acceptedBy = item.acceptedBy,
                            createdAt = item.createdAt,
                            nowEpochSeconds = nowEpochSeconds,
                        )
                    }
            return when (_activeSort.value) {
                // Urgency (P1.F) proxies to newest server-side; the map has
                // no per-pin deadline, so it shares the newest-first order.
                GigsSort.Newest, GigsSort.Urgency -> filtered // backend returns newest-first
                GigsSort.Closest -> filtered.sortedBy { distanceMiles(it.distanceLabel) }
                GigsSort.HighestPay -> filtered.sortedByDescending { priceValue(it.price) }
                GigsSort.FewestBids -> filtered.sortedBy { it.bidCount }
            }
        }

        companion object {
            const val CATEGORY_KEY = "category"

            /** ~1.3 km viewport — the design's default zoom (lon span
             * widened for the cos-latitude correction at ~40°). */
            const val DEFAULT_LAT_SPAN = 0.024
            const val DEFAULT_LON_SPAN = 0.032
            val FALLBACK_ANCHOR = MapAnchor(40.7484, -73.9857)
            private const val EARTH_RADIUS_MILES = 3958.8
            private const val MILLIS_PER_SECOND = 1000L

            /**
             * `GigDto` → pin↔card [TaskMapItem]. Drops gigs without
             * coordinates. Distance is computed client-side because
             * `in-bounds` doesn't project `distance_miles`.
             *
             * Pin state semantic (A11.1): the design's "confirmed"
             * treatment (white ring) marks a *verified poster* —
             * `creator.verified` or the `verified_resident` badge.
             * Everyone else renders the dashed "pending" outline.
             */
            fun project(
                gig: GigDto,
                anchor: MapAnchor,
            ): TaskMapItem? {
                val lat = gig.latitude ?: gig.approxLocation?.latitude ?: return null
                val lon = gig.longitude ?: gig.approxLocation?.longitude ?: return null
                val miles = haversineMiles(anchor.latitude, anchor.longitude, lat, lon)
                val verified = gig.creator?.resolvedVerified() == true
                return TaskMapItem(
                    id = gig.id,
                    category = GigsCategory.fromBackendKey(gig.category),
                    state = if (verified) MapPinState.Confirmed else MapPinState.Pending,
                    latitude = lat,
                    longitude = lon,
                    title = gig.title,
                    price = priceLabel(gig.price, gig.payType),
                    distanceLabel = String.format(Locale.US, "%.1f mi", miles),
                    bidCount = gig.bidCount ?: 0,
                    body = gig.description.orEmpty(),
                    priceValue = gig.price,
                    scheduleType = gig.scheduleType,
                    acceptedBy = gig.acceptedBy,
                    createdAt = gig.createdAt,
                )
            }

            private fun priceLabel(
                price: Double?,
                payType: String?,
            ): String {
                if (price == null) return "—"
                val formatted = if (price % 1.0 == 0.0) "$${price.toInt()}" else String.format(Locale.US, "$%.2f", price)
                return when (payType) {
                    "hourly" -> "$formatted/hr"
                    "per_session" -> "$formatted/session"
                    "per_walk" -> "$formatted/walk"
                    "per_visit" -> "$formatted/visit"
                    else -> formatted
                }
            }

            private fun haversineMiles(
                fromLat: Double,
                fromLon: Double,
                toLat: Double,
                toLon: Double,
            ): Double {
                val dLat = Math.toRadians(toLat - fromLat)
                val dLon = Math.toRadians(toLon - fromLon)
                val a =
                    sin(dLat / 2).pow(2) +
                        cos(Math.toRadians(fromLat)) * cos(Math.toRadians(toLat)) * sin(dLon / 2).pow(2)
                return EARTH_RADIUS_MILES * 2 * atan2(sqrt(a), sqrt(1 - a))
            }

            private fun distanceMiles(label: String): Double = label.substringBefore(" ").toDoubleOrNull() ?: Double.MAX_VALUE

            private fun priceValue(price: String): Double = price.filter { it.isDigit() || it == '.' }.toDoubleOrNull() ?: 0.0
        }
    }

private fun UserCoordinate.toMapAnchor(): MapAnchor = MapAnchor(latitude = latitude, longitude = longitude)
