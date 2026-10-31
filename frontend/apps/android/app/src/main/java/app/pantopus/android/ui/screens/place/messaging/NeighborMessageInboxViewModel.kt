package app.pantopus.android.ui.screens.place.messaging

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
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

        /** A pull is reading again while the list stays on screen. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private var readJob: Job? = null

        /**
         * Showing the inbox. Coming back from a message keeps the list on screen and reads it again, so the message just
         * read loses its unread dot; only a first visit shows the loading rows.
         */
        fun load() {
            if (_state.value is NeighborInboxUiState.Loaded || _state.value == NeighborInboxUiState.Empty) {
                read()
            } else {
                refresh()
            }
        }

        /** Retry: the loading rows, then the list. */
        fun refresh() {
            _state.value = NeighborInboxUiState.Loading
            read()
        }

        /** Pull to refresh: the list stays while it reads. */
        fun pullToRefresh() {
            _refreshing.value = true
            read()
        }

        private fun read() {
            readJob?.cancel()
            readJob =
                viewModelScope.launch {
                    when (val r = repo.receivedNeighborMessages()) {
                        is NetworkResult.Success ->
                            _state.value =
                                if (r.data.messages.isEmpty()) {
                                    NeighborInboxUiState.Empty
                                } else {
                                    NeighborInboxUiState.Loaded(r.data.messages)
                                }
                        // A failed re-read keeps the list (or the empty inbox) that is on screen.
                        is NetworkResult.Failure ->
                            if (_state.value !is NeighborInboxUiState.Loaded && _state.value != NeighborInboxUiState.Empty) {
                                _state.value =
                                    NeighborInboxUiState.Error(
                                        "We couldn't load your messages. Check your connection and try again.",
                                    )
                            }
                    }
                    _refreshing.value = false
                }
        }
    }

sealed interface NeighborInboxUiState {
    data object Loading : NeighborInboxUiState

    data class Loaded(val messages: List<ReceivedNeighborMessage>) : NeighborInboxUiState

    data object Empty : NeighborInboxUiState

    data class Error(val message: String) : NeighborInboxUiState
}
