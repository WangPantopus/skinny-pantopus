package app.pantopus.android.ui.screens.place

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.models.homes.showsCopyBeforeRecheck
import app.pantopus.android.data.api.models.notifications.personalBellCount
import app.pantopus.android.data.api.models.place.HomeChangesResponse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.homes.HomeDashboardAccessRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.screens.homes.HomeCopyGate
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskAccess
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskAccessFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** "Worth a look" reads its tasks once more through a new access when a token refresh retired the first. */
private const val WORTH_TASK_ATTEMPTS = 2

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
        private val accessRepo: HomeDashboardAccessRepository,
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

        private val _homeShortcuts = MutableStateFlow<List<PlaceHomeShortcut>>(emptyList())

        /** The household shortcuts under Home tools that the person's access at this Home allows ([readShortcuts]). */
        val homeShortcuts: StateFlow<List<PlaceHomeShortcut>> = _homeShortcuts.asStateFlow()
        private var shortcutsJob: Job? = null

        /** The household's tasks for "Worth a look" (unit tests build this without Hilt). */
        @Inject lateinit var taskAccess: HomeTaskAccessFactory

        private val _worthTasks = MutableStateFlow<List<HomeTaskDto>>(emptyList())

        /** The tasks this viewer may read here, for overdue and due-today items in "Worth a look" (TPR brief 6.5). */
        val worthTasks: StateFlow<List<HomeTaskDto>> = _worthTasks.asStateFlow()
        private var worthAccess: Pair<String, HomeTaskAccess>? = null
        private var worthJob: Job? = null

        /** When this account last saw this Home's dashboard, on the phone (unit tests build this without Hilt). */
        @Inject lateinit var visits: PlaceLastVisitStore

        /** The signed-in account, which keys the last visit (unit tests build this without Hilt). */
        @Inject lateinit var tokens: TokenStorage

        private val _changes = MutableStateFlow<HomeChangesResponse?>(null)

        /** What changed since the last visit (TPR brief 7.3): null on a first visit, after an error or from an older server. */
        val changes: StateFlow<HomeChangesResponse?> = _changes.asStateFlow()
        private var changesReadFor: String? = null

        private var homeId: String? = null

        /** The person's claim in review on this Home, which isn't theirs yet: the server sends its public view. */
        private var claim: OwnershipClaimDto? = null
        private var readJob: Job? = null
        private var active = true
        private var readVersion = 0L

        /** Set when a verification flow starts, so coming back reads the dashboard again. */
        private var reloadPending = false

        /**
         * Binds the screen to a home (Instant Screens). Coming back keeps what's on screen and reads only when the
         * store says the Place is out of date. A first entry shows the stored copy at once to owners and household
         * roles (founder decision 3); everyone else waits for the server.
         */
        fun load(homeId: String) {
            active = true
            if (!householdViewer(homeId)) clearPrivateCopy(homeId)
            val shown = (_state.value as? PlaceDashboardUiState.Loaded)?.takeIf { this.homeId == homeId }
            if (this.homeId != homeId) {
                _homeShortcuts.value = emptyList()
                _worthTasks.value = emptyList()
            }
            this.homeId = homeId
            refreshUnread()
            readShortcuts(homeId)
            when {
                shown != null && reloadPending -> read(homeId, force = true)
                shown != null -> read(homeId, force = false)
                else -> {
                    val copy = repo.placeCopy(homeId)?.takeIf { showsBeforeRecheck(homeId, it) }
                    _state.value = copy?.let { PlaceDashboardUiState.Loaded(it, it.moveInDate) } ?: PlaceDashboardUiState.Loading
                    read(homeId, force = copy == null && repo.placeCopy(homeId) != null)
                }
            }
            reloadPending = false
        }

        /** Repeated pause/stop/disposal callbacks must not cancel a new screen's shared read. */
        fun suspendContent() {
            if (!active) return
            active = false
            readVersion++
            readJob?.cancel()
            shortcutsJob?.cancel()
            _refreshing.value = false
            homeId?.takeUnless(::householdViewer)?.let(::clearPrivateCopy)
        }

        private fun clearPrivateCopy(id: String) {
            repo.forgetPlace(id)
            _state.value = PlaceDashboardUiState.Loading
            _refreshNotice.value = null
        }

        /** A verification flow is opening on top; reload when the dashboard shows again. */
        fun reloadOnReturn() {
            reloadPending = true
        }

        /** Pull to refresh and Retry: read now, keeping the dashboard on screen, and say so if it fails. */
        fun refresh() {
            val id = homeId ?: return
            read(id, force = true, asked = true)
            refreshUnread()
            readShortcuts(id, forceTasks = true)
        }

        /**
         * The shortcuts follow the person's access at this Home, read the way Home tools reads it
         * (`GET /api/homes/:id/dashboard-access`) and gated on the same permissions. The access copy Home tools keeps for
         * an owner or household member shows them at once. A refusal leaves none; a failed read keeps what shows.
         */
        private fun readShortcuts(
            id: String,
            forceTasks: Boolean = false,
        ) {
            shortcutsJob?.cancel()
            if (_homeShortcuts.value.isEmpty()) {
                accessRepo.storedAuthority(id)?.takeIf { it.homeId == id && HomeCopyGate.householdAccess(it) }?.let {
                    _homeShortcuts.value = PlaceHomeShortcut.allowedBy(it)
                    readWorthTasks(id, force = false)
                }
            }
            shortcutsJob =
                viewModelScope.launch {
                    val authority = (safeApiCall { accessRepo.read(id) } as? NetworkResult.Success)?.data ?: return@launch
                    if (homeId == id && authority.homeId == id) {
                        _homeShortcuts.value = PlaceHomeShortcut.allowedBy(authority)
                        readWorthTasks(id, forceTasks)
                    }
                }
        }

        /**
         * The tasks for "Worth a look", through the screens' store, when Tasks is among this person's tools here. A refusal
         * shows none; a failed read keeps what shows.
         */
        private fun readWorthTasks(
            id: String,
            force: Boolean,
        ) {
            if (!::taskAccess.isInitialized) return
            if (PlaceHomeShortcut.TASKS !in _homeShortcuts.value) {
                _worthTasks.value = emptyList()
                return
            }
            if (!force && worthJob?.isActive == true && worthAccess?.first == id) return
            worthJob?.cancel()
            worthJob =
                viewModelScope.launch {
                    // A token refresh mid-read (a cold start) retires the access, or the store sets the answer aside and
                    // hands back nothing: read once more, through a new access if needed (as Today's agenda does).
                    repeat(WORTH_TASK_ATTEMPTS) {
                        val access =
                            worthAccess?.takeIf { it.first == id && it.second.isCurrent }?.second
                                ?: taskAccess.create(id, viewModelScope).also { worthAccess = id to it }
                        val stored =
                            try {
                                access.listStored(force)
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (_: IllegalStateException) {
                                worthAccess = null
                                return@repeat
                            }
                        if (homeId != id) return@launch
                        if (stored.data == null && stored.failure == null) return@repeat
                        val tasks = stored.data?.tasks
                        when {
                            tasks != null -> _worthTasks.value = tasks
                            stored.failure.refusesStoredCopy -> _worthTasks.value = emptyList()
                        }
                        return@launch
                    }
                }
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
            asked: Boolean = false,
        ) {
            if (!active) return
            readJob?.cancel()
            val version = ++readVersion
            _refreshing.value = force && _state.value is PlaceDashboardUiState.Loaded
            readJob =
                viewModelScope.launch {
                    val stored = readAuthorized(id, force, version)
                    if (!current(id, version)) return@launch
                    _refreshing.value = false
                    publish(stored, asked)
                }
        }

        private fun current(
            id: String,
            version: Long,
        ): Boolean = active && version == readVersion && homeId == id

        private suspend fun readAuthorized(
            id: String,
            force: Boolean,
            version: Long,
        ): Stored<PlaceIntelligence> {
            val homes = homesRepo.myHomesStored(force || !householdViewer(id))
            if (!current(id, version)) return Stored()
            val home = homes.data?.homes?.firstOrNull { it.id == id }
            val keep = home?.showsCopyBeforeRecheck == true
            if (!keep) clearPrivateCopy(id)
            // Not one of their Homes: a claim in review on it reads the Home's public view, never kept on the phone.
            claim = if (home == null && homes.data != null) claimInReview(id, force) else null
            if (claim != null) return repo.placeStored(id, force = true, persist = false)
            return when {
                home == null -> Stored(failure = homes.failure ?: NetworkError.NotFound)
                !keep && homes.failure != null -> Stored(failure = homes.failure)
                else -> repo.placeStored(id, force || !keep, persist = keep)
            }
        }

        /** My homes' claims (the kept copy unless [force]): the one in review on [id], if any. */
        private suspend fun claimInReview(
            id: String,
            force: Boolean,
        ): OwnershipClaimDto? = homesRepo.myClaimsStored(force).data?.claims?.firstOrNull { it.homeId == id && it.isInReview }

        private fun publish(
            stored: Stored<PlaceIntelligence>,
            asked: Boolean,
        ) {
            val data = stored.data
            val failure = stored.failure
            when {
                // The move-in date (the movers card) rides on the intelligence.
                data != null -> {
                    _state.value = PlaceDashboardUiState.Loaded(data, data.moveInDate, claim)
                    homeId?.let(::readChanges)
                }
                // Access ended (contract §3): the store dropped the copy, and the server's answer shows.
                failure.refusesStoredCopy ->
                    _state.value =
                        PlaceDashboardUiState.Error(
                            failure?.displayMessage("Couldn't load your dashboard.") ?: DASHBOARD_FAILED,
                            denied = failure is NetworkError.Forbidden,
                            unavailable = true,
                        )
                _state.value !is PlaceDashboardUiState.Loaded ->
                    _state.value = PlaceDashboardUiState.Error(failure?.displayMessage("Couldn't load your dashboard.") ?: DASHBOARD_FAILED)
            }
            // A pull or Retry that failed says so (the iPhone shows a toast); a read the person didn't ask for stays
            // quiet until the copy is past its max shown age (contract §3).
            _refreshNotice.value =
                RefreshNotice(stored.fetchedAt) { refresh() }.takeIf {
                    stored.showsRefreshFailure(StoreKind.PLACE) || (asked && stored.data != null && stored.failure != null)
                }
        }

        /**
         * "Changed since your last visit", once per visit to this Home's dashboard, after it shows loaded data: the time
         * kept from the last answer goes as `since`, and this answer's `until` is kept for the next visit. A first visit
         * (no time kept) only starts the record; an error or an older server (404) shows nothing and keeps the old time.
         */
        private fun readChanges(id: String) {
            if (!::visits.isInitialized || !::tokens.isInitialized || changesReadFor == id) return
            changesReadFor = id
            viewModelScope.launch {
                val account = tokens.userId()?.takeIf { it.isNotBlank() } ?: return@launch
                val since = visits.since(account, id)
                val answer = (repo.homeChanges(id, since) as? NetworkResult.Success)?.data ?: return@launch
                if (homeId != id) return@launch
                _changes.value = answer.takeIf { since != null && it.items.isNotEmpty() }
                answer.until?.takeIf { it.isNotBlank() }?.let { visits.remember(account, id, it) }
            }
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
        /** A claim in review: [intelligence] is the Home's public view, the claim's status on top. */
        val claim: OwnershipClaimDto? = null,
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
