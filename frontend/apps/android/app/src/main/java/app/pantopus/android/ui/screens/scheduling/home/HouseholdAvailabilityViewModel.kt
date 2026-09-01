@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.home

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Which household-exposure toggle is mid-save (drives the inline spinner). */
enum class Exposure { ShareFreeBusy, RoundRobin, AutoDecline }

/**
 * The loaded F8 payload — the home name for context, whether the user's
 * personal availability is set up (the boundary gate), and the three
 * device-local household-exposure toggles. `savingExposure` is non-null
 * for the row currently persisting.
 */
@Immutable
data class ReadyData(
    val homeName: String,
    val personalIsSetUp: Boolean,
    val shareFreeBusy: Boolean,
    val roundRobin: Boolean,
    val autoDecline: Boolean,
    val quietHoursLabel: String = "Weeknights 9 PM",
    val savingExposure: Exposure? = null,
)

/** Loading / ready / error for F8. */
@Immutable
sealed interface HouseholdAvailabilityUiState {
    data object Loading : HouseholdAvailabilityUiState

    data class Ready(val data: ReadyData) : HouseholdAvailabilityUiState

    data class Error(val message: String) : HouseholdAvailabilityUiState
}

/**
 * F8 — My Household Availability Settings (Home green pillar).
 *
 * An exposure-only boundary screen: it never edits the source availability.
 * It reads `getAvailability()` solely to know whether the user's Personal
 * availability is set up, resolves the home for context, and toggles three
 * device-local household-exposure prefs (share free/busy, round-robin,
 * auto-decline). Editing the source deep-links to Personal availability.
 *
 * Mirrors iOS `HouseholdAvailabilityViewModel`.
 */
@HiltViewModel
class HouseholdAvailabilityViewModel
    @Inject
    constructor(
        private val scheduling: SchedulingRepository,
        private val homes: HomesRepository,
        private val networkMonitor: NetworkMonitor,
        private val prefs: HomeSchedulingPrefs,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /**
         * The home the user navigated from — the route's `homeId` query arg
         * (iOS parity: `.householdAvailability(homeId:)`). Null on legacy/deep
         * links, where [resolveHome] falls back to the first-active-home inference.
         */
        private val routeHomeId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_HOME_ID)?.takeIf { it.isNotBlank() }

        private val _state =
            MutableStateFlow<HouseholdAvailabilityUiState>(HouseholdAvailabilityUiState.Loading)
        val state: StateFlow<HouseholdAvailabilityUiState> = _state.asStateFlow()

        /** Surface connectivity to the screen (chrome banner). */
        val isOnline: StateFlow<Boolean> get() = networkMonitor.isOnline

        /** Resolved during [load]; defaults to a stable fallback for prefs keys. */
        private var homeId: String = FALLBACK_HOME_ID

        fun load() {
            _state.value = HouseholdAvailabilityUiState.Loading
            viewModelScope.launch {
                val homeName = resolveHome()
                when (val result = scheduling.getAvailability()) {
                    is NetworkResult.Success -> {
                        val personalIsSetUp = result.data.schedules.isNotEmpty()
                        _state.value =
                            HouseholdAvailabilityUiState.Ready(
                                ReadyData(
                                    homeName = homeName,
                                    personalIsSetUp = personalIsSetUp,
                                    shareFreeBusy =
                                        prefs.getBool(HomeSchedulingPrefs.shareFreeBusyKey(homeId), default = true),
                                    roundRobin =
                                        prefs.getBool(HomeSchedulingPrefs.roundRobinKey(homeId), default = true),
                                    autoDecline =
                                        prefs.getBool(HomeSchedulingPrefs.autoDeclineKey(homeId), default = false),
                                ),
                            )
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            HouseholdAvailabilityUiState.Error(
                                result.error.message.ifBlank { "Couldn't load your availability settings." },
                            )
                }
            }
        }

        fun refresh() = load()

        /**
         * Resolve the home and seed [homeId] for prefs scoping. Returns the
         * display name. The route's [routeHomeId] is authoritative (that home's
         * detail is fetched, mirroring iOS); without it we fall back to the
         * first-active-home inference. Falls back to "This household" with a
         * stable home id when nothing resolves.
         */
        private suspend fun resolveHome(): String {
            homeId = FALLBACK_HOME_ID
            routeHomeId?.let { id ->
                // Prefs stay scoped to the navigated home even if the name read fails.
                homeId = id
                val name = (homes.detail(id) as? NetworkResult.Success)?.data?.home?.name
                return name ?: "This household"
            }
            return when (val result = homes.myHomes()) {
                is NetworkResult.Success -> {
                    val home =
                        result.data.homes.firstOrNull { it.occupancy?.isActive == true }
                            ?: result.data.homes.firstOrNull()
                    if (home != null) {
                        homeId = home.id
                        home.name ?: "This household"
                    } else {
                        "This household"
                    }
                }
                is NetworkResult.Failure -> "This household"
            }
        }

        /**
         * Flip one household-exposure toggle. Guards on `personalIsSetUp`,
         * shows an inline spinner for ~350ms while it persists to prefs.
         */
        fun setExposure(
            exposure: Exposure,
            to: Boolean,
        ) {
            val current = (_state.value as? HouseholdAvailabilityUiState.Ready)?.data ?: return
            if (!current.personalIsSetUp) return
            val flipped =
                when (exposure) {
                    Exposure.ShareFreeBusy -> current.copy(shareFreeBusy = to)
                    Exposure.RoundRobin -> current.copy(roundRobin = to)
                    Exposure.AutoDecline -> current.copy(autoDecline = to)
                }
            _state.value = HouseholdAvailabilityUiState.Ready(flipped.copy(savingExposure = exposure))
            persist(exposure, to)
            viewModelScope.launch {
                delay(SAVE_DELAY_MS)
                val latest = (_state.value as? HouseholdAvailabilityUiState.Ready)?.data ?: return@launch
                _state.value = HouseholdAvailabilityUiState.Ready(latest.copy(savingExposure = null))
            }
        }

        private fun persist(
            exposure: Exposure,
            to: Boolean,
        ) {
            val key =
                when (exposure) {
                    Exposure.ShareFreeBusy -> HomeSchedulingPrefs.shareFreeBusyKey(homeId)
                    Exposure.RoundRobin -> HomeSchedulingPrefs.roundRobinKey(homeId)
                    Exposure.AutoDecline -> HomeSchedulingPrefs.autoDeclineKey(homeId)
                }
            prefs.setBool(key, to)
        }

        private companion object {
            const val FALLBACK_HOME_ID = "default"
            const val SAVE_DELAY_MS = 350L
        }
    }
