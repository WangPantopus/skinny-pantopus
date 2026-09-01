@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.AvailabilityOverrideDto
import app.pantopus.android.data.api.models.scheduling.AvailabilityRuleDto
import app.pantopus.android.data.api.models.scheduling.RuleInput
import app.pantopus.android.data.api.models.scheduling.RulesRequest
import app.pantopus.android.data.api.models.scheduling.UpdateScheduleRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.scheduling.SchedulingError
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
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/**
 * G4 Member Working-Hours Editor (Stream A13) — SELF-SERVICE "My booking hours".
 * `/availability` is hard-scoped to `req.user`, so a member edits ONLY their own
 * weekly hours (loaded from `GET /availability`, saved via
 * `PUT /availability/:id/rules`). Opened from G3: your own row → editable; a
 * teammate's row → read-only "inherits personal" scaffold (their hours are
 * private). Mirrors iOS `MemberWorkingHoursViewModel` + `memberhours-frames.jsx`.
 */
@HiltViewModel
class MemberWorkingHoursViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val businessTeam: BusinessTeamRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        data class DayHoursUi(
            val weekday: Int,
            val ranges: List<HoursRange>,
        )

        data class DatedException(
            val title: String,
            val sub: String,
            val isBlocked: Boolean,
        )

        data class Form(
            val isReadOnly: Boolean,
            val memberName: String,
            val title: String,
            val scheduleId: String?,
            val timezoneId: String,
            val days: List<DayHoursUi>,
            val upcomingException: DatedException?,
            val saving: Boolean,
        ) {
            val formValid: Boolean get() = days.all { day -> day.ranges.all { it.isValid } }
        }

        sealed interface UiState {
            data object Loading : UiState

            data class Content(val form: Form) : UiState

            data class Error(val message: String) : UiState
        }

        sealed interface Event {
            data object Saved : Event

            data class Toast(val message: String) : Event
        }

        private val memberId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_MEMBER_ID).orEmpty()

        private val _state = MutableStateFlow<UiState>(UiState.Loading)
        val state: StateFlow<UiState> = _state.asStateFlow()

        private val _events = Channel<Event>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        private var loadedTimezone: String = ZoneId.systemDefault().id

        fun load() {
            _state.value = UiState.Loading
            val currentUserId = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
            val isSelf = currentUserId != null && memberId == currentUserId
            viewModelScope.launch {
                val memberName = resolveMemberName(currentUserId, isSelf)
                if (!isSelf) {
                    _state.value =
                        UiState.Content(
                            Form(
                                isReadOnly = true,
                                memberName = memberName,
                                title = "$memberName's booking hours",
                                scheduleId = null,
                                timezoneId = ZoneId.systemDefault().id,
                                days = WEEKDAY_DISPLAY_ORDER.map { DayHoursUi(it, emptyList()) },
                                upcomingException = null,
                                saving = false,
                            ),
                        )
                    return@launch
                }
                when (val result = repo.getAvailability()) {
                    is NetworkResult.Failure ->
                        _state.value = UiState.Error(errors.decode(result.error).displayMessage("Couldn't load your hours."))
                    is NetworkResult.Success -> {
                        val schedule = result.data.schedules.firstOrNull { it.isDefault } ?: result.data.schedules.firstOrNull()
                        if (schedule == null) {
                            _state.value = UiState.Error("You don't have a working-hours schedule yet.")
                            return@launch
                        }
                        loadedTimezone = schedule.timezone ?: ZoneId.systemDefault().id
                        _state.value =
                            UiState.Content(
                                Form(
                                    isReadOnly = false,
                                    memberName = memberName,
                                    title = "My booking hours",
                                    scheduleId = schedule.id,
                                    timezoneId = loadedTimezone,
                                    days = buildDays(result.data.rules.filter { it.scheduleId == schedule.id }),
                                    upcomingException = nextException(result.data.overrides.filter { it.scheduleId == schedule.id }),
                                    saving = false,
                                ),
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        // ─── Editing (self only) ──────────────────────────────────────────────

        fun addRange(weekday: Int) =
            mutateDay(weekday) { day ->
                val last = day.ranges.lastOrNull()
                val next =
                    if (last != null) {
                        val (eh, em) = parseHhMm(last.end)
                        if (eh < 22) HoursRange(hhmm(eh, em), hhmm((eh + 1).coerceAtMost(23), em)) else DEFAULT_RANGE
                    } else {
                        DEFAULT_RANGE
                    }
                day.copy(ranges = day.ranges + next)
            }

        fun removeRange(
            weekday: Int,
            index: Int,
        ) = mutateDay(weekday) { day ->
            day.copy(ranges = day.ranges.toMutableList().apply { if (index in indices) removeAt(index) })
        }

        fun updateRange(
            weekday: Int,
            index: Int,
            start: String,
            end: String,
        ) = mutateDay(weekday) { day ->
            day.copy(ranges = day.ranges.toMutableList().apply { if (index in indices) this[index] = HoursRange(start, end) })
        }

        fun copyMondayToWeekdays() =
            mutateForm { form ->
                val monday = form.days.firstOrNull { it.weekday == 1 }?.ranges ?: return@mutateForm form
                form.copy(days = form.days.map { if (it.weekday in WEEKDAYS_MON_FRI && it.weekday != 1) it.copy(ranges = monday) else it })
            }

        fun changeTimezone(id: String) = mutateForm { it.copy(timezoneId = id) }

        private inline fun mutateForm(transform: (Form) -> Form) {
            val current = (_state.value as? UiState.Content)?.form ?: return
            if (current.isReadOnly) return
            _state.value = UiState.Content(transform(current))
        }

        private fun mutateDay(
            weekday: Int,
            transform: (DayHoursUi) -> DayHoursUi,
        ) = mutateForm { form ->
            form.copy(days = form.days.map { if (it.weekday == weekday) transform(it) else it })
        }

        // ─── Save ─────────────────────────────────────────────────────────────

        fun save() {
            val form = (_state.value as? UiState.Content)?.form ?: return
            val scheduleId = form.scheduleId ?: return
            if (form.saving || form.isReadOnly || !form.formValid) return
            _state.value = UiState.Content(form.copy(saving = true))
            viewModelScope.launch {
                val rules = form.days.flatMap { day -> day.ranges.map { RuleInput(day.weekday, it.start, it.end) } }
                val rulesResult = repo.setRules(scheduleId, RulesRequest(rules))
                if (rulesResult is NetworkResult.Failure) {
                    finishWithError(form, errors.decode(rulesResult.error))
                    return@launch
                }
                if (form.timezoneId != loadedTimezone) {
                    val scheduleResult = repo.updateSchedule(scheduleId, UpdateScheduleRequest(timezone = form.timezoneId))
                    if (scheduleResult is NetworkResult.Failure) {
                        finishWithError(form, errors.decode(scheduleResult.error))
                        return@launch
                    }
                    loadedTimezone = form.timezoneId
                }
                _events.send(Event.Saved)
            }
        }

        private suspend fun finishWithError(
            form: Form,
            error: SchedulingError,
        ) {
            _state.value = UiState.Content(form.copy(saving = false))
            _events.send(Event.Toast(error.displayMessage("Couldn't save hours.")))
        }

        // ─── Helpers ────────────────────────────────────────────────────────────

        private suspend fun resolveMemberName(
            currentUserId: String?,
            isSelf: Boolean,
        ): String {
            if (isSelf) return "You"
            val businessId = currentUserId ?: return "Member"
            val roster = (businessTeam.members(businessId) as? NetworkResult.Success)?.data
            val member = roster?.members?.firstOrNull { it.user?.id == memberId }?.user
            return member?.name ?: member?.username ?: "Member"
        }

        private fun buildDays(rules: List<AvailabilityRuleDto>): List<DayHoursUi> {
            val byDay = rules.groupBy { it.weekday }
            return WEEKDAY_DISPLAY_ORDER.map { weekday ->
                val ranges =
                    byDay[weekday].orEmpty()
                        .sortedBy { it.startTime }
                        .map { HoursRange(normalizeHhMm(it.startTime), normalizeHhMm(it.endTime)) }
                DayHoursUi(weekday, ranges)
            }
        }

        private fun nextException(overrides: List<AvailabilityOverrideDto>): DatedException? {
            val today = LocalDate.now().toString()
            val next = overrides.filter { it.date >= today }.minByOrNull { it.date } ?: return null
            val display = runCatching { LocalDate.parse(next.date).format(DATE_FMT) }.getOrNull() ?: next.date
            return if (next.isUnavailable) {
                DatedException(title = "$display · Time off", sub = "No bookings during these days", isBlocked = true)
            } else {
                val summary =
                    if (next.startTime != null && next.endTime != null) {
                        formatRange12(normalizeHhMm(next.startTime), normalizeHhMm(next.endTime))
                    } else {
                        "Custom hours"
                    }
                DatedException(title = "$display · $summary", sub = "Overrides the weekly hours for this date", isBlocked = false)
            }
        }

        private fun SchedulingError.displayMessage(fallback: String): String =
            when (this) {
                is SchedulingError.Generic -> message
                else -> fallback
            }

        private companion object {
            val DEFAULT_RANGE = HoursRange("09:00", "17:00")
            val DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE MMM d")
        }
    }
