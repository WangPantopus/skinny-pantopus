@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.AssigneeInput
import app.pantopus.android.data.api.models.scheduling.AssigneesRequest
import app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * G2 Collective Event Setup (Stream A13) — a business service requiring several
 * members to be free at once. "Require multiple staff" maps `assignment_mode` →
 * collective; the chosen members become the assignee set; seats-per-appointment
 * maps to `seat_cap`. Mirrors iOS `CollectiveEventSetupViewModel` +
 * `collective-frames.jsx` (off / on / no-overlap / saving).
 *
 * Backend notes (mirroring iOS): the collective model is "all required members
 * must be free" — there is no stored "required staff count" nor an "any N of a
 * group" selector, so those are local UI affordances. Live no-overlap detection
 * is deferred (would need a team-availability intersection probe).
 */
@HiltViewModel
class CollectiveEventSetupViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val businessTeam: BusinessTeamRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        enum class SelectionMode { Specific, AnyN }

        data class PickUi(
            val id: String,
            val name: String,
            val role: String?,
            val checked: Boolean,
        )

        sealed interface UiState {
            data object Loading : UiState

            data class Content(
                val requireMultiple: Boolean,
                val requiredStaff: Int,
                val selectionMode: SelectionMode,
                val seatsPerAppointment: Int,
                val picks: List<PickUi>,
                val saving: Boolean,
                /** True when the selected members share no free windows (deferred live probe; always false until implemented). */
                val noOverlap: Boolean = false,
            ) : UiState {
                val checkedCount: Int get() = picks.count { it.checked }
            }

            data class Error(val message: String) : UiState
        }

        sealed interface Event {
            data object Saved : Event

            data class Toast(val message: String) : Event
        }

        private val eventTypeId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_EVENT_TYPE_ID).orEmpty()

        private val _state = MutableStateFlow<UiState>(UiState.Loading)
        val state: StateFlow<UiState> = _state.asStateFlow()

        private val _events = Channel<Event>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        fun load() {
            _state.value = UiState.Loading
            val owner = businessOwner()
            if (owner == null) {
                _state.value = UiState.Error("Switch to a business profile to set up collective booking.")
                return
            }
            viewModelScope.launch {
                when (val result = loadAssignmentPool(repo, businessTeam, owner, eventTypeId)) {
                    is NetworkResult.Failure ->
                        _state.value = UiState.Error(errors.decode(result.error).displayMessage("Couldn't load collective setup."))
                    is NetworkResult.Success -> {
                        val pool = result.data
                        val assigned = pool.assignees.map { it.subjectId }.toSet()
                        val picks = pool.members.map { PickUi(it.id, it.name, it.role, it.id in assigned) }
                        val checked = picks.count { it.checked }
                        _state.value =
                            UiState.Content(
                                requireMultiple = pool.eventType.assignmentMode == MODE_COLLECTIVE,
                                requiredStaff = maxOf(2, checked),
                                selectionMode = SelectionMode.Specific,
                                seatsPerAppointment = maxOf(1, pool.eventType.seatCap ?: 1),
                                picks = picks,
                                saving = false,
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        // ─── Editing ────────────────────────────────────────────────────────────

        fun setRequireMultiple(on: Boolean) = mutate { it.copy(requireMultiple = on) }

        fun selectMode(mode: SelectionMode) = mutate { it.copy(selectionMode = mode) }

        fun incrementRequired() = mutate { it.copy(requiredStaff = (it.requiredStaff + 1).coerceAtMost(maxOf(2, it.picks.size))) }

        fun decrementRequired() = mutate { it.copy(requiredStaff = (it.requiredStaff - 1).coerceAtLeast(1)) }

        fun incrementSeats() = mutate { it.copy(seatsPerAppointment = (it.seatsPerAppointment + 1).coerceAtMost(50)) }

        fun decrementSeats() = mutate { it.copy(seatsPerAppointment = (it.seatsPerAppointment - 1).coerceAtLeast(1)) }

        fun toggle(id: String) =
            mutate { content -> content.copy(picks = content.picks.map { if (it.id == id) it.copy(checked = !it.checked) else it }) }

        private inline fun mutate(transform: (UiState.Content) -> UiState.Content) {
            val current = _state.value as? UiState.Content ?: return
            _state.value = transform(current)
        }

        // ─── Save ─────────────────────────────────────────────────────────────

        fun save() {
            val content = _state.value as? UiState.Content ?: return
            if (content.saving) return
            val owner = businessOwner() ?: return
            _state.value = content.copy(saving = true)
            viewModelScope.launch {
                val update =
                    UpdateEventTypeRequest(
                        assignmentMode = if (content.requireMultiple) MODE_COLLECTIVE else MODE_ONE_ON_ONE,
                        seatCap = content.seatsPerAppointment,
                    )
                when (val typeResult = repo.updateEventType(owner, eventTypeId, update)) {
                    is NetworkResult.Failure -> finishWithError(content, errors.decode(typeResult.error))
                    is NetworkResult.Success -> {
                        if (!content.requireMultiple) {
                            _events.send(Event.Saved)
                            return@launch
                        }
                        val assignees =
                            content.picks.filter { it.checked }.map {
                                AssigneeInput(subjectId = it.id, subjectType = SUBJECT_USER, weight = 1, priority = 0)
                            }
                        when (val assigneeResult = repo.setAssignees(owner, eventTypeId, AssigneesRequest(assignees))) {
                            is NetworkResult.Success -> _events.send(Event.Saved)
                            is NetworkResult.Failure -> finishWithError(content, errors.decode(assigneeResult.error))
                        }
                    }
                }
            }
        }

        private suspend fun finishWithError(
            content: UiState.Content,
            error: SchedulingError,
        ) {
            _state.value = content.copy(saving = false)
            _events.send(Event.Toast(assigneeErrorMessage(error)))
        }

        // ─── Helpers ────────────────────────────────────────────────────────────

        private fun businessOwner(): SchedulingOwner.Business? =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id?.let { SchedulingOwner.Business(it) }

        private fun assigneeErrorMessage(error: SchedulingError): String =
            when {
                error is SchedulingError.Generic && error.code == CODE_INVALID_ASSIGNEE ->
                    "One of those members isn't on your team anymore. Refresh and try again."
                error is SchedulingError.Validation && error.details.any { it.code == CODE_INVALID_ASSIGNEE } ->
                    "One of those members isn't on your team anymore. Refresh and try again."
                error is SchedulingError.Generic -> error.message
                else -> "Couldn't save collective setup."
            }

        private fun SchedulingError.displayMessage(fallback: String): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> fallback
            }

        private companion object {
            const val MODE_COLLECTIVE = "collective"
            const val MODE_ONE_ON_ONE = "one_on_one"
            const val SUBJECT_USER = "user"
            const val CODE_INVALID_ASSIGNEE = "INVALID_ASSIGNEE"
        }
    }
