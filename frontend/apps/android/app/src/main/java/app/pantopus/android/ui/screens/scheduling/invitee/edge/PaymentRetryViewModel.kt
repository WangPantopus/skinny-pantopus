@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.MoneyAndFlag
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * D6 — Payment failed / retry. Drives the retry sheet from the booking's manage
 * `payment` block: a declined payment holds the slot while the invitee retries
 * the Stripe `clientSecret` (test mode, behind the paid flag), and a dropped
 * connection re-checks idempotently — we never charge twice. Settlement is
 * deferred server-side, so a succeeded retry surfaces processing/pending until
 * the webhook reconciles.
 */
@HiltViewModel
class PaymentRetryViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        val flags: SchedulingFeatureFlags,
    ) : ViewModel() {
        sealed interface PaymentRetryUiState {
            data object Loading : PaymentRetryUiState

            /** Card declined / requires a new payment method — the slot is still held. */
            data class Declined(
                val amountLabel: String,
                val message: String,
                /** Formatted slot time for the hold chip, e.g. "2:00 PM". */
                val slotTime: String? = null,
            ) : PaymentRetryUiState

            /** Outcome unknown after a dropped connection — re-check, idempotent. */
            data class Timeout(
                val amountLabel: String,
                /** Formatted slot time for the hold chip, e.g. "2:00 PM". */
                val slotTime: String? = null,
            ) : PaymentRetryUiState

            /** The held slot was released while waiting — pick again. */
            data object HoldExpired : PaymentRetryUiState

            /** Payment captured (or processing — settlement deferred). */
            data class Succeeded(val amountLabel: String, val processing: Boolean) : PaymentRetryUiState

            data class Error(val message: String) : PaymentRetryUiState
        }

        private val _state = MutableStateFlow<PaymentRetryUiState>(PaymentRetryUiState.Loading)
        val state: StateFlow<PaymentRetryUiState> = _state.asStateFlow()

        /**
         * Live hold countdown in seconds. Ticks down every second for Declined and
         * Timeout states (mirrors iOS PaymentFailedViewModel.startHold). Starts at
         * the default hold window; stops when the state leaves those two cases.
         */
        private val _holdRemaining = MutableStateFlow(HOLD_WINDOW_SECONDS)
        val holdRemaining: StateFlow<Int> = _holdRemaining.asStateFlow()

        private var holdJob: Job? = null
        private var loadedToken: String? = null

        fun start(manageToken: String) {
            if (loadedToken == manageToken && _state.value !is PaymentRetryUiState.Loading) return
            loadedToken = manageToken
            load(manageToken)
        }

        fun load(manageToken: String) {
            viewModelScope.launch {
                _state.value = PaymentRetryUiState.Loading
                val next = mapState(repo.publicGetManageBooking(manageToken))
                _state.value = next
                if (next is PaymentRetryUiState.Declined || next is PaymentRetryUiState.Timeout) {
                    startHold()
                }
            }
        }

        /** "Check again" after a timeout — idempotent re-read of the payment state. */
        fun recheck(manageToken: String) = load(manageToken)

        fun onCheckoutOutcome(
            outcome: CheckoutOutcome,
            manageToken: String,
        ) {
            when (outcome) {
                is CheckoutOutcome.Paid -> load(manageToken) // re-read; webhook reconciles
                is CheckoutOutcome.Canceled -> Unit // stay on the retry sheet
                is CheckoutOutcome.Declined -> {
                    val slotTime =
                        (_state.value as? PaymentRetryUiState.Declined)?.slotTime
                            ?: (_state.value as? PaymentRetryUiState.Timeout)?.slotTime
                    _state.value =
                        PaymentRetryUiState.Declined(
                            amountLabel = (_state.value as? PaymentRetryUiState.Declined)?.amountLabel.orEmpty(),
                            message = outcome.message ?: "Your card was declined. Nothing was charged.",
                            slotTime = slotTime,
                        )
                    startHold()
                }
            }
        }

        /**
         * Starts the hold countdown timer (mirrors iOS startHold). Resets the
         * remaining seconds to [HOLD_WINDOW_SECONDS] and ticks down every second.
         * Cancels any previous timer before starting.
         */
        private fun startHold() {
            holdJob?.cancel()
            _holdRemaining.value = HOLD_WINDOW_SECONDS
            holdJob =
                viewModelScope.launch {
                    while (_holdRemaining.value > 0) {
                        delay(HOLD_TICK_MS)
                        _holdRemaining.value = (_holdRemaining.value - 1).coerceAtLeast(0)
                    }
                }
        }

        private fun mapState(result: NetworkResult<ManageBookingResponse>): PaymentRetryUiState =
            when (result) {
                is NetworkResult.Success -> mapBooking(result.data)
                is NetworkResult.Failure -> PaymentRetryUiState.Error("Couldn't check your payment. Try again.")
            }

        private fun mapBooking(data: ManageBookingResponse): PaymentRetryUiState {
            val status = data.booking.status?.lowercase()
            if (status in TERMINAL_STATUSES) return PaymentRetryUiState.HoldExpired
            val payment = data.payment
            val amountLabel = MoneyAndFlag.formatPrice(payment?.amountTotal, payment?.currency)
            // Extract slot time for the hold chip ("2:00 PM") from the booking start.
            val slotTime = formatSlotTime(data.booking.startAt)
            return when (payment?.paymentStatus?.lowercase()) {
                "succeeded", "paid" -> PaymentRetryUiState.Succeeded(amountLabel, processing = false)
                "processing" -> PaymentRetryUiState.Succeeded(amountLabel, processing = true)
                "requires_action", null -> PaymentRetryUiState.Timeout(amountLabel, slotTime)
                else ->
                    PaymentRetryUiState.Declined(
                        amountLabel = amountLabel,
                        message = "Your card was declined. Nothing was charged.",
                        slotTime = slotTime,
                    )
            }
        }

        /**
         * Format a booking start instant (ISO) to a short time label for the hold
         * chip, e.g. "2:00 PM". Returns null when the value is missing or unparseable.
         */
        private fun formatSlotTime(startTime: String?): String? {
            if (startTime.isNullOrBlank()) return null
            return runCatching {
                val instant = java.time.OffsetDateTime.parse(startTime).toInstant()
                val zdt = instant.atZone(java.time.ZoneId.systemDefault())
                zdt.format(java.time.format.DateTimeFormatter.ofPattern("h:mm a", java.util.Locale.US))
            }.getOrNull()
        }

        /** Format [holdRemaining] seconds as "M:SS" for the chip label. */
        fun holdLabel(remainingSeconds: Int): String {
            val m = remainingSeconds / 60
            val s = remainingSeconds % 60
            return "$m:${s.toString().padStart(2, '0')}"
        }

        private companion object {
            val TERMINAL_STATUSES = setOf("cancelled", "canceled", "declined", "expired", "no_show")
            const val HOLD_WINDOW_SECONDS = 600 // 10-minute default hold window
            const val HOLD_TICK_MS = 1_000L
        }
    }
