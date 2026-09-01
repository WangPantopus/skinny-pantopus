@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.wallet.scheduling

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.models.wallet.WalletTransactionDto
import app.pantopus.android.data.api.models.wallet.WalletWithdrawRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.connect.ConnectRepository
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.wallet.WalletRepository
import app.pantopus.android.ui.screens.wallet.ActivityDirection
import app.pantopus.android.ui.screens.wallet.WalletMapper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import javax.inject.Inject

/** The source axis for the earnings filter (distinct from the Wallet's category). */
enum class EarningsSource(val label: String) {
    All("All"),
    Gigs("Gigs"),
    Booking("Booking earnings"),
    Packages("Packages"),
}

/** One projected earnings row. */
data class EarningRow(
    val id: String,
    val day: String,
    val description: String,
    val time: String,
    /** Display amount without symbol, e.g. `"48.00"`. */
    val amount: String,
    val direction: ActivityDirection,
    val source: EarningsSource,
    val isPending: Boolean,
    val isFee: Boolean,
) {
    val statusLabel: String
        get() =
            when {
                isFee -> "Fee"
                direction == ActivityDirection.Out -> "Payout"
                isPending -> "Pending"
                else -> "Cleared"
            }
}

/**
 * G7 Payouts & Earnings (Stream A14) — the EXCLUSIVE Calendarly extension of the
 * Wallet. Reuses the live Wallet read endpoints (balance / transactions /
 * pending-release) + Stripe Connect status, then layers a booking-source filter
 * (All / Gigs / Booking earnings / Packages) and renders booking settlement
 * honestly as Pending (payout settlement is deferred server-side). Withdraw is
 * gated on Connect payouts. Behind [SchedulingFeatureFlags.paidSchedulingEnabled]
 * (Stripe TEST mode). Mirrors the iOS `PayoutsEarningsViewModel`.
 */
