@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.HomeEventAttendeeDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg keys for the Event Detail screen. */
const val EVENT_DETAIL_HOME_ID_KEY = "homeId"
const val EVENT_DETAIL_EVENT_ID_KEY = "eventId"

/** UI state for the Event Detail + RSVP screen (F2). */
sealed interface EventDetailUiState {
    data object Loading : EventDetailUiState

    data class Loaded(
        val event: CalendarEventDto,
        val attendeeNames: Map<String, String>,
        val attendees: List<HomeEventAttendeeDto>,
        val myUserId: String?,
        val isDeleting: Boolean = false,
        val deleteError: String? = null,
        val rsvpSaving: Boolean = false,
    ) : EventDetailUiState {
        /** The current member's recorded choice — null when unreplied / pending. */
        val myRsvp: HomeRsvpChoice?
            get() = myUserId?.let { rsvpFor(it) }?.takeIf { it != HomeRsvpChoice.NoReply }

        /** RSVP state for any member — [HomeRsvpChoice.NoReply] when no row. */
        fun rsvpFor(userId: String): HomeRsvpChoice =
            attendees.firstOrNull { it.userId == userId }
                ?.let { HomeRsvpChoice.fromBackend(it.rsvpStatus) }
                ?: HomeRsvpChoice.NoReply
    }

    data class Error(val message: String) : EventDetailUiState
}

/**
 * F2 — Event Detail + RSVP. Fetches `GET /api/homes/:id/events/:eventId`
 * (event + attendee RSVP rows) and the household roster in parallel, then
 * supports an optimistic RSVP upsert (`POST …/rsvp`). Mirrors iOS
 * `EventDetailViewModel`.
 */
@HiltViewModel
class EventDetailViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val membersRepo: HomeMembersRepository,
        private val authRepository: AuthRepository,
        private val networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[EVENT_DETAIL_HOME_ID_KEY]) {
                "EventDetailViewModel requires a '$EVENT_DETAIL_HOME_ID_KEY' nav arg."
            }
        private val eventId: String =
            requireNotNull(savedStateHandle[EVENT_DETAIL_EVENT_ID_KEY]) {
                "EventDetailViewModel requires a '$EVENT_DETAIL_EVENT_ID_KEY' nav arg."
            }

        val isOnline: StateFlow<Boolean> get() = networkMonitor.isOnline

        private val _state = MutableStateFlow<EventDetailUiState>(EventDetailUiState.Loading)
        val state: StateFlow<EventDetailUiState> = _state.asStateFlow()

        private var onDeleted: () -> Unit = {}

        fun configure(onDeleted: () -> Unit) {
            this.onDeleted = onDeleted
        }

        fun load() {
            _state.value = EventDetailUiState.Loading
            viewModelScope.launch {
                val myUserId = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id
                val detailTask = async { repo.getHomeEvent(homeId, eventId) }
                val membersTask = async { membersRepo.listOccupants(homeId) }
                when (val detail = detailTask.await()) {
                    is NetworkResult.Success -> {
                        val nameLookup =
                            when (val members = membersTask.await()) {
                                is NetworkResult.Success ->
                                    members.data.occupants.associate { occupant ->
                                        val name =
                                            occupant.displayName?.takeIf { it.isNotBlank() }
                                                ?: occupant.username
                                                ?: "Member"
                                        occupant.userId to name
                                    }
                                is NetworkResult.Failure -> emptyMap()
                            }
                        _state.value =
                            EventDetailUiState.Loaded(
                                event = detail.data.event,
                                attendeeNames = nameLookup,
                                attendees = detail.data.attendees,
                                myUserId = myUserId,
                            )
                    }
                    is NetworkResult.Failure -> {
                        membersTask.await()
                        _state.value =
                            EventDetailUiState.Error(detail.error.message ?: "Couldn't load this event.")
                    }
                }
            }
        }

        /** Swap the loaded snapshot in place — used by the host after edit. */
        fun replaceLoaded(event: CalendarEventDto) {
            _state.update { current ->
                if (current is EventDetailUiState.Loaded) current.copy(event = event) else current
            }
        }

        /** Optimistically record the current member's RSVP, reverting on failure. */
        fun setRsvp(choice: HomeRsvpChoice) {
            val loaded = (_state.value as? EventDetailUiState.Loaded) ?: return
            val me = loaded.myUserId ?: return
            if (loaded.rsvpSaving) return
            val previous = loaded.attendees
            _state.value =
                loaded.copy(
                    attendees = upsertAttendee(previous, me, choice.backendValue),
                    rsvpSaving = true,
                )
            viewModelScope.launch {
                when (val result = repo.rsvpHomeEvent(homeId, eventId, choice.backendValue)) {
                    is NetworkResult.Success ->
                        _state.update { current ->
                            if (current is EventDetailUiState.Loaded) {
                                current.copy(
                                    attendees =
                                        upsertAttendee(
                                            current.attendees,
                                            me,
                                            result.data.attendee.rsvpStatus ?: choice.backendValue,
                                        ),
                                    rsvpSaving = false,
                                )
                            } else {
                                current
                            }
                        }
                    is NetworkResult.Failure ->
                        _state.update { current ->
                            if (current is EventDetailUiState.Loaded) {
                                current.copy(attendees = previous, rsvpSaving = false)
                            } else {
                                current
                            }
                        }
                }
            }
        }

        fun delete() {
            val loaded = (_state.value as? EventDetailUiState.Loaded) ?: return
            if (loaded.isDeleting) return
            _state.value = loaded.copy(isDeleting = true, deleteError = null)
            viewModelScope.launch {
                when (val result = repo.deleteHomeEvent(homeId, eventId)) {
                    is NetworkResult.Success -> onDeleted()
                    is NetworkResult.Failure ->
                        _state.update { current ->
                            if (current is EventDetailUiState.Loaded) {
                                current.copy(
                                    isDeleting = false,
                                    deleteError = result.error.message ?: "Couldn't delete this event.",
                                )
                            } else {
                                current
                            }
                        }
                }
            }
        }

        private fun upsertAttendee(
            attendees: List<HomeEventAttendeeDto>,
            userId: String,
            status: String,
        ): List<HomeEventAttendeeDto> {
            val existing = attendees.any { it.userId == userId }
            return if (existing) {
                attendees.map { if (it.userId == userId) it.copy(rsvpStatus = status) else it }
            } else {
                attendees + HomeEventAttendeeDto(userId = userId, rsvpStatus = status)
            }
        }
    }
