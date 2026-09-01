@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.P3CreateTaskFromMailRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskDto
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskToGigRequest
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskUpdateRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.mailbox.MailboxTasksRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav-arg keys for the A17.12 mail-task list route. */
const val MAIL_TASK_LIST_MAIL_ID_KEY = "mailId"
const val MAIL_TASK_LIST_SUBJECT_KEY = "mailSubject"
const val MAIL_TASK_LIST_SENDER_KEY = "mailSender"

/** Sentinel the route builder uses when a leg carries no value. */
const val MAIL_TASK_LIST_NONE = "-"

/**
 * A17.12 (list surface) — backs the Mail-tasks screen. Ports the RN
 * behaviour in `src/app/mailbox/tasks.tsx` (:47 load, :57 create, :96
 * toggle, :112 convert):
 *
 *  - `GET api/mailbox/v2/p3/tasks`             → `{ active, completed }`
 *  - `POST api/mailbox/v2/p3/tasks/from-mail`  → create from a mail item
 *  - `PATCH api/mailbox/v2/p3/tasks/:id`       → complete / reopen
 *  - `POST api/mailbox/v2/p3/tasks/:id/to-gig` → post as a neighbor gig
 *
 * Creating needs a `homeId`, which the backend does not infer — RN
 * resolves it from `GET api/homes/my-homes` and takes the first home
 * (`tasks.tsx:70-76`); we do the same and surface the same "No Home"
 * alert when the user has none.
 *
 * Mirrors iOS `MailTaskListViewModel`.
 */
