@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.QuestionInput
import app.pantopus.android.data.api.models.scheduling.QuestionsRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * B3 Intake questions editor view-model. Loads the parent event type's question
 * set, edits an inline draft list, and saves the whole set via
 * `PUT /event-types/:id/questions` (replace-all). For an unsaved (`new`) event
 * type it reports [IntakeUiState.NeedsSaveFirst] — there is no id to attach to.
 */
@HiltViewModel
class IntakeQuestionsViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val ownerRelay: SchedulingEditorOwnerRelay,
    ) : ViewModel() {
        private val eventTypeId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_EVENT_TYPE_ID).orEmpty()
        private val isNew: Boolean = eventTypeId.isEmpty() || eventTypeId == EventTypeListViewModel.NEW_EVENT_TYPE_ID

        private val _state = MutableStateFlow<IntakeUiState>(IntakeUiState.Loading)
        val state: StateFlow<IntakeUiState> = _state.asStateFlow()

        private val _saved = MutableStateFlow(false)
        val saved: StateFlow<Boolean> = _saved.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var pillar: SchedulingPillar = SchedulingPillar.Personal
        private var eventName: String = "this event"
        private var questions: List<QuestionDraft> = emptyList()
        private var original: List<QuestionDraft> = emptyList()
        private var editing: EditingQuestion? = null
        private var saving = false
        private var localCounter = 0
        private var started = false

        fun start() {
            if (started) return
            started = true
            // The arg-less A0 route carries no owner; the editor/list hands it over via the relay.
            owner = ownerRelay.consume() ?: SchedulingOwner.Personal
            if (isNew) _state.value = IntakeUiState.NeedsSaveFirst else load()
        }

        fun load() {
            viewModelScope.launch {
                _state.value = IntakeUiState.Loading
                when (val r = repo.getEventType(owner, eventTypeId)) {
                    is NetworkResult.Success -> {
                        val dto = r.data.eventType
                        eventName = dto.name
                        pillar =
                            when (dto.ownerType) {
                                "business" -> SchedulingPillar.Business
                                "home" -> SchedulingPillar.Home
                                else -> SchedulingPillar.Personal
                            }
                        // The loaded DTO's owner is authoritative — overrides the relay hint.
                        owner =
                            when {
                                pillar == SchedulingPillar.Business && dto.ownerId != null -> SchedulingOwner.Business(dto.ownerId)
                                pillar == SchedulingPillar.Home && dto.ownerId != null -> SchedulingOwner.Home(dto.ownerId)
                                else -> SchedulingOwner.Personal
                            }
                        questions = r.data.questions.sortedBy { it.sortOrder ?: Int.MAX_VALUE }.map { it.toDraft(newLocalId()) }
                        original = questions
                        render()
                    }
                    is NetworkResult.Failure ->
                        _state.value = IntakeUiState.Error(errors.decode(r.error).message())
                }
            }
        }

        // ─── Inline edit group ──────────────────────────────────────────────────

        fun startAdd() {
            editing = EditingQuestion(QuestionDraft(newLocalId(), "", QuestionType.ShortText, emptyList(), false), isNew = true)
            render()
        }

        fun editQuestion(localId: String) {
            val draft = questions.firstOrNull { it.localId == localId } ?: return
            editing = EditingQuestion(draft, isNew = false)
            render()
        }

        fun onEditLabel(value: String) = updateEditing { it.copy(label = value) }

        fun onEditType(type: QuestionType) =
            updateEditing {
                val options = if (type.hasOptions && it.options.isEmpty()) listOf("", "") else it.options
                it.copy(type = type, options = options)
            }

        fun onEditRequired(value: Boolean) = updateEditing { it.copy(required = value) }

        fun onEditOption(
            index: Int,
            value: String,
        ) = updateEditing { it.copy(options = it.options.toMutableList().also { l -> l[index] = value }) }

        fun addOption() = updateEditing { it.copy(options = it.options + "") }

        fun removeOption(index: Int) = updateEditing { it.copy(options = it.options.filterIndexed { i, _ -> i != index }) }

        fun saveEditing() {
            val e = editing ?: return
            if (!e.draft.canSave) return
            val cleaned = e.draft.copy(options = e.draft.options.filter { it.isNotBlank() })
            questions =
                if (e.isNew) {
                    questions + cleaned
                } else {
                    questions.map { if (it.localId == cleaned.localId) cleaned else it }
                }
            editing = null
            render()
        }

        fun cancelEditing() {
            editing = null
            render()
        }

        /** Red "Delete" action inside the edit group — drops the question being edited. */
        fun deleteEditing() {
            val e = editing ?: return
            if (!e.isNew) questions = questions.filterNot { it.localId == e.draft.localId }
            editing = null
            render()
        }

        fun deleteQuestion(localId: String) {
            questions = questions.filterNot { it.localId == localId }
            if (editing?.draft?.localId == localId) editing = null
            render()
        }

        /** Drag-to-reorder: move the question at [from] to [to] within the custom list. */
        fun moveQuestion(
            from: Int,
            to: Int,
        ) {
            if (from == to || from !in questions.indices || to !in questions.indices) return
            val mutable = questions.toMutableList()
            mutable.add(to, mutable.removeAt(from))
            questions = mutable
            render()
        }

        private fun updateEditing(block: (QuestionDraft) -> QuestionDraft) {
            val e = editing ?: return
            editing = e.copy(draft = block(e.draft))
            render()
        }

        // ─── Save (Done) ────────────────────────────────────────────────────────

        fun save() {
            if (saving) return
            saving = true
            render()
            viewModelScope.launch {
                val body =
                    QuestionsRequest(
                        questions =
                            questions.mapIndexed { i, q ->
                                QuestionInput(
                                    label = q.label.trim(),
                                    fieldType = q.type.backend,
                                    options = if (q.type.hasOptions) q.options.filter { it.isNotBlank() } else null,
                                    required = q.required,
                                    sortOrder = i,
                                )
                            },
                    )
                when (val r = repo.setQuestions(owner, eventTypeId, body)) {
                    is NetworkResult.Success -> {
                        original = questions
                        _saved.value = true
                    }
                    is NetworkResult.Failure -> {
                        saving = false
                        _toast.value = errors.decode(r.error).message()
                        render()
                    }
                }
            }
        }

        fun savedConsumed() {
            _saved.value = false
        }

        fun toastConsumed() {
            _toast.value = null
        }

        private fun render() {
            _state.value =
                IntakeUiState.Content(
                    eventName = eventName,
                    pillar = pillar,
                    questions = questions,
                    editing = editing,
                    isSaving = saving,
                    isDirty = questions != original,
                )
        }

        private fun newLocalId(): String = "q${localCounter++}"

        private fun SchedulingError.message(): String =
            when (this) {
                is SchedulingError.Secret -> "You don't have access to edit these questions."
                is SchedulingError.Generic -> message
                else -> "Couldn't save your questions. Try again."
            }
    }
