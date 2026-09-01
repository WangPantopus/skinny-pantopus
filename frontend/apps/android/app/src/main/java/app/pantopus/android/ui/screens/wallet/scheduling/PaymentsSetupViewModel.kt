@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.wallet.scheduling

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.PaymentStatusResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * G6 Payments Setup · Stripe Connect & Tax (Stream A14). Loads the owner's
 * Stripe Connect status from `GET /payments/status` and projects it into the
 * designed frames (not-connected / incomplete / ready / restricted / returned).
 * Connect / resume / finish open the Stripe-hosted Account Link via the existing
 * [ConnectRepository] plumbing (Custom Tabs); on return we re-read status.
 *
 * Honest backend mapping: `/payments/status` exposes only
 * `{ applicable, connected, charges_enabled, payouts_enabled }` — enough for the
 * hero + three readiness pills. Account/tax detail lives in Stripe, so those rows
 * open the Express dashboard rather than fabricating values. Homes are
 * `applicable:false`. Behind [SchedulingFeatureFlags.paidSchedulingEnabled]
 * (Stripe TEST mode). Owner is the Business pillar. Mirrors the iOS
 * `PaymentsSetupViewModel`.
 */
@HiltViewModel
class PaymentsSetupViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val connect: ConnectRepository,
        private val flags: SchedulingFeatureFlags,
        auth: AuthRepository,
    ) : ViewModel() {
        /** The five designed connection frames, derived from the status booleans. */
        enum class Setup { NotConnected, Incomplete, Restricted, Ready }

        /** A readiness pill's state (Charges / Payouts / Details). */
        enum class PillState { On, Off, Warn }

        private val owner: SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)
                ?.user
                ?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private val _state = MutableStateFlow<PaymentsSetupUiState>(PaymentsSetupUiState.Loading)
        val state: StateFlow<PaymentsSetupUiState> = _state.asStateFlow()

        private val _connecting = MutableStateFlow(false)
        val connecting: StateFlow<Boolean> = _connecting.asStateFlow()

        private val _actionMessage = MutableStateFlow<String?>(null)
        val actionMessage: StateFlow<String?> = _actionMessage.asStateFlow()

        private val _events = MutableSharedFlow<OpenStripeUrl>(extraBufferCapacity = 1)
        val events: SharedFlow<OpenStripeUrl> = _events.asSharedFlow()

        private var status: PaymentStatusResponse? = null
        private var justReturned = false

        fun load() {
            if (!flags.paidSchedulingEnabled) {
                _state.value = PaymentsSetupUiState.NotEnabled
                return
            }
            // Homes never take payments directly.
            if (owner is SchedulingOwner.Home) {
                _state.value = PaymentsSetupUiState.NotApplicable
                return
            }
            _state.value = PaymentsSetupUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() = load()

        private suspend fun fetch() {
            when (val r = repo.getPaymentsStatus(owner)) {
                is NetworkResult.Success -> {
                    status = r.data
                    if (!r.data.applicable) {
                        _state.value = PaymentsSetupUiState.NotApplicable
                    } else {
                        emitLoaded()
                    }
                }
                is NetworkResult.Failure ->
                    _state.value = PaymentsSetupUiState.Error(r.error.message)
            }
        }

        /** Ensure a connected account exists, then open the Account Link. */
        fun beginConnect() {
            if (_connecting.value) return
            _connecting.value = true
            viewModelScope.launch {
                connect.createAccount() // a 400 "already exists" is fine
                when (val link = connect.onboarding()) {
                    is NetworkResult.Success ->
                        _events.tryEmit(OpenStripeUrl(link.data.onboardingUrl, refreshOnReturn = true))
                    is NetworkResult.Failure ->
                        _actionMessage.value = link.error.message
                }
                _connecting.value = false
            }
        }

        /** Open the Stripe Express dashboard (bank, descriptor, tax, payouts). */
        fun openDashboard() {
            viewModelScope.launch {
                when (val link = connect.dashboard()) {
                    is NetworkResult.Success ->
                        _events.tryEmit(OpenStripeUrl(link.data.dashboardUrl, refreshOnReturn = false))
                    is NetworkResult.Failure ->
                        _actionMessage.value = link.error.message
                }
            }
        }

        /** Re-read status after returning from the Stripe-hosted flow. */
        fun onReturnFromConnect() {
            viewModelScope.launch {
                fetch()
                if (_state.value is PaymentsSetupUiState.Loaded) {
                    justReturned = setupOf(status) == Setup.Ready
                    emitLoaded()
                }
            }
        }

        fun dismissReturnedBanner() {
            justReturned = false
            emitLoaded()
        }

        fun clearActionMessage() {
            _actionMessage.value = null
        }

        private fun emitLoaded() {
            val s = status
            if (s != null && !s.applicable) {
                _state.value = PaymentsSetupUiState.NotApplicable
                return
            }
            _state.value =
                PaymentsSetupUiState.Loaded(
                    PaymentsModel(
                        setup = setupOf(s),
                        chargesPill = chargesPill(s),
                        payoutsPill = payoutsPill(s),
                        detailsPill = detailsPill(s),
                        isConnected = s?.connected == true,
                        justReturned = justReturned,
                    ),
                )
        }

        companion object {
            internal fun setupOf(status: PaymentStatusResponse?): Setup {
                if (status == null || !status.connected) return Setup.NotConnected
                val charges = status.chargesEnabled == true
                val payouts = status.payoutsEnabled == true
                return when {
                    charges && payouts -> Setup.Ready
                    charges -> Setup.Restricted
                    else -> Setup.Incomplete
                }
            }

            internal fun chargesPill(status: PaymentStatusResponse?): PillState =
                when {
                    status?.chargesEnabled == true -> PillState.On
                    status?.connected == true -> PillState.Warn
                    else -> PillState.Off
                }

            internal fun payoutsPill(status: PaymentStatusResponse?): PillState =
                when {
                    status?.payoutsEnabled == true -> PillState.On
                    status?.chargesEnabled == true -> PillState.Warn
                    else -> PillState.Off
                }

            internal fun detailsPill(status: PaymentStatusResponse?): PillState =
                when {
                    setupOf(status) == Setup.Ready -> PillState.On
                    status?.connected == true -> PillState.Warn
                    else -> PillState.Off
                }
        }
    }

/** Render payload for the payments-setup hero + rows. */
data class PaymentsModel(
    val setup: PaymentsSetupViewModel.Setup,
    val chargesPill: PaymentsSetupViewModel.PillState,
    val payoutsPill: PaymentsSetupViewModel.PillState,
    val detailsPill: PaymentsSetupViewModel.PillState,
    val isConnected: Boolean,
    val justReturned: Boolean,
)

/** Five-state machine for the payments-setup screen. */
sealed interface PaymentsSetupUiState {
    data object Loading : PaymentsSetupUiState

    /** Paid scheduling is off → "coming soon" surface. */
    data object NotEnabled : PaymentsSetupUiState

    /** Homes don't take payments directly (`applicable:false`). */
    data object NotApplicable : PaymentsSetupUiState

    data class Loaded(val model: PaymentsModel) : PaymentsSetupUiState

    data class Error(val message: String) : PaymentsSetupUiState
}
