@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreateRecurringRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling.invitee.edge.parseInstant
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale
import javax.inject.Inject

/**
 * D12 — Recurring / multi-session setup (host-side). One decision lays down many
 * linked bookings via `POST /bookings/recurring` (1–52 sessions). The arg-less
 * A0 route means the screen resolves the user's event type itself (Personal
 * owner), generates the session start times from the chosen pattern, and on
 * confirm reports the booked vs. conflicted sessions — the partial-series path
 * the design calls out ("we can book 4 of 6").
 */
@HiltViewModel
class RecurringSetupViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
    ) : ViewModel() {
        private val zone: ZoneId = ZoneId.systemDefault()

        private val _load = MutableStateFlow<RecurringLoadState>(RecurringLoadState.Loading)
        val load: StateFlow<RecurringLoadState> = _load.asStateFlow()

        private val _config = MutableStateFlow(RecurringConfig())
        val config: StateFlow<RecurringConfig> = _config.asStateFlow()

        private val _occurrences = MutableStateFlow<List<RecurrenceOccurrence>>(emptyList())
        val occurrences: StateFlow<List<RecurrenceOccurrence>> = _occurrences.asStateFlow()

        private val _submit = MutableStateFlow<RecurringSubmitState>(RecurringSubmitState.Idle)
        val submit: StateFlow<RecurringSubmitState> = _submit.asStateFlow()

        private var started = false

        fun start() {
            if (started) return
            started = true
            loadEventType()
        }

        fun loadEventType() {
            viewModelScope.launch {
                _load.value = RecurringLoadState.Loading
                when (val r = repo.getEventTypes(SchedulingOwner.Personal)) {
                    is NetworkResult.Success -> {
                        val et = r.data.eventTypes.firstOrNull { it.isActive != false } ?: r.data.eventTypes.firstOrNull()
                        if (et == null) {
                            _load.value = RecurringLoadState.Empty
                        } else {
                            val duration = et.defaultDuration ?: et.durations.firstOrNull() ?: DEFAULT_DURATION
                            _load.value = RecurringLoadState.Loaded(et.id, et.name, duration)
                            _config.value = _config.value.copy(durationMin = duration)
                            recompute()
                        }
                    }
                    is NetworkResult.Failure -> _load.value = RecurringLoadState.Error("Couldn't load your event types.")
                }
            }
        }

        fun setRepeat(repeat: RecurrenceRepeat) = update { it.copy(repeat = repeat) }

        /** Advance from configure step → Frame 4 review state. */
        fun review() {
            val occs = _occurrences.value
            if (occs.isEmpty()) return
            _submit.value = RecurringSubmitState.Reviewing(reviewOccurrences = occs)
        }

        /** Remove one occurrence from the Frame 4 recap before confirming. */
        fun removeOccurrence(occ: RecurrenceOccurrence) {
            val reviewing = _submit.value as? RecurringSubmitState.Reviewing ?: return
            val updated = reviewing.reviewOccurrences.filter { it != occ }
            if (updated.isEmpty()) {
                // Removing all items goes back to configure
                _submit.value = RecurringSubmitState.Idle
            } else {
                _submit.value = RecurringSubmitState.Reviewing(reviewOccurrences = updated)
            }
        }

        /** Go back from Frame 4 review to the configure step. */
        fun backFromReview() {
            _submit.value = RecurringSubmitState.Idle
        }

        fun setWeekday(index: Int) = update { it.copy(weekdayIndex = index) }

        fun setCount(count: Int) = update { it.copy(count = count.coerceIn(MIN_SESSIONS, MAX_SESSIONS)) }

        fun stepCount(delta: Int) = setCount(_config.value.count + delta)

        fun stepTime(deltaMinutes: Int) =
            update {
                val raw = it.startMinutes + deltaMinutes
                val wrapped = ((raw % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
                it.copy(startMinutes = wrapped)
            }

        private fun update(transform: (RecurringConfig) -> RecurringConfig) {
            _config.value = transform(_config.value)
            recompute()
        }

        private fun recompute() {
            _occurrences.value = generate(_config.value)
        }

        private fun generate(cfg: RecurringConfig): List<RecurrenceOccurrence> {
            val time = LocalTime.of(cfg.startMinutes / 60, cfg.startMinutes % 60)
            val today = LocalDate.now(zone)
            // Design only specifies Weekly cadence (recurring-frames.jsx RepeatsSelect).
            val firstDate = today.with(TemporalAdjusters.nextOrSame(dayOfWeek(cfg.weekdayIndex)))
            return (0 until cfg.count).map { i ->
                val date = firstDate.plusWeeks(i.toLong())
                val start = date.atTime(time).atZone(zone)
                RecurrenceOccurrence(
                    startUtc = start.toInstant().toString(),
                    dateLabel = date.format(DATE_FORMAT),
                    timeLabel = time.format(TIME_FORMAT),
                )
            }
        }

        fun confirm() {
            val loaded = _load.value as? RecurringLoadState.Loaded ?: return
            // Confirm uses the review-state occurrences (may differ after removes),
            // falling back to the full generated list when called from outside review.
            val reviewOccs = (_submit.value as? RecurringSubmitState.Reviewing)?.reviewOccurrences
            val sessions = (reviewOccs ?: _occurrences.value).map { it.startUtc }
            if (sessions.isEmpty()) return
            _submit.value = RecurringSubmitState.Saving
            viewModelScope.launch {
                val body =
                    CreateRecurringRequest(
                        eventTypeId = loaded.eventTypeId,
                        sessions = sessions,
                        inviteeTimezone = zone.id,
                    )
                _submit.value =
                    when (val r = repo.createRecurringBookings(SchedulingOwner.Personal, body)) {
                        is NetworkResult.Success -> {
                            val failedStarts = r.data.failed.mapNotNull { it.start }.toSet()
                            val failed =
                                _occurrences.value
                                    .filter { occ -> failedStarts.any { sameInstant(it, occ.startUtc) } }
                                    .map { it.copy(status = OccurrenceStatus.Failed) }
                            val created = (sessions.size - failed.size).coerceAtLeast(0)
                            // reflect failures in the preview list
                            _occurrences.value =
                                _occurrences.value.map { occ ->
                                    if (failedStarts.any {
                                            sameInstant(
                                                it,
                                                occ.startUtc,
                                            )
                                        }
                                    ) {
                                        occ.copy(status = OccurrenceStatus.Failed)
                                    } else {
                                        occ
                                    }
                                }
                            RecurringSubmitState.Result(created = created, requested = sessions.size, failed = failed)
                        }
                        is NetworkResult.Failure -> RecurringSubmitState.Error("Couldn't book the series — try again.")
                    }
            }
        }

        fun resetSubmit() {
            _submit.value = RecurringSubmitState.Idle
        }

        private fun sameInstant(
            a: String,
            b: String,
        ): Boolean {
            val ia = parseInstant(a) ?: return a == b
            val ib = parseInstant(b) ?: return a == b
            return ia == ib
        }

        private fun dayOfWeek(index: Int): DayOfWeek =
            // 0 = Sunday … 6 = Saturday
            when (index) {
                0 -> DayOfWeek.SUNDAY
                else -> DayOfWeek.of(index)
            }

        /** First / last date label for the summary range. */
        fun rangeLabel(): String {
            val occ = _occurrences.value
            val first = occ.firstOrNull()?.let { parseInstant(it.startUtc)?.atZone(zone)?.format(DATE_FORMAT) }
            val last = occ.lastOrNull()?.let { parseInstant(it.startUtc)?.atZone(zone)?.format(DATE_FORMAT) }
            return if (first != null && last != null) "$first – $last" else ""
        }

        fun weekdayShort(): String = dayOfWeek(_config.value.weekdayIndex).getDisplayName(java.time.format.TextStyle.SHORT, Locale.US)

        fun timeLabel(): String = LocalTime.of(_config.value.startMinutes / 60, _config.value.startMinutes % 60).format(TIME_FORMAT)

        private companion object {
            const val DEFAULT_DURATION = 30
            const val MIN_SESSIONS = 1
            const val MAX_SESSIONS = 52
            const val DAY_MINUTES = 24 * 60
            val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
            val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
        }
    }
