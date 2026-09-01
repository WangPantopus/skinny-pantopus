@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.AssigneeInput
import app.pantopus.android.data.api.models.scheduling.AssigneesRequest
import app.pantopus.android.data.api.models.scheduling.EventTypeAssigneeDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * G1 Round-Robin Assignment (Stream A13) — a local bottom sheet hung off a
 * business service. Picks which members take bookings and the fairness rule.
 * Saving REPLACES the whole assignee set via `PUT /event-types/:id/assignees`
 * (`INVALID_ASSIGNEE` surfaced). Mirrors iOS `RoundRobinAssignmentViewModel`
 * + `roundrobin-frames.jsx`.
 *
 * Backend note: there is no dedicated "rule" column — Balanced/Priority/Strict
 * are expressed through the assignees' weight/priority and inferred on reload.
 * The encoding is a lossless sentinel scheme (identical to iOS) so the chosen
 * rule survives a save→reload roundtrip:
 *   · Strict   → weight 1, priority 0            (the neutral shape)
 *   · Priority → weight 1, priority index+1      (1-based rank; >0 marks the rule)
 *   · Balanced → user weights, priority -1       (<0 marks the rule; weights carry the data)
 * (bookingService.pickRoundRobinHost sorts by assigned_count then priority, so
 * a constant -1 across the set never changes the pick; Joi and the DB column
 * both accept any integer priority.) Previously Balanced-with-default-weights
 * and single-member Priority both round-tripped back as "Strict".
 */
