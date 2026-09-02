package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.place.PlaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the Place dashboard (C1 verified / C1a claimed). Fetches the
 * living section-envelope payload for a home and exposes the four render
 * states. The home id arrives via [load] (the Home-tab landing renders
 * this screen inline, so there is no nav-arg SavedStateHandle). Mirrors
 * the iOS `PlaceDashboardViewModel`.
 */
@HiltViewModel
class PlaceDashboardViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        private val homesRepository: HomesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PlaceDashboardUiState>(PlaceDashboardUiState.Loading)
        val state: StateFlow<PlaceDashboardUiState> = _state.asStateFlow()

        private var homeId: String? = null

        /** Bind the screen to a home; idempotent once loaded for that home. */
        fun load(homeId: String) {
            if (this.homeId == homeId && _state.value is PlaceDashboardUiState.Loaded) return
            this.homeId = homeId
            refresh()
        }

        fun refresh() {
            val id = homeId ?: return
            _state.value = PlaceDashboardUiState.Loading
            viewModelScope.launch { fetch(id) }
        }

        private suspend fun fetch(id: String) {
            // The home row rides alongside the intelligence for the one field
            // the dashboard needs from it (move_in_date → the movers card);
            // a failure there never blocks the page.
            val intelligence = viewModelScope.async { repo.intelligence(id) }
            val detail = viewModelScope.async { homesRepository.detail(id) }
            val intelligenceResult = intelligence.await()
            val moveInDate = (detail.await() as? NetworkResult.Success)?.data?.home?.moveInDate
            _state.value =
                when (intelligenceResult) {
                    is NetworkResult.Success -> PlaceDashboardUiState.Loaded(intelligenceResult.data, moveInDate)
                    is NetworkResult.Failure ->
                        PlaceDashboardUiState.Error(intelligenceResult.error.displayMessage("Couldn't load your dashboard."))
                }
        }
    }

sealed interface PlaceDashboardUiState {
    data object Loading : PlaceDashboardUiState

    data class Loaded(
        val intelligence: PlaceIntelligence,
        /** Wedge v2 D5: the movers card shows for ~60 days after this. */
        val moveInDate: String? = null,
    ) : PlaceDashboardUiState

    data class Error(val message: String) : PlaceDashboardUiState
}
