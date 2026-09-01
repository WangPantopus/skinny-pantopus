@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.RuleInput
import app.pantopus.android.data.api.models.scheduling.RulesRequest
import app.pantopus.android.data.api.models.scheduling.UpdateScheduleRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/** One contiguous open window within a day, as `"HH:MM"` start/end. */
@Immutable
data class TimeRange(
    val start: String,
    val end: String,
) {
    fun label(): String = formatRange12(start, end)

    /** A window is well-formed when it has positive duration (start < end). */
    val isValid: Boolean get() = minutesOfDay(start) < minutesOfDay(end)
}

/** A weekday row in the editor — Monday-first display, ISO [weekday]. */
@Immutable
data class DayHoursUi(
    val weekday: Int,
    val enabled: Boolean,
    val blocks: List<TimeRange>,
) {
    val label: String get() = weekdayFull(weekday)
}

/** The editable weekly-hours form. */
@Immutable
data class WeeklyHoursForm(
    val scheduleId: String,
    val name: String,
    val timezoneId: String,
    val timezoneLabel: String,
    val lockTimezone: Boolean,
    val days: List<DayHoursUi>,
    val saving: Boolean = false,
    /** True when schedule has never had rules and the user hasn't dirtied it yet
     *  (mirrors iOS WeeklyHoursEditorViewModel.isUnset = allOff && !isDirty). */
    val isDirty: Boolean = false,
) {
    val allDaysOff: Boolean get() = days.none { it.enabled }
    val hasNoRules: Boolean get() = days.all { it.blocks.isEmpty() }

    /**
     * Every enabled day must carry >= 1 well-formed (start < end) block; an
     * inverted range would 200-OK server-side but silently zero that day's
     * availability. All-off is valid (it just clears the schedule and warns).
     * Mirrors iOS `WeeklyHoursEditorViewModel.formValid`.
     */
    val isValid: Boolean
        get() =
            days.filter { it.enabled }.all { day ->
                day.blocks.isNotEmpty() && day.blocks.all { it.isValid }
            }

    /** Design Frame 4: show the "Set hours" / composition-gap hero state. */
    val isUnset: Boolean get() = allDaysOff && !isDirty

    /** "Pacific Time · auto" when the schedule tracks the device zone; just the
     *  city otherwise (mirrors iOS timezoneDisplay). */
    val timezoneDisplay: String get() = if (lockTimezone) "$timezoneLabel · auto" else timezoneLabel
}

@Immutable
sealed interface WeeklyHoursUiState {
    data object Loading : WeeklyHoursUiState

    data class Content(val form: WeeklyHoursForm) : WeeklyHoursUiState

    data class Error(val message: String) : WeeklyHoursUiState
}

sealed interface WeeklyHoursEvent {
    data object Saved : WeeklyHoursEvent

    data class Toast(val message: String) : WeeklyHoursEvent
}

/**
 * B5 — Weekly hours editor. Edits one personal availability schedule's name,
 * timezone, and per-weekday open windows. Rules are replace-all
 * (`PUT /availability/:id/rules`, weekday `0=Sun…6=Sat`, `HH:MM`); the name +
 * timezone go through `PUT /availability/:id`.
 */
