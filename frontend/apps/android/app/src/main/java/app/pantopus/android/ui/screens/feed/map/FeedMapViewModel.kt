@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.feed.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.postsmap.PostsMapResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.location.ViewingLocationRepository
import app.pantopus.android.data.postsmap.PostsMapRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.explore.ExploreEntity
import app.pantopus.android.ui.screens.explore.ExploreKind
import app.pantopus.android.ui.screens.explore.ExploreMapViewModel
import app.pantopus.android.ui.screens.explore.ExploreMarker
import app.pantopus.android.ui.screens.feed.FeedSurface
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.abs
import kotlin.math.max

/** Which half of the feed header's List / Map toggle is active. */
enum class FeedViewMode(val key: String, val label: String) {
    List("list", "List"),
    Map("map", "Map"),
}

/** A viewport as the map reports it — centre plus span (mirrors RN `Region`). */
data class FeedMapRegion(
    val latitude: Double,
    val longitude: Double,
    val latitudeDelta: Double,
    val longitudeDelta: Double,
) {
    /** South / west / north / east — the four params `/api/posts/map` requires. */
    val south: Double get() = latitude - latitudeDelta / 2
    val west: Double get() = longitude - longitudeDelta / 2
    val north: Double get() = latitude + latitudeDelta / 2
    val east: Double get() = longitude + longitudeDelta / 2

    /**
     * RN's `regionChangedSignificantly` — ignore sub-10% jitter so a
     * settling camera doesn't spam the endpoint.
     */
    fun changedSignificantly(other: FeedMapRegion): Boolean {
        val latThreshold = max(other.latitudeDelta * 0.1, 0.0005)
        val lonThreshold = max(other.longitudeDelta * 0.1, 0.0005)
        return abs(latitude - other.latitude) > latThreshold ||
            abs(longitude - other.longitude) > lonThreshold ||
            abs(latitudeDelta - other.latitudeDelta) > latThreshold ||
            abs(longitudeDelta - other.longitudeDelta) > lonThreshold
    }

    companion object {
        /** RN default region (`src/constants/feed.ts` DEFAULT_REGION). */
        val Fallback = FeedMapRegion(40.7484, -73.9857, 0.12, 0.12)
    }
}

/**
 * The two request dimensions the map mode re-fetches on: which feed surface
 * is active (`place` / `connections`) and which chip-row intent is selected.
 */
data class FeedMapQuery(
    val surface: FeedSurface,
    val postType: String?,
)

/** Render state for the Pulse map mode. */
sealed interface FeedMapUiState {
    data object Loading : FeedMapUiState

    data class Loaded(
        val entities: List<ExploreEntity>,
        val markers: List<ExploreMarker>,
        val userCoordinate: UserCoordinate?,
        val selectedId: String? = null,
        /**
         * Backend hint offered when the viewport was empty
         * (`backend/routes/posts.js:1854`).
         */
        val nearestActivityCenter: FeedMapRegion? = null,
    ) : FeedMapUiState {
        val isEmpty: Boolean get() = entities.isEmpty()
    }

    data class Error(val message: String) : FeedMapUiState
}

/**
 * Backs the Pulse feed's Map mode (the List / Map toggle in the feed
 * header). Mirrors RN `src/hooks/feed/useFeedMap.ts`: a viewport-driven
 * fetch against `GET /api/posts/map` (route `backend/routes/posts.js:1646`),
 * a debounced "viewport dirty" flag that surfaces the "Search this area"
 * pill, and a recenter action that returns to the viewing location.
 *
 * Pin/cluster geometry is not rebuilt here — the Explore map's clusterer,
 * marker vocabulary, and pin composables are reused so Pulse and Explore
 * share one map stack.
 */
