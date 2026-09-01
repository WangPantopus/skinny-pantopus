@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.ManageActions
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTerminalState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import javax.inject.Inject

/**
 * D10 — Reschedule / Cancel cutoff & policy-blocked. The invitee's manage
 * surface read from `GET /api/public/booking/:token`. The policy mode is
 * computed from `actions` (deadlines + invitee permissions), `payment`, and the
 * booking status, so the screen states the exact rule and always offers a
 * fallback (it never dead-ends). Reschedule pulls open slots and `POST …
 * /reschedule` (409 → nearest open times); cancel reads the refund estimate and
 * `POST …/cancel`; host-proposed reschedules accept/decline.
 */
@HiltViewModel
class RescheduleCancelPolicyViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ManageUiState>(ManageUiState.Loading)
        val state: StateFlow<ManageUiState> = _state.asStateFlow()

        private val _reschedule = MutableStateFlow<RescheduleSheetState>(RescheduleSheetState.Hidden)
        val reschedule: StateFlow<RescheduleSheetState> = _reschedule.asStateFlow()

        private val _cancel = MutableStateFlow<CancelSheetState>(CancelSheetState.Hidden)
        val cancel: StateFlow<CancelSheetState> = _cancel.asStateFlow()

        /** One-shot transient message. */
        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var token: String = ""
        private var zone: ZoneId = ZoneId.systemDefault()

        fun start(manageToken: String) {
            if (token == manageToken && _state.value !is ManageUiState.Loading) return
            token = manageToken
            load()
        }

        fun load() {
            viewModelScope.launch {
                _state.value = ManageUiState.Loading
                _state.value =
                    when (val r = repo.publicGetManageBooking(token)) {
                        is NetworkResult.Success -> mapLoaded(r.data)
                        is NetworkResult.Failure -> {
                            when (val decoded = errors.decode(r.error, notFoundAs = SchedulingError.Expired)) {
                                is SchedulingError.Generic -> ManageUiState.Error(decoded.message)
                                else -> ManageUiState.Terminal(decoded.terminalOrExpired())
                            }
                        }
                    }
            }
        }

        private fun mapLoaded(data: ManageBookingResponse): ManageUiState {
            zone = data.booking.inviteeTimezone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()
            val status = data.booking.status?.lowercase()
            terminalForStatus(status)?.let { return ManageUiState.Terminal(it) }
            val view = data.toManageView(zone)
            return ManageUiState.Loaded(view, computeMode(data.actions, status, view))
        }

        // ─── Reschedule ─────────────────────────────────────────────────────────

        fun openReschedule() {
            _reschedule.value = RescheduleSheetState.Loading
            viewModelScope.launch {
                val now = Instant.now()
                val from = now.toString()
                val to = now.plus(RESCHEDULE_WINDOW_DAYS, ChronoUnit.DAYS).toString()
                _reschedule.value =
                    when (val r = repo.publicGetManageSlots(token, from = from, to = to, tz = zone.id)) {
                        is NetworkResult.Success ->
                            if (r.data.slots.isEmpty()) RescheduleSheetState.NoSlots else RescheduleSheetState.Slots(r.data.slots)
                        is NetworkResult.Failure -> RescheduleSheetState.Error("Couldn't load open times.")
                    }
            }
        }

        fun closeReschedule() {
            _reschedule.value = RescheduleSheetState.Hidden
        }

        fun confirmReschedule(slot: SlotDto) {
            _reschedule.value = RescheduleSheetState.Saving
            viewModelScope.launch {
                when (val r = repo.publicReschedule(token, slot.start)) {
                    is NetworkResult.Success -> {
                        _reschedule.value = RescheduleSheetState.Hidden
                        _toast.value = "Rescheduled."
                        load()
                    }
                    is NetworkResult.Failure ->
                        _reschedule.value =
                            when (val decoded = errors.decode(r.error)) {
                                is SchedulingError.Conflict -> RescheduleSheetState.Conflict(decoded.alternatives)
                                else -> RescheduleSheetState.Error("Couldn't save the new time — try again.")
                            }
                }
            }
        }

        // ─── Cancel ─────────────────────────────────────────────────────────────

        fun openCancel() {
            val view = (_state.value as? ManageUiState.Loaded)?.view ?: return
            _cancel.value = CancelSheetState.Confirm(refundLabel = view.refundEstimateLabel)
        }

        fun closeCancel() {
            _cancel.value = CancelSheetState.Hidden
        }

        fun confirmCancel(reason: String?) {
            _cancel.value = CancelSheetState.Saving
            viewModelScope.launch {
                when (val r = repo.publicCancel(token, reason?.takeIf { it.isNotBlank() })) {
                    is NetworkResult.Success -> {
                        _cancel.value = CancelSheetState.Hidden
                        _state.value = ManageUiState.Terminal(SchedulingTerminalState.Cancelled)
                    }
                    is NetworkResult.Failure -> _cancel.value = CancelSheetState.Error("Couldn't cancel — try again.")
                }
            }
        }

        // ─── Host-proposed reschedule ────────────────────────────────────────────

        fun acceptProposed() {
            viewModelScope.launch {
                when (repo.publicAcceptReschedule(token)) {
                    is NetworkResult.Success -> {
                        _toast.value = "New time confirmed."
                        load()
                    }
                    is NetworkResult.Failure -> _toast.value = "Couldn't accept the new time."
                }
            }
        }

        fun declineProposed() {
            viewModelScope.launch {
                when (repo.publicDeclineReschedule(token)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Proposed time declined."
                        load()
                    }
                    is NetworkResult.Failure -> _toast.value = "Couldn't decline the new time."
                }
            }
        }

        fun toastConsumed() {
            _toast.value = null
        }

        // ─── Mapping helpers ─────────────────────────────────────────────────────

        private fun computeMode(
            actions: ManageActions?,
            status: String?,
            view: ManageView,
        ): ManagePolicyMode {
            if (status in PROPOSED_STATUSES) return ManagePolicyMode.ProposedReschedule
            val rescheduleAllowed = actions?.inviteeRescheduleAllowed != false
            val cancelAllowed = actions?.inviteeCancelAllowed != false
            if (!rescheduleAllowed && !cancelAllowed) return ManagePolicyMode.NotOnline
            val canReschedule = actions?.canReschedule == true
            val canCancel = actions?.canCancel == true
            return when {
                canReschedule && canCancel -> ManagePolicyMode.FreeToChange
                cancelAllowed && !canCancel -> ManagePolicyMode.CancelClosedNoRefund
                !canReschedule && canCancel && view.refundIsPartial -> ManagePolicyMode.PartialRefund
                !canReschedule && canCancel && view.hasPayment && view.refundIsFull -> ManagePolicyMode.FreeCancel
                !canReschedule && canCancel -> ManagePolicyMode.RescheduleClosed
                else -> ManagePolicyMode.FreeToChange
            }
        }

        private fun terminalForStatus(status: String?): SchedulingTerminalState? =
            when (status) {
                "cancelled", "canceled" -> SchedulingTerminalState.Cancelled
                "declined" -> SchedulingTerminalState.Cancelled
                else -> null
            }

        private fun SchedulingError.terminalOrExpired(): SchedulingTerminalState =
            when (this) {
                is SchedulingError.Paused -> SchedulingTerminalState.Paused
                is SchedulingError.Unavailable -> SchedulingTerminalState.Unavailable
                is SchedulingError.Secret -> SchedulingTerminalState.Secret
                else -> SchedulingTerminalState.Expired
            }

        private fun ManageBookingResponse.toManageView(zone: ZoneId): ManageView {
            val refundCents = actions?.refundEstimateCents
            val amountCents = payment?.amountTotal
            return ManageView(
                eventName = eventType?.name ?: "Your booking",
                hostLabel = page?.title ?: "Your host",
                pillar = pillarFor(page?.ownerType ?: booking.policySnapshot?.get("owner_type") as? String),
                whenLabel = formatWhenRange(booking.startAt, booking.endAt, zone),
                tzLabel = tzShortLabel(zone, parseInstant(booking.startAt) ?: Instant.now()),
                status = booking.status ?: "confirmed",
                canReschedule = actions?.canReschedule == true,
                canCancel = actions?.canCancel == true,
                rescheduleDeadlineLabel = formatDeadline(actions?.rescheduleDeadline, zone),
                freeCancelUntilLabel = formatDeadline(actions?.freeCancelUntil, zone),
                refundEstimateLabel = refundCents?.let { MoneyAndFlag.formatPrice(it, payment?.currency) },
                refundIsFull = refundCents != null && amountCents != null && refundCents >= amountCents,
                refundIsPartial = refundCents != null && refundCents > 0 && amountCents != null && refundCents < amountCents,
                hasPayment = payment != null,
                startUtc = booking.startAt,
                endUtc = booking.endAt,
                location = booking.locationDetail,
                timezone = booking.inviteeTimezone,
                proposedWhenLabel = booking.previousStartAt?.let { formatWhenRange(booking.startAt, booking.endAt, zone) },
            )
        }

        private fun pillarFor(ownerType: String?): SchedulingPillar =
            when (ownerType?.lowercase()) {
                "business" -> SchedulingPillar.Business
                "home" -> SchedulingPillar.Home
                else -> SchedulingPillar.Personal
            }

        private fun formatDeadline(
            utc: String?,
            zone: ZoneId,
        ): String? = formatWhenRange(utc, null, zone).takeIf { it.isNotBlank() && utc != null }

        private companion object {
            const val RESCHEDULE_WINDOW_DAYS = 30L
            val PROPOSED_STATUSES = setOf("reschedule_proposed", "proposed", "reschedule_pending")
        }
    }

