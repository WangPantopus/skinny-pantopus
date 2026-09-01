@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.automations

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateMessageTemplateRequest
import app.pantopus.android.data.api.models.scheduling.UpdateMessageTemplateRequest
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

/**
 * Stream A16 — H5 Message Template Editor. Writes a reusable message template: a
 * channel, an optional subject (required for email), and a body with
 * `{{variable}}` insertion + H7 preview. New templates POST; existing ones PUT
 * (`/message-templates`). There is no GET-single route, so editing loads the list
 * and finds the row. SMS over 160 characters warns it sends as more than one.
 */
@HiltViewModel
class MessageTemplateEditorViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        // Owner comes from the route's ownerKind/ownerId args (threaded by the
        // template library); Personal when absent.
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )
        val pillar: SchedulingPillar = owner.pillar()

        private val templateId: String? =
            savedStateHandle.get<String>(SchedulingRoutes.ARG_TEMPLATE_ID)
                ?.takeIf { it.isNotBlank() && it != "new" }

        val isNew: Boolean = templateId == null
        val navTitle: String = if (isNew) "New template" else "Edit template"

        private val _state = MutableStateFlow<MessageTemplateEditorUiState>(MessageTemplateEditorUiState.Loading)
        val state: StateFlow<MessageTemplateEditorUiState> = _state.asStateFlow()

        private val _saved = MutableStateFlow(false)
        val saved: StateFlow<Boolean> = _saved.asStateFlow()

        private val _deleted = MutableStateFlow(false)
        val deleted: StateFlow<Boolean> = _deleted.asStateFlow()

        fun start() {
            if (templateId == null) {
                _state.value = MessageTemplateEditorUiState.Loaded(TemplateForm())
                return
            }
            if (_state.value !is MessageTemplateEditorUiState.Loaded) _state.value = MessageTemplateEditorUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getMessageTemplates(owner)) {
                    is NetworkResult.Success -> {
                        val template = result.data.templates.firstOrNull { it.id == templateId }
                        _state.value =
                            if (template == null) {
                                MessageTemplateEditorUiState.Error("This template couldn't be found. It may have been deleted.")
                            } else {
                                MessageTemplateEditorUiState.Loaded(
                                    TemplateForm(
                                        name = template.name,
                                        channel = WorkflowChannel.fromWire(template.channel),
                                        subject = template.subject.orEmpty(),
                                        body = template.body.orEmpty(),
                                        isActive = template.isActive ?: true,
                                    ),
                                )
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value = MessageTemplateEditorUiState.Error(errors.decode(result.error).loadMessage())
                }
            }
        }

        // ── Editing ──────────────────────────────────────────────────────────

        fun onName(value: String) = updateForm { it.copy(name = value) }

        fun onSubject(value: String) = updateForm { it.copy(subject = value) }

        fun onBody(value: String) = updateForm { it.copy(body = value) }

        fun setChannel(channel: WorkflowChannel) {
            if (channel.isComingSoon) return
            updateForm { it.copy(channel = channel) }
        }

        /** Mirrors the backend `is_active` field (iOS activeSection parity). */
        fun setActive(value: Boolean) = updateForm { it.copy(isActive = value) }

        fun insertVariable(variable: TemplateVariable) =
            updateForm { form ->
                val needsSpace = form.body.isNotEmpty() && !form.body.endsWith(" ") && !form.body.endsWith("\n")
                form.copy(body = form.body + (if (needsSpace) " " else "") + variable.token)
            }

        // ── Save ─────────────────────────────────────────────────────────────

        fun save() {
            val loaded = _state.value as? MessageTemplateEditorUiState.Loaded ?: return
            _state.value = loaded.copy(didAttemptSave = true)
            if (!loaded.canSave) return
            _state.value = loaded.copy(didAttemptSave = true, isSaving = true, saveError = null)
            val form = loaded.form
            val subjectValue = form.subject.trim().ifBlank { null }
            viewModelScope.launch {
                val result =
                    if (templateId == null) {
                        repo.createMessageTemplate(
                            owner,
                            CreateMessageTemplateRequest(
                                name = form.name,
                                body = form.body,
                                channel = form.channel.wire,
                                subject = subjectValue,
                                isActive = form.isActive,
                            ),
                        )
                    } else {
                        repo.updateMessageTemplate(
                            owner,
                            templateId,
                            UpdateMessageTemplateRequest(
                                name = form.name,
                                body = form.body,
                                channel = form.channel.wire,
                                subject = subjectValue,
                                isActive = form.isActive,
                            ),
                        )
                    }
                val current = _state.value as? MessageTemplateEditorUiState.Loaded ?: return@launch
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

        /** DELETE `/message-templates/:id` — the screen navigates back via [deleted]. */
        fun delete() {
            val id = templateId ?: return
            val loaded = _state.value as? MessageTemplateEditorUiState.Loaded ?: return
            if (loaded.isDeleting) return
            _state.value = loaded.copy(isDeleting = true, deleteError = null)
            viewModelScope.launch {
                val result = repo.deleteMessageTemplate(owner, id)
                val current = _state.value as? MessageTemplateEditorUiState.Loaded ?: return@launch
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

        private inline fun updateForm(transform: (TemplateForm) -> TemplateForm) {
            val loaded = _state.value as? MessageTemplateEditorUiState.Loaded ?: return
            _state.value = loaded.copy(form = transform(loaded.form))
        }

        private fun SchedulingError.loadMessage(): String = (this as? SchedulingError.Generic)?.message ?: "Couldn't load this template."

        private fun SchedulingError.deleteMessage(): String =
            (this as? SchedulingError.Generic)?.message ?: "Couldn't delete this template. Try again."

        private fun SchedulingError.saveMessage(): String =
            when (this) {
                is SchedulingError.Secret -> "Only admins can edit templates here."
                is SchedulingError.Validation -> details.firstOrNull()?.message ?: "Check the highlighted fields and try again."
                is SchedulingError.Generic -> message
                else -> "Couldn't save this template. Try again."
            }
    }

@Immutable
data class TemplateForm(
    val name: String = "",
    val channel: WorkflowChannel = WorkflowChannel.Email,
    val subject: String = "",
    val body: String = "",
    /** Backend `is_active` — off pauses the template so workflows skip it. */
    val isActive: Boolean = true,
) {
    val showsSubject: Boolean get() = channel == WorkflowChannel.Email || channel == WorkflowChannel.Sms
    val subjectRequired: Boolean get() = channel == WorkflowChannel.Email

    val nameIsEmpty: Boolean get() = name.trim().isEmpty()
    val bodyIsEmpty: Boolean get() = body.trim().isEmpty()
    val subjectMissing: Boolean get() = subjectRequired && subject.trim().isEmpty()

    val bodyCount: Int get() = body.length
    val counterLimit: Int
        get() = if (channel == WorkflowChannel.Sms) WorkflowChannel.SMS_SEGMENT_LIMIT else WorkflowChannel.BODY_COUNTER_LIMIT
    val isOverLimit: Boolean get() = channel == WorkflowChannel.Sms && bodyCount > WorkflowChannel.SMS_SEGMENT_LIMIT

    /** Subject routed into the preview (only when shown + non-blank). */
    val previewSubject: String? get() = if (showsSubject && subject.trim().isNotEmpty()) subject else null
}

@Immutable
sealed interface MessageTemplateEditorUiState {
    data object Loading : MessageTemplateEditorUiState

    data class Loaded(
        val form: TemplateForm,
        val isSaving: Boolean = false,
        val saveError: String? = null,
        val didAttemptSave: Boolean = false,
        val isDeleting: Boolean = false,
        val deleteError: String? = null,
    ) : MessageTemplateEditorUiState {
        val canSave: Boolean get() = !form.nameIsEmpty && !form.bodyIsEmpty && !form.subjectMissing && !isSaving
        val canPreview: Boolean get() = !form.bodyIsEmpty
    }

    data class Error(val message: String) : MessageTemplateEditorUiState
}
