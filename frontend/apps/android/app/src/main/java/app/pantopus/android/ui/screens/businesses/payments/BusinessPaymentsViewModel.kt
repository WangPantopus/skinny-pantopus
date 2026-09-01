@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.payments

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessFinanceRepository
import app.pantopus.android.data.network.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav arg key for the business id consumed via [SavedStateHandle]. */
const val BUSINESS_PAYMENTS_ID_KEY = "businessId"

/** The four Connect stages, derived exactly as RN `PaymentsTab` does. */
enum class BusinessPayoutStage {
    /** No `StripeAccount` row at all — "Connect with Stripe". */
    NotConnected,

    /** Account exists but `details_submitted == false` — "Continue setup". */
    SetupIncomplete,

    /** Details submitted, Stripe still verifying — waiting, no CTA. */
    Verifying,

    /** `charges_enabled && payouts_enabled` — dashboard reachable. */
    Onboarded,
}

/** Loaded payload for the Payments screen. */
data class BusinessPaymentsContent(
    val stage: BusinessPayoutStage,
    val chargesEnabled: Boolean,
    val payoutsEnabled: Boolean,
) {
    val headline: String
        get() =
            when (stage) {
                BusinessPayoutStage.NotConnected -> "No payout account connected"
                BusinessPayoutStage.SetupIncomplete -> "Account setup incomplete"
                BusinessPayoutStage.Verifying -> "Account verification in progress"
                BusinessPayoutStage.Onboarded -> "Stripe account connected"
            }

    val subcopy: String
        get() =
            when (stage) {
                BusinessPayoutStage.NotConnected -> "Connect Stripe to accept payments and receive payouts."
                BusinessPayoutStage.SetupIncomplete -> "Your account needs additional information."
                BusinessPayoutStage.Verifying -> "Stripe is verifying your identity. Usually 1–2 business days."
                BusinessPayoutStage.Onboarded -> "Payouts are enabled."
            }
}

/** Render state for the Payments screen. */
sealed interface BusinessPaymentsUiState {
    data object Loading : BusinessPaymentsUiState

    data class Loaded(val content: BusinessPaymentsContent) : BusinessPaymentsUiState

    data class Error(val message: String) : BusinessPaymentsUiState
}

/** Transient result of a Connect action. */
sealed interface BusinessPaymentsAction {
    data object Idle : BusinessPaymentsAction

    /** Opening a Stripe-hosted page. */
    data object Connecting : BusinessPaymentsAction

    data class Failed(val message: String) : BusinessPaymentsAction
}

/** One-shot "open this Stripe-hosted URL" signal for the screen. */
data class OpenStripeUrl(
    val url: String,
    /** Re-read Connect status when the user comes back. */
    val refreshOnReturn: Boolean,
)

/**
 * Owner-side Stripe Connect for a *business* — the twin of the personal
 * payout flow in `WalletViewModel`. Read the connected account, create it,
 * mint an Account Link to finish onboarding, and open the Express dashboard
 * once payouts are live. Stripe hosts every KYC / bank screen; we only open
 * URLs. Mirrors iOS `BusinessPaymentsViewModel`.
 */