@HiltViewModel
class FeedMapViewModel
    @Inject
    constructor(
        private val postsMapRepository: PostsMapRepository,
        private val locationProvider: LocationProvider,
        private val viewingLocation: ViewingLocationRepository,
        private val savedPlaces: SavedPlacesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<FeedMapUiState>(FeedMapUiState.Loading)
        val state: StateFlow<FeedMapUiState> = _state.asStateFlow()

        private val _region = MutableStateFlow(FeedMapRegion.Fallback)

        /** Current camera viewport. The screen mirrors this into the camera. */
        val region: StateFlow<FeedMapRegion> = _region.asStateFlow()

        private val _viewportDirty = MutableStateFlow(false)

        /**
         * True once the camera moved off the last fetched viewport — drives
         * the floating "Search this area" pill.
         */
        val viewportDirty: StateFlow<Boolean> = _viewportDirty.asStateFlow()

        private var isReady = false
        private var query = FeedMapQuery(FeedSurface.Pulse, null)
        private var userCoordinate: UserCoordinate? = null
        private var pendingRegion: FeedMapRegion? = null
        private var debounceJob: Job? = null
        private var readJob: Job? = null
        private var fetchGeneration = 0
        private var shownRegion: FeedMapRegion? = null
        private var shownQuery: FeedMapQuery? = null
        private var selectedArea: Pair<Double, Double>? = null
        private var defaultArea: Pair<Double, Double>? = null
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice = _refreshNotice.asStateFlow()

        private fun launchRead(block: suspend () -> Unit) {
            readJob?.cancel()
            fetchGeneration++
            readJob = viewModelScope.launch { block() }
        }

        fun suspendContent() {
            readJob?.cancel()
            fetchGeneration++
        }

        /**
         * Entering Map mode, or the surface / chip-row filter changed while
         * it is showing. Resolves the viewing location on first use and
         * re-requests the current viewport thereafter.
         */
        fun activate(next: FeedMapQuery) {
            val changed = next != query
            query = next
            launchRead {
                val areaChanged = updateSelectedArea() ?: return@launchRead
                if (!isReady) {
                    initializeMap()
                } else {
                    val target =
                        when {
                            areaChanged -> _region.value
                            changed -> pendingRegion ?: _region.value
                            else -> shownRegion ?: _region.value
                        }
                    fetchMarkers(target)
                }
            }
        }

        fun refresh() {
            if (!isReady) {
                activate(query)
            } else {
                launchRead { fetchMarkers(pendingRegion ?: _region.value, force = true) }
            }
        }

        /** The map shares the feed's chosen area; returning inside its window adds no location request. */
        private suspend fun updateSelectedArea(): Boolean? {
            val result = viewingLocation.current()
            if (result !is NetworkResult.Success) {
                if (isReady && !(result as NetworkResult.Failure).error.refusesStoredCopy) return false
                isReady = false
                _refreshNotice.value = null
                _state.value = FeedMapUiState.Error("Couldn't load your selected area. Please try again.")
                return null
            }
            val next = result.data.viewingLocation?.let { it.latitude to it.longitude }
            // The list feed also falls back to the first Home, then the newest saved place.
            defaultArea = result.data.homes.firstNotNullOfOrNull { home ->
                home.latitude?.let { lat -> home.longitude?.let { lon -> lat to lon } }
            } ?: if (next == null && !isReady) {
                savedPlaces.listStored().data?.savedPlaces?.firstOrNull()?.let { it.latitude to it.longitude }
            } else {
                defaultArea
            }
            if (next == selectedArea) return false
            selectedArea = next
            if (next != null) {
                _region.value = _region.value.copy(latitude = next.first, longitude = next.second)
                pendingRegion = null
                _viewportDirty.value = false
            } else {
                isReady = false
            }
            return next != null
        }

        private suspend fun initializeMap() {
            if (userCoordinate == null) {
                userCoordinate = locationProvider.cachedCoordinate()
                if (selectedArea == null && userCoordinate == null) userCoordinate = locationProvider.requestCurrent()
            }
            val center = selectedArea ?: userCoordinate?.let { it.latitude to it.longitude } ?: defaultArea
            if (center == null) {
                _refreshNotice.value = null
                _state.value = FeedMapUiState.Error("Choose an area or turn on location to explore nearby.")
                return
            }
            _region.value = _region.value.copy(latitude = center.first, longitude = center.second)
            fetchMarkers(_region.value)
            isReady = true
        }

        /**
         * Camera settled on a new viewport. Marks the viewport dirty (so the
         * "Search this area" pill appears) and debounces the follow-up region
         * commit — the refetch itself waits for the explicit tap, matching RN.
         */
        fun cameraDidSettle(next: FeedMapRegion) {
            if (!next.changedSignificantly(pendingRegion ?: _region.value)) return
            pendingRegion = next
            _viewportDirty.value = true
            selectEntity(null)
            debounceJob?.cancel()
            debounceJob =
                viewModelScope.launch {
                    delay(REGION_DEBOUNCE_MS)
                    pendingRegion?.let { _region.value = it }
                }
        }

        /** "Search this area" — re-request the viewport the user dragged to. */
        fun searchThisArea() {
            debounceJob?.cancel()
            debounceJob = null
            val target = pendingRegion ?: _region.value
            _region.value = target
            launchRead {
                fetchMarkers(target, force = true)
                pendingRegion = null
                _viewportDirty.value = false
            }
        }

        /**
         * Recenter — re-resolve the device location, move the camera back,
         * and refetch (RN `useFeedMap.ts:160`).
         */
        fun recenter() {
            launchRead {
                locationProvider.requestCurrent()?.let { userCoordinate = it }
                val coord = userCoordinate ?: return@launchRead
                val next =
                    FeedMapRegion(
                        latitude = coord.latitude,
                        longitude = coord.longitude,
                        latitudeDelta = _region.value.latitudeDelta,
                        longitudeDelta = _region.value.longitudeDelta,
                    )
                _region.value = next
                pendingRegion = null
                _viewportDirty.value = false
                fetchMarkers(next)
            }
        }

        /**
         * Jump to the backend's nearest-activity hint when the viewport came
         * back empty.
         */
        fun jumpToNearestActivity() {
            val center = (_state.value as? FeedMapUiState.Loaded)?.nearestActivityCenter ?: return
            val next =
                FeedMapRegion(
                    latitude = center.latitude,
                    longitude = center.longitude,
                    latitudeDelta = _region.value.latitudeDelta,
                    longitudeDelta = _region.value.longitudeDelta,
                )
            _region.value = next
            pendingRegion = null
            _viewportDirty.value = false
            launchRead { fetchMarkers(next, force = true) }
        }

        fun selectEntity(id: String?) {
            val current = _state.value as? FeedMapUiState.Loaded ?: return
            _state.value = current.copy(selectedId = id)
        }

        private suspend fun fetchMarkers(
            target: FeedMapRegion,
            force: Boolean = false,
        ) {
            val generation = ++fetchGeneration
            val requestedQuery = query
            val sameView = shownRegion == target && shownQuery == requestedQuery
            val copy =
                postsMapRepository.postsCopy(
                    target.south,
                    target.west,
                    target.north,
                    target.east,
                    requestedQuery.postType,
                    requestedQuery.surface.backendSurface,
                )
            if (!sameView || _state.value !is FeedMapUiState.Loaded) {
                _refreshNotice.value = null
                if (copy.data != null) {
                    publish(copy.data, target, requestedQuery, keepSelection = false)
                } else {
                    _state.value = FeedMapUiState.Loading
                }
            }
            val stored =
                postsMapRepository.postsStored(
                    target.south,
                    target.west,
                    target.north,
                    target.east,
                    requestedQuery.postType,
                    requestedQuery.surface.backendSurface,
                    force,
                )
            if (generation != fetchGeneration || requestedQuery != query) return
            _refreshNotice.value =
                if (stored.showsRefreshFailure(StoreKind.NEARBY)) RefreshNotice(stored.fetchedAt, ::refresh) else null
            if (stored.data == null) {
                shownRegion = null
                shownQuery = null
                _state.value = FeedMapUiState.Error(stored.failure?.message ?: "Couldn't load the map. Try again.")
            } else {
                publish(stored.data, target, requestedQuery, keepSelection = sameView)
            }
        }

        private fun publish(
            data: PostsMapResponse,
            target: FeedMapRegion,
            requestedQuery: FeedMapQuery,
            keepSelection: Boolean,
        ) {
            val anchor = userCoordinate ?: UserCoordinate(target.latitude, target.longitude, 0.0)
            val selected = if (keepSelection) (_state.value as? FeedMapUiState.Loaded)?.selectedId else null
            val entities = ExploreMapViewModel.projectMarkers(data.markers, anchor).filter { it.kind == ExploreKind.Post }
            val hint =
                data.nearestActivityCenter?.let {
                    FeedMapRegion(it.latitude, it.longitude, target.latitudeDelta, target.longitudeDelta)
                }
            shownRegion = target
            shownQuery = requestedQuery
            _state.value =
                FeedMapUiState.Loaded(
                    entities = entities.sortedBy { it.distanceMiles },
                    markers = ExploreMapViewModel.cluster(entities, clusterRadius(target)),
                    userCoordinate = userCoordinate,
                    selectedId = selected.takeIf { id -> entities.any { it.id == id } },
                    nearestActivityCenter = hint,
                )
        }

        /** Widen the cluster radius as the camera zooms out and vice versa. */
        private fun clusterRadius(target: FeedMapRegion): Double = (target.latitudeDelta * 0.08).coerceIn(0.0005, 0.05)

        companion object {
            /**
             * Debounce applied to camera-driven region commits. Matches RN's
             * `REGION_DEBOUNCE_MS` (`src/hooks/feed/useFeedMap.ts:13`).
             */
            const val REGION_DEBOUNCE_MS = 350L
        }
    }
