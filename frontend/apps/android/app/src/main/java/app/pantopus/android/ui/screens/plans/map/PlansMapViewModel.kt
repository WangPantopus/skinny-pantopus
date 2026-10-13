@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.plans.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.MyPlansResponse
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.api.models.plans.PlanPinDto
import app.pantopus.android.data.api.models.plans.PlansElsewhereDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanLocation
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.plans.PlanOrigin
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewport
import app.pantopus.android.data.plans.PlanWindow
import app.pantopus.android.data.plans.PlansEvents
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.data.plans.PlansFlags
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject
import kotlin.math.ceil
import kotlin.math.floor

/** Where the map stands with the person's location (boards F1 and F5). */
enum class PlansLocationStatus { Resolving, Ready, Missing }

/** The list under the map. */
sealed interface PlansListStatus {
    data object Loading : PlansListStatus

    data object Loaded : PlansListStatus

    data class Failed(
        val message: String,
    ) : PlansListStatus
}

/** Everything Nearby-on-the-map shows. */
data class PlansMapUiState(
    val flags: PlansFlags = PlansFlags(),
    val locationStatus: PlansLocationStatus = PlansLocationStatus.Resolving,
    val location: PlanLocation? = null,
    val canUseHome: Boolean = false,
    val window: PlanWindow = PlanWindow.WEEK,
    val kind: PlanKind? = null,
    val pins: List<PlanPinDto> = emptyList(),
    val list: List<PlanDto> = emptyList(),
    val mine: MyPlansResponse? = null,
    val listStatus: PlansListStatus = PlansListStatus.Loading,
    val selectedId: String? = null,
    val selected: PlanDto? = null,
    val selectedMissing: Boolean = false,
    val games: List<PlanGameDto> = emptyList(),
    val refreshing: Boolean = false,
    /** A plan the person just posted (board H8): its pin drops in and the sheet says it's on the map. */
    val postedId: String? = null,
    /** The closest town with plans 5 to 15 miles away, when nothing is near (F4). */
    val elsewhere: PlansElsewhereDto? = null,
) {
    /** The kinds the chips offer: playdates only while their flag is on. */
    val kinds: List<PlanKind>
        get() = PlanKind.entries.filter { it != PlanKind.PLAYDATE || (flags.playdatesOn && mine?.viewer?.seesPlaydates != false) }

    /** Nothing this week around here (board F4). */
    val isEmpty: Boolean
        get() = listStatus == PlansListStatus.Loaded && list.isEmpty() && pins.isEmpty() && mineShown.isEmpty()

    /** Every plan of the viewer's, soonest first. */
    val mineAll: List<PlanDto>
        get() =
            mine
                ?.let { it.hosting + it.going + it.asked + it.waitlisted }
                .orEmpty()
                .filter { it.planState != PlanState.CANCELLED && it.planState != PlanState.ENDED }
                .distinctBy { it.id }
                .sortedBy { PlanFormat.instant(it.startsAt) ?: Instant.MAX }

    /** The viewer's own plans of the kind the chips show ("Your plans" follows the filter like the map). */
    val mineShown: List<PlanDto>
        get() = mineAll.filter { kind == null || it.planKind == kind }

    /** The list without the viewer's own plans (they show under "Your plans"). */
    val others: List<PlanDto>
        get() {
            val own = mineAll.map { it.id }.toSet()
            return list.filterNot { it.id in own }
        }
}

/**
 * Nearby on the map (boards F1 to F5). Reads the pins for the visible part of the map, the list around the
 * person's point and their own plans, all through the store (kind `nearby`), so coming back shows the last copy at
 * once and refreshes behind it.
 */
