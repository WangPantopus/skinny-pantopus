@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.models.scheduling.ResourceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** One resource row, annotated with a live free/booked status. */
data class ResourceRowUi(
    val id: String,
    val name: String,
    val kind: ResourceKind,
    val statusLabel: String,
    val isFree: Boolean,
)

/** F9 list lifecycle. */
sealed interface ResourceListUiState {
    data object Loading : ResourceListUiState

    /**
     * Loaded rows. Offline presentation (amber banner, 0.55 row dim,
     * hidden FAB) is driven live by the screen from [ResourceListViewModel.isOnline],
     * mirroring iOS's `NetworkMonitor.shared.isOnline`.
     */
    data class Loaded(
        val rows: List<ResourceRowUi>,
    ) : ResourceListUiState

    data object Empty : ResourceListUiState

    data class Error(
        val message: String,
    ) : ResourceListUiState
}

/**
 * Stream A12 — F9 Bookable Home Resources · List. Reads `GET …/scheduling/
 * resources` (home alias) and annotates each row with a live "Free now /
 * Booked until …" status derived from the home's active resource bookings
 * (best-effort; the list still renders if the bookings read is unavailable).
 */
@HiltViewModel
class ResourceListViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ResourceListUiState>(ResourceListUiState.Loading)
        val state: StateFlow<ResourceListUiState> = _state.asStateFlow()

        /** Live connectivity — drives the offline frame (banner + dim + FAB-hide). */
        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        // The route's homeId query arg pins the home the user navigated from
        // (iOS parity); absent → resolvePrimaryHomeId inference on first fetch.
        private var homeId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_HOME_ID)?.takeIf { it.isNotBlank() }
        private var started = false

        /** Sibling-route builders — keep the resolved home across A12 hops. */
        fun newEditorRoute(): String = SchedulingRoutes.resourceEditor("new", homeId)

        fun detailRoute(resourceId: String): String = SchedulingRoutes.resourceDetail(resourceId, homeId)

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() = fetch(showLoading = true)

        fun refresh() = fetch(showLoading = false)

        private fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = ResourceListUiState.Loading
            viewModelScope.launch {
                val hid = homeId ?: resolvePrimaryHomeId(homes)
                if (hid == null) {
                    _state.value =
                        ResourceListUiState.Error(
                            "Join or create a home to manage shared resources.",
                        )
                    return@launch
                }
                homeId = hid
                val owner = SchedulingOwner.Home(hid)
                when (val result = repo.getResources(owner)) {
                    is NetworkResult.Success -> {
                        val resources = result.data.resources.filter { it.isActive != false }
                        rebuild(resources, fetchBookings(owner))
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            ResourceListUiState.Error(
                                result.error.message ?: "Couldn't load resources.",
                            )
                }
            }
        }

        /** Active resource bookings for the home (never fails the screen). */
        private suspend fun fetchBookings(owner: SchedulingOwner.Home): List<BookingDto> =
            when (val result = repo.getBookings(owner)) {
                is NetworkResult.Success ->
                    result.data.bookings.filter {
                        it.resourceId != null &&
                            it.isLive()
                    }
                is NetworkResult.Failure -> emptyList()
            }

        private fun rebuild(
            resources: List<ResourceDto>,
            bookings: List<BookingDto>,
        ) {
            if (resources.isEmpty()) {
                _state.value = ResourceListUiState.Empty
                return
            }
            val now = Instant.now()
            _state.value =
                ResourceListUiState.Loaded(
                    resources.map { resource ->
                        val (label, free) = status(resource.id, bookings, now)
                        ResourceRowUi(
                            id = resource.id,
                            name = resource.name,
                            kind = ResourceKind.fromWire(resource.resourceType),
                            statusLabel = label,
                            isFree = free,
                        )
                    },
                )
        }

        /** "Booked until <end>" when a live booking spans `now`, else "Free now". */
        private fun status(
            resourceId: String,
            bookings: List<BookingDto>,
            now: Instant,
        ): Pair<String, Boolean> {
            val active =
                bookings.firstOrNull { booking ->
                    if (booking.resourceId != resourceId) return@firstOrNull false
                    val start = ResourceTime.parseUtc(booking.startAt) ?: return@firstOrNull false
                    val end = ResourceTime.parseUtc(booking.endAt) ?: start
                    !now.isBefore(start) && now.isBefore(end)
                }
            return if (active != null) {
                "Booked until ${ResourceTime.timeLabel(active.endAt)}" to false
            } else {
                "Free now" to true
            }
        }
    }

/** Active (non-cancelled) booking. */
internal fun BookingDto.isLive(): Boolean = status == "confirmed" || status == "pending"

/** Pending (awaiting approval) booking. */
internal fun BookingDto.isPending(): Boolean = status == "pending"
