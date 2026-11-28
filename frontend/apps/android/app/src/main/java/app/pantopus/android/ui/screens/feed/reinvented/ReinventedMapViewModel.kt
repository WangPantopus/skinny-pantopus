package app.pantopus.android.ui.screens.feed.reinvented

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentGuessSpotDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.models.plans.PlanPinDto
import app.pantopus.android.data.api.models.reinvented.ReinventedKeptDto
import app.pantopus.android.data.api.models.reinvented.ReinventedMarkDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.data.pulse.ReinventedFilterQuery
import app.pantopus.android.data.pulse.ReinventedPoint
import app.pantopus.android.data.pulse.ReinventedRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** One thing on the one map: a ring is a Moment, a mark a post that stays (a kept Moment too), a ticket a plan. */
sealed interface ReinventedMapItem {
    val id: String
    val latitude: Double
    val longitude: Double

    data class Ring(
        val ring: MomentRingDto,
    ) : ReinventedMapItem {
        override val id: String get() = "ring-${ring.id}"
        override val latitude: Double get() = ring.latitude
        override val longitude: Double get() = ring.longitude
    }

    data class Mark(
        val mark: ReinventedMarkDto,
    ) : ReinventedMapItem {
        override val id: String get() = "mark-${mark.id}"
        override val latitude: Double get() = mark.latitude
        override val longitude: Double get() = mark.longitude
    }

    data class Kept(
        val kept: ReinventedKeptDto,
    ) : ReinventedMapItem {
        override val id: String get() = "kept-${kept.id}"
        override val latitude: Double get() = kept.latitude
        override val longitude: Double get() = kept.longitude
    }

    data class Ticket(
        val ticket: PlanPinDto,
        override val latitude: Double,
        override val longitude: Double,
    ) : ReinventedMapItem {
        override val id: String get() = "ticket-${ticket.id}"
    }

    /** A Heads-up: red, pulsing and always on top. */
    val headsUp: Boolean get() = this is Mark && mark.headsUp
}

/** What the one map shows. */
data class ReinventedMapState(
    /** Where the map opens: the phone's place, else the person's home; null until known. */
    val center: ReinventedPoint? = null,
    val time: String = LIVE,
    val items: List<ReinventedMapItem> = emptyList(),
    /** The peek deck's cards: Heads-ups first, then what was nearest the map's middle when each first came. */
    val deck: List<ReinventedMapItem> = emptyList(),
    /** The card the deck shows, and the pin it lights. */
    val focused: String? = null,
    /** Guess the spot in the area (CONTRACT 5d): a list under the time row, never marks. */
    val guessSpots: List<MomentGuessSpotDto> = emptyList(),
    /** Rings float on the living map (phase 4, `feed/living/LivingMap.kt`): the answer said `heights_on` and `float_on`. */
    val floats: Boolean = false,
    /** My Atlas's map (the person's own kept Moments): no live beams on it (phase 4). */
    val atlas: Boolean = false,
) {
    /** Heads-ups last, so they draw over everything else. */
    val drawOrder: List<ReinventedMapItem> get() = items.filterNot { it.headsUp } + items.filter { it.headsUp }

    companion object {
        const val LIVE = "live"
    }
}

/**
 * "Pulse, reinvented" phase 1, the one map (PHASE-1 §2 piece 7, board B4 flat; CONTRACT 6b), behind the list and full
 * screen at the Map height: `GET /api/reinvented/map` for the box in view and a time. Nothing is read before the list's
 * first page has arrived ([allow]), so the map never competes with what opens the tab; then each box is read once the
 * map has been still a moment.
 */
