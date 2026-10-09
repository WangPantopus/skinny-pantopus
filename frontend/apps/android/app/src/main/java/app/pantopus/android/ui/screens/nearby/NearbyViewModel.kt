package app.pantopus.android.ui.screens.nearby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
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

        /**
         * Tab entry and every return (Instant Screens): what's on screen stays and is read again quietly once the
         * store says it is out of date (2 minutes). A first entry shows the stored meter and cells at once.
         */
        fun load() {
            if (_state.value is NearbyUiState.Loaded) {
                if (!repository.isCurrent()) read(force = false)
                return
            }
            repository.meterCopy()?.let { _state.value = NearbyUiState.Loaded(it, repository.cellsCopy()?.takeIf(::isReady)) }
            read(force = false)
        }

        /** Retry: read now. The skeleton shows only when nothing is on screen. */
        fun refresh() {
            if (_state.value !is NearbyUiState.Loaded) _state.value = NearbyUiState.Loading
            read(force = true)
        }

        private fun read(force: Boolean) {
            viewModelScope.launch {
                val meter = viewModelScope.async { repository.meterStored(force) }
                val cells = viewModelScope.async { repository.cellsStored(force) }
                val meterStored = meter.await()
                val cellsStored = cells.await()
                val data = meterStored.data
                when {
                    data != null -> _state.value = NearbyUiState.Loaded(meter = data, cells = cellsStored.data?.takeIf(::isReady))
                    // A failed read keeps what's on screen; only an empty screen shows the error.
                    _state.value !is NearbyUiState.Loaded ->
                        _state.value =
                            NearbyUiState.Error(
                                meterStored.failure?.displayMessage("We couldn't load your neighborhood meter.")
                                    ?: "We couldn't load your neighborhood meter.",
                            )
                }
            }
        }

        private fun isReady(cells: NeighborhoodCells): Boolean = cells.state == "ready"
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
