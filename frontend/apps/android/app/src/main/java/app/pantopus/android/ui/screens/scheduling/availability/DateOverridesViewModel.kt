@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.runtime.Immutable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.OverrideInput
import app.pantopus.android.data.api.models.scheduling.OverridesRequest
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
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

/** What a picked date does. */
enum class OverrideChoice { Unavailable, CustomHours }

/** One date override in the working set. */
@Immutable
data class OverrideItem(
    val date: String,
    val isUnavailable: Boolean,
    val start: String? = null,
    val end: String? = null,
) {
    fun detail(): String = overrideDetail(isUnavailable, start, end)

    fun dateLabel(): String = formatOverrideDate(date)
}

@Immutable
data class DateOverridesForm(
    val scheduleId: String,
    val overrides: List<OverrideItem>,
    val selectedDate: LocalDate,
    val displayedMonth: YearMonth,
    val choice: OverrideChoice,
    val customStart: String,
    val customEnd: String,
    val holidaySetOn: Boolean,
    val saving: Boolean = false,
) {
    val markedDates: Set<LocalDate>
        get() = overrides.mapNotNull { runCatching { LocalDate.parse(it.date) }.getOrNull() }.toSet()
}

@Immutable
sealed interface DateOverridesUiState {
    data object Loading : DateOverridesUiState

    data class Content(val form: DateOverridesForm) : DateOverridesUiState

    data class Error(val message: String) : DateOverridesUiState
}

sealed interface DateOverridesEvent {
    data object Saved : DateOverridesEvent

    data class Toast(val message: String) : DateOverridesEvent
}

/**
 * B6 — Date overrides & holidays. A date-level override either blocks the whole
 * day (`is_unavailable=true`) or sets custom hours; the set is replace-all
 * (`PUT /availability/:id/overrides`). A holiday set bulk-adds the 11 observed
 * US public holidays as days off.
 */
