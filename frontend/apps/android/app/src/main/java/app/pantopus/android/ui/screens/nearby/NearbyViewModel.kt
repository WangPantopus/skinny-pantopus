package app.pantopus.android.ui.screens.nearby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.neighborhood.NeighborhoodRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Nearby (Wedge v2 D2 / §4): the meter decides the door; the cells
 * window is alive whatever the meter says, once there is a place.
 * The window failing never takes the meter down.
 */
@HiltViewModel
class NearbyViewModel
    @Inject
    constructor(
        private val repository: NeighborhoodRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<NearbyUiState>(NearbyUiState.Loading)
        val state: StateFlow<NearbyUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is NearbyUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = NearbyUiState.Loading
            viewModelScope.launch {
                val meter = viewModelScope.async { repository.meter() }
                val cells = viewModelScope.async { repository.cells() }
                val meterResult = meter.await()
                val cellsResult = cells.await()
                _state.value =
                    when (meterResult) {
                        is NetworkResult.Success ->
                            NearbyUiState.Loaded(
                                meter = meterResult.data,
                                cells = (cellsResult as? NetworkResult.Success)?.data?.takeIf { it.state == "ready" },
                            )
                        is NetworkResult.Failure ->
                            NearbyUiState.Error(meterResult.error.displayMessage("We couldn't load your neighborhood meter."))
                    }
            }
        }
    }

sealed interface NearbyUiState {
    data object Loading : NearbyUiState

    data class Loaded(
        val meter: NeighborhoodMeter,
        /** Null when there is no place or the window failed; the meter still renders. */
        val cells: NeighborhoodCells?,
    ) : NearbyUiState

    data class Error(val message: String) : NearbyUiState
}
