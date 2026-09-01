@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber", "LongMethod", "CyclomaticComplexMethod", "ReturnCount")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

/**
 * C6 Date + time slot picker. Fetches a **month window** of slots from the
 * public API (`GET …/slots?from&to&tz` for the slug flow, `GET /book/o/:token`
 * for one-off) with the invitee's timezone, renders the month grid + the
 * selected day's times grouped by daypart, and handles tz change (re-fetch),
 * month paging, and the C8 no-availability states (next-available / advance the
 * window). Selecting a slot is the **terminal A5 action** — A6 owns confirm.
 *
 * Per the wiring contract: always pass `tz`, render `startLocal`, store/compare
 * UTC `start`.
 */
@HiltViewModel
class SlotPickerViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val _state = MutableStateFlow<SlotPickerUiState>(SlotPickerUiState.Loading)
        val state: StateFlow<SlotPickerUiState> = _state.asStateFlow()

        private lateinit var args: SlotPickerArgs
        private var tzId: String = "UTC"
        private var visibleMonth: YearMonth = YearMonth.now()
        private var selectedDay: Int? = null
        private var selectedSlotStart: String? = null
        private var monthSlots: List<SlotDto> = emptyList()
        private var fetchJob: Job? = null
        private var started = false
        private var takenSlotStart: String? = null

        fun start(pickerArgs: SlotPickerArgs) {
            if (started && this::args.isInitialized && args == pickerArgs) return
            started = true
            args = pickerArgs
            tzId = pickerArgs.detectedTimezone
            visibleMonth = YearMonth.now(zone())
            selectedDay = null
            selectedSlotStart = null
            fetchMonth()
        }

        fun retry() {
            if (this::args.isInitialized) fetchMonth()
        }

        fun selectDay(day: Int) {
            selectedDay = day
            selectedSlotStart = null
            emitContent(slotsLoading = false)
        }

        fun selectSlot(slot: SlotDto) {
            selectedSlotStart = slot.start
            takenSlotStart = null // selecting a new slot dismisses any prior taken-badge
            emitContent(slotsLoading = false)
        }

        /**
         * Frame 6: called when the 409 conflict response indicates the just-tapped
         * slot was taken by a race condition. Marks the slot with a "Just taken"
         * WARN badge + bottom toast, and clears the pending selection so the user
         * must pick again.
         */
        fun notifySlotTaken(startUtc: String) {
            takenSlotStart = startUtc
            selectedSlotStart = null
            emitContent(slotsLoading = false)
        }

        /** Clears the taken-slot badge (e.g. user navigated away or picked another slot). */
        fun clearTakenSlot() {
            takenSlotStart = null
            emitContent(slotsLoading = false)
        }

        fun selectTimezone(id: String) {
            if (id == tzId) return
            tzId = id
            selectedSlotStart = null
            fetchMonth()
        }

        fun showPreviousMonth() {
            if (!canGoPrevious()) return
            visibleMonth = visibleMonth.minusMonths(1)
            selectedDay = null
            selectedSlotStart = null
            fetchMonth()
        }

        fun showNextMonth() {
            visibleMonth = visibleMonth.plusMonths(1)
            selectedDay = null
            selectedSlotStart = null
            fetchMonth()
        }

        /** C8: scan forward up to a year for the first month with availability and jump to it. */
        fun seeNextAvailable() {
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    emitContent(slotsLoading = true)
                    var month = visibleMonth.plusMonths(1)
                    repeat(MAX_FORWARD_MONTHS) {
                        val slots = loadSlots(month)
                        if (slots == null) {
                            // hard failure mid-scan — surface it and stop.
                            return@launch
                        }
                        val days = availableDaysIn(month, slots)
                        if (days.isNotEmpty()) {
                            visibleMonth = month
                            monthSlots = slots
                            selectedDay = days.min()
                            selectedSlotStart = null
                            emitContent(slotsLoading = false)
                            return@launch
                        }
                        month = month.plusMonths(1)
                    }
                    // nothing in range — land on the next month so the empty card shows there.
                    visibleMonth = visibleMonth.plusMonths(1)
                    monthSlots = emptyList()
                    selectedDay = null
                    emitContent(slotsLoading = false)
                }
        }

        private fun fetchMonth() {
            fetchJob?.cancel()
            fetchJob =
                viewModelScope.launch {
                    emitContent(slotsLoading = true)
                    val slots = loadSlots(visibleMonth)
                    if (slots == null) return@launch
                    monthSlots = slots
                    val available = availableDaysIn(visibleMonth, slots)
                    selectedDay =
                        when {
                            selectedDay != null && selectedDay in available -> selectedDay
                            available.isNotEmpty() -> available.min()
                            else -> null
                        }
                    emitContent(slotsLoading = false)
                }
        }

        /**
         * Fetch a month's slots. Returns the slot list, or null on a hard failure
         * (after emitting [SlotPickerUiState.Error]). A `status:'paused'` page
         * resolves to an empty list (rendered as a calm no-availability state).
         */
        private suspend fun loadSlots(month: YearMonth): List<SlotDto>? {
            val from = maxOf(month.atDay(1), LocalDate.now(zone())).toString()
            // Exclusive end: a date-only `to` parses server-side as UTC midnight, so the
            // last calendar day must be covered by sending the next day.
            val to = month.atEndOfMonth().plusDays(1).toString()
            val oneOff = args.oneOffToken
            return if (oneOff != null) {
                when (val r = repo.publicGetOneOff(oneOff, tzId, from, to)) {
                    is NetworkResult.Success -> r.data.slots
                    is NetworkResult.Failure -> {
                        _state.value = SlotPickerUiState.Error(decodeMessage(r.error))
                        null
                    }
                }
            } else {
                when (val r = repo.publicGetSlots(args.slug.orEmpty(), args.eventTypeSlug.orEmpty(), from, to, tzId)) {
                    is NetworkResult.Success -> if (r.data.status == STATUS_PAUSED) emptyList() else r.data.slots
                    is NetworkResult.Failure -> {
                        _state.value = SlotPickerUiState.Error(decodeMessage(r.error))
                        null
                    }
                }
            }
        }

        private fun emitContent(slotsLoading: Boolean) {
            if (!this::args.isInitialized) return
            val available = availableDaysIn(visibleMonth, monthSlots)
            val daySlots =
                selectedDay?.let { day ->
                    val date = visibleMonth.atDay(day)
                    monthSlots.filter { localDateOf(it) == date }.sortedBy { it.start }
                }.orEmpty()
            _state.value =
                SlotPickerUiState.Content(
                    eventTypeName = args.eventTypeName,
                    subLabel = subLabel(),
                    locationIcon = args.locationIcon,
                    pillar = args.pillar,
                    tzId = tzId,
                    tzLabel = tzLabel(),
                    detectedTimezone = args.detectedTimezone,
                    monthLabel = visibleMonth.format(MONTH_FORMAT),
                    daysInMonth = visibleMonth.lengthOfMonth(),
                    firstWeekdayIndex = visibleMonth.atDay(1).dayOfWeek.value % DAYS_IN_WEEK,
                    today = todayInVisibleMonth(),
                    availableDays = available,
                    selectedDay = selectedDay,
                    selectedDayHeading = selectedDay?.let { visibleMonth.atDay(it).format(DAY_HEADING_FORMAT) },
                    daySlots = daySlots,
                    selectedSlotStart = selectedSlotStart,
                    monthHasAvailability = available.isNotEmpty(),
                    nextMonthLabel = visibleMonth.plusMonths(1).month.getDisplayName(TextStyle.FULL, Locale.US),
                    canGoPreviousMonth = canGoPrevious(),
                    slotsLoading = slotsLoading,
                    takenSlotStart = takenSlotStart,
                )
        }

        /** The chosen slot object (for the hand-off), resolved from the stored UTC start. */
        fun selectedSlot(): SlotDto? = selectedSlotStart?.let { start -> monthSlots.firstOrNull { it.start == start } }

        private fun zone(): ZoneId = runCatching { ZoneId.of(tzId) }.getOrDefault(ZoneId.systemDefault())

        private fun canGoPrevious(): Boolean = visibleMonth.isAfter(YearMonth.now(zone()))

        private fun todayInVisibleMonth(): Int? {
            val now = LocalDate.now(zone())
            return if (YearMonth.from(now) == visibleMonth) now.dayOfMonth else null
        }

        private fun availableDaysIn(
            month: YearMonth,
            slots: List<SlotDto>,
        ): Set<Int> = slots.mapNotNull { localDateOf(it)?.takeIf { d -> YearMonth.from(d) == month }?.dayOfMonth }.toSet()

        private fun localDateOf(slot: SlotDto): LocalDate? = localDateTimeOf(slot)?.toLocalDate()

        private fun localDateTimeOf(slot: SlotDto): LocalDateTime? {
            val raw = slot.startLocal ?: slot.start
            return runCatching { LocalDateTime.parse(raw) }
                .recoverCatching { OffsetDateTime.parse(raw).toLocalDateTime() }
                .recoverCatching { Instant.parse(raw).atZone(zone()).toLocalDateTime() }
                .getOrNull()
        }

        private fun subLabel(): String {
            val duration = durationLabel(args.durationMin)
            val host = args.hostName?.takeIf { it.isNotBlank() }
            return if (host != null) "$duration · with $host" else duration
        }

        private fun tzLabel(): String =
            runCatching {
                ZonedDateTime.now(zone()).format(TZ_ABBREV_FORMAT).takeIf { it.isNotBlank() && !it.startsWith("GMT") }
            }.getOrNull() ?: tzId.substringAfterLast('/').replace('_', ' ')

        private fun decodeMessage(error: NetworkError): String =
            (errors.decode(error) as? SchedulingError.Generic)?.message
                ?: "We couldn't load times right now. Check your connection and try again."

        private companion object {
            const val STATUS_PAUSED = "paused"
            const val DAYS_IN_WEEK = 7
            const val MAX_FORWARD_MONTHS = 12
            val MONTH_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US)
            val DAY_HEADING_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.US)
            val TZ_ABBREV_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("zzz", Locale.US)
        }
    }

