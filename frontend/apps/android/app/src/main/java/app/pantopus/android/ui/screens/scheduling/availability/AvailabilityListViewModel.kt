@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.AvailabilityOverrideDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityScheduleDto
import app.pantopus.android.data.api.models.scheduling.CreateScheduleRequest
import app.pantopus.android.data.api.models.scheduling.OverrideInput
import app.pantopus.android.data.api.models.scheduling.OverridesRequest
import app.pantopus.android.data.api.models.scheduling.RuleInput
import app.pantopus.android.data.api.models.scheduling.RulesRequest
import app.pantopus.android.data.api.models.scheduling.UpdateScheduleRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/** A schedule rendered as a list row. */
@Immutable
data class ScheduleRowUi(
    val id: String,
    val name: String,
    val summary: String,
    val timezone: String,
    val isDefault: Boolean,
)

/** Loading / empty / loaded / error for the availability schedule list (B4). */
@Immutable
sealed interface AvailabilityListUiState {
    data object Loading : AvailabilityListUiState

    data object Empty : AvailabilityListUiState

    data class Loaded(val schedules: List<ScheduleRowUi>) : AvailabilityListUiState

    data class Error(val message: String) : AvailabilityListUiState
}

/** One-shot effects the list screen consumes (navigation, toasts, reassign prompt). */
sealed interface AvailabilityListEvent {
    data class OpenEditor(val scheduleId: String) : AvailabilityListEvent

    data class Toast(val message: String) : AvailabilityListEvent

    /** A delete hit `CANNOT_DELETE_DEFAULT` — prompt to pick a new default first. */
    data class ReassignNeeded(val scheduleId: String) : AvailabilityListEvent
}

/**
 * B4 — Availability schedule list. Availability is **always personal**
 * (`GET /availability`, no owner context). Auto-creates a default schedule
 * server-side; the list collapses overflow actions (set default / rename /
 * duplicate / delete with the `CANNOT_DELETE_DEFAULT` reassign flow).
 */
