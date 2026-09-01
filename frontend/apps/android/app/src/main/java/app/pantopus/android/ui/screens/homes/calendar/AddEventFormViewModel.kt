@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "TooManyFunctions",
    "LongMethod",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.UpdateHomeEventRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.maxLength
import app.pantopus.android.ui.screens.shared.form.required
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav-arg keys for the Add Event form. */
const val ADD_EVENT_HOME_ID_KEY = "homeId"
const val ADD_EVENT_EVENT_ID_KEY = "eventId"
const val ADD_EVENT_PREFILLED_CATEGORY_KEY = "prefilledCategory"

/** Stable identifiers for free-text fields backed by FormFieldState. */
enum class AddEventField(val key: String) {
    Title("title"),
    Location("location"),
    Notes("notes"),
}

/** Recurrence choices the form exposes. Mapped to iCal RRULE on submit. */
enum class AddEventRecurrence(val rawValue: String) {
    None("none"),
    Daily("daily"),
    Weekly("weekly"),
    Monthly("monthly"),
    Yearly("yearly"),
    ;

    val label: String
        get() =
            when (this) {
                None -> "Does not repeat"
                Daily -> "Repeats daily"
                Weekly -> "Repeats weekly"
                Monthly -> "Repeats monthly"
                Yearly -> "Repeats yearly"
            }

    /** Compact label rendered in the segmented control. */
    val segmentedLabel: String
        get() =
            when (this) {
                None -> "No"
                Daily -> "Daily"
                Weekly -> "Weekly"
                Monthly -> "Monthly"
                Yearly -> "Yearly"
            }

    /** Serialize to an iCal RRULE. [None] → null. */
    val rrule: String?
        get() =
            when (this) {
                None -> null
                Daily -> "FREQ=DAILY"
                Weekly -> "FREQ=WEEKLY"
                Monthly -> "FREQ=MONTHLY"
                Yearly -> "FREQ=YEARLY"
            }

    companion object {
        /** The four options surfaced in the picker (matches design + iOS). */
        val pickerOptions: List<AddEventRecurrence> = listOf(None, Daily, Weekly, Monthly)

        /** Best-effort inverse for prefilling on edit. */
        fun from(rrule: String?): AddEventRecurrence {
            val upper = rrule?.uppercase(Locale.ROOT).orEmpty()
            if (upper.isEmpty()) return None
            return when {
                "FREQ=DAILY" in upper -> Daily
                "FREQ=WEEKLY" in upper -> Weekly
                "FREQ=MONTHLY" in upper -> Monthly
                "FREQ=YEARLY" in upper -> Yearly
                else -> None
            }
        }
    }
}

/**
 * Reminder lead-time offset, in minutes-before-start. Multi-select; the
 * wire sends a `reminders` array (minutes) + a derived `alerts_enabled`
 * boolean. Mirrors iOS `AddEventReminderOffset`.
 */
enum class AddEventReminderOffset(val minutes: Int, val label: String) {
    AtTime(0, "At time"),
    TenMin(10, "10 min"),
    OneHour(60, "1 hour"),
    OneDay(1440, "1 day"),
    ;

    companion object {
        fun fromMinutes(minutes: Int): AddEventReminderOffset? = entries.firstOrNull { it.minutes == minutes }
    }
}

/** Attendee row surfaced in the multi-pick. */
data class AddEventAttendee(
    val id: String,
    val displayName: String,
    val initials: String,
)

/** Tone+text bundle the screen renders as a toast. */
data class AddEventToast(
    val text: String,
    val isError: Boolean,
)

/** Outbound event after a successful commit. */
sealed interface AddEventCommit {
    data class Created(val eventId: String) : AddEventCommit

    data class Updated(val eventId: String) : AddEventCommit
}