/**
 * C6 render state. [Content] keeps the summary header + month calendar visible
 * across loading (skeleton slots) / loaded / paused / no-availability — the
 * design never blanks the chrome. [Error] is the retryable hard-failure
 * fallback.
 */
sealed interface SlotPickerUiState {
    data object Loading : SlotPickerUiState

    @Suppress("LongParameterList")
    data class Content(
        val eventTypeName: String,
        val subLabel: String,
        val locationIcon: PantopusIcon,
        val pillar: SchedulingPillar,
        val tzId: String,
        val tzLabel: String,
        val detectedTimezone: String,
        val monthLabel: String,
        val daysInMonth: Int,
        val firstWeekdayIndex: Int,
        val today: Int?,
        val availableDays: Set<Int>,
        val selectedDay: Int?,
        val selectedDayHeading: String?,
        val daySlots: List<SlotDto>,
        val selectedSlotStart: String?,
        val monthHasAvailability: Boolean,
        val nextMonthLabel: String,
        val canGoPreviousMonth: Boolean,
        val slotsLoading: Boolean,
        /**
         * Frame 2 (Composing): true while a collective-intersect fetch is in
         * progress and the Business/Home pillar composes member availability.
         * Renders the avatar-cluster caption + ComposedPill above the skeleton.
         */
        val isComposing: Boolean = false,
        /**
         * Frame 5 (ComposedEmpty): true when this is a Home/Business collective
         * booking and the intersection of member calendars yields no overlap in
         * the selected window. Renders a framed EmptyCard with the member
         * free/busy cluster.
         */
        val isComposedEmpty: Boolean = false,
        /**
         * Frame 5 (DST hint): non-null when a DST transition falls within the
         * current visible month and the user should be informed that shown times
         * are adjusted. Displayed as an INFO banner below the timezone chip.
         */
        val dstHint: String? = null,
        /**
         * Frame 6 (Slot just taken): the UTC start string of a slot that was
         * selected but taken by a race condition. Renders a strikethrough +
         * "Just taken" WARN pill on that slot row and a floating bottom toast.
         */
        val takenSlotStart: String? = null,
    ) : SlotPickerUiState

    data class Error(
        val message: String,
    ) : SlotPickerUiState
}