@HiltViewModel
class PayoutsEarningsViewModel
    @Inject
    constructor(
        private val wallet: WalletRepository,
        private val connect: ConnectRepository,
        private val flags: SchedulingFeatureFlags,
    ) : ViewModel() {
        /** Withdraw / payout enablement, derived from the Connect account. */
        enum class PayoutState { Enabled, OnHold, NotEnabled }

        private val _state = MutableStateFlow<PayoutsEarningsUiState>(PayoutsEarningsUiState.Loading)
        val state: StateFlow<PayoutsEarningsUiState> = _state.asStateFlow()

        private val _source = MutableStateFlow(EarningsSource.Booking)
        val source: StateFlow<EarningsSource> = _source.asStateFlow()

        private val _withdrawing = MutableStateFlow(false)
        val withdrawing: StateFlow<Boolean> = _withdrawing.asStateFlow()

        private val _connecting = MutableStateFlow(false)
        val connecting: StateFlow<Boolean> = _connecting.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _events = MutableSharedFlow<OpenStripeUrl>(extraBufferCapacity = 1)
        val events: SharedFlow<OpenStripeUrl> = _events.asSharedFlow()

        private var availableCents = 0L
        private var payoutState = PayoutState.NotEnabled

        fun load() {
            if (!flags.paidSchedulingEnabled) {
                _state.value = PayoutsEarningsUiState.NotEnabled
                return
            }
            _state.value = PayoutsEarningsUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() = load()

        fun setSource(source: EarningsSource) {
            _source.value = source
        }

        private suspend fun fetch() {
            val balanceDef = viewModelScope.async { wallet.balance() }
            val txDef = viewModelScope.async { wallet.transactions() }
            val pendingDef = viewModelScope.async { wallet.pendingRelease() }
            val connectDef = viewModelScope.async { connect.accountStatus() }

            val balanceResult = balanceDef.await()
            val balance =
                when (balanceResult) {
                    is NetworkResult.Success -> balanceResult.data
                    is NetworkResult.Failure -> {
                        _state.value = PayoutsEarningsUiState.Error(balanceResult.error.message)
                        return
                    }
                }
            val txResult = txDef.await()
            val transactions =
                when (txResult) {
                    is NetworkResult.Success -> txResult.data.transactions
                    is NetworkResult.Failure -> {
                        _state.value = PayoutsEarningsUiState.Error(txResult.error.message)
                        return
                    }
                }
            val pending = (pendingDef.await() as? NetworkResult.Success)?.data
            val account = (connectDef.await() as? NetworkResult.Success)?.data?.account

            val zone = ZoneId.systemDefault()
            val now = Instant.now()
            availableCents = balance.wallet.balance
            payoutState = payoutState(account)

            val pendingCents = pending?.totalPendingCents ?: 0L
            val pendingCount = (pending?.inReviewCount ?: 0) + (pending?.releasingSoonCount ?: 0)
            val monthRows = transactions.filter { isIncomeThisMonth(it, zone, now) }
            val monthCents = monthRows.sumOf { it.amount }

            _state.value =
                PayoutsEarningsUiState.Loaded(
                    EarningsModel(
                        availableDisplay = WalletMapper.centsToPlain(availableCents),
                        availableCents = availableCents,
                        pendingDisplay = WalletMapper.centsToCurrency(pendingCents),
                        pendingMeta = if (pendingCents == 0L) "Nothing pending" else "$pendingCount ${bookingWord(pendingCount)}",
                        monthDisplay = WalletMapper.centsToCurrency(monthCents),
                        monthMeta = "${monthRows.size} ${bookingWord(monthRows.size)} this month",
                        allRows = transactions.map { projectRow(it, zone, now) },
                        payoutState = payoutState,
                    ),
                )
        }

        fun withdraw() {
            if (_withdrawing.value) return
            if (payoutState != PayoutState.Enabled || availableCents < MIN_WITHDRAW_CENTS) {
                if (payoutState != PayoutState.Enabled) _toast.value = "Set up payouts before withdrawing."
                return
            }
            _withdrawing.value = true
            viewModelScope.launch {
                val result =
                    wallet.withdraw(
                        WalletWithdrawRequest(amount = availableCents, idempotencyKey = UUID.randomUUID().toString()),
                    )
                _withdrawing.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _toast.value = result.data.message ?: "Withdrawal initiated."
                        fetch()
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
            }
        }

        fun setupPayouts() {
            if (_connecting.value) return
            _connecting.value = true
            viewModelScope.launch {
                connect.createAccount()
                when (val link = connect.onboarding()) {
                    is NetworkResult.Success ->
                        _events.tryEmit(OpenStripeUrl(link.data.onboardingUrl, refreshOnReturn = true))
                    is NetworkResult.Failure -> _toast.value = link.error.message
                }
                _connecting.value = false
            }
        }

        fun openDashboard() {
            viewModelScope.launch {
                when (val link = connect.dashboard()) {
                    is NetworkResult.Success ->
                        _events.tryEmit(OpenStripeUrl(link.data.dashboardUrl, refreshOnReturn = false))
                    is NetworkResult.Failure -> _toast.value = link.error.message
                }
            }
        }

        fun onReturnFromConnect() {
            viewModelScope.launch { fetch() }
        }

        fun clearToast() {
            _toast.value = null
        }

        private fun isIncomeThisMonth(
            tx: WalletTransactionDto,
            zone: ZoneId,
            now: Instant,
        ): Boolean {
            if (direction(tx.type) != ActivityDirection.In) return false
            val instant = WalletMapper.parseInstant(tx.createdAt) ?: return false
            val date = instant.atZone(zone).toLocalDate()
            val nowDate = now.atZone(zone).toLocalDate()
            return date.year == nowDate.year && date.monthValue == nowDate.monthValue
        }

        companion object {
            private const val MIN_WITHDRAW_CENTS = 100L

            private fun bookingWord(count: Int): String = if (count == 1) "booking" else "bookings"

            internal fun payoutState(account: ConnectAccountDto?): PayoutState =
                when {
                    account?.stripeAccountId == null -> PayoutState.NotEnabled
                    account.payoutsEnabled -> PayoutState.Enabled
                    else -> PayoutState.OnHold
                }

            internal fun direction(type: String): ActivityDirection =
                when (type) {
                    "withdrawal", "gig_payment", "tip_sent", "transfer_out", "cancellation_fee" -> ActivityDirection.Out
                    else -> ActivityDirection.In
                }

            internal fun source(
                type: String,
                description: String?,
            ): EarningsSource {
                val hay = (type + " " + (description ?: "")).lowercase()
                return when {
                    hay.contains("package") || hay.contains("credit") -> EarningsSource.Packages
                    hay.contains("book") -> EarningsSource.Booking
                    else -> EarningsSource.Gigs
                }
            }

            internal fun fallbackDescription(type: String): String =
                when (type) {
                    "gig_income", "gig_payment" -> "Booking payment"
                    "tip_income" -> "Tip received"
                    "cancellation_fee" -> "Cancellation fee"
                    "refund" -> "Refund"
                    "withdrawal" -> "Withdrawal"
                    else -> "Earning"
                }

            internal fun projectRow(
                tx: WalletTransactionDto,
                zone: ZoneId = ZoneId.systemDefault(),
                now: Instant = Instant.now(),
            ): EarningRow {
                val instant = WalletMapper.parseInstant(tx.createdAt)
                return EarningRow(
                    id = tx.id,
                    day = WalletMapper.dayLabel(instant, zone, now),
                    description = tx.description ?: fallbackDescription(tx.type),
                    time = WalletMapper.timeLabel(instant, zone),
                    amount = WalletMapper.centsToPlain(tx.amount),
                    direction = direction(tx.type),
                    source = source(tx.type, tx.description),
                    isPending = tx.status == "pending",
                    isFee = tx.type == "cancellation_fee" || tx.type == "fee",
                )
            }
        }
    }

/** Render payload for the payouts/earnings screen. */
data class EarningsModel(
    val availableDisplay: String,
    val availableCents: Long,
    val pendingDisplay: String,
    val pendingMeta: String,
    val monthDisplay: String,
    val monthMeta: String,
    val allRows: List<EarningRow>,
    val payoutState: PayoutsEarningsViewModel.PayoutState,
)

/** Four-state machine for the payouts/earnings screen. */
sealed interface PayoutsEarningsUiState {
    data object Loading : PayoutsEarningsUiState

    /** Paid scheduling is off → "coming soon" surface. */
    data object NotEnabled : PayoutsEarningsUiState

    data class Loaded(val model: EarningsModel) : PayoutsEarningsUiState

    data class Error(val message: String) : PayoutsEarningsUiState
}
