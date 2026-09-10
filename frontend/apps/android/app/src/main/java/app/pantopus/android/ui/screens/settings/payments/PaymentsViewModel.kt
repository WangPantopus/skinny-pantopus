@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.payments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.payments.PaymentHistoryRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PendingCardSetupStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
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
        private val pendingSetups: PendingCardSetupStore,
    ) : ViewModel() {
        private companion object {
            /** Matches the server's default page size for `GET api/payments/history`. */
            const val HISTORY_PAGE_SIZE = 50
        }

        val title: String = "Payments"

        private val _state = MutableStateFlow<PaymentsUiState>(PaymentsUiState.Loading)
        val state: StateFlow<PaymentsUiState> = _state.asStateFlow()

        // Retain one-shot presentation across a brief collector gap, such as rotation.
        private val _events = Channel<PaymentsEvent>(Channel.BUFFERED)
        val events: Flow<PaymentsEvent> = _events.receiveAsFlow()

        /** Non-null → fixture mode (previews / snapshots / projection tests). */
        private var fixtureSeed: PaymentsSeed? = null

        /** Drives the pull-to-refresh indicator. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()
        private var methodMutationBusy = false
        private var methodsReadBusy = false
        private var methodsGeneration = 0L
        private var projectedAccountId: String? = null
        private val cardSetup =
            PaymentsCardSetup(
                repository = repository,
                pendingSetups = pendingSetups,
                scope = viewModelScope,
                events = _events,
                canStart = { fixtureSeed == null && !methodMutationBusy && !methodsReadBusy },
                onFreshMethods = { accountId, methods ->
                    projectedAccountId = accountId
                    val current = (_state.value as? PaymentsUiState.Loaded)?.content ?: PaymentsMapper.liveFrame(emptyList())
                    _state.value = PaymentsUiState.Loaded(current.copy(methods = methods.map(PaymentsMapper::toUiMethod)))
                },
                onSavedReceipt = { accountId, receipt ->
                    projectedAccountId = accountId
                    saveConfirmedMethod(PaymentsMapper.toUiMethod(receipt))
                },
            )
        val addCardPhase: StateFlow<AddCardPhase> = cardSetup.phase

        /** Override the active seed before [load] runs (fixture mode). */
        fun seed(seed: PaymentsSeed) {
            fixtureSeed = seed
        }

        fun load() {
            if (addCardPhase.value.isBusy || methodMutationBusy || methodsReadBusy) return
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
            methodsReadBusy = true
            methodsGeneration++
            viewModelScope.launch {
                try {
                    cardSetup.restorePendingSetup()
                    fetch(showLoading = true)
                } finally {
                    methodsReadBusy = false
                }
            }
        }

        /**
         * `showLoading == false` keeps the current frame visible while a
         * pull-to-refresh re-read runs, so the screen doesn't flash the
         * loading shell.
         */
        private suspend fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = PaymentsUiState.Loading
            val generation = methodsGeneration
            val accountId = pendingSetups.currentAccountId()
            // Supplementary reads degrade independently; their latency cannot let
            // an old methods response overwrite a later save or a different account.
            when (val result = repository.paymentMethods()) {
                is NetworkResult.Success -> {
                    val content =
                        PaymentsMapper.liveFrame(
                            methods = result.data.paymentMethods.map(PaymentsMapper::toUiMethod),
                            activity = fetchActivity(),
                            connectAccount = fetchConnectAccount(),
                            earnings = fetchEarnings(),
                        )
                    if (readScopeMatches(accountId, generation)) {
                        projectedAccountId = accountId
                        _state.value = PaymentsUiState.Loaded(content)
                    }
                }
                is NetworkResult.Failure -> {
                    if (readScopeMatches(accountId, generation)) {
                        _state.value = PaymentsUiState.Error(result.error.displayMessage("Couldn't load Payments."))
                    }
                }
            }
        }

        private suspend fun readScopeMatches(
            accountId: String?,
            generation: Long,
        ): Boolean = accountId != null && pendingSetups.currentAccountId() == accountId && methodsGeneration == generation

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
            if (addCardPhase.value.isBusy || methodMutationBusy || methodsReadBusy) return
            if (fixtureSeed != null) {
                load()
                return
            }
            _refreshing.value = true
            methodsReadBusy = true
            methodsGeneration++
            viewModelScope.launch {
                try {
                    fetch(showLoading = _state.value is PaymentsUiState.Error)
                } finally {
                    _refreshing.value = false
                    methodsReadBusy = false
                }
            }
        }

        // MARK: - Add a card (Stripe PaymentSheet, SetupIntent)

        fun tapAddMethod() {
            if (fixtureSeed != null) return
            if (addCardPhase.value.isBusy || methodMutationBusy || methodsReadBusy) return
            methodsGeneration++
            cardSetup.tapAddMethod()
        }

        fun onAddCardOutcome(outcome: AddCardOutcome) = cardSetup.onAddCardOutcome(outcome)

        suspend fun canPresentAddCardSheet(params: AddCardSheetParamsDto): Boolean = cardSetup.canPresentAddCardSheet(params)

        private fun saveConfirmedMethod(saved: PaymentMethod) {
            val current = (_state.value as? PaymentsUiState.Loaded)?.content ?: PaymentsMapper.liveFrame(emptyList())
            val updated = current.copy(methods = listOf(saved) + current.methods.filter { it.id != saved.id })
            _state.value = PaymentsUiState.Loaded(if (saved.chip == null) updated else updated.markingDefault(saved.id))
        }

        // MARK: - Set default / remove (optimistic, then reconcile)

        fun setDefault(id: String) = changeMethod(id, makeDefault = true)

        fun removeMethod(id: String) = changeMethod(id, makeDefault = false)

        private fun changeMethod(
            id: String,
            makeDefault: Boolean,
        ) {
            if (addCardPhase.value.isBusy || methodMutationBusy || methodsReadBusy) return
            val loaded = (_state.value as? PaymentsUiState.Loaded)?.content ?: return
            methodMutationBusy = true
            val generation = ++methodsGeneration
            viewModelScope.launch {
                try {
                    val accountId = pendingSetups.currentAccountId()
                    if (accountId == null || accountId != projectedAccountId) return@launch
                    _state.value = PaymentsUiState.Loaded(if (makeDefault) loaded.markingDefault(id) else loaded.removingMethod(id))
                    val result = if (makeDefault) repository.setDefault(id) else repository.removeMethod(id)
                    if (!readScopeMatches(accountId, generation)) return@launch
                    when (result) {
                        is NetworkResult.Success -> reloadMethods(accountId, generation)
                        is NetworkResult.Failure -> {
                            _state.value = PaymentsUiState.Loaded(loaded)
                            val message =
                                if (makeDefault) {
                                    "Couldn't update your default payment method."
                                } else {
                                    "Couldn't remove that payment method."
                                }
                            _events.send(PaymentsEvent.ShowMessage(message))
                        }
                    }
                } finally {
                    methodMutationBusy = false
                }
            }
        }

        /** Non-wallet rows can still be observed here; payout rows route from the screen into Wallet. */
        fun tapRow(
            @Suppress("UNUSED_PARAMETER") id: String,
        ) = Unit

        fun tapCloseAccount() = Unit

        private suspend fun reloadMethods(
            accountId: String,
            generation: Long,
        ) {
            val result = repository.paymentMethods()
            if (!readScopeMatches(accountId, generation)) return
            when (result) {
                is NetworkResult.Success -> {
                    val methods = result.data.paymentMethods.map(PaymentsMapper::toUiMethod)
                    val current = (_state.value as? PaymentsUiState.Loaded)?.content
                    _state.value =
                        PaymentsUiState.Loaded(current?.copy(methods = methods) ?: PaymentsMapper.liveFrame(methods))
                }
                is NetworkResult.Failure ->
                    _events.send(PaymentsEvent.ShowMessage(result.error.message))
            }
        }
    }
