@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "ReturnCount")

package app.pantopus.android.ui.screens.scheduling.home

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaBuilder
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaItem
import app.pantopus.android.ui.screens.homes.calendar.HomeAgendaSection
import app.pantopus.android.ui.screens.homes.calendar.HomeMember
import app.pantopus.android.ui.screens.homes.calendar.MonthStripState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/** The loaded F15 payload. */
@Immutable
data class LoadedData(
    val monthStrip: MonthStripState?,
    val assignments: List<HomeAgendaItem>,
    val agendaSections: List<HomeAgendaSection>,
    val requested: Boolean,
    val actioningId: String? = null,
)

/** Loading / no-access / loaded / error for F15. */
@Immutable
sealed interface GatedSchedulerUiState {
    data object Loading : GatedSchedulerUiState

    data object NoAccess : GatedSchedulerUiState

    data class Loaded(val data: LoadedData) : GatedSchedulerUiState

    data class Error(val message: String) : GatedSchedulerUiState
}

/**
 * F15 — Permission-Gated Scheduler View. A read-only render mode of the Home
 * agenda for a member lacking `calendar.edit`. Gating is **server-driven**:
 * `getHomeEvents` returning 403/forbidden flips to the no-access state — there
 * is no client-side role check. The member can browse the week, accept/decline
 * their own assignments, and request scheduling access (device-local flag).
 *
 * Mirrors iOS `PermissionGatedSchedulerViewModel`.
 */
