@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateWorkflowRequest
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val DEFAULT_OFFSET_MINUTES = 60

/**
 * Stream A16 — H3 Workflow Editor. Builds or edits one automation: a trigger
 * (lifecycle + optional before/after offset, refined in the H4 Trigger Picker),
 * an action channel (email / push / in-app / SMS — SMS disabled "coming soon"),
 * and a message body (with {{variable}} insertion + H7 preview), plus an active
 * toggle. Maps 1:1 to `SchedulingWorkflow`: there is no separate recipient field,
 * so the channel carries the audience. New workflows POST; existing ones PUT.
 * There is no GET-single route, so editing loads the list and finds the row.
 */
@HiltViewModel
class WorkflowEditorViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        enum class Tab { Build, Activity }

        // Owner comes from the route's ownerKind/ownerId args (threaded by the
        // workflows list); Personal when absent.
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )
        val pillar: SchedulingPillar = owner.pillar()

        private val workflowId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_WORKFLOW_ID)
                ?.takeIf { it.isNotBlank() && it != "new" }

        val isNew: Boolean = workflowId == null
        val navTitle: String = if (isNew) "New workflow" else "Edit workflow"

        private val _state = MutableStateFlow<WorkflowEditorUiState>(WorkflowEditorUiState.Loading)
        val state: StateFlow<WorkflowEditorUiState> = _state.asStateFlow()

        private val _tab = MutableStateFlow(Tab.Build)
        val tab: StateFlow<Tab> = _tab.asStateFlow()

        private val _saved = MutableStateFlow(false)
        val saved: StateFlow<Boolean> = _saved.asStateFlow()

        private val _deleted = MutableStateFlow(false)
        val deleted: StateFlow<Boolean> = _deleted.asStateFlow()

        fun start() {
            if (workflowId == null) {
                _state.value = WorkflowEditorUiState.Loaded(WorkflowForm())
                return
            }
            if (_state.value !is WorkflowEditorUiState.Loaded) _state.value = WorkflowEditorUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getWorkflows(owner)) {
                    is NetworkResult.Success -> {
                        val workflow = result.data.workflows.firstOrNull { it.id == workflowId }
                        _state.value =
                            if (workflow == null) {
                                WorkflowEditorUiState.Error("This workflow couldn't be found. It may have been deleted.")
                            } else {
                                WorkflowEditorUiState.Loaded(workflow.toForm())
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value = WorkflowEditorUiState.Error(errors.decode(result.error).loadMessage())
                }
            }
        }

        fun setTab(index: Int) {
            _tab.value = Tab.entries.getOrElse(index) { Tab.Build }
        }

        // ── Editing ──────────────────────────────────────────────────────────

        fun applyTrigger(
            trigger: WorkflowTrigger,
            offsetMinutes: Int,
        ) = updateForm { it.copy(trigger = trigger, offsetMinutes = if (trigger.usesOffset) offsetMinutes.coerceAtLeast(0) else 0) }

        fun setChannel(channel: WorkflowChannel) {
            if (channel.isComingSoon) return
            updateForm { it.copy(channel = channel) }
        }

        fun onName(value: String) = updateForm { it.copy(name = value) }

        fun onMessage(value: String) = updateForm { it.copy(message = value) }

        fun setActive(value: Boolean) = updateForm { it.copy(isActive = value) }

        fun insertVariable(variable: TemplateVariable) =
            updateForm { form ->
                val needsSpace = form.message.isNotEmpty() && !form.message.endsWith(" ") && !form.message.endsWith("\n")
                form.copy(message = form.message + (if (needsSpace) " " else "") + variable.token)
            }

        // ── Save ─────────────────────────────────────────────────────────────

        fun save() {
            val loaded = _state.value as? WorkflowEditorUiState.Loaded ?: return
            _state.value = loaded.copy(didAttemptSave = true)
            if (loaded.form.messageIsEmpty || loaded.isSaving) return
            _state.value = loaded.copy(didAttemptSave = true, isSaving = true, saveError = null)
            val form = loaded.form
            val offset = if (form.trigger.usesOffset) form.offsetMinutes else 0
            viewModelScope.launch {
                val result =
                    if (workflowId == null) {
                        repo.createWorkflow(
                            owner,
                            CreateWorkflowRequest(
                                name = form.resolvedName,
                                trigger = form.trigger.wire,
                                action = form.channel.wire,
                                eventTypeId = null,
                                offsetMinutes = offset,
                                messageTemplate = form.message,
                                isActive = form.isActive,
                            ),
                        )
                    } else {
                        repo.updateWorkflow(
                            owner,
                            workflowId,
                            UpdateWorkflowRequest(
                                name = form.resolvedName,
                                trigger = form.trigger.wire,
                                offsetMinutes = offset,
                                action = form.channel.wire,
                                messageTemplate = form.message,
                                isActive = form.isActive,
                            ),
                        )
                    }
                val current = _state.value as? WorkflowEditorUiState.Loaded ?: return@launch
                when (result) {
                    is NetworkResult.Success -> _saved.value = true
                    is NetworkResult.Failure ->
                        _state.value = current.copy(isSaving = false, saveError = errors.decode(result.error).saveMessage())
                }
            }
        }

        fun consumeSaved() {
            _saved.value = false
        }

        // ── Delete ───────────────────────────────────────────────────────────

        /** DELETE `/workflows/:id` — the screen navigates back via [deleted]. */
        fun delete() {
            val id = workflowId ?: return
            val loaded = _state.value as? WorkflowEditorUiState.Loaded ?: return
            if (loaded.isDeleting) return
            _state.value = loaded.copy(isDeleting = true, deleteError = null)
            viewModelScope.launch {
                val result = repo.deleteWorkflow(owner, id)
                val current = _state.value as? WorkflowEditorUiState.Loaded ?: return@launch
                when (result) {
                    is NetworkResult.Success -> _deleted.value = true
                    is NetworkResult.Failure ->
                        _state.value = current.copy(isDeleting = false, deleteError = errors.decode(result.error).deleteMessage())
                }
            }
        }

        fun consumeDeleted() {
            _deleted.value = false
        }

        private inline fun updateForm(transform: (WorkflowForm) -> WorkflowForm) {
            val loaded = _state.value as? WorkflowEditorUiState.Loaded ?: return
            _state.value = loaded.copy(form = transform(loaded.form))
        }

        private fun WorkflowDto.toForm(): WorkflowForm {
            val resolvedTrigger = WorkflowTrigger.fromWire(trigger)
            var offset = (offsetMinutes ?: 0).coerceAtLeast(0)
            if (offset == 0 && resolvedTrigger.usesOffset) offset = DEFAULT_OFFSET_MINUTES
            return WorkflowForm(
                trigger = resolvedTrigger,
                offsetMinutes = offset,
                channel = WorkflowChannel.fromWire(action),
                message = messageTemplate.orEmpty(),
                name = name,
                isActive = isActive ?: true,
            )
        }

        private fun SchedulingError.loadMessage(): String = (this as? SchedulingError.Generic)?.message ?: "Couldn't load this workflow."

        private fun SchedulingError.deleteMessage(): String =
            (this as? SchedulingError.Generic)?.message ?: "Couldn't delete this workflow. Try again."

        private fun SchedulingError.saveMessage(): String =
            when (this) {
                is SchedulingError.Secret -> "Only admins can edit workflows here."
                is SchedulingError.Validation -> details.firstOrNull()?.message ?: "Check the highlighted fields and try again."
                is SchedulingError.Generic -> message
                else -> "Couldn't save this workflow. Try again."
            }
    }

