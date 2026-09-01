@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.CreateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.models.homes.UpdateMaintenanceRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Nav-arg keys for the Log / Edit / Detail Maintenance routes. */
const val LOG_MAINTENANCE_HOME_ID_KEY = "homeId"
const val LOG_MAINTENANCE_TASK_ID_KEY = "taskId"

/** Whether the form is creating a new task or editing an existing one. */
sealed interface LogMaintenanceFormMode {
    data object Create : LogMaintenanceFormMode

    data class Edit(val taskId: String) : LogMaintenanceFormMode
}

/** Repeat cadence — wraps the backend-accepted recurrence strings plus
 *  a `None` value for the segmented control. */
enum class MaintenanceRecurrence(val raw: String, val label: String) {
    None("one_time", "None"),
    Monthly("monthly", "Monthly"),
    Quarterly("quarterly", "Quarterly"),
    Yearly("yearly", "Yearly"),
    ;

    companion object {
        fun fromRaw(raw: String?): MaintenanceRecurrence = entries.firstOrNull { it.raw == raw } ?: None
    }
}

/** Mutable form state. Equatable so the dirty-check is one comparison. */
data class LogMaintenanceFormState(
    val category: MaintenanceCategory = MaintenanceCategory.Generic,
    val title: String = "",
    val dateCompleted: Instant = Instant.now(),
    val performedBy: MaintenancePerformedBy = MaintenancePerformedBy.Self,
    val performerName: String = "",
    val performerContact: String = "",
    val costText: String = "",
    val notes: String = "",
    val photos: List<MaintenanceDraftFile> = emptyList(),
    val receipt: MaintenanceDraftFile? = null,
    val nextDueEnabled: Boolean = false,
    val nextDueDate: Instant = Instant.now().plusSeconds(SECONDS_IN_30_DAYS),
    val recurrence: MaintenanceRecurrence = MaintenanceRecurrence.None,
    val isSubmitting: Boolean = false,
    val isLoadingExisting: Boolean = false,
    val submitError: String? = null,
) {
    val canSubmit: Boolean
        get() = title.isNotBlank() && !isSubmitting

    /** Slot grid for the 2x2 photos card — pads up to four slots. */
    fun photoSlots(): List<PhotoSlot> =
        (0 until MAX_PHOTOS).map { idx ->
            PhotoSlot(index = idx, file = photos.getOrNull(idx))
        }

    /** One photo slot for rendering. */
    data class PhotoSlot(val index: Int, val file: MaintenanceDraftFile?)

    companion object {
        const val MAX_PHOTOS = 4
        private const val SECONDS_IN_30_DAYS: Long = 30L * 24 * 60 * 60
    }
}

/** Outbound event from the form VM — host listens and routes. */
sealed interface LogMaintenanceFormEvent {
    data object Dismiss : LogMaintenanceFormEvent

    data class Created(val taskId: String) : LogMaintenanceFormEvent

    data class Updated(val taskId: String) : LogMaintenanceFormEvent
}

/**
 * ViewModel backing [LogMaintenanceFormScreen]. Posts to
 * `POST /api/homes/:id/maintenance` (or PUT for an edit) and — when a
 * next-due date is provided — also creates a calendar reminder via
 * `POST /api/homes/:id/events` so the household calendar surfaces the
 * upcoming task.
 *
 * Photos / notes / receipt / performed-by are stored client-side via
 * [MaintenanceDraftStore] because the backend's `HomeMaintenanceLog`
 * schema doesn't carry those columns today. When it does, the relevant
 * fields will move onto [MaintenanceTaskDto] and this store can be
 * dropped in one diff.
 */