@HiltViewModel
class PermissionGatedSchedulerViewModel
    internal constructor(
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        private val auth: AuthRepository,
        private val networkMonitor: NetworkMonitor,
        private val prefs: HomeSchedulingPrefs,
        private val clock: () -> Instant = Instant::now,
        private val zone: ZoneId = ZoneId.of("UTC"),
    ) : ViewModel() {
        @Inject
        constructor(
            homes: HomesRepository,
            members: HomeMembersRepository,
            auth: AuthRepository,
            networkMonitor: NetworkMonitor,
            prefs: HomeSchedulingPrefs,
        ) : this(homes, members, auth, networkMonitor, prefs, Instant::now, ZoneId.of("UTC"))

        private val _state = MutableStateFlow<GatedSchedulerUiState>(GatedSchedulerUiState.Loading)
        val state: StateFlow<GatedSchedulerUiState> = _state.asStateFlow()

        val isOnline: StateFlow<Boolean> get() = networkMonitor.isOnline

        private var homeId: String = ""
        private var currentUserId: String? = null
        private var events: List<CalendarEventDto> = emptyList()
        private var memberMap: Map<String, HomeMember> = emptyMap()
        private var weekAnchorIso: String = HomeAgendaBuilder.weekAnchorIso(clock(), zone)
        private var requested: Boolean = false
        private var assignments: List<HomeAgendaItem> = emptyList()
        private var actioningId: String? = null

        fun load() {
            _state.value = GatedSchedulerUiState.Loading
            viewModelScope.launch {
                currentUserId = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

                val home = resolveHomeId()
                if (home == null) {
                    _state.value = GatedSchedulerUiState.NoAccess
                    return@launch
                }
                homeId = home
                requested = prefs.getBool(HomeSchedulingPrefs.gatedRequestedKey(homeId), default = false)
                weekAnchorIso = HomeAgendaBuilder.weekAnchorIso(clock(), zone)

                when (val result = homes.getHomeEvents(homeId)) {
                    is NetworkResult.Success -> {
                        events = result.data.events
                        memberMap = resolveMembers(homeId)
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        if (isForbidden(result.error)) {
                            _state.value = GatedSchedulerUiState.NoAccess
                        } else {
                            _state.value =
                                GatedSchedulerUiState.Error(
                                    result.error.message.ifBlank { "Couldn't load the schedule." },
                                )
                        }
                    }
                }
            }
        }

        fun refresh() = load()

        private fun isForbidden(error: NetworkError): Boolean = error is NetworkError.Forbidden || error.code == FORBIDDEN_CODE

        private suspend fun resolveHomeId(): String? =
            when (val result = homes.myHomes()) {
                is NetworkResult.Success -> {
                    val home =
                        result.data.homes.firstOrNull { it.occupancy?.isActive == true }
                            ?: result.data.homes.firstOrNull()
                    home?.id
                }
                is NetworkResult.Failure -> null
            }

        /** Best-effort member resolution — failure leaves an empty map. */
        private suspend fun resolveMembers(homeId: String): Map<String, HomeMember> =
            when (val result = members.listOccupants(homeId)) {
                is NetworkResult.Success ->
                    result.data.occupants
                        .filter { it.isActive }
                        .associate { occupant ->
                            val name = occupant.displayName ?: occupant.username ?: "Member"
                            occupant.userId to
                                HomeMember(
                                    id = occupant.userId,
                                    name = name,
                                    initials = HomeMember.initialsFor(name),
                                    isYou = occupant.userId == currentUserId,
                                )
                        }
                is NetworkResult.Failure -> emptyMap()
            }

        private fun rebuild() {
            val now = clock()
            val monthStrip =
                HomeAgendaBuilder.weekStrip(
                    events = events,
                    anchorIso = weekAnchorIso,
                    selectedIso = null,
                    now = now,
                    zone = zone,
                )

            val userId = currentUserId
            val mineIds =
                if (userId != null) {
                    events.filter { it.assignedTo.orEmpty().contains(userId) }.map { it.id }.toSet()
                } else {
                    emptySet()
                }

            val startOfDay = now.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant()
            assignments =
                if (userId != null && mineIds.isNotEmpty()) {
                    events
                        .filter { it.id in mineIds }
                        .mapNotNull { dto ->
                            val start = HomeAgendaBuilder.parseInstant(dto.startAt) ?: return@mapNotNull null
                            if (start.isBefore(startOfDay)) return@mapNotNull null
                            start to dto
                        }
                        .sortedBy { it.first }
                        .map { (start, dto) -> HomeAgendaBuilder.item(dto, start, memberMap, zone) }
                } else {
                    emptyList()
                }

            val agendaSections =
                if (assignments.isEmpty()) {
                    HomeAgendaBuilder.sections(
                        events = events,
                        members = memberMap,
                        now = now,
                        zone = zone,
                        selectedIsoDate = null,
                    )
                } else {
                    val restItems =
                        HomeAgendaBuilder
                            .sections(
                                events = events,
                                members = memberMap,
                                now = now,
                                zone = zone,
                                selectedIsoDate = null,
                            )
                            .flatMap { it.items }
                            .filter { it.id !in mineIds }
                    if (restItems.isEmpty()) {
                        emptyList()
                    } else {
                        listOf(HomeAgendaSection("rest", "Rest of the schedule", restItems))
                    }
                }

            _state.value =
                GatedSchedulerUiState.Loaded(
                    LoadedData(
                        monthStrip = monthStrip,
                        assignments = assignments,
                        agendaSections = agendaSections,
                        requested = requested,
                        actioningId = actioningId,
                    ),
                )
        }

        /** Roll the browse week by ±7 days (read-only). */
        fun shiftWeek(direction: WeekShift) {
            val anchor = runCatching { LocalDate.parse(weekAnchorIso) }.getOrNull() ?: return
            val delta = if (direction == WeekShift.Previous) -DAYS_PER_WEEK else DAYS_PER_WEEK
            weekAnchorIso = anchor.plusDays(delta).toString()
            val now = clock()
            val monthStrip =
                HomeAgendaBuilder.weekStrip(
                    events = events,
                    anchorIso = weekAnchorIso,
                    selectedIso = null,
                    now = now,
                    zone = zone,
                )
            val current = (_state.value as? GatedSchedulerUiState.Loaded)?.data ?: return
            _state.value = GatedSchedulerUiState.Loaded(current.copy(monthStrip = monthStrip))
        }

        /** Record the "ask to manage" request (device-local). */
        fun requestAccess() {
            if (requested) return
            requested = true
            prefs.setBool(HomeSchedulingPrefs.gatedRequestedKey(homeId), value = true)
            val current = (_state.value as? GatedSchedulerUiState.Loaded)?.data
            if (current != null) {
                _state.value = GatedSchedulerUiState.Loaded(current.copy(requested = true))
            }
        }

        fun accept(item: HomeAgendaItem) = rsvp(item, "going")

        fun decline(item: HomeAgendaItem) = rsvp(item, "declined")

        private fun rsvp(
            item: HomeAgendaItem,
            status: String,
        ) {
            val eventId = item.eventId ?: return
            if (actioningId != null) return
            actioningId = item.id
            publishActioning()
            viewModelScope.launch {
                when (homes.rsvpHomeEvent(homeId, eventId, status)) {
                    is NetworkResult.Success -> {
                        assignments = assignments.filterNot { it.id == item.id }
                        // Drop the now-actioned event so the agenda reflects it.
                        events = events.filterNot { it.id == item.id }
                        actioningId = null
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        actioningId = null
                        publishActioning()
                    }
                }
            }
        }

        private fun publishActioning() {
            val current = (_state.value as? GatedSchedulerUiState.Loaded)?.data ?: return
            _state.value =
                GatedSchedulerUiState.Loaded(
                    current.copy(assignments = assignments, actioningId = actioningId),
                )
        }

        enum class WeekShift { Previous, Next }

        private companion object {
            const val FORBIDDEN_CODE = 403
            const val DAYS_PER_WEEK = 7L
        }
    }
