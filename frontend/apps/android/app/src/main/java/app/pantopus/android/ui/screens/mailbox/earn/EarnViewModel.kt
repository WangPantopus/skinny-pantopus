@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.earn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.EarningEntryDto
import app.pantopus.android.data.api.models.wallet.WalletDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.wallet.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * A10.11 / Block 2A — backs the Earn dashboard. The live path fetches
 * `GET /api/wallet` + `GET /api/mailbox/earnings/history`. The hero's
 * "Available to cash out" is the wallet balance, the same figure Payments
 * shows and withdraws. Mail-offer and ad payouts (the history rows) are shown
 * apart from it and marked not cashable: nothing credits them to the wallet.
 * The weekly-goal ring, linked payout method, auto-cash-out, and 1099 tax
 * docs have no source, so they stay null and the screen hides them rather
 * than faking them. [setFixture] is the preview/test seam.
 *
 * Mirrors iOS `EarnViewModel`.
 */
@HiltViewModel
class EarnViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository,
        private val walletRepository: WalletRepository,
    ) : ViewModel() {
        private var fixture: EarnContent? = null
        private var hasFixture = false

        private val _state = MutableStateFlow<EarnUiState>(EarnUiState.Loading)
        val state: StateFlow<EarnUiState> = _state.asStateFlow()

        fun load() {
            if (hasFixture) {
                _state.value =
                    fixture?.let { EarnUiState.Populated(it) }
                        ?: EarnUiState.Empty(EarnSampleData.waysToEarn)
            } else {
                fetch()
            }
        }

        fun refresh() = load()

        /** Test/preview seam — null selects the empty new-earner frame. */
        fun setFixture(content: EarnContent?) {
            fixture = content
            hasFixture = true
        }

        private fun fetch() {
            _state.value = EarnUiState.Loading
            viewModelScope.launch {
                val history =
                    (repository.earningsHistory() as? NetworkResult.Success)?.data?.earnings ?: emptyList()
                when (val wallet = walletRepository.balance()) {
                    is NetworkResult.Success -> {
                        val rows = history.map(::earningFrom)
                        val dto = wallet.data.wallet
                        val hasWalletMoney = dto.balance > 0L || (dto.lifetimeReceived ?: 0L) > 0L
                        _state.value =
                            if (hasWalletMoney || rows.isNotEmpty()) {
                                EarnUiState.Populated(contentFrom(dto, history, rows))
                            } else {
                                EarnUiState.Empty(WAYS_TO_EARN)
                            }
                    }
                    is NetworkResult.Failure -> {
                        // Fixed copy mirrors iOS EarnViewModel for cross-platform
                        // parity (Block 2G) — not the raw repository message.
                        _state.value =
                            EarnUiState.Error(
                                "We couldn't load your earnings. Check your connection and try again.",
                            )
                    }
                }
            }
        }

        // MARK: - DTO → projection

        private fun contentFrom(
            wallet: WalletDto,
            history: List<EarningEntryDto>,
            rows: List<EarnEarning>,
        ): EarnContent {
            val offerSum = history.sumOf { it.payoutAmount ?: 0.0 }
            return EarnContent(
                available = money(wallet.balance / 100.0),
                thisWeek = "",
                thisWeekMeta = "",
                pending = "",
                pendingMeta = "",
                offerEarnings = if (rows.isEmpty()) null else "\$" + money(offerSum),
                // Deferred slots — no source yet (Stripe Connect = Phase 3).
                weeklyGoal = null,
                waysToEarn = WAYS_TO_EARN,
                earnings = rows,
                payoutMethod = null,
                autoCashOut = null,
                taxDocs = null,
            )
        }

        private fun earningFrom(dto: EarningEntryDto): EarnEarning {
            val instant = parseInstant(dto.viewedAt) ?: parseInstant(dto.createdAt)
            return EarnEarning(
                id = dto.id,
                day = dayLabel(instant),
                dateLabel = timeLabel(instant),
                description = dto.subject?.takeIf { it.isNotBlank() } ?: "Sponsored offer",
                counterparty = dto.senderBusinessName?.takeIf { it.isNotBlank() } ?: "Pantopus",
                // Ad-payout rows have no gig category — the row renders a
                // neutral tile rather than a faked cleaning/handyman glyph.
                category = null,
                // Nothing pays an ad payout out or credits it to the wallet.
                status = EarnStatus.Offer,
                amount = money(dto.payoutAmount ?: 0.0),
            )
        }

        // MARK: - Formatting helpers

        private fun money(value: Double): String = String.format(Locale.US, "%.2f", value)

        private fun dayLabel(instant: Instant?): String {
            instant ?: return ""
            val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
            val today = LocalDate.now()
            return when (date) {
                today -> "Today"
                today.minusDays(1) -> "Yesterday"
                else -> date.format(DAY_MONTH_FORMAT)
            }
        }

        private fun timeLabel(instant: Instant?): String {
            instant ?: return ""
            return instant.atZone(ZoneId.systemDefault()).format(TIME_FORMAT).lowercase(Locale.US)
        }

        private fun parseInstant(value: String?): Instant? {
            value ?: return null
            return runCatching { OffsetDateTime.parse(value).toInstant() }
                .recoverCatching { Instant.parse(value) }
                .recoverCatching { LocalDate.parse(value).atStartOfDay(ZoneId.systemDefault()).toInstant() }
                .getOrNull()
        }

        private companion object {
            private val TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            private val DAY_MONTH_FORMAT = DateTimeFormatter.ofPattern("MMM d", Locale.US)

            /**
             * Live `Ways to earn` rows. Only real facts: no sample counts or
             * amounts, and no Refer row until referrals exist.
             */
            private val WAYS_TO_EARN =
                listOf(
                    EarnWayToEarn(
                        kind = EarnWayKind.Browse,
                        title = "Browse open tasks",
                        meta = "Paid tasks near you",
                        accent = EarnAccent.Primary,
                        featured = true,
                    ),
                    EarnWayToEarn(
                        kind = EarnWayKind.Offer,
                        title = "Offer a service",
                        meta = "Get matched to repeat clients",
                        accent = EarnAccent.Business,
                    ),
                )
        }
    }
