package app.pantopus.android.ui.screens.crewday.route

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.api.models.crewday.CrewDayRouteDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

sealed interface CrewDayRouteUiState {
    data object Loading : CrewDayRouteUiState

    data class Loaded(val route: CrewDayRouteDto) : CrewDayRouteUiState

    data class Error(val message: String) : CrewDayRouteUiState
}

/**
 * The crew's route (screen 16): `GET /api/crew-days/:id/route?date=`, the homes in the crew's order with what the job
 * window allows. On my way, Running late and a new order write through and read the route again.
 */
@HiltViewModel
class CrewDayRouteViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val crewDayId: String = savedStateHandle.get<String>(CrewDayRoutes.CREW_DAY_ID_KEY).orEmpty()
        private var date: String? = savedStateHandle.get<String>(CrewDayRoutes.DATE_KEY)?.takeIf { it.isNotBlank() }
        private val _state = MutableStateFlow<CrewDayRouteUiState>(CrewDayRouteUiState.Loading)
        val state: StateFlow<CrewDayRouteUiState> = _state.asStateFlow()
        private val _working = MutableStateFlow<Set<String>>(emptySet())
        val working: StateFlow<Set<String>> = _working.asStateFlow()
        private val _notice = MutableStateFlow<String?>(null)
        val notice: StateFlow<String?> = _notice.asStateFlow()

        /** While reordering: the homes in the order being made, saved with [saveOrder]. */
        private val _order = MutableStateFlow<List<CrewDayHomeDto>?>(null)
        val order: StateFlow<List<CrewDayHomeDto>?> = _order.asStateFlow()

        init {
            viewModelScope.launch { repository.changes.drop(1).collect { load() } }
        }

        fun load() {
            viewModelScope.launch {
                when (val result = repository.route(crewDayId, date)) {
                    is NetworkResult.Success -> {
                        date = result.data.date ?: date
                        _state.value = CrewDayRouteUiState.Loaded(result.data)
                    }
                    is NetworkResult.Failure ->
                        if (_state.value !is CrewDayRouteUiState.Loaded) {
                            _state.value = CrewDayRouteUiState.Error(result.error.crewDayMessage)
                        }
                }
            }
        }

        fun retry() {
            _state.value = CrewDayRouteUiState.Loading
            load()
        }

        /** Another date of a day the rain split. */
        fun showDate(next: String) {
            if (next == date) return
            date = next
            _order.value = null
            _state.value = CrewDayRouteUiState.Loading
            load()
        }

        /** "On my way": the household is told the window ([start] to [end]). Again on the way: a new time. */
        fun onMyWay(
            home: CrewDayHomeDto,
            start: Instant,
            end: Instant,
        ) = act(home.id, "We told the household you're on the way.") {
            repository.onTheWay(home.id, start.toString(), end.toString()).also { if (it is NetworkResult.Success) load() }
        }

        /** "Running late": every home still waiting moves back [minutes] and is told. */
        fun runningLate(minutes: Int) {
            if (LATE in _working.value) return
            _working.update { it + LATE }
            viewModelScope.launch {
                val result = repository.runningLate(crewDayId, minutes, date)
                _working.update { it - LATE }
                when (result) {
                    is NetworkResult.Success -> {
                        result.data.route?.let { _state.value = CrewDayRouteUiState.Loaded(it) }
                        val moved = result.data.moved
                        _notice.value = "We told ${if (moved == 1) "1 home" else "$moved homes"} you're running late."
                    }
                    is NetworkResult.Failure -> _notice.value = result.error.crewDayMessage
                }
            }
        }

        fun startReorder() {
            _order.value = (state.value as? CrewDayRouteUiState.Loaded)?.route?.homes
        }

        fun move(
            index: Int,
            delta: Int,
        ) {
            val list = _order.value?.toMutableList() ?: return
            val target = index + delta
            if (target !in list.indices) return
            list.add(target, list.removeAt(index))
            _order.value = list
        }

        fun cancelReorder() {
            _order.value = null
        }

        fun saveOrder() {
            val ids = _order.value?.map { it.id } ?: return
            if (ORDER in _working.value) return
            _working.update { it + ORDER }
            viewModelScope.launch {
                val result = repository.reorder(crewDayId, ids)
                _working.update { it - ORDER }
                when (result) {
                    is NetworkResult.Success -> {
                        _order.value = null
                        _state.value = CrewDayRouteUiState.Loaded(result.data)
                        _notice.value = "Route order saved."
                    }
                    is NetworkResult.Failure -> _notice.value = result.error.crewDayMessage
                }
            }
        }

        fun noticeShown() {
            _notice.value = null
        }

        private fun act(
            key: String,
            done: String,
            block: suspend () -> NetworkResult<*>,
        ) {
            if (key in _working.value) return
            _working.update { it + key }
            viewModelScope.launch {
                val result = block()
                _working.update { it - key }
                _notice.value =
                    when (result) {
                        is NetworkResult.Success -> done
                        is NetworkResult.Failure -> result.error.crewDayMessage
                    }
            }
        }

        companion object {
            const val LATE = "late"
            const val ORDER = "order"
        }
    }
