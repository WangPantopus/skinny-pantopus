package app.pantopus.android.ui.screens.place.privacy

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.identity.HomeMirrorDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.identity.IdentityCenterRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val PRIVACY_MIRROR_HOME_ID_KEY = "homeId"

/** The four lines of the promise, verbatim from the web `PrivacyPromise`. */
val PRIVACY_PROMISE_LINES: List<String> =
    listOf(
        "Neighbors see a first name and a street at most. Never a house number or unit.",
        "We never sell your address or use it for ads.",
        "Verifying never asks for your GPS. It works by mail, a landlord, or a document you choose.",
        "Verification documents are seen by one reviewer, never by neighbors, and deleted once your claim is decided.",
    )

/**
 * The privacy mirror (Wedge v2 §2): the member's home exactly as a
 * neighbor outside the household sees it, from the real serializer.
 */
@HiltViewModel
class PlacePrivacyMirrorViewModel
    @Inject
    constructor(
        private val repository: IdentityCenterRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[PRIVACY_MIRROR_HOME_ID_KEY]) {
                "PlacePrivacyMirrorViewModel requires a '$PRIVACY_MIRROR_HOME_ID_KEY' nav arg."
            }
        private val _state = MutableStateFlow<PrivacyMirrorUiState>(PrivacyMirrorUiState.Loading)
        val state: StateFlow<PrivacyMirrorUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is PrivacyMirrorUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = PrivacyMirrorUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val r = repository.homeMirror(homeId)) {
                        is NetworkResult.Success -> PrivacyMirrorUiState.Loaded(r.data)
                        is NetworkResult.Failure ->
                            PrivacyMirrorUiState.Error("We couldn't load the preview. Only a member of this home can see it.")
                    }
            }
        }
    }

sealed interface PrivacyMirrorUiState {
    data object Loading : PrivacyMirrorUiState

    data class Loaded(val mirror: HomeMirrorDto) : PrivacyMirrorUiState

    data class Error(val message: String) : PrivacyMirrorUiState
}
