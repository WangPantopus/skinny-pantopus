@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.earn.offers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.earn.EarnOfferDto
import app.pantopus.android.data.api.models.mailbox.v2.EarnBalanceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.earn.EarnOffersRepository
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.ceil
import kotlin.math.roundToInt

/**
 * Backs the Earn drawer's paid-offer wall (the `Offers` tab of A10.11).
 *
 * The wall is the money-IN engine RN ships at `src/app/mailbox/earn.tsx`:
 * list active offers, open an envelope, dwell on it for the server's 15s
 * minimum, then close to bank the reward, plus save / reveal-code side
 * actions.
 *
 * Two rules this implementation holds to:
 * * **The dwell is real.** `open` starts a wall-clock timer; only when it
 *   passes 15s does `close` fire with the measured `dwellMs`, and the card
 *   flips to earned **only** if the server answers `consumed = true`.
 * * **The balance is the server's.** Every state-changing call is followed
 *   by a fresh `GET /earn/balance` read — the client never increments a
 *   local total.
 *
 * Mirrors iOS `EarnOffersViewModel`.
 */
@HiltViewModel
class EarnOffersViewModel
    @Inject
    constructor(
        private val repository: EarnOffersRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<EarnOffersUiState>(EarnOffersUiState.Loading)
        val state: StateFlow<EarnOffersUiState> = _state.asStateFlow()

        /**
         * First-class daily-cap state — set when `POST /earn/open` answers
         * 429. Rendered as a banner, never as a generic error.
         */
        private val _capNotice = MutableStateFlow<EarnCapNotice?>(null)
        val capNotice: StateFlow<EarnCapNotice?> = _capNotice.asStateFlow()

        /** Set by [reveal]; the screen presents it as a dialog. */
        private val _revealedCode = MutableStateFlow<EarnRevealedCode?>(null)
        val revealedCode: StateFlow<EarnRevealedCode?> = _revealedCode.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        /** Offers with an in-flight write, so their controls can disable. */
        private val _busyOfferIds = MutableStateFlow<Set<String>>(emptySet())
        val busyOfferIds: StateFlow<Set<String>> = _busyOfferIds.asStateFlow()

        private val dwellJobs = mutableMapOf<String, Job>()

        // MARK: - Loading

        /**
         * First-appearance load. Tab switches re-enter the composable but
         * must not re-fetch — a running dwell timer would lose its card.
         */
        fun loadIfNeeded() {
            if (_state.value is EarnOffersUiState.Loading) load()
        }

        fun load() {
            _state.value = EarnOffersUiState.Loading
            fetch()
        }

        fun refresh() = fetch()

        private fun fetch() {
            viewModelScope.launch {
                val offersDeferred = async { repository.offers() }
                val balanceDeferred = async { repository.balance() }
                val offersResult = offersDeferred.await()
                // Mirrors RN's `Promise.allSettled` — a balance blip must
                // not hide a perfectly good offer wall.
                val balance =
                    (balanceDeferred.await() as? NetworkResult.Success)?.data?.balance
                val display = balance?.let(::displayBalance) ?: EarnOffersBalance.Zero

                _state.value =
                    when (offersResult) {
                        is NetworkResult.Success -> {
                            val items = offersResult.data.offers.map(::itemFrom)
                            if (items.isEmpty()) {
                                EarnOffersUiState.Empty(display)
                            } else {
                                EarnOffersUiState.Loaded(display, items)
                            }
                        }

                        is NetworkResult.Failure ->
                            EarnOffersUiState.Error(
                                "We couldn't load offers. Check your connection and try again.",
                            )
                    }
            }
        }

        // MARK: - Open then dwell then bank

        /**
         * `POST /earn/open`. Starts the dwell window on success; surfaces
         * the daily cap as [capNotice] rather than a generic error.
         */
        fun open(offerId: String) {
            val current = _state.value as? EarnOffersUiState.Loaded ?: return
            val offer = current.offers.firstOrNull { it.id == offerId } ?: return
            if (offer.engagement !is EarnOfferEngagement.Unopened) return
            if (offerId in _busyOfferIds.value) return

            viewModelScope.launch {
                markBusy(offerId, busy = true)
                when (val result = repository.openOffer(offerId)) {
                    is NetworkResult.Success -> {
                        _capNotice.value = null
                        if (result.data.alreadyOpened) {
                            // A transaction already existed — no new window.
                            updateEngagement(offerId, EarnOfferEngagement.Pending)
                            refreshBalance()
                        } else {
                            updateEngagement(offerId, EarnOfferEngagement.Dwelling(EarnOfferDwell.SECONDS))
                            refreshBalance()
                            startDwell(offerId)
                        }
                    }

                    is NetworkResult.Failure -> {
                        if (result.error.code == HTTP_TOO_MANY_REQUESTS) {
                            _capNotice.value = EarnCapNotice()
                        } else {
                            showToast(result.error.message, ToastKind.Error)
                        }
                    }
                }
                markBusy(offerId, busy = false)
            }
        }

        /**
         * Cancels every running dwell timer — mirrors RN's `clearInterval`
         * cleanup on unmount and iOS `cancelDwellTimers()`.
         */
        fun cancelDwellTimers() {
            dwellJobs.values.forEach { it.cancel() }
            dwellJobs.clear()
        }

        override fun onCleared() {
            cancelDwellTimers()
            super.onCleared()
        }

        private fun startDwell(offerId: String) {
            dwellJobs[offerId]?.cancel()
            dwellJobs[offerId] =
                viewModelScope.launch {
                    val started = System.currentTimeMillis()
                    while (isActive) {
                        val elapsed = System.currentTimeMillis() - started
                        val remaining = ceil((EarnOfferDwell.MILLIS - elapsed) / MILLIS_PER_SECOND).toInt().coerceAtLeast(0)
                        updateEngagement(offerId, EarnOfferEngagement.Dwelling(remaining))
                        if (elapsed >= EarnOfferDwell.MILLIS) break
                        delay(TICK_MS)
                    }
                    if (!isActive) return@launch
                    bank(offerId, System.currentTimeMillis() - started)
                }
        }

        /**
         * `POST /earn/close/:offerId`. The card only claims the payout when
         * the server answers `consumed = true`.
         */
        private suspend fun bank(
            offerId: String,
            dwellMs: Long,
        ) {
            dwellJobs.remove(offerId)
            when (val result = repository.closeOffer(offerId, dwellMs)) {
                is NetworkResult.Success ->
                    if (result.data.consumed) {
                        updateEngagement(offerId, EarnOfferEngagement.Earned)
                        refreshBalance()
                    } else {
                        updateEngagement(
                            offerId,
                            engagementForStatus(result.data.status) ?: EarnOfferEngagement.Pending,
                        )
                    }

                // Reward stays un-banked — never fake an earn the server
                // hasn't accepted.
                is NetworkResult.Failure -> updateEngagement(offerId, EarnOfferEngagement.Pending)
            }
        }

        // MARK: - Save / reveal

        /** `POST /earn/save/:offerId` — RN confirms with "Offer saved". */
        fun save(offerId: String) {
            if (offerId in _busyOfferIds.value) return
            viewModelScope.launch {
                markBusy(offerId, busy = true)
                when (repository.saveOffer(offerId)) {
                    is NetworkResult.Success -> showToast("Offer saved", ToastKind.Success)
                    is NetworkResult.Failure -> showToast("We couldn't save that offer.", ToastKind.Error)
                }
                markBusy(offerId, busy = false)
            }
        }

        /** `POST /earn/reveal/:offerId` — pops the promo code in a dialog. */
        fun reveal(offerId: String) {
            val current = _state.value as? EarnOffersUiState.Loaded ?: return
            val offer = current.offers.firstOrNull { it.id == offerId } ?: return
            if (offerId in _busyOfferIds.value) return

            viewModelScope.launch {
                markBusy(offerId, busy = true)
                when (val result = repository.revealOffer(offerId)) {
                    is NetworkResult.Success ->
                        _revealedCode.value =
                            EarnRevealedCode(
                                id = offerId,
                                businessName = offer.businessName,
                                code = result.data.code?.trim()?.takeIf { it.isNotEmpty() },
                            )

                    is NetworkResult.Failure -> showToast("We couldn't reveal that code.", ToastKind.Error)
                }
                markBusy(offerId, busy = false)
            }
        }

        // MARK: - Dismissals

        fun dismissCapNotice() {
            _capNotice.value = null
        }

        fun dismissRevealedCode() {
            _revealedCode.value = null
        }

        fun dismissToast() {
            _toast.value = null
        }

        // MARK: - Mutation helpers

        private fun markBusy(
            offerId: String,
            busy: Boolean,
        ) {
            _busyOfferIds.value =
                if (busy) _busyOfferIds.value + offerId else _busyOfferIds.value - offerId
        }

        private fun updateEngagement(
            offerId: String,
            engagement: EarnOfferEngagement,
        ) {
            val current = _state.value as? EarnOffersUiState.Loaded ?: return
            if (current.offers.none { it.id == offerId }) return
            _state.value =
                current.copy(
                    offers =
                        current.offers.map { offer ->
                            if (offer.id == offerId) offer.copy(engagement = engagement) else offer
                        },
                )
        }

        /** Re-reads the server's balance and swaps it into the current state. */
        private suspend fun refreshBalance() {
            val result = repository.balance()
            val balance = (result as? NetworkResult.Success)?.data?.balance ?: return
            val display = displayBalance(balance)
            _state.value =
                when (val current = _state.value) {
                    is EarnOffersUiState.Loaded -> current.copy(balance = display)
                    is EarnOffersUiState.Empty -> current.copy(balance = display)
                    else -> current
                }
        }

        private fun showToast(
            text: String,
            kind: ToastKind,
        ) {
            _toast.value = ToastMessage(text = text, kind = kind)
        }

        // MARK: - DTO to projection

        private fun displayBalance(dto: EarnBalanceDto): EarnOffersBalance =
            EarnOffersBalance(
                total = money(dto.total),
                available = money(dto.available),
                pending = money(dto.pending),
                hasPending = dto.pending > 0.0,
            )

        private fun itemFrom(dto: EarnOfferDto): EarnOfferItem {
            val name = dto.businessName?.trim()?.takeIf { it.isNotEmpty() } ?: "Local business"
            return EarnOfferItem(
                id = dto.id,
                businessName = name,
                initials = initials(explicit = dto.businessInit, name = name),
                title = dto.offerTitle?.trim()?.takeIf { it.isNotEmpty() } ?: "Sponsored offer",
                subtitle = dto.offerSubtitle?.trim()?.takeIf { it.isNotEmpty() },
                expiryLabel = expiryLabel(dto.expiresAt),
                payoutLabel = payoutLabel(dto.payoutAmount.toDouble()),
                engagement = engagementFrom(dto),
            )
        }

        private fun engagementFrom(dto: EarnOfferDto): EarnOfferEngagement {
            if (!dto.opened && dto.transaction == null) return EarnOfferEngagement.Unopened
            return engagementForStatus(dto.transaction?.status) ?: EarnOfferEngagement.Pending
        }

        private fun engagementForStatus(status: String?): EarnOfferEngagement? =
            when (status?.lowercase(Locale.US)) {
                "verified", "available", "paid" -> EarnOfferEngagement.Earned
                "flagged" -> EarnOfferEngagement.Held
                "pending" -> EarnOfferEngagement.Pending
                else -> null
            }

        // MARK: - Formatting

        private fun money(value: Double): String = String.format(Locale.US, "%.2f", value)

        /**
         * `"25¢"` under a dollar, `"$1.50"` at or above — RN renders cents
         * for the sub-dollar payouts every seeded offer uses.
         */
        private fun payoutLabel(amount: Double): String =
            when {
                amount <= 0.0 -> ""
                amount < 1.0 -> "${(amount * CENTS_PER_DOLLAR).roundToInt()}¢"
                else -> "$" + money(amount)
            }

        private fun expiryLabel(isoDate: String?): String {
            val instant = parseInstant(isoDate) ?: return "Limited time"
            return "Offer expires " + MONTH_DAY.format(instant.atZone(ZoneId.systemDefault()))
        }

        private fun parseInstant(value: String?): Instant? {
            if (value.isNullOrBlank()) return null
            return runCatching { Instant.parse(value) }
                .recoverCatching {
                    java.time.OffsetDateTime
                        .parse(value)
                        .toInstant()
                }.getOrNull()
        }

        private fun initials(
            explicit: String?,
            name: String,
        ): String {
            val trimmed = explicit?.trim()?.takeIf { it.isNotEmpty() }
            if (trimmed != null) return trimmed.take(2).uppercase(Locale.US)
            return name
                .split(" ")
                .filter { it.isNotBlank() }
                .take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase(Locale.US)
        }

        companion object {
            private const val TICK_MS = 1_000L
            private const val MILLIS_PER_SECOND = 1_000.0
            private const val CENTS_PER_DOLLAR = 100.0
            private const val HTTP_TOO_MANY_REQUESTS = 429
            private val MONTH_DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
        }
    }
