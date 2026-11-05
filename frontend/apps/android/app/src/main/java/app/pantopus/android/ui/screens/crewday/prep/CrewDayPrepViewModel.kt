package app.pantopus.android.ui.screens.crewday.prep

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayCrewViewDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface CrewDayPrepUiState {
    data object Loading : CrewDayPrepUiState

    data class Loaded(val view: CrewDayCrewViewDto) : CrewDayPrepUiState

    data class Error(val message: String) : CrewDayPrepUiState
}

/**
 * The crew's day before it starts (screen 15): `GET /api/crew-days/:id/crew`, the price checks and release asks it
 * answers, inviting past customers, sending a draft for approval and cancelling the day. The day itself (16) and
 * after it (19) are the same read.
 */
@HiltViewModel
class CrewDayPrepViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val crewDayId: String = savedStateHandle.get<String>(CrewDayRoutes.CREW_DAY_ID_KEY).orEmpty()
        private val _state = MutableStateFlow<CrewDayPrepUiState>(CrewDayPrepUiState.Loading)
        val state: StateFlow<CrewDayPrepUiState> = _state.asStateFlow()

        /** Writes in flight, by booking id (or `day` for the day's own). */
        private val _working = MutableStateFlow<Set<String>>(emptySet())
        val working: StateFlow<Set<String>> = _working.asStateFlow()
        private val _notice = MutableStateFlow<String?>(null)
        val notice: StateFlow<String?> = _notice.asStateFlow()

        fun load() {
            viewModelScope.launch {
                when (val result = repository.crewDay(crewDayId)) {
                    is NetworkResult.Success -> _state.value = CrewDayPrepUiState.Loaded(result.data)
                    is NetworkResult.Failure ->
                        if (_state.value !is CrewDayPrepUiState.Loaded) _state.value = CrewDayPrepUiState.Error(result.error.crewDayMessage)
                }
            }
        }

        fun retry() {
            _state.value = CrewDayPrepUiState.Loading
            load()
        }

        /** "Set price" on a look-first home. */
        fun setPrice(
            bookingId: String,
            cents: Int,
        ) = act(bookingId, "We sent the household its price.") { repository.setPrice(crewDayId, bookingId, cents) }

        /** "Can't take it": the home is declined, at no charge. */
        fun decline(
            bookingId: String,
            note: String?,
        ) = act(bookingId, "We told the household you can't take this home.") { repository.declineHome(crewDayId, bookingId, note) }

        /** "Release at no charge" for a household that asked inside the cutoff. */
        fun release(bookingId: String) =
            act(bookingId, "The home is released. Nobody is charged.") { repository.release(crewDayId, bookingId) }

        fun invitePast() {
            if (DAY in _working.value) return
            _working.update { it + DAY }
            viewModelScope.launch {
                val result = repository.invitePast(crewDayId)
                _working.update { it - DAY }
                _notice.value =
                    when (result) {
                        is NetworkResult.Success ->
                            when (val invited = result.data) {
                                0 -> "Everyone you served nearby is already invited."
                                1 -> "We invited 1 home you served."
                                else -> "We invited $invited homes you served."
                            }
                        is NetworkResult.Failure -> result.error.crewDayMessage
                    }
                load()
            }
        }

        /** A draft (or a declined day, changed) goes to Pantopus for approval. */
        fun submit() = act(DAY, "Sent to Pantopus. We'll tell you within a business day.") { repository.submit(crewDayId) }

        fun cancelDay(reason: String?) =
            act(DAY, "The Crew Day is cancelled. Nobody is charged.") { repository.cancelDay(crewDayId, reason) }

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
                load()
            }
        }

        companion object {
            /** The working key for writes to the day itself. */
            const val DAY = "day"
        }
    }
