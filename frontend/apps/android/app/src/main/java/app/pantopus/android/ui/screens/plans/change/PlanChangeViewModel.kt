package app.pantopus.android.ui.screens.plans.change

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanNearbyPlaceDto
import app.pantopus.android.data.api.models.plans.PlanPlaceInput
import app.pantopus.android.data.api.models.plans.PlanPlaceSuggestBody
import app.pantopus.android.data.api.models.plans.UpdatePlanBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanPlaceQuery
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planMessage
import app.pantopus.android.ui.screens.plans.PlansRoutes
import app.pantopus.android.ui.screens.plans.host.PLACES_SLOW
import app.pantopus.android.ui.screens.plans.host.PickedPlace
import app.pantopus.android.ui.screens.plans.host.PlaceSuggestions
import app.pantopus.android.ui.screens.plans.host.placeQuery
import app.pantopus.android.ui.screens.plans.host.placesFailure
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import javax.inject.Inject
import kotlin.math.abs

/** H11's state. */
data class PlanChangeUi(
    val plan: PlanDto? = null,
    val zone: ZoneId = ZoneId.systemDefault(),
    val originalStart: LocalDateTime? = null,
    val originalEnd: LocalDateTime? = null,
    val start: LocalDateTime? = null,
    val end: LocalDateTime? = null,
    /** A public plan's new place (H6 over H11, as on iOS); null while it stays where it is. */
    val newPlace: PickedPlace? = null,
    val picking: Boolean = false,
    val placeCandidate: PickedPlace? = null,
    val placesQuery: String = "",
    val places: List<PlanNearbyPlaceDto> = emptyList(),
    val placesLoading: Boolean = false,
    /** The server is still gathering the area's places (a first look can take up to a minute). */
    val placesGathering: Boolean = false,
    /** Why H6's places couldn't load, shown with "Try again". */
    val placesError: String? = null,
    val placesAttribution: String? = null,
    /** H6's "Suggest places" (or "Ask Pantopus" for the search text), for the plan at its new time. */
    val suggestions: PlaceSuggestions = PlaceSuggestions.Idle,
    val saving: Boolean = false,
    val error: String? = null,
    val saved: Boolean = false,
) {
    /** People in, not counting the host; a party counts in full ("Alex + 1" is two), as on iOS and board H11. */
    val peopleIn: Int get() = plan?.people.orEmpty().filter { !it.isHost }.sumOf { it.partySize.coerceAtLeast(1) }

    /** The start moved by more than 30 minutes. */
    val timeMoved: Boolean
        get() {
            val a = originalStart ?: return false
            val b = start ?: return false
            return abs(Duration.between(a, b).toMinutes()) > STILL_COMING_MINUTES
        }

    /** Moving the start more than 30 minutes, or the place, asks everyone in "Still coming?" (brief section 5). */
    val asksStillComing: Boolean get() = peopleIn > 0 && (timeMoved || newPlace != null)

    /** A public plan can move to another public place; a plan at home keeps its place (as on iOS). */
    val canChangePlace: Boolean get() = plan?.isAtHome == false

    /** Where H6 looks for places: around the plan's own place. */
    val placesOrigin: Pair<Double, Double>?
        get() {
            val place = plan?.place
            if (place?.latitude != null && place.longitude != null) return place.latitude to place.longitude
            val area = plan?.area ?: return null
            return if (area.latitude != null && area.longitude != null) area.latitude to area.longitude else null
        }

    val changed: Boolean get() = start != originalStart || end != originalEnd || newPlace != null

    private companion object {
        const val STILL_COMING_MINUTES = 30
    }
}

/**
 * Change the time, or a public plan's place (board H11, as on iOS). The server sends "Still coming?" when the start
 * moves more than 30 minutes or the place changes.
 */