@HiltViewModel
class LogMaintenanceFormViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val draftStore: MaintenanceDraftStore,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle[LOG_MAINTENANCE_HOME_ID_KEY]) {
                "LogMaintenanceFormViewModel requires a $LOG_MAINTENANCE_HOME_ID_KEY nav argument"
            }

        private val taskIdArg: String? = savedStateHandle[LOG_MAINTENANCE_TASK_ID_KEY]

        private val mode: LogMaintenanceFormMode =
            taskIdArg?.let { LogMaintenanceFormMode.Edit(it) } ?: LogMaintenanceFormMode.Create

        private val _form = MutableStateFlow(LogMaintenanceFormState())
        val form: StateFlow<LogMaintenanceFormState> = _form.asStateFlow()

        private val _event = MutableStateFlow<LogMaintenanceFormEvent?>(null)
        val event: StateFlow<LogMaintenanceFormEvent?> = _event.asStateFlow()

        private var initial: LogMaintenanceFormState = _form.value

        private val _isDirty = MutableStateFlow(false)
        val isDirty: StateFlow<Boolean> = _isDirty.asStateFlow()

        val screenTitle: String
            get() =
                when (mode) {
                    LogMaintenanceFormMode.Create -> "Log maintenance"
                    is LogMaintenanceFormMode.Edit -> "Edit maintenance"
                }

        val submitLabel: String
            get() =
                when (mode) {
                    LogMaintenanceFormMode.Create -> "Log"
                    is LogMaintenanceFormMode.Edit -> "Save"
                }

        fun loadIfNeeded() {
            val editTaskId = (mode as? LogMaintenanceFormMode.Edit)?.taskId ?: return
            if (_form.value.title.isNotBlank() && initial.title == _form.value.title) return
            _form.value = _form.value.copy(isLoadingExisting = true)
            viewModelScope.launch {
                when (val result = repo.getHomeMaintenance(homeId)) {
                    is NetworkResult.Success -> {
                        val task = result.data.tasks.firstOrNull { it.id == editTaskId }
                        if (task != null) applyExisting(task, editTaskId)
                        _form.value = _form.value.copy(isLoadingExisting = false)
                    }
                    is NetworkResult.Failure ->
                        _form.value = _form.value.copy(isLoadingExisting = false)
                }
            }
        }

        private fun applyExisting(
            task: MaintenanceTaskDto,
            taskId: String,
        ) {
            val stored = draftStore.draft(taskId)
            val inferredCategory = MaintenanceCategory.from(task.task)
            val performedBy =
                stored?.performedBy ?: if (task.vendor.isNullOrBlank()) {
                    MaintenancePerformedBy.Self
                } else {
                    MaintenancePerformedBy.Contractor
                }
            val parsedDue =
                task.dueDate?.let { parseDate(it) } ?: _form.value.nextDueDate
            val merged =
                LogMaintenanceFormState(
                    category = stored?.category ?: inferredCategory,
                    title = task.task,
                    dateCompleted = parseInstant(task.updatedAt ?: task.createdAt) ?: Instant.now(),
                    performedBy = performedBy,
                    performerName = stored?.performerName ?: (task.vendor.orEmpty()),
                    performerContact = stored?.performerContact.orEmpty(),
                    costText = task.cost?.let { formatCost(it) }.orEmpty(),
                    notes = stored?.notes.orEmpty(),
                    photos = stored?.photos ?: emptyList(),
                    receipt = stored?.receipt,
                    nextDueEnabled = task.dueDate != null,
                    nextDueDate = parsedDue,
                    recurrence = MaintenanceRecurrence.fromRaw(task.recurrence),
                )
            _form.value = merged
            initial = merged
            _isDirty.value = false
        }

        // MARK: - Field mutators

        fun updateCategory(value: MaintenanceCategory) = mutate { it.copy(category = value) }

        fun updateTitle(value: String) = mutate { it.copy(title = value) }

        fun updateDateCompleted(value: Instant) = mutate { it.copy(dateCompleted = value) }

        fun updatePerformedBy(value: MaintenancePerformedBy) = mutate { it.copy(performedBy = value) }

        fun updatePerformerName(value: String) = mutate { it.copy(performerName = value) }

        fun updatePerformerContact(value: String) = mutate { it.copy(performerContact = value) }

        fun updateCost(value: String) = mutate { it.copy(costText = value) }

        fun updateNotes(value: String) = mutate { it.copy(notes = value) }

        fun toggleNextDue(enabled: Boolean) = mutate { it.copy(nextDueEnabled = enabled) }

        fun updateNextDueDate(value: Instant) = mutate { it.copy(nextDueDate = value) }

        fun updateRecurrence(value: MaintenanceRecurrence) = mutate { it.copy(recurrence = value) }

        fun addPhoto(file: MaintenanceDraftFile) =
            mutate {
                if (it.photos.size >= LogMaintenanceFormState.MAX_PHOTOS) {
                    it
                } else {
                    it.copy(photos = it.photos + file)
                }
            }

        fun removePhoto(id: String) = mutate { it.copy(photos = it.photos.filterNot { p -> p.id == id }) }

        fun pickReceipt(file: MaintenanceDraftFile?) = mutate { it.copy(receipt = file) }

        fun cancel() {
            _event.value = LogMaintenanceFormEvent.Dismiss
        }

        fun consumeEvent() {
            _event.value = null
        }

        private fun mutate(transform: (LogMaintenanceFormState) -> LogMaintenanceFormState) {
            val next = transform(_form.value)
            _form.value = next
            _isDirty.value = next.copy(isSubmitting = false, submitError = null) !=
                initial.copy(isSubmitting = false, submitError = null)
        }

        // MARK: - Submit

        fun submit() {
            val current = _form.value
            if (!current.canSubmit) return
            _form.value = current.copy(isSubmitting = true, submitError = null)
            viewModelScope.launch {
                val req =
                    CreateMaintenanceRequest(
                        task = current.title.trim(),
                        vendor = encodeVendor(current),
                        cost = parseCost(current.costText),
                        recurrence = current.recurrence.raw,
                        dueDate = if (current.nextDueEnabled) formatDay(current.nextDueDate) else null,
                        status = "completed",
                    )
                val result =
                    when (val m = mode) {
                        LogMaintenanceFormMode.Create -> repo.createHomeMaintenance(homeId, req)
                        is LogMaintenanceFormMode.Edit ->
                            repo.updateHomeMaintenance(
                                homeId,
                                m.taskId,
                                UpdateMaintenanceRequest(
                                    task = req.task,
                                    vendor = req.vendor,
                                    cost = req.cost,
                                    recurrence = req.recurrence,
                                    dueDate = req.dueDate,
                                    status = null,
                                ),
                            )
                    }
                when (result) {
                    is NetworkResult.Success -> {
                        val taskId = result.data.task.id
                        persistExtras(taskId, current)
                        if (current.nextDueEnabled) {
                            postCalendarReminder(current.title.trim(), current.nextDueDate)
                        }
                        Analytics.track(AnalyticsEvent.CtaLogMaintenanceSubmit(AnalyticsResult.SUCCESS))
                        _form.value = current.copy(isSubmitting = false)
                        _event.value =
                            when (mode) {
                                LogMaintenanceFormMode.Create ->
                                    LogMaintenanceFormEvent.Created(taskId)
                                is LogMaintenanceFormMode.Edit ->
                                    LogMaintenanceFormEvent.Updated(taskId)
                            }
                    }
                    is NetworkResult.Failure -> {
                        Analytics.track(AnalyticsEvent.CtaLogMaintenanceSubmit(AnalyticsResult.ERROR))
                        _form.value =
                            current.copy(
                                isSubmitting = false,
                                submitError = result.error.message,
                            )
                    }
                }
            }
        }

        private suspend fun postCalendarReminder(
            taskTitle: String,
            due: Instant,
        ) {
            val req =
                CreateHomeEventRequest(
                    eventType = "maintenance",
                    title = taskTitle,
                    startAt = formatTimestamp(due),
                    description = "Maintenance reminder",
                    alertsEnabled = true,
                )
            // Best-effort — calendar failures don't block the maintenance row.
            repo.createHomeEvent(homeId, req)
        }

        private fun persistExtras(
            taskId: String,
            current: LogMaintenanceFormState,
        ) {
            draftStore.upsert(
                taskId,
                MaintenanceDraft(
                    category = current.category,
                    performedBy = current.performedBy,
                    performerName = current.performerName.trim(),
                    performerContact = current.performerContact.trim(),
                    notes = current.notes.trim(),
                    photos = current.photos,
                    receipt = current.receipt,
                ),
            )
        }

        private fun encodeVendor(current: LogMaintenanceFormState): String? {
            val trimmed = current.performerName.trim()
            return when (current.performedBy) {
                MaintenancePerformedBy.Self -> null
                MaintenancePerformedBy.Member,
                MaintenancePerformedBy.Contractor,
                -> trimmed.ifEmpty { null }
            }
        }

        // MARK: - Static helpers exposed for tests

        companion object {
            private val dayFormatter: DateTimeFormatter =
                DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC)
            private val timestampFormatter: DateTimeFormatter =
                DateTimeFormatter.ISO_INSTANT

            fun parseCost(text: String): BigDecimal? {
                val cleaned =
                    text
                        .trim()
                        .replace("$", "")
                        .replace(",", "")
                if (cleaned.isEmpty()) return null
                return runCatching { BigDecimal(cleaned) }.getOrNull()
            }

            fun formatCost(cost: BigDecimal): String =
                if (cost.stripTrailingZeros().scale() <= 0) {
                    cost.toBigInteger().toString()
                } else {
                    cost.toPlainString()
                }

            fun formatDay(instant: Instant): String = dayFormatter.format(instant.atZone(ZoneOffset.UTC).toLocalDate())

            fun formatTimestamp(instant: Instant): String = timestampFormatter.format(instant)

            fun parseDate(iso: String): Instant {
                // Accept ISO-8601 timestamps and bare YYYY-MM-DD strings.
                return runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        LocalDate.parse(iso).atStartOfDay(ZoneId.of("UTC")).toInstant()
                    }
                    .getOrElse { Instant.now() }
            }

            fun parseInstant(iso: String?): Instant? {
                if (iso.isNullOrBlank()) return null
                return runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        LocalDate.parse(iso).atStartOfDay(ZoneId.of("UTC")).toInstant()
                    }
                    .getOrNull()
            }
        }
    }