@HiltViewModel
class BusinessPaymentsViewModel
    @Inject
    constructor(
        private val repository: BusinessFinanceRepository,
        networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String = savedStateHandle.get<String>(BUSINESS_PAYMENTS_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<BusinessPaymentsUiState>(BusinessPaymentsUiState.Loading)
        val state: StateFlow<BusinessPaymentsUiState> = _state.asStateFlow()

        private val _action = MutableStateFlow<BusinessPaymentsAction>(BusinessPaymentsAction.Idle)
        val action: StateFlow<BusinessPaymentsAction> = _action.asStateFlow()

        private val _events = MutableSharedFlow<OpenStripeUrl>(extraBufferCapacity = 4)
        val events: SharedFlow<OpenStripeUrl> = _events.asSharedFlow()

        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        fun load() {
            viewModelScope.launch {
                _state.value = BusinessPaymentsUiState.Loading
                fetch()
            }
        }

        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        /**
         * A 404 / 4xx from `GET /stripe/account` means "no account yet" — the
         * not-connected stage, not a screen failure. Only transport / 5xx
         * raise the error frame.
         */
        private suspend fun fetch() {
            when (val result = repository.stripeAccount(businessId)) {
                is NetworkResult.Success ->
                    _state.value = BusinessPaymentsUiState.Loaded(contentFrom(result.data.account))
                is NetworkResult.Failure ->
                    _state.value =
                        when (result.error) {
                            is NetworkError.NotFound, is NetworkError.ClientError ->
                                BusinessPaymentsUiState.Loaded(contentFrom(null))
                            else -> BusinessPaymentsUiState.Error(result.error.message)
                        }
            }
        }

        // ─── Actions ──────────────────────────────────────────────────

        /**
         * "Connect with Stripe" — create the connected account, then open the
         * Stripe-hosted Account Link. The connect route answers no link of its
         * own (`businesses.js:4447`), so we mint one via refresh-link, exactly
         * as the personal wallet flow does.
         */
        fun connect() {
            viewModelScope.launch {
                _action.value = BusinessPaymentsAction.Connecting
                val created = repository.connectStripe(businessId)
                // A 400 "account already exists" is fine — fall through to the
                // Account Link. Anything else is terminal.
                if (created is NetworkResult.Failure && created.error.code != 400) {
                    _action.value = BusinessPaymentsAction.Failed(created.error.message)
                    return@launch
                }
                openOnboardingLink()
            }
        }

        /** "Continue setup" — a fresh Account Link for an existing account. */
        fun continueSetup() {
            viewModelScope.launch {
                _action.value = BusinessPaymentsAction.Connecting
                openOnboardingLink()
            }
        }

        private suspend fun openOnboardingLink() {
            when (val link = repository.stripeRefreshLink(businessId)) {
                is NetworkResult.Success -> {
                    _action.value = BusinessPaymentsAction.Idle
                    _events.emit(OpenStripeUrl(link.data.accountLink, refreshOnReturn = true))
                }
                is NetworkResult.Failure ->
                    _action.value = BusinessPaymentsAction.Failed(link.error.message)
            }
        }

        /** "Open Stripe Dashboard" — Express login link; nothing to refresh. */
        fun openDashboard() {
            viewModelScope.launch {
                when (val link = repository.stripeDashboardLink(businessId)) {
                    is NetworkResult.Success ->
                        _events.emit(OpenStripeUrl(link.data.dashboardUrl, refreshOnReturn = false))
                    is NetworkResult.Failure ->
                        _action.value = BusinessPaymentsAction.Failed(link.error.message)
                }
            }
        }

        /** Re-read Connect status when the owner returns from hosted onboarding. */
        fun onReturnFromConnect() {
            refresh()
        }

        fun clearAction() {
            _action.value = BusinessPaymentsAction.Idle
        }

        companion object {
            /**
             * Onboarded = `charges_enabled && payouts_enabled`; an account
             * without `details_submitted` is still in setup; anything else with
             * an account row is verifying. Pure — the unit-test surface.
             */
            fun contentFrom(account: ConnectAccountDto?): BusinessPaymentsContent {
                if (account == null) {
                    return BusinessPaymentsContent(
                        stage = BusinessPayoutStage.NotConnected,
                        chargesEnabled = false,
                        payoutsEnabled = false,
                    )
                }
                val stage =
                    when {
                        account.chargesEnabled && account.payoutsEnabled -> BusinessPayoutStage.Onboarded
                        !account.detailsSubmitted -> BusinessPayoutStage.SetupIncomplete
                        else -> BusinessPayoutStage.Verifying
                    }
                return BusinessPaymentsContent(
                    stage = stage,
                    chargesEnabled = account.chargesEnabled,
                    payoutsEnabled = account.payoutsEnabled,
                )
            }
        }
    }
