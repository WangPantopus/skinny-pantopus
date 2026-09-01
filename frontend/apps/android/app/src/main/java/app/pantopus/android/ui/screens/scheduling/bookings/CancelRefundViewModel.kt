@file:Suppress("PackageNaming", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
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
import javax.inject.Inject

/** The three refund presets the E5 refund section offers (frames 2–4). */
enum class RefundPreset(val label: String) {
    Full("Full"),
    Partial("Partial"),
    PerPolicy("Per policy"),
}

/** The E5 cancel sheet state (null = hidden). */
data class CancelSheetUiState(
    val pillar: SchedulingPillar,
    val summary: String,
    val reasons: List<String>,
    val selectedReason: String? = null,
    val otherText: String = "",
    val note: String = "",
    val notify: Boolean = true,
    val showRefund: Boolean = false,
    val refundPreset: RefundPreset = RefundPreset.Full,
    val creditRedeemed: Boolean = false,
    val restoreCredit: Boolean = true,
    val submitting: Boolean = false,
    val errorMessage: String? = null,
    val refundFailed: Boolean = false,
    // Terminal frames (5 confirmation · 8 already-cancelled, read-only).
    val succeeded: Boolean = false,
    val alreadyCancelled: Boolean = false,
    val refundOutcomeIssued: Boolean = false,
) {
    /** Per-preset policy explainer under the refund money rows (frames 2–4). Mirrors iOS. */
    val refundPolicyCopy: String
        get() =
            when (refundPreset) {
                RefundPreset.Full -> "You're within the free-cancellation window — full refund"
                RefundPreset.Partial -> "A partial refund applies per your cancellation policy"
                RefundPreset.PerPolicy ->
                    "Within 24h of start — 50% refund per your cancellation policy"
            }
}

/** Cancel reasons offered by the E5 sheet (last is free-text "Other"). */
val CANCEL_REASONS: List<String> =
    listOf("Changed plans", "Emergency", "Found someone else", "Other")

/**
 * E5 Cancel & Refund sheet. `POST /bookings/:id/cancel` applies the refund
 * server-side per the event type's policy (the host can't pick an amount). The
 * refund card is gated behind [SchedulingFeatureFlags] + a present payment, and
 * stays informational (no fabricated amount — the host-side API returns no
 * pre-cancel estimate). 409 `PAST_DEADLINE` surfaces inline; `REFUND_FAILED`
 * flips to a retry. On success it sets [committed] so the detail refetches.
 */
@HiltViewModel
class CancelRefundViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val bookingId: String =
            savedStateHandle.get<String>(
                SchedulingRoutes.ARG_BOOKING_ID,
            ).orEmpty()

        private val _state = MutableStateFlow<CancelSheetUiState?>(null)
        val state: StateFlow<CancelSheetUiState?> = _state.asStateFlow()

        private val _committed = MutableStateFlow(false)
        val committed: StateFlow<Boolean> = _committed.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal

        fun open(
            owner: SchedulingOwner,
            pillar: SchedulingPillar,
            summary: String,
            hasPayment: Boolean,
            creditRedeemed: Boolean = false,
            alreadyCancelled: Boolean = false,
            refundIssued: Boolean = false,
        ) {
            this.owner = owner
            val paid = hasPayment && flags.paidSchedulingEnabled
            val credit = creditRedeemed && flags.paidSchedulingEnabled
            _state.value =
                CancelSheetUiState(
                    pillar = pillar,
                    summary = summary,
                    reasons = CANCEL_REASONS,
                    // The money refund section (frames 2–4) and the credit-restore
                    // switch (frame 5) are mutually exclusive — a credit booking
                    // takes the switch instead.
                    showRefund = paid && !credit,
                    creditRedeemed = credit,
                    alreadyCancelled = alreadyCancelled,
                    refundOutcomeIssued = paid && refundIssued,
                )
        }

        fun dismiss() {
            _state.value = null
        }

        fun committedConsumed() {
            _committed.value = false
        }

        fun selectReason(reason: String) {
            _state.update { it?.copy(selectedReason = reason, errorMessage = null) }
        }

        fun setOther(value: String) {
            _state.update { it?.copy(otherText = value) }
        }

        fun setNote(value: String) {
            _state.update { it?.copy(note = value) }
        }

        fun toggleNotify() {
            _state.update { it?.copy(notify = !it.notify) }
        }

        fun selectPreset(preset: RefundPreset) {
            _state.update { it?.copy(refundPreset = preset) }
        }

        fun toggleRestoreCredit() {
            _state.update { it?.copy(restoreCredit = !it.restoreCredit) }
        }

        /** Frame 5/8 terminal "Done" — close the sheet and let the detail refetch. */
        fun done() {
            _state.value = null
            _committed.value = true
        }

        fun confirm() {
            val current = _state.value ?: return
            _state.update { it?.copy(submitting = true, errorMessage = null) }
            val reason = composeReason(current)
            viewModelScope.launch {
                when (val r = repo.cancelBooking(owner, bookingId, reason)) {
                    is NetworkResult.Success ->
                        // Design frame 5/8: re-render to the read-only confirmation
                        // (circle-slash + outcome copy + ghost Done) rather than
                        // dismiss immediately; Done then commits the refetch.
                        _state.update {
                            it?.copy(
                                submitting = false,
                                succeeded = true,
                                errorMessage = null,
                                refundOutcomeIssued = it.showRefund,
                            )
                        }
                    is NetworkResult.Failure -> applyError(r.error)
                }
            }
        }

        private fun composeReason(state: CancelSheetUiState): String? {
            val base =
                if (state.selectedReason == "Other") {
                    state.otherText.ifBlank {
                        "Other"
                    }
                } else {
                    state.selectedReason
                }
            val parts =
                listOfNotNull(
                    base?.takeIf { it.isNotBlank() },
                    state.note.takeIf { it.isNotBlank() },
                )
            return parts.joinToString(" — ").ifBlank { null }
        }

        private fun applyError(error: app.pantopus.android.data.api.net.NetworkError) {
            when (val decoded = errors.decode(error)) {
                is SchedulingError.Generic ->
                    when (decoded.code) {
                        "PAST_DEADLINE" ->
                            _state.update {
                                it?.copy(
                                    submitting = false,
                                    errorMessage = "This is past the cancellation deadline.",
                                )
                            }
                        "REFUND_FAILED" ->
                            _state.update {
                                it?.copy(
                                    submitting = false,
                                    refundFailed = true,
                                    errorMessage = "Refund couldn't be processed — try again or contact support.",
                                )
                            }
                        "ALREADY_CANCELLED" ->
                            // Design frame 8: flip to the read-only already-cancelled
                            // terminal instead of silently dismissing.
                            _state.update {
                                it?.copy(
                                    submitting = false,
                                    alreadyCancelled = true,
                                    errorMessage = null,
                                )
                            }
                        else ->
                            _state.update {
                                it?.copy(
                                    submitting = false,
                                    errorMessage = "Couldn't cancel — try again.",
                                )
                            }
                    }
                else ->
                    _state.update {
                        it?.copy(submitting = false, errorMessage = "Couldn't cancel — try again.")
                    }
            }
        }
    }
