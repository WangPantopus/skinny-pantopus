package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.showsCopyBeforeRecheck
import app.pantopus.android.data.api.models.notifications.personalBellCount
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
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
        private val notificationsRepo: NotificationsRepository,
        private val homesRepo: HomesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PlaceDashboardUiState>(PlaceDashboardUiState.Loading)
        val state: StateFlow<PlaceDashboardUiState> = _state.asStateFlow()

        private val _unreadCount = MutableStateFlow(0)

        /** Unread personal notifications, the Hub bell's count; the header bell shows a dot above zero. */
        val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

        /** A pull or Retry is reading while the dashboard stays on screen: the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past a day old. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        private var homeId: String? = null
        private var readJob: Job? = null

        /** Set when a verification flow starts, so coming back reads the dashboard again. */
        private var reloadPending = false

        /**
         * Binds the screen to a home (Instant Screens). Coming back keeps what's on screen and reads only when the
         * store says the Place is out of date. A first entry shows the stored copy at once to owners and household
         * roles (founder decision 3); everyone else waits for the server.
         */
        fun load(homeId: String) {
            val shown = (_state.value as? PlaceDashboardUiState.Loaded)?.takeIf { this.homeId == homeId }
            this.homeId = homeId
            refreshUnread()
            when {
                shown != null && reloadPending -> read(homeId, force = true)
                shown != null -> if (!repo.placeIsCurrent(homeId)) read(homeId, force = false)
                else -> {
                    val copy = repo.placeCopy(homeId)?.takeIf { showsBeforeRecheck(homeId, it) }
                    _state.value = copy?.let { PlaceDashboardUiState.Loaded(it, it.moveInDate) } ?: PlaceDashboardUiState.Loading
                    read(homeId, force = copy == null && repo.placeCopy(homeId) != null)
                }
            }
            reloadPending = false
        }

        /** A verification flow is opening on top; reload when the dashboard shows again. */
        fun reloadOnReturn() {
            reloadPending = true
        }

        /** Pull to refresh and Retry: read now, keeping the dashboard on screen. */
        fun refresh() {
            val id = homeId ?: return
            read(id, force = true)
            refreshUnread()
        }

        /** Re-read the bell's count with every load and refresh. A failed read keeps the last count. */
        private fun refreshUnread() {
            viewModelScope.launch {
                val unread = (notificationsRepo.unreadCount() as? NetworkResult.Success)?.data ?: return@launch
                _unreadCount.value = unread.personalBellCount
            }
        }

        /** Founder decision 3: My Homes says the viewer is an owner or household role here, with open-ended access. */
        private fun householdViewer(homeId: String): Boolean =
            homesRepo.myHomesCopy()?.homes?.firstOrNull { it.id == homeId }?.showsCopyBeforeRecheck == true

        /**
         * Founder decision 3: a stored copy shows before the re-check only to owners and household roles with
         * open-ended access (and to the person whose own private setup it is), as My Homes and the reply describe them.
         */
        private fun showsBeforeRecheck(
            homeId: String,
            copy: PlaceIntelligence,
        ): Boolean {
            return copy.viewer?.role != NONRESIDENT && householdViewer(homeId)
        }

        private fun read(
            id: String,
            force: Boolean,
        ) {
            readJob?.cancel()
            _refreshing.value = force && _state.value is PlaceDashboardUiState.Loaded
            readJob =
                viewModelScope.launch {
                    val stored = repo.placeStored(id, force, persist = householdViewer(id))
                    if (homeId != id) return@launch
                    _refreshing.value = false
                    publish(stored)
                }
        }

        private fun publish(stored: Stored<PlaceIntelligence>) {
            val data = stored.data
            val failure = stored.failure
            when {
                // The move-in date (the movers card) rides on the intelligence.
                data != null -> _state.value = PlaceDashboardUiState.Loaded(data, data.moveInDate)
                // Access ended (contract §3): the store dropped the copy, and the server's answer shows.
                failure is NetworkError.Forbidden || failure == NetworkError.NotFound || failure == NetworkError.Unauthorized ->
                    _state.value =
                        PlaceDashboardUiState.Error(
                            failure.displayMessage("Couldn't load your dashboard."),
                            denied = failure is NetworkError.Forbidden,
                            unavailable = true,
                        )
                _state.value !is PlaceDashboardUiState.Loaded ->
                    _state.value = PlaceDashboardUiState.Error(failure?.displayMessage("Couldn't load your dashboard.") ?: DASHBOARD_FAILED)
            }
            _refreshNotice.value = RefreshNotice(stored.fetchedAt) { refresh() }.takeIf { stored.showsRefreshFailure(StoreKind.PLACE) }
        }

        private companion object {
            const val NONRESIDENT = "nonresident"
            const val DASHBOARD_FAILED = "Couldn't load your dashboard."
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
