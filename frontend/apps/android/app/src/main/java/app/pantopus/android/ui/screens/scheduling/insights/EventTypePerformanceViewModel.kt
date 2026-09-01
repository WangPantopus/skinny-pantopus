@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject
import kotlin.math.max

/**
 * H10 Per-Event-Type Performance (A17). Drills into one event type's funnel +
 * stats, derived from its bookings over the window plus the event-type header
 * (name / duration / price). Because the A0 route is arg-less, the screen owns
 * an in-screen event-type selector; the H9 dashboard pre-selects a type via
 * [InsightsNavRelay]. Loaded / empty (never booked) / no-types / loading / error.
 *
 * Wiring: `GET /event-types` (header + selector) + `GET /bookings?event_type_id&
 * from&to` (the funnel/stat aggregation). Page-views are not in the backend, so
 * the funnel starts at Booked rather than fabricating a views step.
 */
@HiltViewModel
class EventTypePerformanceViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val relay: InsightsNavRelay,
    ) : ViewModel() {
        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var started = false
        private var eventTypes: List<EventTypeDto> = emptyList()

        private val _filter = MutableStateFlow(InsightsFilter.Default)
        val filter: StateFlow<InsightsFilter> = _filter.asStateFlow()

        private val _typeOptions = MutableStateFlow<List<InsightsFilterOption>>(emptyList())
        val typeOptions: StateFlow<List<InsightsFilterOption>> = _typeOptions.asStateFlow()

        private val _selectedId = MutableStateFlow<String?>(null)
        val selectedId: StateFlow<String?> = _selectedId.asStateFlow()

        private val _state = MutableStateFlow<PerfUiState>(PerfUiState.Loading)
        val state: StateFlow<PerfUiState> = _state.asStateFlow()

        val pillar: SchedulingPillar get() = owner.pillar()

        fun start() {
            if (started) return
            started = true
            owner = relay.consumeOwner() ?: SchedulingOwner.Personal
            val pendingId = relay.consumeEventTypeId()
            loadTypes(pendingId)
        }

        fun refresh() = loadTypes(_selectedId.value)

        fun apply(newFilter: InsightsFilter) {
            _filter.value = newFilter
            _selectedId.value?.let { loadBookings(it) }
        }

        fun selectType(id: String) {
            if (id == _selectedId.value) return
            _selectedId.value = id
            loadBookings(id)
        }

        private fun loadTypes(preferredId: String?) {
            _state.value = PerfUiState.Loading
            viewModelScope.launch {
                when (val typesResult = repo.getEventTypes(owner)) {
                    is NetworkResult.Success -> {
                        eventTypes = typesResult.data.eventTypes
                        if (eventTypes.isEmpty()) {
                            _state.value = PerfUiState.NoTypes
                            return@launch
                        }
                        _typeOptions.value = eventTypes.map { InsightsFilterOption(it.id, it.name) }
                        val chosen = eventTypes.firstOrNull { it.id == preferredId }?.id ?: eventTypes.first().id
                        _selectedId.value = chosen
                        loadBookings(chosen)
                    }
                    is NetworkResult.Failure -> {
                        _state.value = PerfUiState.Error(errors.decode(typesResult.error).display())
                    }
                }
            }
        }

        private var bookingsJob: Job? = null

        private fun loadBookings(id: String) {
            val type = eventTypes.firstOrNull { it.id == id } ?: return
            _state.value = PerfUiState.Loading
            // Cancel the in-flight fetch: rapid type switches must not let an
            // older (slower) response land last and show type A's stats under
            // type B's selection.
            bookingsJob?.cancel()
            bookingsJob =
                viewModelScope.launch {
                    val range = _filter.value.range()
                    val bookings =
                        repo.getBookings(owner, eventTypeId = id, from = range.first, to = range.second)
                            .dataOrNull()?.bookings.orEmpty()
                    // Guard the final assignment against a selection change that
                    // happened while the fetch was in flight.
                    if (_selectedId.value == id) {
                        _state.value = project(type, bookings)
                    }
                }
        }

        private fun project(
            type: EventTypeDto,
            bookings: List<BookingDto>,
        ): PerfUiState {
            val header =
                PerfHeader(
                    name = type.name,
                    durationLabel = InsightsFormat.duration(type.defaultDuration ?: type.durations.firstOrNull()),
                    priceLabel = MoneyAndFlag.formatPrice(type.priceCents, type.currency),
                )
            if (bookings.isEmpty()) return PerfUiState.EmptyType(header)

            val perf = InsightsMath.eventTypePerf(bookings)
            val booked = max(perf.booked, 1)
            val funnel =
                listOf(
                    FunnelStep("booked", "Booked", perf.booked, 1.0, null),
                    FunnelStep(
                        "completed",
                        "Completed",
                        perf.completed,
                        perf.completed.toDouble() / booked,
                        InsightsFormat.percentFraction(perf.completed.toDouble() / booked),
                    ),
                    FunnelStep(
                        "noshow",
                        "No-show",
                        perf.noShow,
                        perf.noShow.toDouble() / booked,
                        InsightsFormat.percentFraction(perf.noShow.toDouble() / booked),
                    ),
                )
            val tiles =
                listOf(
                    MetricTile("booked", "Booked", "${perf.booked}"),
                    MetricTile("completed", "Completed", "${perf.completed}"),
                    MetricTile("completion", "Completion", InsightsFormat.percent(perf.completionRate)),
                    MetricTile("noshow", "No-show", InsightsFormat.percent(perf.noShowRate)),
                )
            return PerfUiState.Loaded(
                PerfData(
                    header = header,
                    tiles = tiles,
                    funnel = funnel,
                    dayBars = InsightsMath.dailyBars(bookings, ZoneId.systemDefault(), _filter.value.days(), maxBars = 14),
                    hasTrend = bookings.size >= 3,
                ),
            )
        }

        fun editorRoute(): String = SchedulingRoutes.eventTypeEditor(_selectedId.value.orEmpty())

        fun bookingPageRoute(): String = SchedulingRoutes.bookingPageManage(owner.routeKind, owner.ownerRouteId)

        private fun SchedulingError.display(): String =
            when (this) {
                is SchedulingError.Secret -> "You don't have access to this performance report."
                is SchedulingError.Generic -> message
                else -> "Couldn't load performance."
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data
    }

/** Header for the selected event type. */
data class PerfHeader(
    val name: String,
    val durationLabel: String,
    val priceLabel: String,
)

/** One funnel step (Booked → Completed → No-show). */
data class FunnelStep(
    val id: String,
    val label: String,
    val count: Int,
    val proportion: Double,
    val percent: String?,
)

/** Everything the H10 screen renders once a booked type is loaded. */
data class PerfData(
    val header: PerfHeader,
    val tiles: List<MetricTile>,
    val funnel: List<FunnelStep>,
    val dayBars: List<DayBar>,
    val hasTrend: Boolean,
)

sealed interface PerfUiState {
    data object Loading : PerfUiState

    /** The owner has no event types at all. */
    data object NoTypes : PerfUiState

    /** A type is selected but it was never booked in this window. */
    data class EmptyType(val header: PerfHeader) : PerfUiState

    data class Loaded(val data: PerfData) : PerfUiState

    data class Error(val message: String) : PerfUiState
}