@HiltViewModel
class RoundRobinAssignmentViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val businessTeam: BusinessTeamRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        enum class Rule { Balanced, Priority, Strict }

        data class PickUi(
            val id: String,
            val name: String,
            val role: String?,
            val checked: Boolean,
            val weight: Int,
        )

        sealed interface UiState {
            data object Loading : UiState

            data class Content(
                val rule: Rule,
                val picks: List<PickUi>,
                val saving: Boolean,
            ) : UiState {
                val checkedCount: Int get() = picks.count { it.checked }
                val doneDisabled: Boolean get() = checkedCount == 0 || saving
                val isSingleMember: Boolean get() = checkedCount == 1
                val firstCheckedName: String? get() = picks.firstOrNull { it.checked }?.name
            }

            data class Error(val message: String) : UiState
        }

        sealed interface Event {
            data object Saved : Event

            data class Toast(val message: String) : Event
        }

        private val _state = MutableStateFlow<UiState>(UiState.Loading)
        val state: StateFlow<UiState> = _state.asStateFlow()

        private val _events = Channel<Event>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        private var eventTypeId: String = ""
        private var started = false

        fun start(id: String) {
            if (started && eventTypeId == id) return
            started = true
            eventTypeId = id
            load()
        }

        fun load() {
            _state.value = UiState.Loading
            val owner = businessOwner()
            if (owner == null) {
                _state.value = UiState.Error("Switch to a business profile to assign bookings.")
                return
            }
            viewModelScope.launch {
                when (val result = loadAssignmentPool(repo, businessTeam, owner, eventTypeId)) {
                    is NetworkResult.Failure ->
                        _state.value = UiState.Error(errors.decode(result.error).displayMessage("Couldn't load assignment."))
                    is NetworkResult.Success -> {
                        val pool = result.data
                        val assignedById = pool.assignees.associateBy { it.subjectId }
                        val picks =
                            pool.members.map { member ->
                                val assignee = assignedById[member.id]
                                PickUi(
                                    id = member.id,
                                    name = member.name,
                                    role = member.role,
                                    checked = assignee != null,
                                    weight = assignee?.weight ?: 1,
                                )
                            }.toMutableList()
                        // Keep any assignee not present in the roster fetch (defensive).
                        val known = picks.map { it.id }.toSet()
                        pool.assignees.filter { it.subjectId !in known }.forEach {
                            picks.add(PickUi(id = it.subjectId, name = "Member", role = null, checked = true, weight = it.weight ?: 1))
                        }
                        _state.value = UiState.Content(rule = inferRule(pool.assignees), picks = picks, saving = false)
                    }
                }
            }
        }

        // ─── Editing ────────────────────────────────────────────────────────────

        fun selectRule(rule: Rule) = mutate { it.copy(rule = rule) }

        fun toggle(id: String) =
            mutate { content ->
                content.copy(picks = content.picks.map { if (it.id == id) it.copy(checked = !it.checked) else it })
            }

        fun incrementWeight(id: String) =
            mutate { content ->
                content.copy(picks = content.picks.map { if (it.id == id) it.copy(weight = (it.weight + 1).coerceAtMost(9)) else it })
            }

        fun decrementWeight(id: String) =
            mutate { content ->
                content.copy(picks = content.picks.map { if (it.id == id) it.copy(weight = (it.weight - 1).coerceAtLeast(1)) else it })
            }

        fun moveUp(id: String) =
            mutate { content ->
                val idx = content.picks.indexOfFirst { it.id == id }
                if (idx <= 0) {
                    content
                } else {
                    content.copy(picks = content.picks.toMutableList().apply { add(idx - 1, removeAt(idx)) })
                }
            }

        fun moveDown(id: String) =
            mutate { content ->
                val idx = content.picks.indexOfFirst { it.id == id }
                if (idx < 0 || idx >= content.picks.lastIndex) {
                    content
                } else {
                    content.copy(picks = content.picks.toMutableList().apply { add(idx + 1, removeAt(idx)) })
                }
            }

        private inline fun mutate(transform: (UiState.Content) -> UiState.Content) {
            val current = _state.value as? UiState.Content ?: return
            _state.value = transform(current)
        }

        // ─── Save ─────────────────────────────────────────────────────────────

        fun save() {
            val content = _state.value as? UiState.Content ?: return
            if (content.doneDisabled) return
            _state.value = content.copy(saving = true)
            val owner = businessOwner() ?: return
            viewModelScope.launch {
                val checked = content.picks.filter { it.checked }
                // Sentinel encoding (see class doc): each rule writes a shape the
                // other two can never produce — Balanced marks every row with
                // priority -1, Priority ranks 1-based, Strict stays all-zero.
                val assignees =
                    checked.mapIndexed { index, pick ->
                        when (content.rule) {
                            Rule.Balanced ->
                                AssigneeInput(
                                    subjectId = pick.id,
                                    subjectType = SUBJECT_USER,
                                    weight = pick.weight,
                                    priority = BALANCED_PRIORITY_SENTINEL,
                                )
                            Rule.Priority ->
                                AssigneeInput(subjectId = pick.id, subjectType = SUBJECT_USER, weight = 1, priority = index + 1)
                            Rule.Strict -> AssigneeInput(subjectId = pick.id, subjectType = SUBJECT_USER, weight = 1, priority = 0)
                        }
                    }
                when (val result = repo.setAssignees(owner, eventTypeId, AssigneesRequest(assignees))) {
                    is NetworkResult.Success -> _events.send(Event.Saved)
                    is NetworkResult.Failure -> {
                        _state.value = content.copy(saving = false)
                        _events.send(Event.Toast(assigneeErrorMessage(errors.decode(result.error))))
                    }
                }
            }
        }

        // ─── Helpers ────────────────────────────────────────────────────────────

        private fun businessOwner(): SchedulingOwner.Business? =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id?.let { SchedulingOwner.Business(it) }

        // Sentinel decode (see class doc; mirrors iOS `inferRule`). Negative
        // priority = Balanced marker; positive = Priority rank. Non-default
        // weights also read as Balanced so rows saved by older clients
        // (priority 0 + custom weights) keep their rule.
        private fun inferRule(assignees: List<EventTypeAssigneeDto>): Rule =
            when {
                assignees.isEmpty() -> Rule.Balanced
                assignees.any { (it.priority ?: 0) < 0 } -> Rule.Balanced
                assignees.any { (it.weight ?: 1) != 1 } -> Rule.Balanced
                assignees.any { (it.priority ?: 0) > 0 } -> Rule.Priority
                else -> Rule.Strict
            }

        private fun assigneeErrorMessage(error: SchedulingError): String =
            when {
                error is SchedulingError.Generic && error.code == CODE_INVALID_ASSIGNEE ->
                    "One of those members isn't on your team anymore. Refresh and try again."
                error is SchedulingError.Validation && error.details.any { it.code == CODE_INVALID_ASSIGNEE } ->
                    "One of those members isn't on your team anymore. Refresh and try again."
                error is SchedulingError.Generic -> error.message
                else -> "Couldn't save assignment."
            }

        private fun SchedulingError.displayMessage(fallback: String): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> fallback
            }

        // Internal (not private) so tests can assert against the wire encoding itself
        // rather than re-hardcoding the sentinel and drifting from it.
        internal companion object {
            const val SUBJECT_USER = "user"
            const val CODE_INVALID_ASSIGNEE = "INVALID_ASSIGNEE"

            /** Balanced marker (see class doc) — shared encoding with iOS. */
            const val BALANCED_PRIORITY_SENTINEL = -1
        }
    }
