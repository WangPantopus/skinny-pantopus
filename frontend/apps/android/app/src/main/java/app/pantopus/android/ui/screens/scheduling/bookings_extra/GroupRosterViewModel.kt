@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

sealed interface GroupRosterUiState {
    data object Loading : GroupRosterUiState

    data class Loaded(val data: RosterData) : GroupRosterUiState

    data class Empty(
        val onShareLink: () -> Unit,
        val seatTotal: Int = 0,
        val pillar: SchedulingPillar = SchedulingPillar.Personal,
    ) : GroupRosterUiState

    data class Error(val message: String) : GroupRosterUiState
}

data class RosterData(
    val title: String,
    val pillar: SchedulingPillar,
    val seatTotal: Int,
    val filled: Int,
    val confirmed: Int,
    val pending: Int,
    val waiting: Int,
    val seated: List<RosterPerson>,
    val waitlist: List<RosterPerson>,
    val seatsOpen: Int,
    val canMarkNoShow: Boolean,
)

/**
 * E8 Group Event Roster & Seats. A group booking is N sibling `Booking` rows
 * sharing a slot (capped by the event type's `seat_cap`), so the roster is
 * composed: the anchor booking resolves the event type + start, then the sibling
 * bookings in that slot are the seated attendees and `GET /event-types/:id/
 * waitlist` is the waitlist. Hosts the E6 no-show (multi-select over confirmed
 * siblings → per-booking `markNoShow`) and the E11 nudge (fan-out over the
 * chosen audience).
 */