/** The dominant policy state D10 renders one note-card + action set for. */
enum class ManagePolicyMode {
    FreeToChange,
    FreeCancel,
    RescheduleClosed,
    CancelClosedNoRefund,
    PartialRefund,
    NotOnline,
    ProposedReschedule,
}

/** The flattened manage-your-booking projection D10 renders. */
data class ManageView(
    val eventName: String,
    val hostLabel: String,
    val pillar: SchedulingPillar,
    val whenLabel: String,
    val tzLabel: String?,
    val status: String,
    val canReschedule: Boolean,
    val canCancel: Boolean,
    val rescheduleDeadlineLabel: String?,
    val freeCancelUntilLabel: String?,
    val refundEstimateLabel: String?,
    val refundIsFull: Boolean,
    val refundIsPartial: Boolean,
    val hasPayment: Boolean,
    val startUtc: String?,
    val endUtc: String?,
    val location: String?,
    val timezone: String?,
    val proposedWhenLabel: String?,
)

sealed interface ManageUiState {
    data object Loading : ManageUiState

    data class Loaded(val view: ManageView, val mode: ManagePolicyMode) : ManageUiState

    data class Terminal(val state: SchedulingTerminalState) : ManageUiState

    data class Error(val message: String) : ManageUiState
}

sealed interface RescheduleSheetState {
    data object Hidden : RescheduleSheetState

    data object Loading : RescheduleSheetState

    data class Slots(val slots: List<SlotDto>) : RescheduleSheetState

    data object NoSlots : RescheduleSheetState

    data object Saving : RescheduleSheetState

    data class Conflict(val alternatives: List<SlotDto>) : RescheduleSheetState

    data class Error(val message: String) : RescheduleSheetState
}

sealed interface CancelSheetState {
    data object Hidden : CancelSheetState

    data class Confirm(val refundLabel: String?) : CancelSheetState

    data object Saving : CancelSheetState

    data class Error(val message: String) : CancelSheetState
}