/** UI state for the Add / Edit Event form. */
data class AddEventUiState(
    val fields: Map<AddEventField, FormFieldState> =
        AddEventField.entries.associateWith { FormFieldState(id = it.key) },
    val category: CalendarEventCategory = CalendarEventCategory.Generic,
    val allDay: Boolean = false,
    val startDate: ZonedDateTime,
    val endDate: ZonedDateTime? = null,
    val recurrence: AddEventRecurrence = AddEventRecurrence.None,
    val reminderOffsets: Set<AddEventReminderOffset> = setOf(AddEventReminderOffset.TenMin),
    val requestRsvp: Boolean = false,
    val attendees: List<AddEventAttendee> = emptyList(),
    val selectedAttendeeIds: Set<String> = emptySet(),
    val isEditing: Boolean = false,
    val isLoadingMembers: Boolean = true,
    val isSaving: Boolean = false,
    /**
     * True when editing but the source event could not be fetched — the
     * form shows default values, so committing would overwrite the event
     * with blanks. Blocks [isValid] until a reload succeeds.
     */
    val editingLoadFailed: Boolean = false,
    val toast: AddEventToast? = null,
    val commit: AddEventCommit? = null,
    val baseline: AddEventBaseline,
) {
    val aggregate: FormAggregate
        get() = FormAggregate.from(AddEventField.entries.mapNotNull { fields[it] })

    val title: String
        get() = if (isEditing) "Edit event" else "New event"

    val commitLabel: String
        get() = "Save"

    /** End-date inline error when end < start. */
    val endError: String?
        get() =
            if (endDate != null && endDate.isBefore(startDate)) {
                "End time is before the start time"
            } else {
                null
            }

    val isValid: Boolean
        get() {
            if (editingLoadFailed) return false
            val title = fields[AddEventField.Title]?.value?.trim().orEmpty()
            if (title.isEmpty()) return false
            if (fields.values.any { it.error != null }) return false
            if (endError != null) return false
            return true
        }

    val isDirty: Boolean
        get() {
            if (fields.values.any { it.isDirty }) return true
            if (category != baseline.category) return true
            if (allDay != baseline.allDay) return true
            if (startDate.toInstant() != baseline.start.toInstant()) return true
            if (endDate?.toInstant() != baseline.end?.toInstant()) return true
            if (recurrence != baseline.recurrence) return true
            if (reminderOffsets != baseline.reminderOffsets) return true
            if (requestRsvp != baseline.requestRsvp) return true
            if (selectedAttendeeIds != baseline.attendees) return true
            return false
        }
}

/** Frozen original-values used for dirty diffing. */
data class AddEventBaseline(
    val category: CalendarEventCategory,
    val allDay: Boolean,
    val start: ZonedDateTime,
    val end: ZonedDateTime?,
    val recurrence: AddEventRecurrence,
    val reminderOffsets: Set<AddEventReminderOffset>,
    val requestRsvp: Boolean,
    val attendees: Set<String>,
)

