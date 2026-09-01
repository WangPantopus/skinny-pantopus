@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.UpdateWorkflowRequest
import app.pantopus.android.data.api.models.scheduling.WorkflowDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Stream A16 — H2 Workflows List. The automations home: a pinned "Default
 * reminders" card (opens the H1 Quick-Setup sheet) plus the owner's workflows
 * (`GET /workflows`), split by a Global / This-event-type scope. Each row's
 * toggle flips `is_active` via `PUT /workflows/:id`; a 403 means the caller can
 * view but not edit (Home/Business members), which dims the toggles into the
 * read-only gated state honestly. Owner comes from the route's ownerKind/ownerId
 * args so Business/Home settings list + mutate THEIR rows; Personal when absent.
 */
@HiltViewModel
class WorkflowsListViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        enum class Scope { Global, ThisType }

        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        val pillar: SchedulingPillar = owner.pillar()

        private val _state = MutableStateFlow<WorkflowsListUiState>(WorkflowsListUiState.Loading)
        val state: StateFlow<WorkflowsListUiState> = _state.asStateFlow()

        private val _scope = MutableStateFlow(Scope.Global)
        val scope: StateFlow<Scope> = _scope.asStateFlow()

        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        /** True while a pull-to-refresh refetch is in flight (drives the indicator). */
        private val _isRefreshing = MutableStateFlow(false)
        val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

        fun load() {
            if (_state.value !is WorkflowsListUiState.Loaded) _state.value = WorkflowsListUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getWorkflows(owner)) {
                    is NetworkResult.Success -> {
                        // Non-fatal: the reminder summary is decorative.
                        val pageDef = async { repo.getBookingPage(owner) }
                        val reminders =
                            (pageDef.await() as? NetworkResult.Success)?.data?.page?.reminderMinutes ?: emptyList()
                        _state.value =
                            WorkflowsListUiState.Loaded(
                                workflows = result.data.workflows,
                                remindersSummary = AutomationsFormat.remindersSummary(reminders),
                                isGated = false,
                            )
                    }
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(result.error)
                        _state.value =
                            WorkflowsListUiState.Error(
                                message = decoded.listMessage(),
                                gated = decoded is SchedulingError.Secret,
                            )
                    }
                }
                _isRefreshing.value = false
            }
        }

        /** Pull-to-refresh refetch — keeps Loaded content on screen while in flight. */
        fun refresh() {
            if (_state.value is WorkflowsListUiState.Loaded) _isRefreshing.value = true
            load()
        }

        fun selectScope(index: Int) {
            _scope.value = Scope.entries.getOrElse(index) { Scope.Global }
        }

        fun clearActionError() {
            _actionError.value = null
        }

        fun toggleActive(workflow: WorkflowDto) {
            val loaded = _state.value as? WorkflowsListUiState.Loaded ?: return
            if (loaded.isGated) return
            val next = !(workflow.isActive ?: true)
            // Optimistic flip.
            _state.value = loaded.replacing(workflow.id) { it.copy(isActive = next) }
            viewModelScope.launch {
                when (val result = repo.updateWorkflow(owner, workflow.id, UpdateWorkflowRequest(isActive = next))) {
                    is NetworkResult.Success ->
                        (_state.value as? WorkflowsListUiState.Loaded)?.let { current ->
                            _state.value = current.replacing(workflow.id) { result.data.workflow }
                        }
                    is NetworkResult.Failure -> {
                        val current = _state.value as? WorkflowsListUiState.Loaded ?: return@launch
                        val reverted = current.replacing(workflow.id) { it.copy(isActive = workflow.isActive ?: true) }
                        when (val decoded = errors.decode(result.error)) {
                            is SchedulingError.Secret -> _state.value = reverted.copy(isGated = true)
                            else -> {
                                _state.value = reverted
                                _actionError.value = decoded.toastMessage()
                            }
                        }
                    }
                }
            }
        }

        // Navigation route builders (the screen calls onNavigate) — carry the owner.
        fun createWorkflowRoute(): String = SchedulingRoutes.workflowEditor("new", owner.routeKind, owner.ownerRouteId)

        fun workflowRoute(id: String): String = SchedulingRoutes.workflowEditor(id, owner.routeKind, owner.ownerRouteId)

        private fun SchedulingError.listMessage(): String =
            when (this) {
                is SchedulingError.Secret -> "Only admins can edit these workflows."
                is SchedulingError.Generic -> message
                else -> "Couldn't load your workflows."
            }

        private fun SchedulingError.toastMessage(): String = (this as? SchedulingError.Generic)?.message ?: "Couldn't update this workflow."
    }

@Immutable
sealed interface WorkflowsListUiState {
    data object Loading : WorkflowsListUiState

    data class Loaded(
        val workflows: List<WorkflowDto>,
        val remindersSummary: String,
        val isGated: Boolean,
    ) : WorkflowsListUiState {
        val globalWorkflows: List<WorkflowDto> get() = workflows.filter { (it.eventTypeId ?: "").isBlank() }
        val scopedWorkflows: List<WorkflowDto> get() = workflows.filter { (it.eventTypeId ?: "").isNotBlank() }

        fun visible(scope: WorkflowsListViewModel.Scope): List<WorkflowDto> =
            if (scope == WorkflowsListViewModel.Scope.Global) globalWorkflows else scopedWorkflows

        fun replacing(
            id: String,
            transform: (WorkflowDto) -> WorkflowDto,
        ): Loaded = copy(workflows = workflows.map { if (it.id == id) transform(it) else it })

        fun isActive(workflow: WorkflowDto): Boolean = workflow.isActive ?: true
    }

    data class Error(
        val message: String,
        val gated: Boolean = false,
    ) : WorkflowsListUiState
}
