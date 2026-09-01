package app.pantopus.android.ui.screens.place.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.ui.screens.place.PlaceDetailGroup
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val PLACE_DETAIL_HOME_ID_KEY = "homeId"
const val PLACE_DETAIL_SLUG_KEY = "slug"

/**
 * Container VM for a Place group-detail page (W2.3). Fetches the home's
 * PlaceIntelligence (the dashboard's warm cache) and exposes the four
 * states; the screen extracts the page's sections via [PlaceDetailGroup].
 * Mirrors the iOS `PlaceDetailViewModel`.
 */
@HiltViewModel
class PlaceDetailViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[PLACE_DETAIL_HOME_ID_KEY]) {
                "PlaceDetailViewModel requires a '$PLACE_DETAIL_HOME_ID_KEY' nav arg."
            }
        val group: PlaceDetailGroup =
            PlaceDetailGroup.fromSlug(savedStateHandle[PLACE_DETAIL_SLUG_KEY])
                ?: PlaceDetailGroup.TODAY

        private val _state = MutableStateFlow<PlaceDetailUiState>(PlaceDetailUiState.Loading)
        val state: StateFlow<PlaceDetailUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is PlaceDetailUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = PlaceDetailUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val result = repo.intelligence(homeId)) {
                        is NetworkResult.Success -> PlaceDetailUiState.Loaded(result.data)
                        is NetworkResult.Failure -> PlaceDetailUiState.Error(result.error.displayMessage("Couldn't load this place."))
                    }
            }
        }

        // ── Residency letters (Identity detail, T4) ──────────────

        private val _letters = MutableStateFlow<ResidencyLetterUiState>(ResidencyLetterUiState.Loading)
        val letters: StateFlow<ResidencyLetterUiState> = _letters.asStateFlow()

        private val _isIssuing = MutableStateFlow(false)
        val isIssuing: StateFlow<Boolean> = _isIssuing.asStateFlow()

        fun loadLetters() {
            viewModelScope.launch {
                _letters.value =
                    when (val r = repo.residencyLetters(homeId)) {
                        is NetworkResult.Success -> ResidencyLetterUiState.Loaded(r.data.letters)
                        is NetworkResult.Failure -> ResidencyLetterUiState.Error(r.error.message)
                    }
            }
        }

        fun issueLetter(purpose: String) {
            if (purpose.isBlank()) return
            viewModelScope.launch {
                _isIssuing.value = true
                repo.issueResidencyLetter(homeId, purpose)
                _isIssuing.value = false
                loadLetters()
            }
        }

        fun revokeLetter(letterId: String) {
            viewModelScope.launch {
                repo.revokeResidencyLetter(homeId, letterId)
                loadLetters()
            }
        }
    }

sealed interface ResidencyLetterUiState {
    data object Loading : ResidencyLetterUiState

    data class Loaded(val letters: List<app.pantopus.android.data.api.models.place.ResidencyLetter>) : ResidencyLetterUiState

    data class Error(val message: String) : ResidencyLetterUiState
}

sealed interface PlaceDetailUiState {
    data object Loading : PlaceDetailUiState

    data class Loaded(val intelligence: PlaceIntelligence) : PlaceDetailUiState

    data class Error(val message: String) : PlaceDetailUiState
}

/** Sections that belong to this detail page, in contract order. */
fun PlaceIntelligence.sectionsFor(group: PlaceDetailGroup): List<PlaceSectionEnvelope> {
    val groups = group.groups.toSet()
    return groups.let { gs -> this.groups.filter { it.groupId in gs }.flatMap { it.sections } }
}

/** Find a single section across the payload. */
fun PlaceIntelligence.section(id: PlaceSectionId): PlaceSectionEnvelope? = groups.flatMap { it.sections }.firstOrNull { it.sectionId == id }