@HiltViewModel
class PlanChangeViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: PlansRepository,
    ) : ViewModel() {
        private val planId: String = savedStateHandle.get<String>(PlansRoutes.PLAN_ID_KEY).orEmpty()
        private val _ui = MutableStateFlow(PlanChangeUi())
        val ui: StateFlow<PlanChangeUi> = _ui.asStateFlow()
        private var placesRead: Job? = null
        private var suggestJob: Job? = null

        fun load() {
            if (_ui.value.plan != null) return
            viewModelScope.launch {
                when (val result = repository.plan(planId)) {
                    is NetworkResult.Success -> {
                        val plan = result.data
                        val zone = PlanFormat.zone(plan.timezone)
                        val start = PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDateTime()
                        val end = PlanFormat.instant(plan.endsAt)?.atZone(zone)?.toLocalDateTime()
                        _ui.update {
                            PlanChangeUi(
                                plan = plan,
                                zone = zone,
                                originalStart = start,
                                originalEnd = end,
                                start = start,
                                end = end,
                            )
                        }
                    }
                    is NetworkResult.Failure -> _ui.update { it.copy(error = result.error.planMessage) }
                }
            }
        }

        /** A new start keeps the plan's length. */
        fun setStart(value: LocalDateTime) {
            _ui.update { ui ->
                val length = if (ui.start != null && ui.end != null) Duration.between(ui.start, ui.end) else Duration.ofHours(2)
                ui.copy(start = value, end = value.plus(length), error = null)
            }
        }

        fun setEnd(value: LocalDateTime) {
            _ui.update { it.copy(end = value, error = null) }
        }

        // ---- Where (H6 over H11, public plans only) ----

        fun openPlaces() {
            if (!_ui.value.canChangePlace) return
            suggestJob?.cancel()
            _ui.update {
                it.copy(picking = true, placeCandidate = it.newPlace, error = null, suggestions = PlaceSuggestions.Idle)
            }
            // Read again when the time changed since: each place says whether it's open for the plan's new time.
            findPlaces(query = _ui.value.placesQuery.trim().takeIf(String::isNotEmpty), debounce = false)
        }

        /** Search by name: the list filters at once, and the server looks further than the nearest 40. */
        fun searchPlaces(query: String) {
            if (query.trim() != _ui.value.placesQuery.trim()) {
                // Suggestions answer the words they were asked with (as on iOS).
                suggestJob?.cancel()
                _ui.update { it.copy(suggestions = PlaceSuggestions.Idle) }
            }
            _ui.update { it.copy(placesQuery = query) }
            findPlaces(query.trim().takeIf(String::isNotEmpty), debounce = true)
        }

        /** "Try again" under H6's list. */
        fun retryPlaces() {
            findPlaces(_ui.value.placesQuery.trim().takeIf(String::isNotEmpty), debounce = false)
        }

        /** What H6's list and suggestions are for: the plan's kind and sport, at the time chosen here. */
        private fun planPlaceQuery(): PlanPlaceQuery? {
            val ui = _ui.value
            val plan = ui.plan ?: return null
            val kind = plan.planKind ?: return null
            val start = ui.start ?: return null
            return placeQuery(kind, plan.details?.sport, start, ui.end, ui.zone)
        }

        /** H6's "Suggest places" ([ask] null), or "Ask Pantopus" for what the host typed in the search box. */
        fun suggestPlaces(ask: String?) {
            val ui = _ui.value
            val plan = ui.plan ?: return
            val origin = ui.placesOrigin ?: return
            val query = planPlaceQuery() ?: return
            val body =
                PlanPlaceSuggestBody(
                    latitude = origin.first,
                    longitude = origin.second,
                    kind = query.kind,
                    title = plan.title.trim().takeIf(String::isNotEmpty),
                    about = plan.about?.trim()?.takeIf(String::isNotEmpty),
                    startsAt = query.startsAt,
                    endsAt = query.endsAt,
                    spots = plan.spots.takeIf { it > 0 },
                    details = plan.details,
                    ask = ask,
                )
            suggestJob?.cancel()
            _ui.update { it.copy(suggestions = PlaceSuggestions.Loading(gathering = false)) }
            suggestJob =
                viewModelScope.launch {
                    val result =
                        repository.suggestPlacesWhenReady(body) {
                            _ui.update { it.copy(suggestions = PlaceSuggestions.Loading(gathering = true)) }
                        }
                    _ui.update { it.copy(suggestions = PlaceSuggestions.from(result, ask)) }
                }
        }

        fun pickPlaceCandidate(place: PickedPlace) {
            _ui.update { it.copy(placeCandidate = place) }
        }

        /** "Use …": the plan moves there on Save; picking the place it's at already changes nothing. */
        fun usePlace() {
            val place = _ui.value.placeCandidate ?: return
            val current = _ui.value.plan?.place
            val same =
                current != null &&
                    current.name == place.name &&
                    current.latitude == place.latitude &&
                    current.longitude == place.longitude
            _ui.update { it.copy(picking = false, newPlace = if (same) null else place, error = null) }
        }

        fun closePlaces() {
            _ui.update { it.copy(picking = false) }
        }

        /**
         * One places read, ordered for the plan at its new time; a first read for an area may come back `loading` while
         * OpenStreetMap is slow, and the read asks again (as on H6).
         */
        private fun findPlaces(
            query: String?,
            debounce: Boolean,
        ) {
            val origin = _ui.value.placesOrigin ?: return
            placesRead?.cancel()
            placesRead =
                viewModelScope.launch {
                    if (debounce) delay(SEARCH_DEBOUNCE_MS)
                    _ui.update { it.copy(placesLoading = true, placesGathering = false, placesError = null) }
                    val result =
                        repository.nearbyPlacesWhenReady(origin.first, origin.second, query, planPlaceQuery()) { reply ->
                            _ui.update { it.copy(placesGathering = true, placesAttribution = reply.attribution ?: it.placesAttribution) }
                        }
                    _ui.update {
                        when (result) {
                            is NetworkResult.Success ->
                                if (result.data.loading) {
                                    it.copy(placesLoading = false, placesGathering = false, placesError = PLACES_SLOW)
                                } else {
                                    it.copy(
                                        placesLoading = false,
                                        placesGathering = false,
                                        places = result.data.places,
                                        placesAttribution = result.data.attribution ?: it.placesAttribution,
                                    )
                                }
                            is NetworkResult.Failure ->
                                it.copy(placesLoading = false, placesGathering = false, placesError = placesFailure(result.error))
                        }
                    }
                }
        }

        fun save() {
            val ui = _ui.value
            val start = ui.start ?: return
            val end = ui.end ?: return
            val problem = validate(start, end)
            if (problem != null) {
                _ui.update { it.copy(error = problem) }
                return
            }
            _ui.update { it.copy(saving = true, error = null) }
            viewModelScope.launch {
                val body =
                    UpdatePlanBody(
                        startsAt = start.atZone(ui.zone).toInstant().toString(),
                        endsAt = end.atZone(ui.zone).toInstant().toString(),
                        place =
                            ui.newPlace?.let {
                                PlanPlaceInput(
                                    kind = "public",
                                    name = it.name,
                                    address = it.address,
                                    latitude = it.latitude,
                                    longitude = it.longitude,
                                )
                            },
                    )
                when (val result = repository.update(planId, body)) {
                    is NetworkResult.Success -> _ui.update { it.copy(saving = false, saved = true) }
                    is NetworkResult.Failure -> _ui.update { it.copy(saving = false, error = result.error.planMessage) }
                }
            }
        }

        private fun validate(
            start: LocalDateTime,
            end: LocalDateTime,
        ): String? {
            val now = LocalDateTime.now(_ui.value.zone)
            val minutes = Duration.between(start, end).toMinutes()
            return when {
                start.isBefore(now) -> "Pick a time that hasn't passed."
                start.isAfter(now.plusDays(MAX_DAYS_AHEAD)) -> "Plans can start up to 14 days from now."
                minutes < MIN_MINUTES -> "A plan lasts at least 15 minutes."
                minutes > MAX_MINUTES -> "A plan lasts at most 8 hours."
                else -> null
            }
        }

        private companion object {
            const val MAX_DAYS_AHEAD = 14L
            const val MIN_MINUTES = 15L
            const val MAX_MINUTES = 8 * 60L
            const val SEARCH_DEBOUNCE_MS = 350L
        }
    }