@HiltViewModel
class GroupRosterViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val homes: HomesRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val bookingId: String = savedStateHandle.get<String>(SchedulingRoutes.ARG_BOOKING_ID).orEmpty()

        private val _state = MutableStateFlow<GroupRosterUiState>(GroupRosterUiState.Loading)
        val state: StateFlow<GroupRosterUiState> = _state.asStateFlow()

        private val _noShow = MutableStateFlow<NoShowSheetState?>(null)
        val noShow: StateFlow<NoShowSheetState?> = _noShow.asStateFlow()

        private val _nudge = MutableStateFlow<NudgeSheetState?>(null)
        val nudge: StateFlow<NudgeSheetState?> = _nudge.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _navRequest = MutableStateFlow<String?>(null)
        val navRequest: StateFlow<String?> = _navRequest.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var eventTypeId: String? = null
        private var eventTypeName: String = "Roster"
        private var anchorStart: String? = null
        private var seatTotal: Int = 0
        private var siblings: List<BookingDto> = emptyList()
        private var started = false

        fun start() {
            if (started) {
                refresh()
            } else {
                started = true
                load()
            }
        }

        fun load() {
            viewModelScope.launch {
                _state.value = GroupRosterUiState.Loading
                fetch()
            }
        }

        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        private suspend fun fetch() {
            when (val detail = repo.getBooking(SchedulingOwner.Personal, bookingId)) {
                is NetworkResult.Failure -> {
                    _state.value = GroupRosterUiState.Error(errors.decode(detail.error).message())
                    return
                }
                is NetworkResult.Success -> {
                    val booking = detail.data.booking
                    owner = BookingsExtrasOwner.fromBooking(booking)
                    eventTypeId = booking.eventTypeId
                    anchorStart = booking.startAt
                    eventTypeName = detail.data.eventType?.name ?: "Roster"
                }
            }

            val etId = eventTypeId
            seatTotal =
                if (etId != null) {
                    repo.getEventType(owner, etId).dataOrNull()?.eventType?.let { et ->
                        eventTypeName = et.name
                        et.seatCap ?: 1
                    } ?: 1
                } else {
                    1
                }

            siblings =
                if (etId != null && anchorStart != null) {
                    repo.getBookings(owner, eventTypeId = etId, from = anchorStart, to = anchorStart)
                        .dataOrNull()?.bookings
                        ?.filter { sameSlot(it.startAt, anchorStart) }
                        ?: listOf()
                } else {
                    emptyList()
                }

            val waitlistEntries =
                if (etId != null) {
                    repo.getWaitlist(owner, etId).dataOrNull()?.waitlist?.filter { it.status == "waiting" }.orEmpty()
                } else {
                    emptyList()
                }

            val confirmed = siblings.filter { it.status == STATUS_CONFIRMED }
            val pending = siblings.filter { it.status == STATUS_PENDING }
            val seatedRows =
                (confirmed + pending).sortedBy { it.createdAt ?: "" }.map { b ->
                    RosterPerson(
                        id = b.id,
                        name = b.inviteeName ?: b.inviteeEmail ?: "Guest",
                        meta = BookingsExtrasFormatting.joinedLabel(b.createdAt),
                        status = b.status,
                    )
                }
            val waitlistRows =
                waitlistEntries.mapIndexed { index, entry ->
                    RosterPerson(
                        id = entry.id,
                        name = entry.inviteeName ?: entry.inviteeEmail ?: "Guest",
                        meta = "#${index + 1} · ${BookingsExtrasFormatting.joinedLabel(entry.createdAt)}",
                        status = "waiting",
                    )
                }

            if (seatedRows.isEmpty() && waitlistRows.isEmpty()) {
                _state.value =
                    GroupRosterUiState.Empty(
                        // Carry the roster's resolved owner into the booking-page hop.
                        onShareLink = {
                            _navRequest.value = SchedulingRoutes.bookingPageManage(owner.routeKind, owner.ownerRouteId)
                        },
                        seatTotal = seatTotal,
                        pillar = owner.pillar(),
                    )
                return
            }

            val filled = seatedRows.size
            _state.value =
                GroupRosterUiState.Loaded(
                    RosterData(
                        title = "Roster",
                        pillar = owner.pillar(),
                        seatTotal = seatTotal,
                        filled = filled,
                        confirmed = confirmed.size,
                        pending = pending.size,
                        waiting = waitlistRows.size,
                        seated = seatedRows,
                        waitlist = waitlistRows,
                        seatsOpen = (seatTotal - filled).coerceAtLeast(0),
                        canMarkNoShow = confirmed.isNotEmpty() && anchorStartHasPassed(),
                    ),
                )
        }

        // ─── Capacity ────────────────────────────────────────────────────────

        fun adjustCapacity(delta: Int) {
            val etId = eventTypeId ?: return
            val current = (state.value as? GroupRosterUiState.Loaded)?.data ?: return
            val newCap = (current.seatTotal + delta).coerceAtLeast(current.filled.coerceAtLeast(1))
            if (newCap == current.seatTotal) return
            seatTotal = newCap
            _state.value =
                GroupRosterUiState.Loaded(current.copy(seatTotal = newCap, seatsOpen = (newCap - current.filled).coerceAtLeast(0)))
            viewModelScope.launch {
                val body = app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest(seatCap = newCap)
                if (repo.updateEventType(owner, etId, body) is NetworkResult.Failure) {
                    _toast.value = "Couldn't update capacity."
                    refresh()
                }
            }
        }

        // ─── Waitlist promote ────────────────────────────────────────────────

        fun promote(entryId: String) {
            viewModelScope.launch {
                when (repo.promoteWaitlist(owner, entryId)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Notified — they can grab the seat."
                        refresh()
                    }
                    is NetworkResult.Failure -> _toast.value = "Couldn't promote — try again."
                }
            }
        }

        // ─── No-show ─────────────────────────────────────────────────────────

        fun openNoShow() {
            val confirmed = siblings.filter { it.status == STATUS_CONFIRMED }
            if (confirmed.isEmpty()) {
                _toast.value = "No confirmed attendees to mark."
                return
            }
            val targets = confirmed.map { NoShowTarget(it.id, it.inviteeName ?: it.inviteeEmail ?: "Guest") }
            _noShow.value = NoShowSheetState(targets = targets, selectedIds = targets.map { it.bookingId }.toSet())
        }

        /** The 1:1 dialog variant for a single seated row's kebab action. */
        fun openNoShowFor(
            id: String,
            name: String,
        ) {
            _noShow.value = NoShowSheetState(targets = listOf(NoShowTarget(id, name)), selectedIds = setOf(id))
        }

        fun toggleNoShow(id: String) {
            _noShow.update { s ->
                s?.copy(selectedIds = if (id in s.selectedIds) s.selectedIds - id else s.selectedIds + id)
            }
        }

        fun setNoShowNote(note: String) {
            _noShow.update { it?.copy(note = note) }
        }

        fun dismissNoShow() {
            _noShow.value = null
        }

        fun confirmNoShow() {
            val current = _noShow.value ?: return
            _noShow.value = current.copy(submitting = true, error = null)
            viewModelScope.launch {
                val succeeded = mutableSetOf<String>()
                var failure: String? = null
                for (id in current.selectedIds) {
                    when (val r = repo.markNoShow(owner, id)) {
                        is NetworkResult.Success -> succeeded += id
                        is NetworkResult.Failure ->
                            // BAD_STATE = the booking already reached a terminal state
                            // (e.g. an earlier partial attempt already marked it
                            // no-show) — count it done, don't re-send it forever.
                            if (isAlreadyTerminal(r)) succeeded += id else failure = noShowErrorMessage(r)
                    }
                }
                if (failure == null) {
                    _noShow.value = null
                    _toast.value = "Marked no-show."
                    refresh()
                } else {
                    // Keep only the failed ids selected so a retry re-sends just the
                    // failures, not the bookings that already landed.
                    _noShow.value = current.copy(submitting = false, error = failure, selectedIds = current.selectedIds - succeeded)
                }
            }
        }

        // ─── Nudge ───────────────────────────────────────────────────────────

        fun openNudge() {
            val confirmed = siblings.count { it.status == STATUS_CONFIRMED }
            val noShows = siblings.count { it.status == STATUS_NO_SHOW }
            val all = siblings.count { it.status == STATUS_CONFIRMED || it.status == STATUS_PENDING }
            _nudge.value =
                NudgeSheetState(
                    subtitle = "$eventTypeName · ${BookingsExtrasFormatting.dayAndTime(anchorStart)}",
                    counts = NudgeAudienceCounts(all = all, confirmed = confirmed, noShows = noShows),
                )
            viewModelScope.launch {
                val templates =
                    repo.getMessageTemplates(owner).dataOrNull()?.templates
                        ?.map { NudgeTemplate(it.id, it.name, it.body.orEmpty()) }
                        .orEmpty()
                _nudge.update { it?.copy(templates = templates) }
            }
        }

        fun setNudgeMessage(message: String) {
            _nudge.update { it?.copy(message = message) }
        }

        fun setNudgeAudience(audience: NudgeAudience) {
            _nudge.update { it?.copy(audience = audience) }
        }

        fun setNudgePush(on: Boolean) {
            _nudge.update { it?.copy(pushOn = on) }
        }

        fun setNudgeEmail(on: Boolean) {
            _nudge.update { it?.copy(emailOn = on) }
        }

        fun openTemplatePicker() {
            _nudge.update { it?.copy(templatePickerOpen = true) }
        }

        fun dismissTemplatePicker() {
            _nudge.update { it?.copy(templatePickerOpen = false) }
        }

        fun applyTemplate(template: NudgeTemplate) {
            _nudge.update { it?.copy(message = template.body, templatePickerOpen = false) }
        }

        fun dismissNudge() {
            _nudge.value = null
        }

        fun confirmNudge() {
            val current = _nudge.value ?: return
            val ids =
                when (current.audience) {
                    NudgeAudience.All -> siblings.filter { it.status == STATUS_CONFIRMED || it.status == STATUS_PENDING }
                    NudgeAudience.Confirmed -> siblings.filter { it.status == STATUS_CONFIRMED }
                    NudgeAudience.NoShows -> siblings.filter { it.status == STATUS_NO_SHOW }
                }.map { it.id }
            if (ids.isEmpty()) return
            _nudge.value = current.copy(sending = true, error = null)
            viewModelScope.launch {
                var failure = false
                for (id in ids) {
                    if (repo.nudgeBooking(owner, id, current.message) is NetworkResult.Failure) failure = true
                }
                if (failure) {
                    _nudge.value = current.copy(sending = false, error = "Couldn't send to everyone — try again.")
                } else {
                    // Surface the design's in-sheet success scene (disc + "Update
                    // sent" + dark count toast); the sheet auto-dismisses after.
                    _nudge.value = current.copy(sending = false, didSend = true, sentCount = ids.size)
                }
            }
        }

        fun openAddAttendee() {
            // Carry the roster's resolved owner so the manual booking lists this
            // owner's event types and creates the attendee on this roster.
            _navRequest.value = SchedulingRoutes.manualBooking(owner.routeKind, owner.ownerRouteId)
        }

        fun navRequestConsumed() {
            _navRequest.value = null
        }

        fun toastConsumed() {
            _toast.value = null
        }

        // ─── Helpers ─────────────────────────────────────────────────────────

        private fun anchorStartHasPassed(): Boolean {
            val start = BookingsExtrasFormatting.instantOrNull(anchorStart) ?: return true
            return start.isBefore(Instant.now())
        }

        /**
         * `BAD_STATE` from `POST /bookings/:id/no-show` means the booking already
         * reached a terminal state (backend `markNoShow` only transitions
         * confirmed/completed rows) — for the multi-select flow that reads as
         * "already handled", not a retryable failure.
         */
        private fun isAlreadyTerminal(failure: NetworkResult.Failure): Boolean {
            val decoded = errors.decode(failure.error)
            return (decoded as? app.pantopus.android.data.scheduling.SchedulingError.Generic)?.code == CODE_BAD_STATE
        }

        private fun noShowErrorMessage(failure: NetworkResult.Failure): String {
            val decoded = errors.decode(failure.error)
            val code = (decoded as? app.pantopus.android.data.scheduling.SchedulingError.Generic)?.code
            return if (code == CODE_NOT_APPLICABLE_YET) {
                "You can mark a no-show only after the booking's start time."
            } else {
                "Couldn't update — try again."
            }
        }

        private fun sameSlot(
            a: String?,
            b: String?,
        ): Boolean {
            val ia = BookingsExtrasFormatting.instantOrNull(a)
            val ib = BookingsExtrasFormatting.instantOrNull(b)
            return ia != null && ia == ib
        }

        private fun app.pantopus.android.data.scheduling.SchedulingError.message(): String =
            when (this) {
                is app.pantopus.android.data.scheduling.SchedulingError.Generic -> message
                else -> "Couldn't load this roster."
            }

        private fun <T> NetworkResult<T>.dataOrNull(): T? = (this as? NetworkResult.Success)?.data

        private companion object {
            const val STATUS_CONFIRMED = "confirmed"
            const val STATUS_PENDING = "pending"
            const val STATUS_NO_SHOW = "no_show"
            const val CODE_BAD_STATE = "BAD_STATE"
            const val CODE_NOT_APPLICABLE_YET = "NOT_APPLICABLE_YET"
        }
    }