@Immutable
data class WorkflowForm(
    val trigger: WorkflowTrigger = WorkflowTrigger.BeforeStart,
    val offsetMinutes: Int = DEFAULT_OFFSET_MINUTES,
    val channel: WorkflowChannel = WorkflowChannel.Email,
    val message: String = "",
    val name: String = "",
    val isActive: Boolean = true,
) {
    val trimmedMessage: String get() = message.trim()
    val messageIsEmpty: Boolean get() = trimmedMessage.isEmpty()
    val messageCount: Int get() = message.length
    val counterLimit: Int
        get() = if (channel == WorkflowChannel.Sms) WorkflowChannel.SMS_SEGMENT_LIMIT else WorkflowChannel.BODY_COUNTER_LIMIT
    val isOverLimit: Boolean get() = channel == WorkflowChannel.Sms && messageCount > WorkflowChannel.SMS_SEGMENT_LIMIT

    /** Channel-implied audience caption (no backend recipient field). */
    val recipientCaption: String
        get() =
            when (channel) {
                WorkflowChannel.Email, WorkflowChannel.Sms -> "Sends to your attendees"
                WorkflowChannel.Push, WorkflowChannel.InApp -> "Notifies you"
            }

    /** Resolved name sent to the backend (which requires a non-empty name). */
    val resolvedName: String get() = name.trim().ifBlank { channel.actionSummary }
}

@Immutable
sealed interface WorkflowEditorUiState {
    data object Loading : WorkflowEditorUiState

    data class Loaded(
        val form: WorkflowForm,
        val isSaving: Boolean = false,
        val saveError: String? = null,
        val didAttemptSave: Boolean = false,
        val isDeleting: Boolean = false,
        val deleteError: String? = null,
    ) : WorkflowEditorUiState {
        val canSave: Boolean get() = !form.messageIsEmpty && !isSaving
        val canPreview: Boolean get() = !form.messageIsEmpty
    }

    data class Error(val message: String) : WorkflowEditorUiState
}
