package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What's public about the address the person saved, under the saved-address root's next step. */
sealed interface SavedPlaceRootUiState {
    data object Loading : SavedPlaceRootUiState

    data class Loaded(val preview: PlacePreview) : SavedPlaceRootUiState

    data object Error : SavedPlaceRootUiState
}

/**
 * Reads the public preview of a saved place (`GET /api/saved-places/:id/preview`): the saved point itself, never a
 * lookup of its label. Keyed per saved place by its screen.
 */
@HiltViewModel
class SavedPlaceRootViewModel
    @Inject
    constructor(
        private val savedPlacesRepository: SavedPlacesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<SavedPlaceRootUiState>(SavedPlaceRootUiState.Loading)
        val state: StateFlow<SavedPlaceRootUiState> = _state.asStateFlow()

        /** A pull (or a section's Try again) while the preview is on screen: the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private var placeId: String? = null
        private var readJob: Job? = null

        /** Binds the screen to a saved place. Coming back keeps the preview that is shown. */
        fun load(placeId: String) {
            if (this.placeId == placeId && _state.value is SavedPlaceRootUiState.Loaded) return
            this.placeId = placeId
            read(placeId)
        }

        /** Pull to refresh and Try again. */
        fun refresh() {
            placeId?.let(::read)
        }

        private fun read(id: String) {
            readJob?.cancel()
            val shown = _state.value is SavedPlaceRootUiState.Loaded
            _refreshing.value = shown
            if (!shown) _state.value = SavedPlaceRootUiState.Loading
            readJob =
                viewModelScope.launch {
                    val result = savedPlacesRepository.preview(id)
                    if (placeId != id) return@launch
                    _refreshing.value = false
                    when (result) {
                        is NetworkResult.Success -> _state.value = SavedPlaceRootUiState.Loaded(result.data)
                        // A failed refresh keeps the preview on screen.
                        is NetworkResult.Failure ->
                            if (_state.value !is SavedPlaceRootUiState.Loaded) _state.value = SavedPlaceRootUiState.Error
                    }
                }
        }
    }
