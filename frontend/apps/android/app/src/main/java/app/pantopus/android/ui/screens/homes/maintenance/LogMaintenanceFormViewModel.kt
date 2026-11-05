@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.maintenance

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.homes.CreateDocumentRequest
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.CreateMaintenanceRequest
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.models.homes.UpdateMaintenanceRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.documents.readDocumentBytes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okio.ByteString.Companion.toByteString
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID
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
    val isReadingReceipt: Boolean = false,
    val nextDueEnabled: Boolean = false,
    val nextDueDate: Instant = Instant.now().plusSeconds(SECONDS_IN_30_DAYS),
    val recurrence: MaintenanceRecurrence = MaintenanceRecurrence.None,
    val isSubmitting: Boolean = false,
    val isLoadingExisting: Boolean = false,
    val hasLoadedExisting: Boolean = true,
    val submitError: String? = null,
) {
    val costError: String?
        get() =
            if (costText.isNotBlank() && LogMaintenanceFormViewModel.parseCost(costText) == null) {
                "Enter a cost from $0 to $9,999,999,999.99 with up to two decimal places."
            } else {
                null
            }

    val canSubmit: Boolean
        get() = title.isNotBlank() && costError == null && !isSubmitting && !isReadingReceipt && !isLoadingExisting && hasLoadedExisting

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
 * Notes and receipt links use the existing HomeMaintenanceLog fields. Receipt bytes
 * are uploaded to Home Documents before committing the link; retries reuse both IDs.
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

        private val _form = MutableStateFlow(LogMaintenanceFormState(hasLoadedExisting = taskIdArg == null))
        val form: StateFlow<LogMaintenanceFormState> = _form.asStateFlow()

        private val _event = MutableStateFlow<LogMaintenanceFormEvent?>(null)
        val event: StateFlow<LogMaintenanceFormEvent?> = _event.asStateFlow()

        private var hasPersistedCategory = false
        private var initial: LogMaintenanceFormState = _form.value
        private var pendingCreate: Pair<CreateMaintenanceRequest, String>? = null
        private var uploadedReceipt: Pair<String, String>? = null
        private var receiptRead: Job? = null

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
            if (_form.value.hasLoadedExisting || _form.value.isLoadingExisting) return
            _form.value = _form.value.copy(isLoadingExisting = true, submitError = null)
            viewModelScope.launch {
                when (val result = repo.getHomeMaintenance(homeId)) {
                    is NetworkResult.Success -> {
                        val task = result.data.tasks.firstOrNull { it.id == editTaskId }
                        if (task != null) {
                            applyExisting(task, editTaskId)
                        } else {
                            _form.value =
                                _form.value.copy(
                                    isLoadingExisting = false,
                                    submitError = "This maintenance entry is no longer available. Close this form and refresh the list.",
                                )
                        }
                    }
                    is NetworkResult.Failure ->
                        _form.value =
                            _form.value.copy(
                                isLoadingExisting = false,
                                submitError = "Couldn't load this maintenance entry. Close and reopen it to try again.",
                            )
                }
            }
        }

        private fun applyExisting(
            task: MaintenanceTaskDto,
            taskId: String,
        ) {
            hasPersistedCategory = MaintenanceCategory.entries.any { it.rawValue == task.category }
            val stored = draftStore.draft(taskId)
            val inferredCategory = MaintenanceCategory.from(task.task)
            val storedVendor =
                if (stored?.performedBy == MaintenancePerformedBy.Self) "" else stored?.performerName?.trim()
            val performedBy =
                stored?.performedBy?.takeIf { storedVendor == task.vendor?.trim().orEmpty() }
                    ?: if (task.vendor.isNullOrBlank()) {
                        MaintenancePerformedBy.Self
                    } else {
                        MaintenancePerformedBy.Contractor
                    }
            val parsedDue =
                task.dueDate?.let { parseDate(it) } ?: _form.value.nextDueDate
            val merged =
                LogMaintenanceFormState(
                    category = MaintenanceCategory.entries.firstOrNull { it.rawValue == task.category } ?: inferredCategory,
                    title = task.task,
                    dateCompleted = parseInstant(task.performedAt ?: task.updatedAt ?: task.createdAt) ?: Instant.now(),
                    performedBy = performedBy,
                    performerName = task.vendor.orEmpty(),
                    performerContact = task.performerContact.orEmpty(),
                    costText = task.cost?.let { formatCost(it) }.orEmpty(),
                    notes = task.notes.orEmpty(),
                    receipt =
                        task.documentId?.let {
                            MaintenanceDraftFile(
                                id = it,
                                filename = "Saved receipt",
                                mimeType = "application/octet-stream",
                                bytes = byteArrayOf(),
                                documentId = it,
                            )
                        },
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

        fun pickReceipt(file: MaintenanceDraftFile?) {
            receiptRead?.cancel()
            mutate { it.copy(receipt = file, isReadingReceipt = false, submitError = null) }
        }

        /** Providers may be remote, slow, or report an incorrect size. Keep bounded reads off the UI thread. */
        fun readReceipt(
            resolver: ContentResolver,
            uri: Uri,
        ) {
            receiptRead?.cancel()
            _form.value = _form.value.copy(isReadingReceipt = true, submitError = null)
            receiptRead =
                viewModelScope.launch {
                    try {
                        val file =
                            withContext(Dispatchers.IO) {
                                val name =
                                    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
                                        if (it.moveToFirst()) it.getString(0) else null
                                    }?.takeIf { it.isNotBlank() } ?: "receipt"
                                val mime = resolver.getType(uri) ?: "application/octet-stream"
                                require(mime == "application/pdf" || mime.startsWith("image/"))
                                MaintenanceDraftFile(
                                    filename = name,
                                    mimeType = mime,
                                    bytes = readDocumentBytes { resolver.openInputStream(uri) }.toByteArray(),
                                )
                            }
                        mutate { it.copy(receipt = file, isReadingReceipt = false) }
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        _form.value =
                            _form.value.copy(
                                isReadingReceipt = false,
                                submitError = "Choose a readable, nonempty PDF or image of 25 MB or less.",
                            )
                    }
                }
        }

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
            if (current.photos.isNotEmpty()) {
                _form.value = current.copy(submitError = "Remove separate photos and use Attach receipt to save one PDF or image.")
                return
            }
            _form.value = current.copy(isSubmitting = true, submitError = null)
            viewModelScope.launch {
                val receiptId = uploadReceipt(current) ?: if (current.receipt != null) return@launch else null
                val contact =
                    if (current.performedBy == MaintenancePerformedBy.Contractor) current.performerContact.trim() else ""
                val req =
                    CreateMaintenanceRequest(
                        task = current.title.trim(),
                        notes = current.notes,
                        category = current.category.rawValue,
                        performerContact = contact,
                        vendor = encodeVendor(current),
                        cost = parseCost(current.costText),
                        recurrence = current.recurrence.raw,
                        dueDate = if (current.nextDueEnabled) formatDay(current.nextDueDate) else null,
                        status = "completed",
                        performedAt = current.dateCompleted.toString(),
                        documentId = receiptId,
                    )
                val result =
                    when (val m = mode) {
                        LogMaintenanceFormMode.Create -> {
                            if (pendingCreate?.first != req) pendingCreate = req to UUID.randomUUID().toString()
                            repo.createHomeMaintenance(homeId, req.copy(clientRequestId = pendingCreate?.second))
                        }
                        is LogMaintenanceFormMode.Edit ->
                            repo.updateHomeMaintenance(
                                homeId,
                                m.taskId,
                                updateRequest(current, req, receiptId),
                            )
                    }
                when (result) {
                    is NetworkResult.Success -> {
                        if (!receiptWasSaved(current, result.data.task.documentId, receiptId)) {
                            _form.value =
                                current.copy(
                                    isSubmitting = false,
                                    submitError = "The receipt link was not saved. Your document is in Home Documents. Try again.",
                                )
                            return@launch
                        }
                        pendingCreate = null
                        val taskId = result.data.task.id
                        persistExtras(taskId, current)
                        // Keep the retained next-due date without a hidden family-calendar write.
                        if (current.nextDueEnabled && LaunchFeatures.householdExtras) {
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

        private fun receiptWasSaved(
            current: LogMaintenanceFormState,
            returnedId: String?,
            expectedId: String?,
        ): Boolean = current.receipt == initial.receipt || returnedId == expectedId

        private fun updateRequest(
            current: LogMaintenanceFormState,
            req: CreateMaintenanceRequest,
            receiptId: String?,
        ): UpdateMaintenanceRequest =
            UpdateMaintenanceRequest(
                task = req.task.takeIf { it != initial.title.trim() },
                notes = req.notes.takeIf { current.notes != initial.notes },
                category = req.category.takeIf { current.category != initial.category || !hasPersistedCategory },
                performerContact =
                    req.performerContact.takeIf {
                        current.performerContact != initial.performerContact ||
                            current.performedBy != initial.performedBy
                    },
                vendor = req.vendor.takeIf { it != encodeVendor(initial) },
                cost = req.cost.takeIf { current.costText != initial.costText },
                recurrence = req.recurrence,
                dueDate = req.dueDate,
                status = null,
                performedAt = req.performedAt.takeIf { current.dateCompleted != initial.dateCompleted },
                clearVendor = req.vendor == null && encodeVendor(initial) != null,
                clearCost = current.costText.isBlank() && parseCost(initial.costText) != null,
                documentId = receiptId.takeIf { current.receipt != initial.receipt },
                clearDocument = current.receipt == null && initial.receipt != null,
            )

        private suspend fun uploadReceipt(current: LogMaintenanceFormState): String? {
            val file = current.receipt ?: return null
            val savedId = file.documentId ?: uploadedReceipt?.takeIf { it.first == file.id }?.second
            if (savedId != null) return savedId
            val request =
                CreateDocumentRequest(
                    docType = "receipt",
                    title = file.filename.take(MAX_RECEIPT_TITLE_LENGTH),
                    mimeType = file.mimeType,
                    sizeBytes = file.bytes.size.toLong(),
                    visibility = "members",
                )
            val result = repo.uploadHomeDocument(homeId, file.id, file.filename, file.bytes.toByteString(), request)
            val document = (result as? NetworkResult.Success)?.data?.document
            if (document?.id == file.id && document.fileId == file.id && document.contentUrl != null) {
                uploadedReceipt = file.id to document.id
                return document.id
            }
            _form.value =
                current.copy(
                    isSubmitting = false,
                    submitError = (result as? NetworkResult.Failure)?.error?.message ?: "The receipt was not uploaded. Try again.",
                )
            return null
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
            private const val MAX_RECEIPT_TITLE_LENGTH = 255
            private val costPattern = Regex("""^\$?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?|\.\d{1,2})$""")
            private val maximumCost = BigDecimal("9999999999.99")
            private val dayFormatter: DateTimeFormatter =
                DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC)
            private val timestampFormatter: DateTimeFormatter =
                DateTimeFormatter.ISO_INSTANT

            fun parseCost(text: String): BigDecimal? {
                if (!costPattern.matches(text.trim())) return null
                val cleaned =
                    text
                        .trim()
                        .replace("$", "")
                        .replace(",", "")
                if (cleaned.isEmpty()) return null
                return runCatching { BigDecimal(cleaned) }.getOrNull()?.takeIf { it <= maximumCost }
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
