@file:Suppress("PackageNaming", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.HostRescheduleRequest
import app.pantopus.android.data.api.models.scheduling.ProposeRescheduleRequest
import app.pantopus.android.data.api.models.scheduling.ReassignRequest
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import javax.inject.Inject

/** Whether the new time is proposed to the invitee, or applied immediately. */
enum class RescheduleAuthority { Propose, Now }

/** A reassign candidate host (id-only — names need a team roster the A8 contract doesn't expose). */
data class MemberOption(
    val id: String,
    val initials: String,
    val label: String,
)

/** The E4 sheet state (null = hidden). */
data class RescheduleSheetUiState(
    val pillar: SchedulingPillar,
    val reassignOnly: Boolean,
    val allowReassign: Boolean,
    val currentLabel: String,
    val tz: String,
    val loading: Boolean = true,
    val submitting: Boolean = false,
    val slots: List<SlotDto> = emptyList(),
    val selectedDayEpoch: Long? = null,
    val selectedStart: String? = null,
    val members: List<MemberOption> = emptyList(),
    val selectedMemberId: String? = null,
    val authority: RescheduleAuthority = RescheduleAuthority.Now,
    val notify: Boolean = true,
    val conflict: SchedulingError.Conflict? = null,
    val errorMessage: String? = null,
    val proposed: Boolean = false,
)

/**
 * E4 Reschedule / Reassign sheet. Reuses the shared `SlotTimeList` over a day
 * strip; honors tz (renders local, sends UTC). "Reschedule now" →
 * `POST /bookings/:id/reschedule`; "Propose to invitee" →
 * `…/propose-reschedule`; reassign-only → `…/reassign`. A 409 `SLOT_CONFLICT`
 * routes to the shared `ConflictAlternativesSheet`; `PAST_DEADLINE`/`INVALID_TIME`
 * and `INVALID_HOST` surface inline. On commit it sets [committed] so the detail
 * screen refetches.
 */
@HiltViewModel
class RescheduleReassignViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val bookingId: String =
            savedStateHandle.get<String>(
                SchedulingRoutes.ARG_BOOKING_ID,
            ).orEmpty()

        private val _state = MutableStateFlow<RescheduleSheetUiState?>(null)
        val state: StateFlow<RescheduleSheetUiState?> = _state.asStateFlow()

        private val _committed = MutableStateFlow(false)
        val committed: StateFlow<Boolean> = _committed.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal

        fun open(
            owner: SchedulingOwner,
            pillar: SchedulingPillar,
            currentStartUtc: String?,
            currentEndUtc: String?,
            allowReassign: Boolean,
            reassignOnly: Boolean,
        ) {
            this.owner = owner
            val tz = ZoneId.systemDefault().id
            _state.value =
                RescheduleSheetUiState(
                    pillar = pillar,
                    reassignOnly = reassignOnly,
                    allowReassign = allowReassign,
                    currentLabel = slotRangeLabel(currentStartUtc, currentEndUtc),
                    tz = tz,
                    loading = true,
                    authority = RescheduleAuthority.Now,
                )
            fetchSlots(tz)
        }

        fun dismiss() {
            _state.value = null
        }

        fun committedConsumed() {
            _committed.value = false
        }

        private fun fetchSlots(tz: String) {
            viewModelScope.launch {
                val from = Instant.now().toString()
                val to = Instant.now().plusSeconds(WINDOW_SECONDS).toString()
                when (
                    val r =
                        repo.getBookingAvailableSlots(
                            owner,
                            bookingId,
                            from = from,
                            to = to,
                            tz = tz,
                        )
                ) {
                    is NetworkResult.Success -> {
                        val slots = r.data.slots
                        val members =
                            slots.flatMap { it.eligibleHosts.orEmpty() }
                                .distinct()
                                .map { MemberOption(it, it.take(2).uppercase(), "Member") }
                        val firstDay = slots.firstOrNull()?.let { slotLocalDate(it)?.toEpochDay() }
                        _state.update {
                            it?.copy(
                                loading = false,
                                slots = slots,
                                members = members,
                                selectedDayEpoch = firstDay,
                            )
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.update { it?.copy(loading = false, slots = emptyList()) }
                }
            }
        }

        fun selectDay(epochDay: Long) {
            _state.update { it?.copy(selectedDayEpoch = epochDay) }
        }

        fun selectSlot(slot: SlotDto) {
            _state.update { it?.copy(selectedStart = slot.start, errorMessage = null) }
        }

        fun selectMember(id: String) {
            _state.update { it?.copy(selectedMemberId = id, errorMessage = null) }
        }

        fun setAuthority(value: RescheduleAuthority) {
            _state.update { it?.copy(authority = value) }
        }

        fun toggleNotify() {
            _state.update { it?.copy(notify = !it.notify) }
        }

        fun dismissConflict() {
            _state.update { it?.copy(conflict = null) }
        }

        /** Re-submit immediately with a slot picked from the conflict-alternatives sheet. */
        fun pickAlternative(slot: SlotDto) {
            _state.update {
                it?.copy(
                    selectedStart = slot.start,
                    conflict = null,
                    authority = RescheduleAuthority.Now,
                )
            }
            confirm()
        }

        fun confirm() {
            val current = _state.value ?: return
            if (current.reassignOnly) {
                confirmReassign(current)
            } else {
                confirmReschedule(current)
            }
        }

        private fun confirmReassign(current: RescheduleSheetUiState) {
            val host = current.selectedMemberId ?: return
            _state.update { it?.copy(submitting = true, errorMessage = null) }
            viewModelScope.launch {
                when (
                    val r =
                        repo.reassignBooking(
                            owner,
                            bookingId,
                            ReassignRequest(hostUserId = host),
                        )
                ) {
                    is NetworkResult.Success -> commit()
                    is NetworkResult.Failure -> applyError(r.error, reassign = true)
                }
            }
        }

        private fun confirmReschedule(current: RescheduleSheetUiState) {
            val start = current.selectedStart ?: return
            val host = current.selectedMemberId
            _state.update { it?.copy(submitting = true, errorMessage = null, conflict = null) }
            viewModelScope.launch {
                if (current.authority == RescheduleAuthority.Propose) {
                    when (
                        val r =
                            repo.proposeReschedule(
                                owner,
                                bookingId,
                                ProposeRescheduleRequest(startAt = start, hostUserId = host),
                            )
                    ) {
                        is NetworkResult.Success ->
                            _state.update {
                                it?.copy(
                                    submitting = false,
                                    proposed = true,
                                )
                            }
                        is NetworkResult.Failure -> applyError(r.error, reassign = false)
                    }
                } else {
                    when (
                        val r =
                            repo.rescheduleBooking(
                                owner,
                                bookingId,
                                HostRescheduleRequest(startAt = start, hostUserId = host),
                            )
                    ) {
                        is NetworkResult.Success -> commit()
                        is NetworkResult.Failure -> applyError(r.error, reassign = false)
                    }
                }
            }
        }

        private fun applyError(
            error: app.pantopus.android.data.api.net.NetworkError,
            reassign: Boolean,
        ) {
            when (val decoded = errors.decode(error)) {
                is SchedulingError.Conflict ->
                    _state.update {
                        it?.copy(
                            submitting = false,
                            conflict = decoded,
                        )
                    }
                is SchedulingError.Generic ->
                    _state.update {
                        it?.copy(submitting = false, errorMessage = messageFor(decoded.code, reassign))
                    }
                else ->
                    _state.update {
                        it?.copy(
                            submitting = false,
                            errorMessage = genericError(reassign),
                        )
                    }
            }
        }

        private fun messageFor(
            code: String?,
            reassign: Boolean,
        ): String =
            when (code) {
                "PAST_DEADLINE" -> "This is past the reschedule cutoff for this booking."
                "INVALID_TIME" -> "That time isn't valid. Pick another."
                "INVALID_HOST" -> "That member can't take this booking."
                else -> genericError(reassign)
            }

        private fun genericError(reassign: Boolean): String =
            if (reassign) "Couldn't reassign — try again." else "Couldn't save the new time — try again."

        private fun commit() {
            _state.value = null
            _committed.value = true
        }

        private companion object {
            const val WINDOW_SECONDS = 60L * 60 * 24 * 30
        }
    }
