@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskDto
import app.pantopus.android.data.api.models.mailbox.v2.P3TaskUpdateRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav arg key for the A17.12 mail-task detail route (`mailbox/tasks/{taskId}`). */
const val MAIL_TASK_TASK_ID_KEY = "taskId"

/**
 * A17.12 / Block 2A — Mail-task detail view-model. The live path (no
 * seed configured) fetches `GET /api/mailbox/v2/p3/tasks` and selects the
 * task by id (there is no detail-by-id route), mapping the flat HomeTask
 * fields — title / reference / priority / due / status / source-mail link
 * — into [MailTaskContent]. The rich AI elf, subtask checklist, snooze,
 * completion summary, and next-up slots have no backend source, so they
 * stay null/empty and the screen hides them (never faked). Mark-done /
 * reopen round-trip via `PATCH /p3/tasks/:id`. Configuring a [MailTaskSeed]
 * keeps the view-model local (the preview / test seam).
 *
 * Mirrors iOS `MailTaskViewModel`.
 */
@HiltViewModel
class MailTaskViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val taskId: String = savedStateHandle.get<String>(MAIL_TASK_TASK_ID_KEY) ?: "t_412elm"

        /** Non-null → preview / test seam (project the sample fixture, no fetch). */
        private var seed: MailTaskSeed? = null

        private val _state = MutableStateFlow<MailTaskUiState>(MailTaskUiState.Loading)
        val state: StateFlow<MailTaskUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _showsDelegateSheet = MutableStateFlow(false)
        val showsDelegateSheet: StateFlow<Boolean> = _showsDelegateSheet.asStateFlow()

        private var onOpenMail: (String) -> Unit = {}
        private var onBack: () -> Unit = {}

        /** Wire nav callbacks before first paint. */
        fun configureNavigation(
            onOpenMail: (String) -> Unit = {},
            onBack: () -> Unit = {},
        ) {
            this.onOpenMail = onOpenMail
            this.onBack = onBack
        }

        /** Preview / test seam — pin a sample frame instead of fetching. */
        fun configureSeed(seed: MailTaskSeed) {
            this.seed = seed
            if (_state.value is MailTaskUiState.Loaded) {
                _state.value = MailTaskUiState.Loaded(MailTaskSampleData.task(taskId, seed))
            }
        }

        fun load() {
            if (_state.value is MailTaskUiState.Loaded) return
            val seed = this.seed
            if (seed != null) {
                _state.value = MailTaskUiState.Loaded(MailTaskSampleData.task(taskId, seed))
            } else {
                fetch()
            }
        }

        /** Retry after an error frame. */
        fun retry() = fetch()

        private fun fetch() {
            _state.value = MailTaskUiState.Loading
            viewModelScope.launch {
                when (val result = repository.p3Tasks()) {
                    is NetworkResult.Success -> {
                        val all = result.data.active + result.data.completed
                        val dto = all.firstOrNull { it.id == taskId }
                        _state.value =
                            if (dto != null) {
                                MailTaskUiState.Loaded(contentFrom(dto))
                            } else {
                                MailTaskUiState.Error("This task is no longer available.")
                            }
                    }
                    is NetworkResult.Failure -> {
                        // Fixed copy mirrors iOS MailTaskViewModel for cross-platform
                        // parity (Block 2G) — not the raw repository message.
                        _state.value =
                            MailTaskUiState.Error(
                                "We couldn't load this task. Check your connection and try again.",
                            )
                    }
                }
            }
        }

        // MARK: - Derived chrome

        /** True once the task is marked done — flips the dock + hero treatment. */
        val isDone: Boolean
            get() = (_state.value as? MailTaskUiState.Loaded)?.content?.isDone ?: (seed == MailTaskSeed.Done)

        fun consumeToast() {
            _toast.value = null
        }

        // MARK: - View intents

        fun tapBack() = onBack()

        /**
         * Toggle a checklist subtask. Live tasks carry no subtasks, so this
         * only fires in the sample/preview path. No-op once done.
         */
        fun toggleSubtask(id: String) {
            val current = _state.value as? MailTaskUiState.Loaded ?: return
            if (current.content.isDone) return
            val updated =
                current.content.subtasks.map { subtask ->
                    if (subtask.id == id) subtask.copy(isDone = !subtask.isDone) else subtask
                }
            _state.value = MailTaskUiState.Loaded(current.content.copy(subtasks = updated))
        }

        /** Mark the whole task done — optimistic flip + `PATCH status=completed`. */
        fun markDone() {
            val current = _state.value as? MailTaskUiState.Loaded ?: return
            if (current.content.isDone) return
            _state.value = MailTaskUiState.Loaded(current.content.copy(isDone = true))
            _toast.value = "Marked done"
            persistStatus("completed", rollbackDoneTo = false)
        }

        /** Reopen a completed task — optimistic flip + `PATCH status=pending`. */
        fun reopen() {
            val current = _state.value as? MailTaskUiState.Loaded ?: return
            if (!current.content.isDone) return
            _state.value = MailTaskUiState.Loaded(current.content.copy(isDone = false))
            _toast.value = "Task reopened"
            persistStatus("pending", rollbackDoneTo = true)
        }

        /** Persist the done/open flip. No-op in the seeded path; rolls back on failure. */
        private fun persistStatus(
            status: String,
            rollbackDoneTo: Boolean,
        ) {
            if (seed != null) return
            viewModelScope.launch {
                val result = repository.updateP3Task(taskId, P3TaskUpdateRequest(status = status))
                if (result is NetworkResult.Failure) {
                    val current = _state.value as? MailTaskUiState.Loaded ?: return@launch
                    _state.value = MailTaskUiState.Loaded(current.content.copy(isDone = rollbackDoneTo))
                    _toast.value = "Couldn't save — try again"
                }
            }
        }

        /** Quick-snooze tap — pushes due date out one day via PATCH. */
        fun snooze(optionId: String) {
            val current = _state.value as? MailTaskUiState.Loaded ?: return
            val option = current.content.snoozeOptions.firstOrNull { it.id == optionId } ?: return
            _toast.value = "Snoozed · ${option.label}"
            snoozeByDays(1)
        }

        private fun snoozeByDays(days: Int) {
            // Seeded preview / test path never writes, same as [persistStatus].
            if (seed != null) return
            viewModelScope.launch {
                val due =
                    java.time.Instant
                        .now()
                        .plus(java.time.Duration.ofDays(days.toLong()))
                        .toString()
                val result = repository.updateP3Task(taskId, P3TaskUpdateRequest(dueAt = due))
                if (result is NetworkResult.Failure) {
                    _toast.value = "Couldn't snooze — try again"
                }
            }
        }

        /** Open the snooze picker from the dock chip. Stubbed. */
        fun snoozeFromDock() {
            _toast.value = "Snooze options"
        }

        /** Delegate → "Hand this off · Home drawer". Opens the delegate sheet. */
        fun delegate() {
            _showsDelegateSheet.value = true
        }

        fun dismissDelegateSheet() {
            _showsDelegateSheet.value = false
        }

        /** Open the originating mail ([SourceMailCard] tap). */
        fun openSourceMail() {
            val content = (_state.value as? MailTaskUiState.Loaded)?.content ?: return
            content.source?.let { onOpenMail(it.mailId) }
        }

        /** Open the next-up suggestion ([NextUpCard] tap, done frame). */
        fun openNextUp() {
            val content = (_state.value as? MailTaskUiState.Loaded)?.content ?: return
            content.nextUp?.let { onOpenMail(it.mailId) }
        }

        /** Add-a-step affordance on the checklist header. Stubbed. */
        fun addStep() {
            _toast.value = "Add a step"
        }

        /** Calendar dock chip (open frame) — stubbed. */
        fun addToCalendar() {
            _toast.value = "Added to calendar"
        }

        /** "View confirmation" dock chip — opens the source mail when linked. */
        fun viewConfirmation() {
            openSourceMail()
        }

        /**
         * Archive dock chip. It only renders on the completed frame, and the
         * backend has no archived status for tasks (`PATCH /p3/tasks/:id`
         * accepts pending / in_progress / completed) — so archiving means
         * "make sure it's done, then put it away". [markDone] no-ops when it
         * already is; the dismissal is what the user sees.
         */
        fun archive() {
            markDone()
            onBack()
        }

        // MARK: - DTO → projection

        private fun contentFrom(dto: P3TaskDto): MailTaskContent {
            val priority =
                when (dto.priority) {
                    "high" -> MailTaskPriority.High
                    "low" -> MailTaskPriority.Low
                    else -> MailTaskPriority.Medium
                }
            return MailTaskContent(
                taskId = dto.id,
                timeLabel = timeLabel(dto.createdAt),
                title = dto.title,
                reference = dto.description.orEmpty(),
                priority = priority,
                due = dueFrom(dto.dueAt),
                source = sourceFrom(dto),
                isDone = dto.status == "completed",
            )
        }

        private fun sourceFrom(dto: P3TaskDto): MailTaskSourceMail? {
            val mailId = dto.mailId?.takeIf { it.isNotEmpty() } ?: return null
            return MailTaskSourceMail(
                mailId = mailId,
                categoryLabel = "Mail",
                sender = dto.mailSender.orEmpty(),
                title = dto.mailPreview ?: "Original mail",
                snippet = "",
                time = "",
            )
        }

        private fun timeLabel(createdAt: String?): String {
            val instant = parseInstant(createdAt) ?: return "Auto-created"
            val minutes = Duration.between(instant, Instant.now()).toMinutes().coerceAtLeast(0)
            val relative =
                when {
                    minutes < 1 -> "just now"
                    minutes < 60 -> "${minutes}m ago"
                    minutes < 1440 -> "${minutes / 60}h ago"
                    else -> "${minutes / 1440}d ago"
                }
            return "Auto-created · $relative"
        }

        private fun dueFrom(dueAt: String?): MailTaskDue? {
            val instant = parseInstant(dueAt) ?: return null
            val zoned = instant.atZone(ZoneId.systemDefault())
            return MailTaskDue(
                weekday = zoned.format(WEEKDAY_FORMAT).uppercase(Locale.US),
                day = zoned.dayOfMonth.toString(),
                month = zoned.format(MONTH_FORMAT).uppercase(Locale.US),
                label = dueLabel(zoned.toLocalDate()),
                time = zoned.format(TIME_FORMAT),
                // No backend source — the live path hides the DueSnoozeCard
                // that would render these, so they stay blank rather than faked.
                left = "",
                reminderLabel = "",
                closesLabel = "",
            )
        }

        private fun dueLabel(date: LocalDate): String {
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
            private val WEEKDAY_FORMAT = DateTimeFormatter.ofPattern("EEE", Locale.US)
            private val MONTH_FORMAT = DateTimeFormatter.ofPattern("MMM", Locale.US)
            private val TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            private val DAY_MONTH_FORMAT = DateTimeFormatter.ofPattern("MMM d", Locale.US)
        }
    }
