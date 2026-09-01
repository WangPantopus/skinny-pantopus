package app.pantopus.android.ui.screens.place.messaging

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The verified-neighbor inbox — lists received messages (sender always
 * anonymized) and routes into the D2 detail. The web reaches a single
 * message by deep link; native needs a list to make them browsable.
 * Mirrors the iOS `NeighborMessageInboxViewModel`.
 */
@HiltViewModel
class NeighborMessageInboxViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<NeighborInboxUiState>(NeighborInboxUiState.Loading)
        val state: StateFlow<NeighborInboxUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is NeighborInboxUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = NeighborInboxUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val r = repo.receivedNeighborMessages()) {
                        is NetworkResult.Success ->
                            if (r.data.messages.isEmpty()) {
                                NeighborInboxUiState.Empty
                            } else {
                                NeighborInboxUiState.Loaded(r.data.messages)
                            }
                        is NetworkResult.Failure ->
                            NeighborInboxUiState.Error(
                                "We couldn't load your messages. Check your connection and try again.",
                            )
                    }
            }
        }
    }

sealed interface NeighborInboxUiState {
    data object Loading : NeighborInboxUiState

    data class Loaded(val messages: List<ReceivedNeighborMessage>) : NeighborInboxUiState

    data object Empty : NeighborInboxUiState

    data class Error(val message: String) : NeighborInboxUiState
}
