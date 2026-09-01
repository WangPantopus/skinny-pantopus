@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.earn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.EarningEntryDto
import app.pantopus.android.data.api.models.mailbox.EarningsSummaryResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
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
import java.time.temporal.WeekFields
import java.util.Locale
import javax.inject.Inject

/**
 * A10.11 / Block 2A — backs the Earn dashboard. The live path fetches
 * `GET /api/mailbox/earnings/summary` + `/earnings/history` and projects
 * the earnings DISPLAY: the available/pending balance hero and the recent
 * earnings list. The weekly-goal ring, linked payout method, auto-cash-out,
 * and 1099 tax docs have no source on those endpoints (the last three are
 * Stripe Connect — Phase 3), so they stay null and the screen hides them
 * rather than faking them. [setFixture] is the preview/test seam.
 *
 * Mirrors iOS `EarnViewModel`.
 */
@HiltViewModel
class EarnViewModel
    @Inject
    constructor(
        private val repository: MailboxRepository,
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
                when (val summary = repository.earningsSummary()) {
                    is NetworkResult.Success -> {
                        val rows = history.map(::earningFrom)
                        _state.value =
                            if (summary.data.totalEarned > 0 || rows.isNotEmpty()) {
                                EarnUiState.Populated(contentFrom(summary.data, history, rows))
                            } else {
                                EarnUiState.Empty(EarnSampleData.waysToEarn)
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
            summary: EarningsSummaryResponse,
            history: List<EarningEntryDto>,
            rows: List<EarnEarning>,
        ): EarnContent {
            val available = (summary.totalEarned - summary.pendingEarnings).coerceAtLeast(0.0)
            val thisWeekRows = history.filter { isThisWeek(it.viewedAt ?: it.createdAt) }
            val thisWeekSum = thisWeekRows.sumOf { it.payoutAmount ?: 0.0 }
            val pendingCount = history.count { (it.payoutStatus ?: "").lowercase(Locale.US) == "pending" }
            return EarnContent(
                available = money(available),
                thisWeek = "\$" + money(thisWeekSum),
                thisWeekMeta = if (thisWeekRows.size == 1) "1 this week" else "${thisWeekRows.size} this week",
                pending = "\$" + money(summary.pendingEarnings),
                pendingMeta = if (pendingCount == 1) "1 on hold" else "$pendingCount on hold",
                // Deferred slots — no `/earnings/*` source (Stripe = Phase 3).
                weeklyGoal = null,
                waysToEarn = EarnSampleData.waysToEarn,
                earnings = rows,
                payoutMethod = null,
                autoCashOut = null,
                taxDocs = null,
            )
        }

        private fun earningFrom(dto: EarningEntryDto): EarnEarning {
            val instant = parseInstant(dto.viewedAt) ?: parseInstant(dto.createdAt)
            val isPending = (dto.payoutStatus ?: "").lowercase(Locale.US) == "pending"
            return EarnEarning(
                id = dto.id,
                day = dayLabel(instant),
                dateLabel = timeLabel(instant),
                description = dto.subject?.takeIf { it.isNotBlank() } ?: "Sponsored offer",
                counterparty = dto.senderBusinessName?.takeIf { it.isNotBlank() } ?: "Pantopus",
                // Ad-payout rows have no gig category — the row renders a
                // neutral tile rather than a faked cleaning/handyman glyph.
                category = null,
                status = if (isPending) EarnStatus.Pending("soon") else EarnStatus.Paid,
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

        private fun isThisWeek(value: String?): Boolean {
            val instant = parseInstant(value) ?: return false
            val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
            val startOfWeek = LocalDate.now().with(WeekFields.of(Locale.US).dayOfWeek(), 1)
            return !date.isBefore(startOfWeek)
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
        }
    }
