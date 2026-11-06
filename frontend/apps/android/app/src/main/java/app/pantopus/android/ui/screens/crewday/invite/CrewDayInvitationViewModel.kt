package app.pantopus.android.ui.screens.crewday.invite

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayCode
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface CrewDayInvitationUiState {
    data object Loading : CrewDayInvitationUiState

    /** An unknown code, a day Pantopus hasn't approved, or Crew Day off on the server. */
    data object Unavailable : CrewDayInvitationUiState

    data class Loaded(val day: CrewDayPublicDto) : CrewDayInvitationUiState

    data class Error(val message: String) : CrewDayInvitationUiState
}

/** The invitation (screen 1): `GET /api/crew-days/public/:code`, read again after a booking from it. */
@HiltViewModel
class CrewDayInvitationViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val code: String = savedStateHandle.get<String>(CrewDayRoutes.CODE_KEY).orEmpty()
        private val _state = MutableStateFlow<CrewDayInvitationUiState>(CrewDayInvitationUiState.Loading)
        val state: StateFlow<CrewDayInvitationUiState> = _state.asStateFlow()

        init {
            viewModelScope.launch { repository.changes.drop(1).collect { load() } }
        }

        fun load() {
            viewModelScope.launch {
                when (val result = repository.invitation(code)) {
                    is NetworkResult.Success -> _state.value = CrewDayInvitationUiState.Loaded(result.data)
                    is NetworkResult.Failure ->
                        when (result.error.crewDayCode) {
                            "NOT_FOUND", "CREW_DAY_UNAVAILABLE" -> _state.value = CrewDayInvitationUiState.Unavailable
                            else ->
                                if (_state.value !is CrewDayInvitationUiState.Loaded) {
                                    _state.value = CrewDayInvitationUiState.Error(result.error.crewDayMessage)
                                }
                        }
                }
            }
        }

        fun retry() {
            _state.value = CrewDayInvitationUiState.Loading
            load()
        }
    }
