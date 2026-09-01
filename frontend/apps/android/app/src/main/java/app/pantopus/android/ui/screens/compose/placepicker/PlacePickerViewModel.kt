package app.pantopus.android.ui.screens.compose.placepicker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.geo.GeoPlace
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Which coordinate the NEARBY list + search proximity anchor on.
 * [Photo] is offered only when the attached media carries a capture
 * location; [Current] is the device fix (today's behavior). Mirrors the
 * iOS anchor enum / chip ids 1:1.
 */
enum class PlacePickerAnchor { Photo, Current }

/** Render state for the place-picker sheet. */
sealed interface PlacePickerUiState {
    data object Loading : PlacePickerUiState

    /** Nearby POIs + the enclosing locality from the device fix. */
    data class Loaded(
        val nearby: List<GeoPlace>,
        val locality: GeoPlace?,
    ) : PlacePickerUiState

    data class SearchResults(val places: List<GeoPlace>) : PlacePickerUiState

    data object Empty : PlacePickerUiState

    data class Error(val message: String) : PlacePickerUiState
}

/**
 * Backs [PlacePickerSheet] — the Instagram-style venue picker shared by
 * the Pulse and Beacon composers. [load] resolves a device fix and fetches
 * `GET /api/geo/places/nearby`; typing searches
 * `GET /api/geo/places/search` (debounced, proximity-biased when a fix is
 * known). No fix ⇒ search-only mode with no NEARBY section. Mirrors the
 * iOS `PlacePickerViewModel`.
 *
 * ADDENDUM 2 — when the composer's media carries a capture location
 * ([setMediaLocation], refreshed on every presentation), the sheet
 * offers "Photo location" / "Near me" anchor chips: the media anchor is
 * the default, drives the NEARBY load AND the search proximity, and
 * needs no GPS fix or permission. No media location ⇒ no chips ⇒
 * today's behavior byte-identical.
 */
@HiltViewModel
class PlacePickerViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        private val locationProvider: LocationProvider,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PlacePickerUiState>(PlacePickerUiState.Loading)
        val state: StateFlow<PlacePickerUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        /** True when no device fix is available — the sheet hides NEARBY. */
        private val _searchOnly = MutableStateFlow(false)
        val searchOnly: StateFlow<Boolean> = _searchOnly.asStateFlow()

        /**
         * Capture location of the composer's first geotagged attachment.
         * Non-null renders the anchor chips; PRIVACY: a local anchor
         * input only, never part of any outgoing body.
         */
        private val _mediaLocation = MutableStateFlow<MediaCaptureLocation?>(null)
        val mediaLocation: StateFlow<MediaCaptureLocation?> = _mediaLocation.asStateFlow()

        /** Active anchor chip — defaults to Photo when media has a location. */
        private val _anchor = MutableStateFlow(PlacePickerAnchor.Current)
        val anchor: StateFlow<PlacePickerAnchor> = _anchor.asStateFlow()

        /** Device fix, kept for search proximity biasing. */
        private var deviceCoordinate: UserCoordinate? = null

        /**
         * Last successful nearby payload — null until a load (or
         * search-only entry) completes, restored when the search field
         * clears. Mirrors the iOS `lastNearby` cache.
         */
        private var lastNearby: NearbyPayload? = null
        private var searchJob: Job? = null

        /**
         * Monotonic load stamp — an anchor switch starts a NEW load, and
         * a stale in-flight load (the GPS fix can take seconds) must not
         * clobber the newer anchor's state. Mirrors iOS `loadGeneration`.
         */
        private var loadGeneration = 0

        private data class NearbyPayload(
            val nearby: List<GeoPlace>,
            val locality: GeoPlace?,
        )

        /**
         * Seed the media capture anchor for THIS presentation. The Hilt
         * VM outlives sheet dismissals (it is scoped to the host
         * screen), so the sheet calls this on every open, before [load]
         * — the value must track the composer's current attachment set,
         * never be captured once at VM construction. Non-null defaults
         * the anchor to the photo (Instagram behavior); the stale
         * nearby cache is dropped so a short query can't restore a
         * payload anchored on last presentation's coordinate.
         */
        fun setMediaLocation(location: MediaCaptureLocation?) {
            _mediaLocation.value = location
            _anchor.value = if (location != null) PlacePickerAnchor.Photo else PlacePickerAnchor.Current
            lastNearby = null
        }

        /**
         * Anchor chip tap — reload NEARBY around the chosen anchor. An
         * active ≥2-char search keeps the list area (load()'s
         * hasActiveQuery guard caches the fresh payload without
         * clobbering it — the same race guard as the slow GPS load) and
         * is re-run so its proximity bias follows the new anchor.
         */
        fun selectAnchor(anchor: PlacePickerAnchor) {
            if (_anchor.value == anchor) return
            _anchor.value = anchor
            load()
            if (hasActiveQuery()) onQueryChange(_query.value)
        }

        /**
         * Resolve the active anchor's coordinate and fetch the NEARBY
         * section. Called on sheet open (after the runtime permission
         * flow, which lives in the composable layer — [locationProvider]
         * only checks) and on anchor switches. The Photo anchor reads
         * the media capture fix directly — no GPS, no permission; only
         * the Current anchor resolves a device fix, and its no-fix path
         * degrades to search-only while the photo chip stays live.
         *
         * The GPS fix + fetch can take seconds: when the user typed a
         * live query meanwhile, the completion caches the payload for
         * later restore but never clobbers their on-screen search
         * results (or error) — same guard as the iOS `load()`.
         */
        fun load() {
            val generation = ++loadGeneration
            if (!hasActiveQuery()) {
                searchJob?.cancel()
                _state.value = PlacePickerUiState.Loading
            }
            viewModelScope.launch {
                val coordinate = resolveAnchorCoordinate()
                // An anchor switch mid-fix started a newer load — stand down.
                if (generation != loadGeneration) return@launch
                if (coordinate == null) {
                    enterSearchOnlyMode()
                    return@launch
                }
                _searchOnly.value = false
                when (val result = repo.geoNearbyPlaces(coordinate.latitude, coordinate.longitude)) {
                    is NetworkResult.Success -> {
                        if (generation != loadGeneration) return@launch
                        lastNearby = NearbyPayload(result.data.places, result.data.locality)
                        if (!hasActiveQuery()) showNearby()
                    }
                    is NetworkResult.Failure -> {
                        if (generation != loadGeneration) return@launch
                        if (!hasActiveQuery()) {
                            _state.value =
                                PlacePickerUiState.Error(
                                    result.error.message.ifBlank { "Couldn't load nearby places." },
                                )
                        } else {
                            // A failed reload behind a live search must not
                            // leave the PREVIOUS anchor's payload restorable
                            // under the newly active chip — drop the cache so
                            // clearing the query can't resurrect a mislabeled
                            // nearby list (mirrors iOS).
                            lastNearby = null
                        }
                    }
                }
            }
        }

        /**
         * Permission denied (or no fix) — search still works. Maps to
         * `Loaded(emptyList(), null)` like iOS's `.loaded([], nil)`; the
         * sheet renders the search-only hint from [searchOnly].
         */
        fun enterSearchOnlyMode() {
            _searchOnly.value = true
            lastNearby = NearbyPayload(emptyList(), null)
            if (!hasActiveQuery()) {
                _state.value = PlacePickerUiState.Loaded(nearby = emptyList(), locality = null)
            }
        }

        fun onQueryChange(value: String) {
            _query.value = value
            searchJob?.cancel()
            val q = value.trim()
            if (q.length < MIN_QUERY_LENGTH) {
                // Restore nearby only when a payload was cached — a failed
                // load's Error card (and its Retry) must survive short
                // queries (mirrors iOS's `lastNearby` nullable guard).
                showNearby()
                return
            }
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_DEBOUNCE_MS)
                    // Proximity bias follows the ACTIVE anchor, read at
                    // execution time (post-debounce) so a chip switch
                    // mid-typing biases the request that actually fires.
                    val coordinate = searchProximity()
                    when (val result = repo.geoSearchPlaces(q, coordinate?.latitude, coordinate?.longitude)) {
                        is NetworkResult.Success ->
                            _state.value =
                                if (result.data.places.isEmpty()) {
                                    PlacePickerUiState.Empty
                                } else {
                                    PlacePickerUiState.SearchResults(result.data.places)
                                }
                        is NetworkResult.Failure ->
                            _state.value =
                                PlacePickerUiState.Error(
                                    result.error.message.ifBlank { "Couldn't search places." },
                                )
                    }
                }
        }

        /** Error-state CTA — re-run the search or the nearby load. */
        fun retry() {
            if (_query.value.trim().length >= MIN_QUERY_LENGTH) {
                onQueryChange(_query.value)
            } else {
                load()
            }
        }

        /** True while the query is long enough to own the list area. */
        private fun hasActiveQuery(): Boolean = _query.value.trim().length >= MIN_QUERY_LENGTH

        /**
         * The active anchor's coordinate — media capture fix for Photo
         * (defensively falling through to the device flow if the media
         * location vanished), device fix for Current. Only the Current
         * path touches GPS.
         */
        private suspend fun resolveAnchorCoordinate(): MediaCaptureLocation? {
            val media = _mediaLocation.value
            if (_anchor.value == PlacePickerAnchor.Photo && media != null) return media
            val fix = locationProvider.requestCurrent(timeoutMillis = GPS_TIMEOUT_MS)
            deviceCoordinate = fix
            return fix?.let { MediaCaptureLocation(latitude = it.latitude, longitude = it.longitude) }
        }

        /** Search proximity — the ACTIVE anchor's coordinate (null = unbiased). */
        private fun searchProximity(): MediaCaptureLocation? {
            val media = _mediaLocation.value
            if (_anchor.value == PlacePickerAnchor.Photo && media != null) return media
            return deviceCoordinate?.let { MediaCaptureLocation(latitude = it.latitude, longitude = it.longitude) }
        }

        private fun showNearby() {
            val cached = lastNearby ?: return
            // Loaded even when empty — the sheet renders "No places
            // nearby" from the loaded state, matching iOS.
            _state.value = PlacePickerUiState.Loaded(nearby = cached.nearby, locality = cached.locality)
        }

        private companion object {
            /** Best-effort fix; the sheet degrades to search-only past this. */
            const val GPS_TIMEOUT_MS = 4_000L

            // Mirrors PlaceLaunchViewModel: one request per pause, not per key.
            const val SEARCH_DEBOUNCE_MS = 220L
            const val MIN_QUERY_LENGTH = 2
        }
    }