@HiltViewModel
class ReinventedMapViewModel
    @Inject
    constructor(
        private val repository: ReinventedRepository,
        private val location: LocationProvider,
        private val places: PlanLocationResolver,
    ) : ViewModel() {
        private val _state = MutableStateFlow(ReinventedMapState())
        val state: StateFlow<ReinventedMapState> = _state.asStateFlow()

        private val _flight = MutableStateFlow<ReinventedFlight?>(null)

        /** Where the map glides next (a card swiped to, a place tapped in the list); the screen moves the camera. */
        val flight: StateFlow<ReinventedFlight?> = _flight.asStateFlow()
        private var flights = 0

        private var allowed = false
        private var box: ReinventedBox? = null
        private var reading: Job? = null

        /** PHASE-5 B, the filters while any is on (CONTRACT 10a, no `when`); null reads the map exactly as before. */
        private var filters: ReinventedFilterQuery? = null

        init {
            // The phone's place, when it already has one, without waiting: the map opens there.
            location.cachedCoordinate()?.let { fix -> _state.update { it.copy(center = ReinventedPoint(fix.latitude, fix.longitude)) } }
        }

        /** The list's first page arrived: the map may read now, and finds the home to open on if it has no place yet. */
        fun allow() {
            if (allowed) return
            allowed = true
            if (_state.value.center == null) {
                viewModelScope.launch {
                    val home = places.home() ?: return@launch
                    _state.update { it.copy(center = it.center ?: ReinventedPoint(home.latitude, home.longitude)) }
                }
            }
            readSoon(waitMs = 0L)
        }

        /** The map settled on a box. */
        fun moved(next: ReinventedBox) {
            if (next == box) return
            box = next
            readSoon(waitMs = SETTLE_MS)
        }

        /** The time row's choice: back (Live, Today, This week, All time) or forward (Tonight, This weekend). */
        fun pickTime(time: String) {
            if (time == _state.value.time) return
            _state.update { it.copy(time = time) }
            readSoon(waitMs = 0L)
        }

        /** Read again (a pull on the list, coming back to the tab). */
        fun refresh() = readSoon(waitMs = 0L)

        /** The filters changed (PHASE-5 B): the map reads again with them. */
        fun filter(query: ReinventedFilterQuery?) {
            if (query == filters) return
            filters = query
            readSoon(waitMs = 0L)
        }

        /** The deck moved to [item]: its pin lights and the map glides to it. */
        fun focus(item: ReinventedMapItem) {
            _state.update { it.copy(focused = item.id) }
            flyTo(ReinventedPoint(item.latitude, item.longitude))
        }

        /** Glides the map to a place (a card's place, a pin the deck moved to). */
        fun flyTo(point: ReinventedPoint) {
            flights += 1
            _flight.value = ReinventedFlight(point, flights)
        }

        private fun readSoon(waitMs: Long) {
            if (!allowed) return
            val area = box ?: return
            reading?.cancel()
            reading =
                viewModelScope.launch {
                    if (waitMs > 0) delay(waitMs)
                    val time = _state.value.time
                    val answer = repository.map(area, time, filters) as? NetworkResult.Success ?: return@launch
                    val map = answer.data
                    val items =
                        map.rings.filterNot { it.noLocation }.map(ReinventedMapItem::Ring) +
                            map.marks.map(ReinventedMapItem::Mark) +
                            map.kept.map(ReinventedMapItem::Kept) +
                            map.tickets.mapNotNull { ticket ->
                                val lat = ticket.latitude ?: return@mapNotNull null
                                val lng = ticket.longitude ?: return@mapNotNull null
                                ReinventedMapItem.Ticket(ticket, lat, lng)
                            }
                    val spots = map.guessSpots.filter { it.momentId != null }
                    _state.update {
                        if (it.time == time) {
                            it.copy(
                                items = items,
                                deck = arrange(it.deck, items, area),
                                guessSpots = spots,
                                floats = map.heightsOn && map.floatOn,
                            )
                        } else {
                            it
                        }
                    }
                }
        }

        private companion object {
            const val SETTLE_MS = 350L
        }
    }

/** One glide of the map; [serial] tells two glides to the same place apart. */
data class ReinventedFlight(
    val point: ReinventedPoint,
    val serial: Int,
)

/**
 * The deck's cards: those already in it keep their places (swiping moves the map, which reads again, and must never
 * reshuffle what is under the thumb), then the new ones, Heads-ups first and the rest nearest the box's middle first.
 */
internal fun arrange(
    deck: List<ReinventedMapItem>,
    items: List<ReinventedMapItem>,
    box: ReinventedBox,
): List<ReinventedMapItem> {
    val byId = items.associateBy { it.id }
    val kept = deck.mapNotNull { byId[it.id] }
    val keptIds = kept.mapTo(mutableSetOf()) { it.id }
    val middleLat = (box.south + box.north) / 2
    val middleLng = (box.west + box.east) / 2
    val fresh =
        items
            .filterNot { it.id in keptIds }
            .sortedWith(
                compareByDescending<ReinventedMapItem> { it.headsUp }
                    .thenBy { squared(it.latitude - middleLat) + squared(it.longitude - middleLng) },
            )
    return kept + fresh
}

private fun squared(value: Double): Double = value * value
