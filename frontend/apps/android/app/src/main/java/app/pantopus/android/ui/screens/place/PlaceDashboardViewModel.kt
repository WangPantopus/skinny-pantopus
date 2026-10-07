package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.notifications.personalBellCount
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.notifications.NotificationsRepository
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
        private val notificationsRepo: NotificationsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PlaceDashboardUiState>(PlaceDashboardUiState.Loading)
        val state: StateFlow<PlaceDashboardUiState> = _state.asStateFlow()

        private val _unreadCount = MutableStateFlow(0)

        /** Unread personal notifications, the Hub bell's count; the header bell shows a dot above zero. */
        val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

        private var homeId: String? = null

        /** Set when a verification flow starts, so coming back reloads instead of showing the old state. */
        private var reloadPending = false

        /**
         * Bind the screen to a home; idempotent once loaded for that home,
         * unless a verification flow started from here since.
         */
        fun load(homeId: String) {
            if (this.homeId == homeId && _state.value is PlaceDashboardUiState.Loaded && !reloadPending) return
            reloadPending = false
            this.homeId = homeId
            refresh()
        }

        /** A verification flow is opening on top; reload when the dashboard shows again. */
        fun reloadOnReturn() {
            reloadPending = true
        }

        fun refresh() {
            val id = homeId ?: return
            _state.value = PlaceDashboardUiState.Loading
            viewModelScope.launch { fetch(id) }
        }

        /**
         * Re-read the bell's count whenever the dashboard shows again (for
         * example after the user read their notifications). A failed read
         * keeps the last count.
         */
        fun refreshUnread() {
            viewModelScope.launch {
                val unread = (notificationsRepo.unreadCount() as? NetworkResult.Success)?.data ?: return@launch
                _unreadCount.value = unread.personalBellCount
            }
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
                        PlaceDashboardUiState.Error(
                            intelligenceResult.error.displayMessage("Couldn't load your dashboard."),
                            denied = intelligenceResult.error is NetworkError.Forbidden,
                            unavailable =
                                intelligenceResult.error is NetworkError.Forbidden ||
                                    intelligenceResult.error is NetworkError.NotFound,
                        )
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

    /**
     * [denied]: the server refused this account the place (403), so a retry can't change it.
     * [unavailable]: refused or gone (403/404), e.g. after leaving the Home; the Place tab moves on.
     */
    data class Error(
        val message: String,
        val denied: Boolean = false,
        val unavailable: Boolean = false,
    ) : PlaceDashboardUiState
}
