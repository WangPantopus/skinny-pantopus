@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateBlockRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/** A detected booking overlap (best-effort; never blocks save). */
@Immutable
data class BlockConflict(
    val message: String,
    val bookingId: String,
)

/** The editable block-off (busy hold) form. */
@Immutable
data class BlockOffForm(
    val reason: String = "",
    val date: LocalDate = LocalDate.now(),
    val allDay: Boolean = false,
    val start: String = "14:00",
    val end: String = "15:00",
    val repeat: BlockRepeat = BlockRepeat.None,
    val saving: Boolean = false,
    val conflict: BlockConflict? = null,
) {
    // Weekday-specific, with the design's "· Ends never. Tap to add an end date."
    // tail (mirrors block-time-frames.jsx RepeatCard + iOS repeatCaption).
    val repeatCaption: String?
        get() {
            val tail = "· Ends never. Tap to add an end date."
            return when (repeat) {
                BlockRepeat.None -> null
                BlockRepeat.Daily -> "Repeats every day $tail"
                BlockRepeat.Weekly -> "Repeats every ${weekdayFull(date.dayOfWeek.toBackendWeekday())} $tail"
                BlockRepeat.Monthly -> "Repeats monthly on day ${date.dayOfMonth} $tail"
            }
        }

    /** A timed block needs a positive window; all-day blocks are always valid (mirrors iOS). */
    val isValid: Boolean
        get() {
            if (allDay) return true
            val (startHour, startMin) = parseHourMinute(start)
            val (endHour, endMin) = parseHourMinute(end)
            return startHour * MIN_PER_HOUR + startMin < endHour * MIN_PER_HOUR + endMin
        }

    private companion object {
        const val MIN_PER_HOUR = 60
    }
}

sealed interface BlockOffEvent {
    data object Saved : BlockOffEvent

    data class Toast(val message: String) : BlockOffEvent

    data class OpenBooking(val bookingId: String) : BlockOffEvent
}

/**
 * B9 — Block off time. Drops an ad-hoc personal busy HOLD onto availability
 * (`POST /availability/blocks`) so the engine stops offering that slot — not a
 * bookable event, not a whole-day override. Availability is always personal.
 * Surfaces a best-effort booking-overlap warning (the hold never cancels a
 * confirmed booking).
 */
@HiltViewModel
class BlockOffTimeViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val zone: ZoneId = ZoneId.systemDefault()

        private val _form = MutableStateFlow(BlockOffForm())
        val form: StateFlow<BlockOffForm> = _form.asStateFlow()

        private val _events = Channel<BlockOffEvent>(Channel.BUFFERED)
        val events = _events.receiveAsFlow()

        fun setReason(value: String) = _form.update { it.copy(reason = value) }

        fun setDate(date: LocalDate) {
            _form.update { it.copy(date = date) }
            checkConflict()
        }

        fun toggleAllDay(on: Boolean) {
            _form.update { it.copy(allDay = on, conflict = if (on) null else it.conflict) }
            if (!on) checkConflict()
        }

        fun setStart(value: String) {
            _form.update { it.copy(start = value) }
            checkConflict()
        }

        fun setEnd(value: String) {
            _form.update { it.copy(end = value) }
            checkConflict()
        }

        fun setRepeat(repeat: BlockRepeat) = _form.update { it.copy(repeat = repeat) }

        fun viewConflictBooking() {
            val id = _form.value.conflict?.bookingId ?: return
            _events.trySend(BlockOffEvent.OpenBooking(id))
        }

        private var conflictJob: Job? = null

        private fun checkConflict() {
            // One in-flight check at a time: rapid date/time edits cancel the
            // stale check instead of letting an older response land last and
            // pin a conflict computed for outdated form values.
            conflictJob?.cancel()
            if (_form.value.allDay) {
                _form.update { it.copy(conflict = null) }
                return
            }
            conflictJob =
                viewModelScope.launch {
                    // Read the form inside the coroutine so the surviving (latest)
                    // check always evaluates the freshest values.
                    val current = _form.value
                    val dayStart = current.date.atStartOfDay(zone).toInstant()
                    val dayEnd = current.date.plusDays(1).atStartOfDay(zone).toInstant()
                    val result = repo.getBookings(SchedulingOwner.Personal, from = dayStart.toString(), to = dayEnd.toString())
                    if (result !is NetworkResult.Success) return@launch
                    val (startHour, startMin) = parseHourMinute(current.start)
                    val (endHour, endMin) = parseHourMinute(current.end)
                    val blockStart = current.date.atTime(startHour, startMin).atZone(zone).toInstant()
                    val blockEnd = current.date.atTime(endHour, endMin).atZone(zone).toInstant()
                    val overlap =
                        result.data.bookings.firstOrNull { booking ->
                            val status = booking.status
                            val bStart = booking.startAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
                            val bEnd = booking.endAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
                            status != null && status in ACTIVE_STATUSES && bStart != null && bEnd != null &&
                                bStart.isBefore(blockEnd) && bEnd.isAfter(blockStart)
                        }
                    _form.update {
                        if (overlap == null) {
                            it.copy(conflict = null)
                        } else {
                            val time = overlap.startAt?.let { iso -> formatLocalTime(iso) }.orEmpty()
                            it.copy(
                                conflict =
                                    BlockConflict(
                                        message = "This overlaps a confirmed $time booking. Blocking won't cancel it.",
                                        bookingId = overlap.id,
                                    ),
                            )
                        }
                    }
                }
        }

        private fun formatLocalTime(iso: String): String {
            val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
            val local = instant.atZone(zone)
            return formatTime12(local.hour, local.minute)
        }

        fun save() {
            val current = _form.value
            if (current.saving) return
            _form.update { it.copy(saving = true) }
            viewModelScope.launch {
                val startAt: String
                val endAt: String
                if (current.allDay) {
                    startAt = allDayStartIso(current.date, zone)
                    endAt = allDayEndIso(current.date, zone)
                } else {
                    val (startHour, startMin) = parseHourMinute(current.start)
                    val (endHour, endMin) = parseHourMinute(current.end)
                    startAt = toUtcIso(current.date, startHour, startMin, zone)
                    endAt = toUtcIso(current.date, endHour, endMin, zone)
                }
                val body =
                    CreateBlockRequest(
                        title = current.reason.trim().ifEmpty { null },
                        startAt = startAt,
                        endAt = endAt,
                        recurrenceRule = current.repeat.toRRule(),
                    )
                when (val result = repo.createBlock(body)) {
                    is NetworkResult.Success -> _events.send(BlockOffEvent.Saved)
                    is NetworkResult.Failure -> {
                        _form.update { it.copy(saving = false) }
                        _events.send(BlockOffEvent.Toast(errors.decode(result.error).displayMessage()))
                    }
                }
            }
        }

        private fun MutableStateFlow<BlockOffForm>.update(transform: (BlockOffForm) -> BlockOffForm) {
            value = transform(value)
        }

        private companion object {
            val ACTIVE_STATUSES = setOf("confirmed", "pending")
        }
    }
