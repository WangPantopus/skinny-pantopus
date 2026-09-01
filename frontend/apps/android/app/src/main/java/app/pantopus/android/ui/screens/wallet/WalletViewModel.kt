@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.wallet.WalletWithdrawRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.wallet.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * A10.10 / P1-F + Block 3C — backs the Wallet screen.
 *
 * P1-F hydrates the balance hero + Recent-activity feed from the READ
 * endpoints (`GET /api/wallet`, `/transactions`, `/pending-release`). Block 3C
 * adds the payout side: it reads Stripe Connect status (`GET /connect/account`)
 * to gate the Withdraw CTA, runs `POST /api/wallet/withdraw`, and drives the
 * Stripe-hosted onboarding / Express dashboard (opened by the screen). We never
 * mark anything paid client-side — the server is the source of truth and we
 * re-read on success. Previews / snapshots / tests seed deterministic
 * [WalletSampleData] through [setFixture], which bypasses the network.
 */
@HiltViewModel
class WalletViewModel
    @Inject
    constructor(
        private val repository: WalletRepository,
        private val connectRepository: ConnectRepository,
    ) : ViewModel() {
        private var fixture: WalletContent? = null

        private val _state = MutableStateFlow<WalletUiState>(WalletUiState.Loading)
        val state: StateFlow<WalletUiState> = _state.asStateFlow()

        private val _action = MutableStateFlow<WalletAction>(WalletAction.Idle)
        val action: StateFlow<WalletAction> = _action.asStateFlow()

        private val _events = MutableSharedFlow<WalletEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<WalletEvent> = _events.asSharedFlow()

        /** Cached from the last live fetch: full available balance (cents) +
         *  whether the connected account can receive payouts. */
        private var availableCents = 0L
        private var payoutsEnabled = false

        /** The server's `Wallet.frozen` flag from the last read. */
        private var walletFrozen = false

        /**
         * Inline validation error for the withdraw amount field. Distinct from
         * [action] so a bad amount keeps the sheet open (RN re-alerts and
         * leaves the form up) instead of dismissing it with a toast.
         */
        private val _withdrawError = MutableStateFlow<String?>(null)
        val withdrawError: StateFlow<String?> = _withdrawError.asStateFlow()

        /** Drives the pull-to-refresh indicator. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        fun load() = loadInternal(showLoading = true)

        /**
         * Pull-to-refresh + the error frame's Retry. Keeps a loaded frame on
         * screen while re-reading (the pull indicator is the progress signal);
         * only an error frame falls back to the loading shell. Mirrors RN's
         * `RefreshControl` on the wallet route (`app/wallet.tsx:50`).
         */
        fun refresh() {
            if (fixture != null) {
                load()
                return
            }
            _refreshing.value = true
            viewModelScope.launch {
                fetch(showLoading = _state.value is WalletUiState.Error)
                _refreshing.value = false
            }
        }

        /** Test/preview seam — swap the stub fixture before calling [load]. */
        fun setFixture(content: WalletContent) {
            this.fixture = content
        }

        private fun loadInternal(showLoading: Boolean) {
            val seed = fixture
            if (seed != null) {
                _state.value = if (seed.isOnHold) WalletUiState.Hold(seed) else WalletUiState.Populated(seed)
                return
            }
            viewModelScope.launch { fetch(showLoading) }
        }

        private suspend fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = WalletUiState.Loading
            when (val balance = repository.balance()) {
                is NetworkResult.Success -> {
                    // Transactions + pending-release + Connect status are
                    // supplementary — their failure degrades gracefully
                    // rather than sinking the screen.
                    val transactions =
                        (repository.transactions() as? NetworkResult.Success)?.data?.transactions ?: emptyList()
                    val pending = (repository.pendingRelease() as? NetworkResult.Success)?.data
                    val connectAccount =
                        (connectRepository.accountStatus() as? NetworkResult.Success)?.data?.account
                    val enabled = connectAccount?.payoutsEnabled ?: false
                    availableCents = balance.data.wallet.balance
                    payoutsEnabled = enabled
                    walletFrozen = balance.data.wallet.frozen
                    _state.value =
                        WalletUiState.Populated(
                            WalletMapper.build(
                                balance = balance.data,
                                transactions = transactions,
                                pending = pending,
                                payoutsEnabled = enabled,
                                connectAccount = connectAccount,
                            ),
                        )
                }
                is NetworkResult.Failure -> {
                    _state.value = WalletUiState.Error(balance.error.message)
                }
            }
        }

        // MARK: - Payout actions (Block 3C)

        /**
         * Withdraw to the seller's bank. [amountText] is the raw decimal-pad
         * string from the sheet — RN validates it against the available
         * balance and posts *that* amount
         * (`components/payments/WalletTab.tsx:65`). Passing `null` keeps the
         * original "whole balance" behaviour.
         */
        fun withdraw(amountText: String? = null) {
            if (fixture != null) return
            _withdrawError.value = null
            if (!payoutsEnabled || walletFrozen || availableCents < MIN_WITHDRAW_CENTS) {
                _action.value =
                    WalletAction.WithdrawFailed(withdrawGateMessage(payoutsEnabled, walletFrozen))
                return
            }
            val amountCents =
                if (amountText == null) {
                    availableCents
                } else {
                    when (val parsed = parseWithdrawAmount(amountText, availableCents)) {
                        is WithdrawAmount.Valid -> parsed.cents
                        is WithdrawAmount.Invalid -> {
                            _withdrawError.value = parsed.message
                            return
                        }
                    }
                }
            _action.value = WalletAction.Withdrawing
            viewModelScope.launch {
                val request = WalletWithdrawRequest(amount = amountCents, idempotencyKey = UUID.randomUUID().toString())
                when (val result = repository.withdraw(request)) {
                    is NetworkResult.Success -> {
                        _action.value = WalletAction.WithdrawSucceeded(result.data.message ?: "Withdrawal initiated.")
                        loadInternal(showLoading = false)
                    }
                    is NetworkResult.Failure -> {
                        _action.value = WalletAction.WithdrawFailed(result.error.message)
                    }
                }
            }
        }

        /** Drop the inline amount error once the user edits the field. */
        fun clearWithdrawError() {
            _withdrawError.value = null
        }

        /** "Set up payouts" / "Re-verify" — ensure a connected account, then ask
         *  the screen to open the Stripe-hosted Account Link. */
        fun setupPayouts() {
            if (fixture != null) return
            _action.value = WalletAction.Connecting
            viewModelScope.launch {
                // Ensure the account exists; a 400 "already exists" is fine.
                connectRepository.createAccount()
                when (val link = connectRepository.onboarding()) {
                    is NetworkResult.Success -> {
                        _action.value = WalletAction.Idle
                        _events.emit(WalletEvent.OpenUrl(link.data.onboardingUrl, refreshOnReturn = true))
                    }
                    is NetworkResult.Failure -> {
                        _action.value = WalletAction.ActionFailed(link.error.message)
                    }
                }
            }
        }

        /** Open the Stripe Express dashboard for an onboarded seller. */
        fun openDashboard() {
            if (fixture != null) return
            viewModelScope.launch {
                when (val link = connectRepository.dashboard()) {
                    is NetworkResult.Success ->
                        _events.emit(WalletEvent.OpenUrl(link.data.dashboardUrl, refreshOnReturn = false))
                    is NetworkResult.Failure ->
                        _action.value = WalletAction.ActionFailed(link.error.message)
                }
            }
        }

        /** Re-read Connect status when the seller returns from hosted onboarding. */
        fun onReturnFromConnect() {
            if (fixture != null) return
            loadInternal(showLoading = false)
        }

        /** Clear the action toast once the screen has shown it. */
        fun clearAction() {
            _action.value = WalletAction.Idle
        }

        /** Outcome of parsing the withdraw amount field. */
        sealed interface WithdrawAmount {
            data class Valid(val cents: Long) : WithdrawAmount

            data class Invalid(val message: String) : WithdrawAmount
        }

        companion object {
            /** The server's floor — `backend/services/walletService.js:92`. */
            const val MIN_WITHDRAW_CENTS = 100L

            private const val CENTS_PER_DOLLAR = 100.0

            /**
             * Parse the decimal-pad string into integer cents, mirroring RN's
             * three guards: a positive number, at or under the available
             * balance, and the server's $1.00 floor. Pure — the unit-test
             * surface, and the mirror of iOS `parseWithdrawAmount`.
             */
            fun parseWithdrawAmount(
                raw: String,
                availableCents: Long,
            ): WithdrawAmount {
                val cleaned = raw.replace("$", "").replace(",", "").trim()
                val dollars = cleaned.toDoubleOrNull()
                if (dollars == null || dollars <= 0.0) {
                    return WithdrawAmount.Invalid("Please enter a valid amount to withdraw.")
                }
                val cents = Math.round(dollars * CENTS_PER_DOLLAR)
                if (cents < MIN_WITHDRAW_CENTS) {
                    return WithdrawAmount.Invalid("The minimum withdrawal is \$1.00.")
                }
                if (cents > availableCents) {
                    return WithdrawAmount.Invalid(
                        "Your available balance is ${WalletMapper.centsToCurrency(availableCents)}.",
                    )
                }
                return WithdrawAmount.Valid(cents)
            }

            /**
             * Why the withdraw gate refused, in RN's order: frozen wallets are
             * a support matter, a missing payout account is self-serve, and an
             * empty balance is simply nothing to move.
             */
            fun withdrawGateMessage(
                payoutsEnabled: Boolean,
                frozen: Boolean,
            ): String =
                when {
                    frozen -> "Your wallet is frozen. Please contact support."
                    !payoutsEnabled -> "Set up payouts before withdrawing."
                    else -> "No funds to withdraw."
                }
        }
    }