@HiltViewModel
class PlansMapViewModel
    @Inject
    constructor(
        private val repository: PlansRepository,
        private val locations: PlanLocationResolver,
        private val feature: PlansFeature,
        private val events: PlansEvents,
    ) : ViewModel() {
        private val _state = MutableStateFlow(PlansMapUiState(flags = feature.flags.value))
        val state: StateFlow<PlansMapUiState> = _state.asStateFlow()

        private var viewport: PlanViewport? = null
        private var pinsJob: Job? = null
        private var listJob: Job? = null
        private var started = false

        init {
            viewModelScope.launch {
                feature.flags.collect { flags -> _state.update { it.copy(flags = flags) } }
            }
            viewModelScope.launch {
                events.posted.collect { id ->
                    if (id != null && id != _state.value.postedId) {
                        _state.update { it.copy(postedId = id) }
                        select(id)
                        refreshAll(force = true)
                    }
                }
            }
        }

        /** "Done" on H8: back to the map. */
        fun dismissPosted() {
            val id = _state.value.postedId ?: return
            events.consumePosted(id)
            _state.update { it.copy(postedId = null) }
            select(null)
        }

        /** First appearance and every return: show what's stored, then refresh what's out of date. */
        fun load() {
            if (!started) {
                started = true
                resolveLocation()
                loadGames()
                return
            }
            val location = _state.value.location ?: return
            if (location.source == PlanLocation.Source.GPS) {
                // A GPS fix counts as a location for five minutes: renew it on every return.
                viewModelScope.launch {
                    locations.gpsFix()?.let { fix -> repository.setOrigin(PlanOrigin(fix.latitude, fix.longitude, fix.at)) }
                    refreshAll(force = false)
                }
            } else {
                refreshAll(force = false)
            }
        }

        /** Pull to refresh, Retry. */
        fun refresh() {
            _state.update { it.copy(refreshing = true) }
            if (_state.value.location == null) resolveLocation() else refreshAll(force = true)
        }

        /** The person granted location: browse from where they are. */
        fun useMyLocation() {
            locations.prefersHome = false
            resolveLocation()
        }

        /** "Use my home instead" (board F5). */
        fun useHome() {
            locations.prefersHome = true
            viewModelScope.launch {
                val home = locations.home()
                if (home != null) setLocation(home) else _state.update { it.copy(locationStatus = PlansLocationStatus.Missing) }
            }
        }

        private fun resolveLocation() {
            viewModelScope.launch {
                val resolved = locations.resolve()
                if (resolved != null) {
                    setLocation(resolved)
                } else {
                    val canUseHome = locations.hasHome()
                    _state.update {
                        it.copy(locationStatus = PlansLocationStatus.Missing, canUseHome = canUseHome, refreshing = false)
                    }
                }
            }
        }

        private fun setLocation(location: PlanLocation) {
            repository.setOrigin(
                PlanOrigin(
                    location.latitude,
                    location.longitude,
                    gps = if (location.source == PlanLocation.Source.GPS) Instant.now() else null,
                ),
            )
            _state.update { it.copy(location = location, locationStatus = PlansLocationStatus.Ready) }
            showStoredList()
            refreshAll(force = false)
        }

        private fun loadGames() {
            viewModelScope.launch {
                val games = (repository.games() as? NetworkResult.Success)?.data.orEmpty()
                _state.update { it.copy(games = games) }
            }
        }

        /** A chip: null is "All". */
        fun setKind(kind: PlanKind?) {
            if (_state.value.kind == kind) return
            _state.update { it.copy(kind = kind, selectedId = null, selected = null) }
            showStoredList()
            refreshAll(force = false)
        }

        /** The area pill's time choice. */
        fun setWindow(window: PlanWindow) {
            if (_state.value.window == window) return
            _state.update { it.copy(window = window, selectedId = null, selected = null) }
            showStoredList()
            refreshAll(force = false)
        }

        /** The map settled on a new viewport; rounded outward so small pans share one stored copy. */
        fun setViewport(
            south: Double,
            west: Double,
            north: Double,
            east: Double,
        ) {
            val rounded =
                PlanViewport(
                    south = floor(south * GRID) / GRID,
                    west = floor(west * GRID) / GRID,
                    north = ceil(north * GRID) / GRID,
                    east = ceil(east * GRID) / GRID,
                )
            if (rounded == viewport) return
            viewport = rounded
            loadPins(force = false, debounce = true)
        }

        /** A pin or a row: show its card (board F3). */
        fun select(id: String?) {
            if (id == null) {
                _state.update { it.copy(selectedId = null, selected = null, selectedMissing = false) }
                return
            }
            val known = cardFor(id)
            _state.update { it.copy(selectedId = id, selected = known, selectedMissing = false) }
            viewModelScope.launch {
                when (val result = repository.plan(id)) {
                    is NetworkResult.Success ->
                        if (_state.value.selectedId == id) _state.update { it.copy(selected = result.data) }
                    is NetworkResult.Failure ->
                        if (_state.value.selectedId == id && result.error is NetworkError.NotFound) {
                            _state.update { it.copy(selectedMissing = true) }
                            repository.changed()
                        }
                }
            }
        }

        private fun cardFor(id: String): PlanDto? =
            _state.value.list.firstOrNull { it.id == id }
                ?: _state.value.mineAll.firstOrNull { it.id == id }
                ?: repository.card(id)

        private fun kindsParam(): String? = _state.value.kind?.wire

        private fun showStoredList() {
            val location = _state.value.location ?: return
            val copy = repository.listCopy(location.latitude, location.longitude, _state.value.window, kindsParam())
            val mine = repository.mineCopy()
            _state.update {
                it.copy(
                    list = copy?.items?.let(::visible) ?: it.list,
                    mine = mine ?: it.mine,
                    listStatus = if (copy != null) PlansListStatus.Loaded else it.listStatus,
                )
            }
            viewport?.let { box ->
                repository.pinsCopy(box, kindsParam(), _state.value.window)?.let { pins ->
                    _state.update { it.copy(pins = visiblePins(pins.markers)) }
                }
            }
        }

        private fun refreshAll(force: Boolean) {
            loadList(force)
            loadPins(force, debounce = false)
        }

        private fun loadList(force: Boolean) {
            val location = _state.value.location ?: return
            listJob?.cancel()
            listJob =
                viewModelScope.launch {
                    val window = _state.value.window
                    val kinds = kindsParam()
                    val listRead = async { repository.list(location.latitude, location.longitude, window, kinds, force) }
                    val mineRead = async { repository.mine(force) }
                    val list = listRead.await()
                    val mine = mineRead.await()
                    _state.update { current ->
                        val items = list.data?.items?.let(::visible)
                        val failure = list.failure
                        current.copy(
                            list = items ?: current.list,
                            elsewhere = if (items != null) list.data?.nearestElsewhere else current.elsewhere,
                            mine = mine.data ?: current.mine,
                            refreshing = false,
                            listStatus =
                                when {
                                    items != null -> PlansListStatus.Loaded
                                    failure != null && current.listStatus != PlansListStatus.Loaded ->
                                        PlansListStatus.Failed(failure.message)
                                    else -> current.listStatus
                                },
                        )
                    }
                }
        }

        private fun loadPins(
            force: Boolean,
            debounce: Boolean,
        ) {
            val box = viewport ?: return
            pinsJob?.cancel()
            pinsJob =
                viewModelScope.launch {
                    if (debounce) delay(PIN_DEBOUNCE_MS)
                    val stored = repository.pins(box, kindsParam(), _state.value.window, force)
                    stored.data?.let { pins -> _state.update { it.copy(pins = visiblePins(pins.markers)) } }
                }
        }

        /** Playdates only while their flag is on (the server already hides them; this keeps a stale copy honest). */
        private fun visible(items: List<PlanDto>): List<PlanDto> =
            items.filter { it.planKind != null && (it.planKind != PlanKind.PLAYDATE || _state.value.flags.playdatesOn) }

        private fun visiblePins(items: List<PlanPinDto>): List<PlanPinDto> =
            items.filter {
                val kind = PlanKind.from(it.kind)
                it.layerType == "plan" &&
                    (_state.value.kind == null || kind == _state.value.kind) &&
                    it.latitude != null &&
                    it.longitude != null &&
                    kind != null &&
                    (kind != PlanKind.PLAYDATE || _state.value.flags.playdatesOn)
            }

        private companion object {
            const val GRID = 100.0
            const val PIN_DEBOUNCE_MS = 300L
        }
    }