@HiltViewModel
class MailTaskListViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository,
        private val tasksRepository: MailboxTasksRepository,
        private val homesRepository: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /** The originating mail, when the screen was opened from one. */
        val mailId: String? = savedStateHandle.get<String>(MAIL_TASK_LIST_MAIL_ID_KEY).orNone()
        val mailSubject: String? = savedStateHandle.get<String>(MAIL_TASK_LIST_SUBJECT_KEY).orNone()
        val mailSender: String? = savedStateHandle.get<String>(MAIL_TASK_LIST_SENDER_KEY).orNone()

        private val _state = MutableStateFlow<MailTaskListUiState>(MailTaskListUiState.Loading)
        val state: StateFlow<MailTaskListUiState> = _state.asStateFlow()

        private val _mode = MutableStateFlow(if (mailId == null) MailTaskListMode.List else MailTaskListMode.Create)
        val mode: StateFlow<MailTaskListMode> = _mode.asStateFlow()

        private val _showsCompleted = MutableStateFlow(false)
        val showsCompleted: StateFlow<Boolean> = _showsCompleted.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _alert = MutableStateFlow<MailTaskListAlert?>(null)
        val alert: StateFlow<MailTaskListAlert?> = _alert.asStateFlow()

        private val _convertTarget = MutableStateFlow<MailTaskRow?>(null)
        val convertTarget: StateFlow<MailTaskRow?> = _convertTarget.asStateFlow()

        // Create-form fields
        private val _draftTitle = MutableStateFlow(mailSubject.orEmpty())
        val draftTitle: StateFlow<String> = _draftTitle.asStateFlow()

        private val _draftDescription = MutableStateFlow("")
        val draftDescription: StateFlow<String> = _draftDescription.asStateFlow()

        private val _draftPriority = MutableStateFlow(MailTaskPriority.Medium)
        val draftPriority: StateFlow<MailTaskPriority> = _draftPriority.asStateFlow()

        private val _isCreating = MutableStateFlow(false)
        val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

        private val _convertingTaskId = MutableStateFlow<String?>(null)
        val convertingTaskId: StateFlow<String?> = _convertingTaskId.asStateFlow()

        private var onOpenTask: (String) -> Unit = {}
        private var onBack: () -> Unit = {}
        private var onPostAsNeighborTask: (String) -> Unit = {}

        /** Wire nav callbacks before first paint. */
        fun configureNavigation(
            onOpenTask: (String) -> Unit = {},
            onBack: () -> Unit = {},
            onPostAsNeighborTask: (String) -> Unit = {},
        ) {
            this.onOpenTask = onOpenTask
            this.onBack = onBack
            this.onPostAsNeighborTask = onPostAsNeighborTask
        }

        // ── Lifecycle ────────────────────────────────────────────

        fun load() {
            if (_state.value is MailTaskListUiState.Loaded) return
            fetch()
        }

        fun refresh() = fetch()

        private fun fetch() {
            _state.value = MailTaskListUiState.Loading
            viewModelScope.launch {
                when (val result = repository.p3Tasks()) {
                    is NetworkResult.Success -> {
                        val active = result.data.active.map(::rowFrom)
                        val completed = result.data.completed.map(::rowFrom)
                        _state.value =
                            if (active.isEmpty() && completed.isEmpty()) {
                                MailTaskListUiState.Empty
                            } else {
                                MailTaskListUiState.Loaded(active = active, completed = completed)
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            MailTaskListUiState.Error(
                                "We couldn't load your mail tasks. Check your connection and try again.",
                            )
                }
            }
        }

        // ── UI signals ───────────────────────────────────────────

        fun consumeToast() {
            _toast.value = null
        }

        fun dismissAlert() {
            _alert.value = null
        }

        fun toggleShowCompleted() {
            _showsCompleted.value = !_showsCompleted.value
        }

        fun updateDraftTitle(value: String) {
            _draftTitle.value = value
        }

        fun updateDraftDescription(value: String) {
            _draftDescription.value = value
        }

        fun updateDraftPriority(value: MailTaskPriority) {
            _draftPriority.value = value
        }

        // ── Navigation intents ───────────────────────────────────

        fun tapBack() {
            if (_mode.value == MailTaskListMode.Create && mailId != null) {
                // RN's create frame backs out to the list, not out of the screen.
                _mode.value = MailTaskListMode.List
                return
            }
            onBack()
        }

        fun openTask(row: MailTaskRow) = onOpenTask(row.id)

        fun cancelCreate() {
            _mode.value = MailTaskListMode.List
        }

        /**
         * A17.8 → "Ask a Neighbor". RN's create frame offers "Post as Neighbor
         * Task Instead", which leaves the task pipeline entirely and opens the
         * package-gig form for the source mail in post-delivery mode
         * (`src/app/mailbox/tasks.tsx:231-240`).
         */
        fun postAsNeighborTask() {
            val mail = mailId
            if (mail == null) {
                _alert.value =
                    MailTaskListAlert(
                        title = "No Mail",
                        message = "This task must be linked to a mail item.",
                    )
                return
            }
            onPostAsNeighborTask(mail)
        }

        // ── Create ───────────────────────────────────────────────

        /**
         * `POST …/p3/tasks/from-mail`. Resolves the home first (the backend
         * requires an explicit `homeId`), then prepends the created task to
         * the active bucket and returns to the list frame.
         */
        fun create() {
            val title = _draftTitle.value.trim()
            if (title.isEmpty()) {
                _alert.value = MailTaskListAlert("Title Required", "Please enter a task title.")
                return
            }
            val mail = mailId
            if (mail == null) {
                _alert.value = MailTaskListAlert("No Mail", "This task must be linked to a mail item.")
                return
            }
            if (_isCreating.value) return
            _isCreating.value = true
            viewModelScope.launch {
                try {
                    val homeId = firstHomeId()
                    if (homeId == null) {
                        _alert.value = MailTaskListAlert("No Home", "You need to be associated with a home.")
                        return@launch
                    }
                    val description = _draftDescription.value.trim()
                    val result =
                        tasksRepository.createTaskFromMail(
                            P3CreateTaskFromMailRequest(
                                mailId = mail,
                                homeId = homeId,
                                title = title,
                                description = description.ifEmpty { null },
                                priority = _draftPriority.value.wireValue(),
                            ),
                        )
                    when (result) {
                        is NetworkResult.Success -> {
                            val row = rowFrom(result.data.task)
                            insertActive(row)
                            _draftDescription.value = ""
                            _draftPriority.value = MailTaskPriority.Medium
                            _mode.value = MailTaskListMode.List
                            _toast.value = "“${row.title}” has been created"
                        }
                        is NetworkResult.Failure ->
                            _alert.value = MailTaskListAlert("Error", "Could not create task.")
                    }
                } finally {
                    _isCreating.value = false
                }
            }
        }

        /**
         * RN resolves the home with `api.homes.getHomes()` and takes the
         * first entry (`tasks.tsx:70-76`).
         */
        private suspend fun firstHomeId(): String? =
            when (val result = homesRepository.myHomes()) {
                is NetworkResult.Success -> result.data.homes.firstOrNull()?.id
                is NetworkResult.Failure -> null
            }

        // ── Complete / reopen ────────────────────────────────────

        /**
         * Optimistically move the row between buckets, then persist with
         * `PATCH …/p3/tasks/:id`. Rolls back and alerts on failure.
         */
        fun toggle(row: MailTaskRow) {
            val current = _state.value as? MailTaskListUiState.Loaded ?: return
            val nextDone = !row.isDone
            val moved = row.copy(isDone = nextDone)
            _state.value =
                if (nextDone) {
                    MailTaskListUiState.Loaded(
                        active = current.active.filterNot { it.id == row.id },
                        completed = listOf(moved) + current.completed,
                    )
                } else {
                    MailTaskListUiState.Loaded(
                        active = listOf(moved) + current.active,
                        completed = current.completed.filterNot { it.id == row.id },
                    )
                }
            val status = if (nextDone) "completed" else "pending"
            viewModelScope.launch {
                val result = repository.updateP3Task(row.id, P3TaskUpdateRequest(status = status))
                if (result is NetworkResult.Failure) {
                    restore(row)
                    _alert.value = MailTaskListAlert("Error", "Could not update task.")
                }
            }
        }

        /** Undo an optimistic toggle by putting the row back where it was. */
        private fun restore(row: MailTaskRow) {
            val current = _state.value as? MailTaskListUiState.Loaded ?: return
            val active = current.active.filterNot { it.id == row.id }
            val completed = current.completed.filterNot { it.id == row.id }
            _state.value =
                if (row.isDone) {
                    MailTaskListUiState.Loaded(active = active, completed = listOf(row) + completed)
                } else {
                    MailTaskListUiState.Loaded(active = listOf(row) + active, completed = completed)
                }
        }

        // ── Convert to neighbor gig ──────────────────────────────

        /**
         * Row tap on an unconverted task opens the RN confirm sheet
         * ("Post as Task" / "Close").
         */
        fun requestConvert(row: MailTaskRow) {
            if (row.isConvertedToGig) return
            _convertTarget.value = row
        }

        fun dismissConvert() {
            _convertTarget.value = null
        }

        /**
         * `POST …/p3/tasks/:id/to-gig`. On success the backend links the gig
         * onto the task and flips it to `in_progress`; we mirror that by
         * badging the row.
         */
        fun confirmConvert() {
            val row = _convertTarget.value ?: return
            _convertTarget.value = null
            _convertingTaskId.value = row.id
            viewModelScope.launch {
                try {
                    val detail = row.detail.trim()
                    val result =
                        tasksRepository.convertTaskToGig(
                            row.id,
                            P3TaskToGigRequest(
                                title = row.title,
                                description = detail.ifEmpty { null },
                            ),
                        )
                    when (result) {
                        is NetworkResult.Success -> {
                            markConverted(row.id)
                            val title = result.data.title ?: row.title
                            _toast.value = "“$title” posted as a neighbor task"
                        }
                        is NetworkResult.Failure ->
                            _alert.value = MailTaskListAlert("Error", "Could not convert to gig.")
                    }
                } finally {
                    _convertingTaskId.value = null
                }
            }
        }

        private fun markConverted(taskId: String) {
            val current = _state.value as? MailTaskListUiState.Loaded ?: return
            _state.value =
                MailTaskListUiState.Loaded(
                    active = current.active.map { if (it.id == taskId) it.copy(isConvertedToGig = true) else it },
                    completed = current.completed.map { if (it.id == taskId) it.copy(isConvertedToGig = true) else it },
                )
        }

        private fun insertActive(row: MailTaskRow) {
            val current = _state.value as? MailTaskListUiState.Loaded
            _state.value =
                if (current == null) {
                    MailTaskListUiState.Loaded(active = listOf(row), completed = emptyList())
                } else {
                    MailTaskListUiState.Loaded(
                        active = listOf(row) + current.active,
                        completed = current.completed,
                    )
                }
        }

        // ── DTO → projection ─────────────────────────────────────

        private fun rowFrom(dto: P3TaskDto): MailTaskRow =
            MailTaskRow(
                id = dto.id,
                title = dto.title,
                detail = dto.description.orEmpty(),
                priority =
                    when (dto.priority) {
                        "high" -> MailTaskPriority.High
                        "low" -> MailTaskPriority.Low
                        else -> MailTaskPriority.Medium
                    },
                dueLabel = dueLabel(dto.dueAt),
                mailSender = dto.mailSender,
                mailPreview = dto.mailPreview,
                isDone = dto.status == "completed",
                isConvertedToGig = !dto.convertedToGigId.isNullOrEmpty(),
            )

        private fun dueLabel(dueAt: String?): String? {
            val instant = parseInstant(dueAt) ?: return null
            val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
            val today = LocalDate.now()
            return when (date) {
                today -> "Due today"
                today.plusDays(1) -> "Due tomorrow"
                else -> "Due ${date.format(DAY_MONTH_FORMAT)}"
            }
        }

        private fun parseInstant(value: String?): Instant? {
            value ?: return null
            return runCatching { OffsetDateTime.parse(value).toInstant() }
                .recoverCatching { Instant.parse(value) }
                .recoverCatching { LocalDate.parse(value).atStartOfDay(ZoneId.systemDefault()).toInstant() }
                .getOrNull()
        }

        private companion object {
            private val DAY_MONTH_FORMAT = DateTimeFormatter.ofPattern("MMM d", Locale.US)
        }
    }

/** `low / medium / high` as the backend spells it. */
fun MailTaskPriority.wireValue(): String =
    when (this) {
        MailTaskPriority.High -> "high"
        MailTaskPriority.Medium -> "medium"
        MailTaskPriority.Low -> "low"
    }

/** Nav args cannot carry nulls, so absent legs travel as [MAIL_TASK_LIST_NONE]. */
private fun String?.orNone(): String? = this?.takeIf { it.isNotBlank() && it != MAIL_TASK_LIST_NONE }