@HiltViewModel
class AddEventFormViewModel
    internal constructor(
        private val repo: HomesRepository,
        private val membersRepo: HomeMembersRepository,
        private val networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
        // Device-local zone: the picked wall-time is interpreted in the
        // user's own timezone and converted to a true instant on the wire,
        // matching iOS's SwiftUI DatePicker semantics (no timeZone override).
        // Tests inject a fixed zone for determinism.
        private val zone: ZoneId = ZoneId.systemDefault(),
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomesRepository,
            membersRepo: HomeMembersRepository,
            networkMonitor: NetworkMonitor,
            savedStateHandle: SavedStateHandle,
        ) : this(repo, membersRepo, networkMonitor, savedStateHandle, Instant::now, ZoneId.systemDefault())

        private val homeId: String =
            requireNotNull(savedStateHandle[ADD_EVENT_HOME_ID_KEY]) {
                "AddEventFormViewModel requires a '$ADD_EVENT_HOME_ID_KEY' nav arg."
            }
        private val editingEventId: String? = savedStateHandle.get<String>(ADD_EVENT_EVENT_ID_KEY)
        private val prefilledCategoryRaw: String? =
            savedStateHandle.get<String>(ADD_EVENT_PREFILLED_CATEGORY_KEY)

        val isOnline: StateFlow<Boolean> get() = networkMonitor.isOnline

        private val _state: MutableStateFlow<AddEventUiState>
        val state: StateFlow<AddEventUiState>

        private var editingSource: CalendarEventDto? = null

        init {
            val isEditing = editingEventId != null
            val defaultStart = defaultStart(clock(), zone)
            val initialCategory =
                if (prefilledCategoryRaw != null) {
                    CalendarEventCategory.from(prefilledCategoryRaw)
                } else {
                    CalendarEventCategory.Generic
                }
            val defaultEnd = defaultStart.plusHours(1)
            val baseline =
                AddEventBaseline(
                    category = CalendarEventCategory.Generic,
                    allDay = false,
                    start = defaultStart,
                    end = defaultEnd,
                    recurrence = AddEventRecurrence.None,
                    reminderOffsets = setOf(AddEventReminderOffset.TenMin),
                    requestRsvp = false,
                    attendees = emptySet(),
                )
            _state =
                MutableStateFlow(
                    AddEventUiState(
                        startDate = defaultStart,
                        endDate = defaultEnd,
                        category = initialCategory,
                        isEditing = isEditing,
                        baseline = baseline,
                    ),
                )
            state = _state.asStateFlow()
        }

        // MARK: - Lifecycle

        fun load() {
            viewModelScope.launch {
                val source = if (editingEventId != null) fetchEditingSource() else null
                editingSource = source
                source?.let { hydrate(it) }
                fetchOccupants()
            }
        }

        private suspend fun fetchEditingSource(): CalendarEventDto? {
            val result = repo.getHomeEvent(homeId, editingEventId!!)
            return when (result) {
                is NetworkResult.Success -> {
                    _state.update { it.copy(editingLoadFailed = false) }
                    result.data.event
                }
                is NetworkResult.Failure -> {
                    // Block Save: the form still holds defaults, and a PUT from
                    // here would overwrite the event with blanks.
                    _state.update {
                        it.copy(
                            editingLoadFailed = true,
                            toast = AddEventToast("Couldn't load this event.", isError = true),
                        )
                    }
                    null
                }
            }
        }

        private suspend fun fetchOccupants() {
            when (val result = membersRepo.listOccupants(homeId)) {
                is NetworkResult.Success -> {
                    val attendees =
                        result.data.occupants
                            .filter { it.isActive }
                            .map(::projectAttendee)
                    _state.update { it.copy(attendees = attendees, isLoadingMembers = false) }
                }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isLoadingMembers = false,
                            toast = AddEventToast("Couldn't load household members.", isError = true),
                        )
                    }
            }
        }

        private fun hydrate(source: CalendarEventDto) {
            val start = parseIsoInstant(source.startAt)?.atZone(zone) ?: return
            val end = source.endAt?.let { parseIsoInstant(it)?.atZone(zone) }
            val allDay = isAllDayHeuristic(start, end, source.endAt)
            val category = CalendarEventCategory.from(source.eventType)
            val recurrence = AddEventRecurrence.from(source.recurrenceRule)
            val reminders =
                when {
                    source.reminders != null ->
                        source.reminders.mapNotNull { AddEventReminderOffset.fromMinutes(it) }.toSet()
                    source.alertsEnabled == true -> setOf(AddEventReminderOffset.TenMin)
                    else -> emptySet()
                }
            val requestRsvp = source.requestRsvp == true
            val attendees = source.assignedTo?.toSet().orEmpty()

            val titleError = titleValidator.validate(source.title)
            val titleField =
                FormFieldState(
                    id = AddEventField.Title.key,
                    value = source.title,
                    originalValue = source.title,
                    touched = false,
                    error = titleError,
                )
            val locationField =
                FormFieldState(
                    id = AddEventField.Location.key,
                    value = source.locationNotes.orEmpty(),
                    originalValue = source.locationNotes.orEmpty(),
                )
            val notesField =
                FormFieldState(
                    id = AddEventField.Notes.key,
                    value = source.description.orEmpty(),
                    originalValue = source.description.orEmpty(),
                )
            val newFields =
                mapOf(
                    AddEventField.Title to titleField,
                    AddEventField.Location to locationField,
                    AddEventField.Notes to notesField,
                )
            val baseline =
                AddEventBaseline(
                    category = category,
                    allDay = allDay,
                    start = start,
                    end = end,
                    recurrence = recurrence,
                    reminderOffsets = reminders,
                    requestRsvp = requestRsvp,
                    attendees = attendees,
                )
            _state.update {
                it.copy(
                    fields = newFields,
                    category = category,
                    allDay = allDay,
                    startDate = start,
                    endDate = end,
                    recurrence = recurrence,
                    reminderOffsets = reminders,
                    requestRsvp = requestRsvp,
                    selectedAttendeeIds = attendees,
                    baseline = baseline,
                )
            }
        }

        // MARK: - Mutators

        fun updateField(
            field: AddEventField,
            value: String,
        ) {
            _state.update { current ->
                val snapshot =
                    current.fields[field]?.copy(
                        value = value,
                        touched = true,
                        error = validator(field).validate(value),
                    ) ?: FormFieldState(id = field.key, value = value, touched = true)
                current.copy(fields = current.fields + (field to snapshot))
            }
        }

        fun selectCategory(category: CalendarEventCategory) {
            _state.update { it.copy(category = category) }
        }

        fun setAllDay(allDay: Boolean) {
            _state.update { current ->
                if (allDay) {
                    val snapped = current.startDate.toLocalDate().atStartOfDay(zone)
                    current.copy(allDay = true, startDate = snapped, endDate = null)
                } else {
                    val time = LocalTime.of(9, 0)
                    val snapped = LocalDateTime.of(current.startDate.toLocalDate(), time).atZone(zone)
                    current.copy(allDay = false, startDate = snapped, endDate = snapped.plusHours(1))
                }
            }
        }

        fun setStartDate(start: ZonedDateTime) {
            _state.update { current ->
                val end =
                    if (current.endDate != null && current.endDate.isBefore(start)) {
                        start.plusHours(1)
                    } else {
                        current.endDate
                    }
                current.copy(startDate = start, endDate = end)
            }
        }

        fun setEndDate(end: ZonedDateTime) {
            _state.update { it.copy(endDate = end) }
        }

        fun setRecurrence(option: AddEventRecurrence) {
            _state.update { it.copy(recurrence = option) }
        }

        fun toggleReminder(offset: AddEventReminderOffset) {
            _state.update { current ->
                val updated =
                    if (offset in current.reminderOffsets) {
                        current.reminderOffsets - offset
                    } else {
                        current.reminderOffsets + offset
                    }
                current.copy(reminderOffsets = updated)
            }
        }

        fun setRequestRsvp(enabled: Boolean) {
            _state.update { it.copy(requestRsvp = enabled) }
        }

        fun toggleAttendee(userId: String) {
            _state.update { current ->
                val ids = current.selectedAttendeeIds
                val updated = if (userId in ids) ids - userId else ids + userId
                current.copy(selectedAttendeeIds = updated)
            }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeCommit() {
            _state.update { it.copy(commit = null) }
        }

        // MARK: - Submit

        fun submit() {
            if (_state.value.editingLoadFailed) {
                _state.update {
                    it.copy(toast = AddEventToast("Couldn't load this event.", isError = true))
                }
                return
            }
            val firstInvalid = validateAll()
            if (firstInvalid != null || _state.value.endError != null) {
                _state.update {
                    it.copy(toast = AddEventToast("Fix the highlighted field.", isError = true))
                }
                return
            }
            if (!networkMonitor.isOnline.value) {
                _state.update {
                    it.copy(toast = AddEventToast("You're offline. Try again when you're back online.", isError = true))
                }
                return
            }
            val current = _state.value
            _state.update { it.copy(isSaving = true) }
            viewModelScope.launch {
                if (editingEventId != null) {
                    commitUpdate(current, editingEventId)
                } else {
                    commitCreate(current)
                }
            }
        }

        private suspend fun commitCreate(snapshot: AddEventUiState) {
            val request = buildCreateRequest(snapshot)
            when (val result = repo.createHomeEvent(homeId, request)) {
                is NetworkResult.Success ->
                    _state.update {
                        it.copy(
                            isSaving = false,
                            toast = AddEventToast("Event added.", isError = false),
                            commit = AddEventCommit.Created(result.data.event.id),
                        )
                    }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isSaving = false,
                            toast = AddEventToast(result.error.message ?: "Couldn't add this event.", isError = true),
                        )
                    }
            }
        }

        private suspend fun commitUpdate(
            snapshot: AddEventUiState,
            eventId: String,
        ) {
            val request = buildUpdateRequest(snapshot)
            when (val result = repo.updateHomeEvent(homeId, eventId, request)) {
                is NetworkResult.Success ->
                    _state.update {
                        it.copy(
                            isSaving = false,
                            toast = AddEventToast("Event updated.", isError = false),
                            commit = AddEventCommit.Updated(result.data.event.id),
                        )
                    }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            isSaving = false,
                            toast = AddEventToast(result.error.message ?: "Couldn't update this event.", isError = true),
                        )
                    }
            }
        }

        private fun validateAll(): AddEventField? {
            var firstInvalid: AddEventField? = null
            _state.update { current ->
                val updated =
                    current.fields.mapValues { (field, snapshot) ->
                        val message = validator(field).validate(snapshot.value)
                        if (firstInvalid == null && message != null) firstInvalid = field
                        snapshot.copy(error = message, touched = true)
                    }
                current.copy(fields = updated)
            }
            return firstInvalid
        }

        private fun buildCreateRequest(snapshot: AddEventUiState): CreateHomeEventRequest {
            val title = snapshot.fields[AddEventField.Title]?.value?.trim().orEmpty()
            val location = snapshot.fields[AddEventField.Location]?.value?.trim().orEmpty().ifEmpty { null }
            val notes = snapshot.fields[AddEventField.Notes]?.value?.trim().orEmpty().ifEmpty { null }
            val attendees = sortedAttendeeIds(snapshot)
            return CreateHomeEventRequest(
                eventType = snapshot.category.rawValue,
                title = title,
                startAt = iso8601(snapshot.startDate, snapshot.allDay),
                description = notes,
                endAt = if (snapshot.allDay) null else snapshot.endDate?.let { iso8601(it, false) },
                locationNotes = location,
                recurrenceRule = snapshot.recurrence.rrule,
                assignedTo = attendees.ifEmpty { null },
                alertsEnabled = snapshot.reminderOffsets.isNotEmpty(),
                requestRsvp = snapshot.requestRsvp,
                reminders = remindersWire(snapshot).ifEmpty { null },
            )
        }

        private fun buildUpdateRequest(snapshot: AddEventUiState): UpdateHomeEventRequest {
            val title = snapshot.fields[AddEventField.Title]?.value?.trim().orEmpty()
            val location = snapshot.fields[AddEventField.Location]?.value?.trim().orEmpty()
            val notes = snapshot.fields[AddEventField.Notes]?.value?.trim().orEmpty()
            val attendees = sortedAttendeeIds(snapshot)
            // Empty strings explicitly clear the corresponding columns —
            // backend writes through whatever's in the body (home.js allow-list).
            return UpdateHomeEventRequest(
                eventType = snapshot.category.rawValue,
                title = title,
                description = notes,
                startAt = iso8601(snapshot.startDate, snapshot.allDay),
                endAt = if (snapshot.allDay) "" else snapshot.endDate?.let { iso8601(it, false) } ?: "",
                locationNotes = location,
                recurrenceRule = snapshot.recurrence.rrule.orEmpty(),
                assignedTo = attendees,
                alertsEnabled = snapshot.reminderOffsets.isNotEmpty(),
                requestRsvp = snapshot.requestRsvp,
                reminders = remindersWire(snapshot),
            )
        }

        private fun remindersWire(snapshot: AddEventUiState): List<Int> = snapshot.reminderOffsets.map { it.minutes }.sorted()

        private fun sortedAttendeeIds(snapshot: AddEventUiState): List<String> =
            snapshot.attendees.map { it.id }.filter { it in snapshot.selectedAttendeeIds }

        private fun validator(field: AddEventField): FormValidator =
            when (field) {
                AddEventField.Title -> titleValidator
                AddEventField.Location -> FormValidator { null }
                AddEventField.Notes -> FormValidator.maxLength(2000)
            }

        // MARK: - Static helpers

        companion object {
            internal val titleValidator: FormValidator =
                FormValidator.all(
                    listOf(
                        FormValidator.required("Add a title to save this event"),
                        FormValidator.maxLength(120),
                    ),
                )

            /** Default start time — the next quarter hour from [now]. */
            internal fun defaultStart(
                now: Instant,
                zone: ZoneId,
            ): ZonedDateTime {
                val zoned = now.atZone(zone)
                val minute = zoned.minute
                val rounded = ((minute / 15) + 1) * 15
                return if (rounded >= 60) {
                    zoned.plusHours(1).withMinute(0).withSecond(0).withNano(0)
                } else {
                    zoned.withMinute(rounded).withSecond(0).withNano(0)
                }
            }

            private val UTC_ZONE: ZoneId = ZoneId.of("UTC")

            /**
             * Midnight **UTC** + nil end → all-day. The wire convention stores
             * all-day events at 00:00Z, so the check is pinned to UTC no matter
             * which zone the form edits in. Mirrors iOS `isAllDayHeuristic`
             * (`utcCalendar()` components).
             */
            internal fun isAllDayHeuristic(
                start: ZonedDateTime,
                end: ZonedDateTime?,
                endIso: String?,
            ): Boolean {
                val utc = start.withZoneSameInstant(UTC_ZONE)
                return utc.hour == 0 && utc.minute == 0 && utc.second == 0 && end == null && endIso == null
            }

            /**
             * ISO-8601 (UTC instant). All-day events snap to the UTC
             * start-of-day of the instant so the agenda's midnight-UTC
             * heuristic recognises them — mirroring iOS `iso8601(from:allDay:)`
             * (`utcCalendar().startOfDay`). Round-trips with the iOS shape.
             */
            internal fun iso8601(
                date: ZonedDateTime,
                allDay: Boolean,
            ): String {
                val stamp =
                    if (allDay) {
                        date.withZoneSameInstant(UTC_ZONE).toLocalDate().atStartOfDay(UTC_ZONE)
                    } else {
                        date
                    }
                return DateTimeFormatter.ISO_INSTANT.format(stamp.toInstant())
            }

            internal fun parseIsoInstant(iso: String?): Instant? {
                if (iso.isNullOrBlank()) return null
                return runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        LocalDate.parse(iso).atStartOfDay(ZoneId.of("UTC")).toInstant()
                    }.getOrNull()
            }

            internal fun projectAttendee(occupant: OccupantDto): AddEventAttendee {
                val name =
                    occupant.displayName?.takeIf { it.isNotBlank() }
                        ?: occupant.username
                        ?: "Member"
                return AddEventAttendee(
                    id = occupant.userId,
                    displayName = name,
                    initials = initials(name),
                )
            }

            internal fun initials(name: String): String =
                name
                    .split(' ')
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.toString() }
                    .joinToString("")
                    .uppercase(Locale.ROOT)
        }
    }