@HiltViewModel
class WeeklyHoursEditorViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val scheduleId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_SCHEDULE_ID).orEmpty()

        private val _state = MutableStateFlow<WeeklyHoursUiState>(WeeklyHoursUiState.Loading)
        val state: StateFlow<WeeklyHoursUiState> = _state.asStateFlow()

        private val _events = Channel<WeeklyHoursEvent>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        fun load() {
            _state.value = WeeklyHoursUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getAvailability()) {
                    is NetworkResult.Success -> {
                        val schedule = result.data.schedules.firstOrNull { it.id == scheduleId }
                        if (schedule == null) {
                            _state.value = WeeklyHoursUiState.Error("This schedule could not be found.")
                            return@launch
                        }
                        val rulesByDay = result.data.rules.filter { it.scheduleId == scheduleId }.groupBy { it.weekday }
                        val days =
                            WEEKDAY_DISPLAY_ORDER.map { weekday ->
                                val dayRules =
                                    rulesByDay[weekday].orEmpty()
                                        .sortedBy { it.startTime }
                                        .map { TimeRange(normalizeHHmm(it.startTime), normalizeHHmm(it.endTime)) }
                                DayHoursUi(weekday = weekday, enabled = dayRules.isNotEmpty(), blocks = dayRules)
                            }
                        _state.value =
                            WeeklyHoursUiState.Content(
                                WeeklyHoursForm(
                                    scheduleId = scheduleId,
                                    name = schedule.name?.ifBlank { "Working hours" } ?: "Working hours",
                                    timezoneId = schedule.timezone.orEmpty(),
                                    timezoneLabel = friendlyTimezone(schedule.timezone),
                                    // Locked = schedule tracks the device zone (mirrors iOS
                                    // lockTimezone = timezoneId == deviceZone). A blank/absent
                                    // tz is treated as auto-tracking the device.
                                    lockTimezone =
                                        schedule.timezone.isNullOrBlank() ||
                                            schedule.timezone == ZoneId.systemDefault().id,
                                    days = days,
                                ),
                            )
                    }
                    is NetworkResult.Failure ->
                        _state.value = WeeklyHoursUiState.Error(errors.decode(result.error).displayMessage())
                }
            }
        }

        fun refresh() = load()

        private inline fun mutateForm(transform: (WeeklyHoursForm) -> WeeklyHoursForm) {
            val current = (_state.value as? WeeklyHoursUiState.Content)?.form ?: return
            // Mark dirty on every user edit so isUnset clears after first interaction.
            _state.value = WeeklyHoursUiState.Content(transform(current).copy(isDirty = true))
        }

        private fun mutateDay(
            weekday: Int,
            transform: (DayHoursUi) -> DayHoursUi,
        ) = mutateForm { form ->
            form.copy(days = form.days.map { if (it.weekday == weekday) transform(it) else it })
        }

        fun setName(name: String) = mutateForm { it.copy(name = name) }

        fun setTimezone(
            id: String,
            label: String,
        ) = mutateForm {
            // Re-derive lock from whether the picked zone is the device zone
            // (mirrors iOS changeTimezone).
            it.copy(timezoneId = id, timezoneLabel = label, lockTimezone = id == ZoneId.systemDefault().id)
        }

        fun toggleLockTimezone(on: Boolean) =
            mutateForm {
                // Locking snaps back to the device zone (mirrors iOS setLockTimezone).
                if (on) {
                    val deviceId = ZoneId.systemDefault().id
                    it.copy(lockTimezone = true, timezoneId = deviceId, timezoneLabel = friendlyTimezone(deviceId))
                } else {
                    it.copy(lockTimezone = false)
                }
            }

        fun toggleDay(
            weekday: Int,
            on: Boolean,
        ) = mutateDay(weekday) { day ->
            if (on) {
                day.copy(enabled = true, blocks = day.blocks.ifEmpty { listOf(DEFAULT_BLOCK) })
            } else {
                day.copy(enabled = false)
            }
        }

        fun addBlock(weekday: Int) =
            mutateDay(weekday) { day ->
                day.copy(enabled = true, blocks = day.blocks + DEFAULT_BLOCK)
            }

        fun removeBlock(
            weekday: Int,
            index: Int,
        ) = mutateDay(weekday) { day ->
            val next = day.blocks.toMutableList().apply { if (index in indices) removeAt(index) }
            day.copy(blocks = next, enabled = next.isNotEmpty())
        }

        fun updateBlock(
            weekday: Int,
            index: Int,
            start: String,
            end: String,
        ) = mutateDay(weekday) { day ->
            val next =
                day.blocks.toMutableList().apply {
                    if (index in indices) this[index] = TimeRange(start, end)
                }
            day.copy(blocks = next)
        }

        fun copyToDays(
            sourceWeekday: Int,
            targets: Set<Int>,
        ) = mutateForm { form ->
            val source = form.days.firstOrNull { it.weekday == sourceWeekday } ?: return@mutateForm form
            form.copy(
                days =
                    form.days.map { day ->
                        if (day.weekday in targets) {
                            day.copy(enabled = source.enabled, blocks = source.blocks)
                        } else {
                            day
                        }
                    },
            )
        }

        fun useQuickDefault() =
            mutateForm { form ->
                form.copy(
                    days =
                        form.days.map { day ->
                            val weekday = day.weekday
                            if (weekday in WEEKDAYS_MON_FRI) {
                                day.copy(enabled = true, blocks = listOf(DEFAULT_BLOCK))
                            } else {
                                day.copy(enabled = false, blocks = emptyList())
                            }
                        },
                )
            }

        fun save() {
            val form = (_state.value as? WeeklyHoursUiState.Content)?.form ?: return
            if (form.saving || !form.isValid) return
            _state.value = WeeklyHoursUiState.Content(form.copy(saving = true))
            viewModelScope.launch {
                val rules =
                    form.days
                        .filter { it.enabled }
                        .flatMap { day -> day.blocks.map { RuleInput(day.weekday, it.start, it.end) } }
                val rulesResult = repo.setRules(form.scheduleId, RulesRequest(rules))
                if (rulesResult is NetworkResult.Failure) {
                    finishSaveWithError(form, errors.decode(rulesResult.error).displayMessage())
                    return@launch
                }
                val scheduleResult =
                    repo.updateSchedule(
                        form.scheduleId,
                        UpdateScheduleRequest(
                            name = form.name.trim().ifEmpty { "Working hours" },
                            timezone = form.timezoneId.ifBlank { null },
                        ),
                    )
                if (scheduleResult is NetworkResult.Failure) {
                    finishSaveWithError(form, errors.decode(scheduleResult.error).displayMessage())
                    return@launch
                }
                _events.send(WeeklyHoursEvent.Saved)
            }
        }

        private suspend fun finishSaveWithError(
            form: WeeklyHoursForm,
            message: String,
        ) {
            _state.value = WeeklyHoursUiState.Content(form.copy(saving = false))
            _events.send(WeeklyHoursEvent.Toast(message))
        }

        fun overridesRoute(): String = SchedulingRoutes.dateOverrides(scheduleId)

        fun bookingLimitsRoute(): String = SchedulingRoutes.BOOKING_LIMITS

        fun blockOffRoute(): String = SchedulingRoutes.BLOCK_OFF_TIME

        private companion object {
            val DEFAULT_BLOCK = TimeRange("09:00", "17:00")
            val WEEKDAYS_MON_FRI = setOf(1, 2, 3, 4, 5)
        }
    }
