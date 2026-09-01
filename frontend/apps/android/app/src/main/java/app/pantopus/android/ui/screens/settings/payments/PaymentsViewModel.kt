@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.payments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.payments.PaymentHistoryRepository
import app.pantopus.android.data.payments.PaymentsRepository
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
 * Which sample frame to load. Selecting a seed puts the view-model in
 * fixture mode (previews / snapshots) — `load()` projects the static
 * fixture and the repository / PaymentSheet are never touched. Live mode
 * (no seed) fetches from `/api/payments`.
 */
enum class PaymentsSeed {
    Populated,
    Empty,
}

/**
 * Projects the A14.6 Payments screen into render state. The Payment-methods
 * card is wired to the real backend (list saved methods, add a card via
 * Stripe PaymentSheet, set-default and remove — optimistic), and the Activity
 * card renders the real combined payment + payout history from
 * `GET api/payments/history`. The balance hero stays empty because Wallet
 * owns the earnings-in surface; Payouts route into Wallet where Stripe
 * Connect is live.
 */
@HiltViewModel
class PaymentsViewModel
    @Inject
    constructor(
        private val repository: PaymentsRepository,
        private val historyRepository: PaymentHistoryRepository,
        private val connectRepository: ConnectRepository,
    ) : ViewModel() {
        private companion object {
            /** Matches the server's default page size for `GET api/payments/history`. */
            const val HISTORY_PAGE_SIZE = 50
        }

        val title: String = "Payments"

        private val _state = MutableStateFlow<PaymentsUiState>(PaymentsUiState.Loading)
        val state: StateFlow<PaymentsUiState> = _state.asStateFlow()

        private val _events = MutableSharedFlow<PaymentsEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<PaymentsEvent> = _events.asSharedFlow()

        /** Non-null → fixture mode (previews / snapshots / projection tests). */
        private var fixtureSeed: PaymentsSeed? = null

        /** Drives the pull-to-refresh indicator. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** Override the active seed before [load] runs (fixture mode). */
        fun seed(seed: PaymentsSeed) {
            fixtureSeed = seed
        }

        fun load() {
            val seed = fixtureSeed
            if (seed != null) {
                _state.value =
                    PaymentsUiState.Loaded(
                        when (seed) {
                            PaymentsSeed.Populated -> PaymentsSampleData.populated
                            PaymentsSeed.Empty -> PaymentsSampleData.empty
                        },
                    )
                return
            }
            viewModelScope.launch { fetch(showLoading = true) }
        }

        /**
         * `showLoading == false` keeps the current frame visible while a
         * pull-to-refresh re-read runs, so the screen doesn't flash the
         * loading shell.
         */
        private suspend fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = PaymentsUiState.Loading
            // History, the lifetime totals and the Connect status are
            // supplementary — a failure in any of them degrades on its own
            // while the methods card still renders.
            when (val result = repository.paymentMethods()) {
                is NetworkResult.Success ->
                    _state.value =
                        PaymentsUiState.Loaded(
                            PaymentsMapper.liveFrame(
                                methods = result.data.paymentMethods.map(PaymentsMapper::toUiMethod),
                                activity = fetchActivity(),
                                connectAccount = fetchConnectAccount(),
                                earnings = fetchEarnings(),
                            ),
                        )
                is NetworkResult.Failure ->
                    _state.value = PaymentsUiState.Error(result.error.displayMessage("Couldn't load Payments."))
            }
        }

        /**
         * `GET api/payments/history` → the Activity card. History is
         * supplementary: a transport failure keeps the screen usable and says
         * so rather than claiming the user has no transactions.
         */
        private suspend fun fetchActivity(): PaymentsActivity =
            when (val result = historyRepository.history(limit = HISTORY_PAGE_SIZE, offset = 0)) {
                is NetworkResult.Success -> PaymentsMapper.activity(result.data.entries)
                is NetworkResult.Failure ->
                    PaymentsActivity.Empty(
                        title = "Couldn't load transactions",
                        body = "Pull down to refresh and try again.",
                    )
            }

        /**
         * `GET api/payments/connect/account` → the Payouts card. A 404 (the
         * seller has never connected) or any transport error degrades to null,
         * which renders the honest not-connected scaffold.
         */
        private suspend fun fetchConnectAccount(): ConnectAccountDto? =
            (connectRepository.accountStatus() as? NetworkResult.Success)?.data?.account

        /**
         * `GET api/payments/earnings` + `GET api/payments/spending` → the
         * "Earnings & Spending" card. The two reads degrade independently:
         * each figure falls back to an em-dash on its own, and when neither
         * could be read the card is hidden rather than claiming the user
         * earned and spent nothing.
         */
        private suspend fun fetchEarnings(): PaymentsEarnings? {
            val earned = (repository.earnings() as? NetworkResult.Success)?.data?.earnings
            val spent = (repository.spending() as? NetworkResult.Success)?.data?.spending
            return PaymentsMapper.earnings(earned = earned, spent = spent)
        }

        /**
         * Pull-to-refresh + the error frame's Retry. Keeps a loaded frame on
         * screen while re-reading (the pull indicator is the progress signal);
         * only an error frame falls back to the loading shell. Mirrors the
         * Wallet surface's `refresh()`.
         */
        fun refresh() {
            if (fixtureSeed != null) {
                load()
                return
            }
            _refreshing.value = true
            viewModelScope.launch {
                fetch(showLoading = _state.value is PaymentsUiState.Error)
                _refreshing.value = false
            }
        }

        // MARK: - Add a card (Stripe PaymentSheet, SetupIntent)

        fun tapAddMethod() {
            if (fixtureSeed != null) return
            viewModelScope.launch {
                when (val result = repository.addCardSheetParams()) {
                    is NetworkResult.Success -> _events.emit(PaymentsEvent.PresentAddCardSheet(result.data))
                    is NetworkResult.Failure -> _events.emit(PaymentsEvent.ShowMessage(result.error.message))
                }
            }
        }

        fun onAddCardOutcome(outcome: AddCardOutcome) {
            when (outcome) {
                AddCardOutcome.Completed ->
                    // The attached card is reconciled into the backend by the
                    // `payment_method.attached` webhook; re-read server state.
                    viewModelScope.launch { reloadMethods() }
                AddCardOutcome.Canceled -> Unit
                is AddCardOutcome.Failed ->
                    viewModelScope.launch {
                        _events.emit(PaymentsEvent.ShowMessage(outcome.message ?: "Couldn't add that card."))
                    }
            }
        }

        // MARK: - Set default / remove (optimistic, then reconcile)

        fun setDefault(id: String) {
            val loaded = (_state.value as? PaymentsUiState.Loaded)?.content ?: return
            _state.value = PaymentsUiState.Loaded(loaded.markingDefault(id))
            viewModelScope.launch {
                when (repository.setDefault(id)) {
                    is NetworkResult.Success -> reloadMethods()
                    is NetworkResult.Failure -> {
                        _state.value = PaymentsUiState.Loaded(loaded)
                        _events.emit(PaymentsEvent.ShowMessage("Couldn't update your default payment method."))
                    }
                }
            }
        }

        fun removeMethod(id: String) {
            val loaded = (_state.value as? PaymentsUiState.Loaded)?.content ?: return
            _state.value = PaymentsUiState.Loaded(loaded.removingMethod(id))
            viewModelScope.launch {
                when (repository.removeMethod(id)) {
                    is NetworkResult.Success -> reloadMethods()
                    is NetworkResult.Failure -> {
                        _state.value = PaymentsUiState.Loaded(loaded)
                        _events.emit(PaymentsEvent.ShowMessage("Couldn't remove that payment method."))
                    }
                }
            }
        }

        /** Non-wallet rows can still be observed here; payout rows route from the screen into Wallet. */
        fun tapRow(
            @Suppress("UNUSED_PARAMETER") id: String,
        ) = Unit

        fun tapCloseAccount() = Unit

        private suspend fun reloadMethods() {
            when (val result = repository.paymentMethods()) {
                is NetworkResult.Success -> {
                    val methods = result.data.paymentMethods.map(PaymentsMapper::toUiMethod)
                    val current = (_state.value as? PaymentsUiState.Loaded)?.content
                    _state.value =
                        PaymentsUiState.Loaded(current?.copy(methods = methods) ?: PaymentsMapper.liveFrame(methods))
                }
                is NetworkResult.Failure ->
                    _events.emit(PaymentsEvent.ShowMessage(result.error.message))
            }
        }
    }