@HiltViewModel
class DateOverridesViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val scheduleId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_SCHEDULE_ID).orEmpty()

        private val _state = MutableStateFlow<DateOverridesUiState>(DateOverridesUiState.Loading)
        val state: StateFlow<DateOverridesUiState> = _state.asStateFlow()

        private val _events = Channel<DateOverridesEvent>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        /** The override set as last loaded/saved — overrides persist only on Done
         *  (`save()`), so back-without-Done would silently discard. This baseline
         *  lets the screen guard a dirty back-press. */
        private var baselineOverrides: List<OverrideItem> = emptyList()

        /** True when the working overrides differ from the last persisted set. */
        fun isDirty(): Boolean {
            val current = (_state.value as? DateOverridesUiState.Content)?.form?.overrides ?: return false
            return current.sortedBy { it.date } != baselineOverrides.sortedBy { it.date }
        }

        fun load() {
            _state.value = DateOverridesUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getAvailability()) {
                    is NetworkResult.Success -> {
                        val overrides =
                            result.data.overrides
                                .filter { it.scheduleId == scheduleId }
                                .map {
                                    OverrideItem(
                                        it.date,
                                        it.isUnavailable,
                                        it.startTime?.let(::normalizeHHmm),
                                        it.endTime?.let(::normalizeHHmm),
                                    )
                                }
                                .sortedBy { it.date }
                        baselineOverrides = overrides
                        val today = LocalDate.now()
                        _state.value =
                            DateOverridesUiState.Content(
                                DateOverridesForm(
                                    scheduleId = scheduleId,
                                    overrides = overrides,
                                    selectedDate = today,
                                    displayedMonth = YearMonth.from(today),
                                    choice = OverrideChoice.Unavailable,
                                    customStart = "10:00",
                                    customEnd = "14:00",
                                    holidaySetOn = holidaysPresent(overrides, today.year),
                                ),
                            )
                    }
                    is NetworkResult.Failure ->
                        _state.value = DateOverridesUiState.Error(errors.decode(result.error).displayMessage())
                }
            }
        }

        fun refresh() = load()

        private inline fun mutate(transform: (DateOverridesForm) -> DateOverridesForm) {
            val form = (_state.value as? DateOverridesUiState.Content)?.form ?: return
            _state.value = DateOverridesUiState.Content(transform(form))
        }

        fun selectDate(date: LocalDate) =
            mutate { form ->
                val existing = form.overrides.firstOrNull { it.date == date.toString() }
                form.copy(
                    selectedDate = date,
                    displayedMonth = YearMonth.from(date),
                    choice = if (existing?.isUnavailable == false) OverrideChoice.CustomHours else OverrideChoice.Unavailable,
                    customStart = existing?.start ?: form.customStart,
                    customEnd = existing?.end ?: form.customEnd,
                )
            }

        fun prevMonth() = mutate { it.copy(displayedMonth = it.displayedMonth.minusMonths(1)) }

        fun nextMonth() = mutate { it.copy(displayedMonth = it.displayedMonth.plusMonths(1)) }

        fun setChoice(choice: OverrideChoice) = mutate { it.copy(choice = choice) }

        fun setCustomHours(
            start: String,
            end: String,
        ) = mutate { it.copy(customStart = start, customEnd = end) }

        /** Add/replace the override for the selected date per the current choice. */
        fun applySelected() =
            mutate { form ->
                val item =
                    if (form.choice == OverrideChoice.Unavailable) {
                        OverrideItem(form.selectedDate.toString(), isUnavailable = true)
                    } else {
                        // Inverted custom hours (start >= end) would 200-OK but zero the
                        // day server-side — refuse to apply them (the hours sheet also
                        // blocks confirming an inverted range).
                        if (minutesOfDay(form.customStart) >= minutesOfDay(form.customEnd)) return@mutate form
                        OverrideItem(form.selectedDate.toString(), isUnavailable = false, start = form.customStart, end = form.customEnd)
                    }
                form.copy(overrides = form.overrides.upsert(item))
            }

        fun removeOverride(date: String) = mutate { it.copy(overrides = it.overrides.filterNot { o -> o.date == date }) }

        /** Block every date in `[start, end]` as unavailable. */
        fun blockRange(
            start: LocalDate,
            end: LocalDate,
        ) = mutate { form ->
            val (lo, hi) = if (start.isAfter(end)) end to start else start to end
            var next = form.overrides
            var cursor = lo
            while (!cursor.isAfter(hi)) {
                next = next.upsert(OverrideItem(cursor.toString(), isUnavailable = true))
                cursor = cursor.plusDays(1)
            }
            form.copy(overrides = next)
        }

        fun toggleHolidaySet(on: Boolean) =
            mutate { form ->
                val year = form.selectedDate.year
                val holidayDates = usPublicHolidays(year).map { it.first.toString() }.toSet()
                val next =
                    if (on) {
                        var acc = form.overrides
                        holidayDates.forEach { acc = acc.upsert(OverrideItem(it, isUnavailable = true)) }
                        acc
                    } else {
                        form.overrides.filterNot { it.date in holidayDates }
                    }
                form.copy(overrides = next, holidaySetOn = on)
            }

        /** The holiday rows for the active year (shown when the set is on). */
        fun holidayRows(): List<Pair<String, String>> {
            val year = (_state.value as? DateOverridesUiState.Content)?.form?.selectedDate?.year ?: LocalDate.now().year
            return usPublicHolidays(year).map { formatHolidayDate(it.first) to it.second }
        }

        fun save() {
            val form = (_state.value as? DateOverridesUiState.Content)?.form ?: return
            if (form.saving) return
            _state.value = DateOverridesUiState.Content(form.copy(saving = true))
            viewModelScope.launch {
                val body =
                    OverridesRequest(
                        form.overrides.map { OverrideInput(it.date, it.isUnavailable, it.start, it.end) },
                    )
                when (val result = repo.setOverrides(form.scheduleId, body)) {
                    is NetworkResult.Success -> {
                        baselineOverrides = form.overrides
                        _events.send(DateOverridesEvent.Saved)
                    }
                    is NetworkResult.Failure -> {
                        _state.value = DateOverridesUiState.Content(form.copy(saving = false))
                        _events.send(DateOverridesEvent.Toast(errors.decode(result.error).displayMessage()))
                    }
                }
            }
        }

        private fun List<OverrideItem>.upsert(item: OverrideItem): List<OverrideItem> =
            (filterNot { it.date == item.date } + item).sortedBy { it.date }

        private fun holidaysPresent(
            overrides: List<OverrideItem>,
            year: Int,
        ): Boolean {
            val holidays = usPublicHolidays(year).map { it.first.toString() }
            val blocked = overrides.filter { it.isUnavailable }.map { it.date }.toSet()
            return holidays.isNotEmpty() && holidays.all { it in blocked }
        }
    }