@HiltViewModel
class AvailabilityListViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val _state = MutableStateFlow<AvailabilityListUiState>(AvailabilityListUiState.Loading)
        val state: StateFlow<AvailabilityListUiState> = _state.asStateFlow()

        private val _events = Channel<AvailabilityListEvent>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        private var schedules: List<AvailabilityScheduleDto> = emptyList()
        private var rules: List<AvailabilityRuleDto> = emptyList()
        private var overrides: List<AvailabilityOverrideDto> = emptyList()

        fun load() {
            _state.value = AvailabilityListUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getAvailability()) {
                    is NetworkResult.Success -> {
                        schedules = result.data.schedules
                        rules = result.data.rules
                        overrides = result.data.overrides
                        _state.value =
                            if (schedules.isEmpty()) {
                                AvailabilityListUiState.Empty
                            } else {
                                AvailabilityListUiState.Loaded(schedules.map { it.toRowUi() })
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value = AvailabilityListUiState.Error(errors.decode(result.error).displayMessage())
                }
            }
        }

        fun refresh() = load()

        private fun AvailabilityScheduleDto.toRowUi(): ScheduleRowUi {
            val scheduleRules = rules.filter { it.scheduleId == id }
            return ScheduleRowUi(
                id = id,
                name = name?.ifBlank { "Working hours" } ?: "Working hours",
                summary = scheduleSummary(scheduleRules),
                timezone = friendlyTimezone(timezone),
                isDefault = isDefault,
            )
        }

        private fun defaultTimezone(): String =
            schedules.firstOrNull { it.isDefault }?.timezone
                ?: schedules.firstOrNull()?.timezone
                ?: ZoneId.systemDefault().id

        /** "+" — create a fresh schedule and open its editor. */
        fun addSchedule() {
            viewModelScope.launch {
                val body = CreateScheduleRequest(name = "New schedule", timezone = defaultTimezone(), isDefault = schedules.isEmpty())
                when (val result = repo.createSchedule(body)) {
                    is NetworkResult.Success -> {
                        load()
                        _events.send(AvailabilityListEvent.OpenEditor(result.data.schedule.id))
                    }
                    is NetworkResult.Failure -> emitToast(result.error.toMessage())
                }
            }
        }

        /** Empty-state CTA — seed a default Mon–Fri 9–5 "Working hours" schedule
         *  (name + rules), so "Add working hours" produces working hours rather
         *  than an empty editor (parity with iOS createDefaultSchedule). */
        fun createDefaultSchedule() {
            viewModelScope.launch {
                val body = CreateScheduleRequest(name = "Working hours", timezone = defaultTimezone(), isDefault = true)
                when (val result = repo.createSchedule(body)) {
                    is NetworkResult.Success -> {
                        val newId = result.data.schedule.id
                        val rules = WEEKDAYS_MON_FRI.map { RuleInput(it, DEFAULT_START, DEFAULT_END) }
                        repo.setRules(newId, RulesRequest(rules))
                        load()
                    }
                    is NetworkResult.Failure -> emitToast(result.error.toMessage())
                }
            }
        }

        fun setAsDefault(scheduleId: String) {
            viewModelScope.launch {
                when (val result = repo.updateSchedule(scheduleId, UpdateScheduleRequest(isDefault = true))) {
                    is NetworkResult.Success -> load()
                    is NetworkResult.Failure -> emitToast(result.error.toMessage())
                }
            }
        }

        fun rename(
            scheduleId: String,
            name: String,
        ) {
            val trimmed = name.trim()
            if (trimmed.isEmpty()) return
            viewModelScope.launch {
                when (val result = repo.updateSchedule(scheduleId, UpdateScheduleRequest(name = trimmed))) {
                    is NetworkResult.Success -> load()
                    is NetworkResult.Failure -> emitToast(result.error.toMessage())
                }
            }
        }

        /** Duplicate a schedule, copying its weekly rules + date overrides. */
        fun duplicate(scheduleId: String) {
            val source = schedules.firstOrNull { it.id == scheduleId } ?: return
            viewModelScope.launch {
                val created =
                    repo.createSchedule(
                        CreateScheduleRequest(
                            name = "${source.name ?: "Working hours"} copy",
                            timezone = source.timezone ?: defaultTimezone(),
                        ),
                    )
                if (created !is NetworkResult.Success) {
                    emitToast((created as NetworkResult.Failure).error.toMessage())
                    return@launch
                }
                val newId = created.data.schedule.id
                val sourceRules = rules.filter { it.scheduleId == scheduleId }
                if (sourceRules.isNotEmpty()) {
                    repo.setRules(
                        newId,
                        RulesRequest(sourceRules.map { RuleInput(it.weekday, normalizeHHmm(it.startTime), normalizeHHmm(it.endTime)) }),
                    )
                }
                val sourceOverrides = overrides.filter { it.scheduleId == scheduleId }
                if (sourceOverrides.isNotEmpty()) {
                    repo.setOverrides(
                        newId,
                        OverridesRequest(sourceOverrides.map { OverrideInput(it.date, it.isUnavailable, it.startTime, it.endTime) }),
                    )
                }
                load()
            }
        }

        /** Delete; on `CANNOT_DELETE_DEFAULT` raise the reassign prompt instead of erroring. */
        fun delete(scheduleId: String) {
            viewModelScope.launch {
                when (val result = repo.deleteSchedule(scheduleId)) {
                    is NetworkResult.Success -> load()
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(result.error)
                        if (decoded is SchedulingError.Generic && decoded.code == CODE_CANNOT_DELETE_DEFAULT) {
                            _events.send(AvailabilityListEvent.ReassignNeeded(scheduleId))
                        } else {
                            emitToast(decoded.displayMessage())
                        }
                    }
                }
            }
        }

        /** Reassign flow: make [newDefaultId] the default, then delete [scheduleId]. */
        fun reassignDefaultThenDelete(
            scheduleId: String,
            newDefaultId: String,
        ) {
            viewModelScope.launch {
                val reassigned = repo.updateSchedule(newDefaultId, UpdateScheduleRequest(isDefault = true))
                if (reassigned is NetworkResult.Failure) {
                    emitToast(reassigned.error.toMessage())
                    return@launch
                }
                when (val result = repo.deleteSchedule(scheduleId)) {
                    is NetworkResult.Success -> load()
                    is NetworkResult.Failure -> emitToast(errors.decode(result.error).displayMessage())
                }
            }
        }

        /** Other schedules that could become the new default (for the reassign dialog). */
        fun otherSchedules(scheduleId: String): List<ScheduleRowUi> = schedules.filter { it.id != scheduleId }.map { it.toRowUi() }

        private fun emitToast(message: String) {
            _events.trySend(AvailabilityListEvent.Toast(message))
        }

        private fun app.pantopus.android.data.api.net.NetworkError.toMessage(): String = errors.decode(this).displayMessage()

        private companion object {
            const val CODE_CANNOT_DELETE_DEFAULT = "CANNOT_DELETE_DEFAULT"
            const val DEFAULT_START = "09:00"
            const val DEFAULT_END = "17:00"
            val WEEKDAYS_MON_FRI = listOf(1, 2, 3, 4, 5)
        }
    }

/** A user-facing message for a decoded scheduling error. */
fun SchedulingError.displayMessage(): String =
    when (this) {
        is SchedulingError.Generic -> message
        is SchedulingError.Validation -> details.firstOrNull()?.message ?: "Please check the highlighted fields."
        SchedulingError.Paused -> "This schedule is paused."
        SchedulingError.Expired -> "This link has expired."
        SchedulingError.Unavailable -> "This isn't available right now."
        SchedulingError.Secret -> "You don't have access to this."
        is SchedulingError.SlugTaken -> "That link is taken."
        SchedulingError.NotAvailable501 -> "Coming soon."
        is SchedulingError.Conflict -> "That time was just taken."
    }
