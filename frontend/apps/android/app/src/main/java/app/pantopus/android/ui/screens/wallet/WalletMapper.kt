@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.wallet

import app.pantopus.android.data.api.models.connect.ConnectAccountDto
import app.pantopus.android.data.api.models.wallet.WalletBalanceResponse
import app.pantopus.android.data.api.models.wallet.WalletPendingReleaseResponse
import app.pantopus.android.data.api.models.wallet.WalletTransactionDto
import java.text.NumberFormat
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * P1-F — projects the read-path wallet DTOs onto [WalletContent]. Mirrors the
 * iOS `WalletViewModel` mapping. The withdraw/payout slots (payout method,
 * tax docs) stay null — they're wired in Phase 3 with Stripe, and the screen
 * hides those sections rather than showing fixture bank details / YTD
 * earnings. `holdState` stays null because the hold banner copy is
 * Stripe-specific.
 */
@Suppress("TooManyFunctions")
object WalletMapper {
    fun build(
        balance: WalletBalanceResponse,
        transactions: List<WalletTransactionDto>,
        pending: WalletPendingReleaseResponse?,
        payoutsEnabled: Boolean = true,
        connectAccount: ConnectAccountDto? = null,
        zone: ZoneId = ZoneId.systemDefault(),
        now: Instant = Instant.now(),
    ): WalletContent {
        val pendingCents = pending?.totalPendingCents ?: 0L
        val pendingCount = (pending?.inReviewCount ?: 0) + (pending?.releasingSoonCount ?: 0)
        return WalletContent(
            available = centsToPlain(balance.wallet.balance),
            pending = centsToCurrency(pendingCents),
            pendingMeta = pendingMeta(pendingCount, pendingCents),
            pendingBreakdown = pendingBreakdown(pending),
            monthValue = centsToCurrency(monthIncomeCents(transactions, zone, now)),
            monthMeta = monthMeta(monthIncomeRows(transactions, zone, now).size),
            activity = transactions.map { activityItem(it, zone, now) },
            payoutMethod = null,
            payoutAccount = payoutAccount(connectAccount),
            taxDocs = null,
            holdState = null,
            payoutsEnabled = payoutsEnabled,
            lifetimeEarned = balance.wallet.lifetimeReceived?.let(::centsToCurrency),
            lifetimeWithdrawn = balance.wallet.lifetimeWithdrawals?.let(::centsToCurrency),
            frozen = balance.wallet.frozen,
            hasBalance = balance.wallet.balance > 0L,
        )
    }

    /**
     * Map the live Connect status onto the "Payout account" card. Mirrors RN
     * `PayoutsTab`: onboarded = `charges_enabled && payouts_enabled`; an
     * account id without both flags is still verifying. No account at all →
     * null, and the bottom bar's "Set up payouts" remains the entry point.
     * The onboarded frame carries RN's CARD PAYMENTS / PAYOUTS capability
     * tiles (`PayoutsTab.tsx:177-190`) instead of collapsing the account to
     * one boolean. Mirrors iOS `WalletViewModel.payoutAccount(from:)`.
     */
    fun payoutAccount(account: ConnectAccountDto?): WalletPayoutAccount? {
        if (account == null) return null
        if (account.chargesEnabled && account.payoutsEnabled) {
            return WalletPayoutAccount(
                headline = "Stripe account connected",
                bodyText = "Payouts enabled · Card payments enabled",
                actionLabel = "Open Stripe Dashboard",
                warn = false,
                capabilities =
                    listOf(
                        WalletPayoutCapability(
                            key = "cardPayments",
                            label = "Card payments",
                            enabled = account.chargesEnabled,
                        ),
                        WalletPayoutCapability(
                            key = "payouts",
                            label = "Payouts",
                            enabled = account.payoutsEnabled,
                        ),
                    ),
            )
        }
        if (account.stripeAccountId.isNullOrEmpty()) return null
        return WalletPayoutAccount(
            headline = "Account verification in progress",
            bodyText = "Stripe is verifying your identity. This usually takes 1–2 business days.",
            actionLabel = "Continue setup",
            warn = true,
        )
    }

    fun activityItem(
        tx: WalletTransactionDto,
        zone: ZoneId = ZoneId.systemDefault(),
        now: Instant = Instant.now(),
    ): WalletActivityItem {
        val instant = parseInstant(tx.createdAt)
        val direction = direction(tx)
        return WalletActivityItem(
            id = tx.id,
            day = dayLabel(instant, zone, now),
            dateLabel = timeLabel(instant, zone),
            description = tx.description ?: typeLabel(tx.type),
            counterparty = counterpartyLabel(tx.type),
            category = category(tx.type),
            direction = direction,
            status = status(tx.status, direction),
            amount = centsToPlain(tx.amount),
            isFee = tx.type == "cancellation_fee",
        )
    }

    /**
     * Prefer the row's own `direction` — it is NOT NULL on the table and
     * constrained to `credit | debit`, so it is right even for types this client
     * has never seen. The [type] heuristic below defaults to `In`, which would
     * render an unrecognised debit (a refund the user owes, a new fee type) as
     * money coming in. Mirrors iOS `WalletViewModel.direction(for:)`.
     */
    fun direction(tx: WalletTransactionDto): ActivityDirection =
        when (tx.direction?.lowercase()) {
            "debit" -> ActivityDirection.Out
            "credit" -> ActivityDirection.In
            else -> direction(tx.type)
        }

    fun direction(type: String): ActivityDirection =
        when (type) {
            "withdrawal", "gig_payment", "tip_sent", "transfer_out", "cancellation_fee" -> ActivityDirection.Out
            else -> ActivityDirection.In
        }

    fun category(type: String): ActivityCategory =
        when (type) {
            "withdrawal", "deposit", "transfer_in", "transfer_out" -> ActivityCategory.Bank
            "cancellation_fee", "refund", "adjustment" -> ActivityCategory.Fee
            else -> ActivityCategory.Handyman
        }

    fun status(
        status: String,
        direction: ActivityDirection,
    ): ActivityStatus =
        when (status) {
            "pending" -> ActivityStatus.Pending("soon")
            else -> if (direction == ActivityDirection.Out) ActivityStatus.Complete else ActivityStatus.Available
        }

    private fun counterpartyLabel(type: String): String =
        when (type) {
            "withdrawal", "deposit", "transfer_in", "transfer_out" -> "Bank"
            "gig_income", "gig_payment" -> "Gig"
            "tip_income", "tip_sent" -> "Tip"
            "refund" -> "Refund"
            "cancellation_fee" -> "Pantopus"
            else -> "Adjustment"
        }

    private fun typeLabel(type: String): String =
        when (type) {
            "withdrawal" -> "Withdrawal"
            "deposit" -> "Deposit"
            "gig_income", "gig_payment" -> "Gig payment"
            "tip_income" -> "Tip received"
            "tip_sent" -> "Tip sent"
            "refund" -> "Refund"
            "cancellation_fee" -> "Cancellation fee"
            else -> "Adjustment"
        }

    private fun monthIncomeCents(
        transactions: List<WalletTransactionDto>,
        zone: ZoneId,
        now: Instant,
    ): Long = monthIncomeRows(transactions, zone, now).sumOf { it.amount }

    private fun monthIncomeRows(
        transactions: List<WalletTransactionDto>,
        zone: ZoneId,
        now: Instant,
    ): List<WalletTransactionDto> {
        val nowDate = now.atZone(zone).toLocalDate()
        return transactions.filter { tx ->
            if (direction(tx) != ActivityDirection.In) return@filter false
            val instant = parseInstant(tx.createdAt) ?: return@filter false
            val date = instant.atZone(zone).toLocalDate()
            date.year == nowDate.year && date.monthValue == nowDate.monthValue
        }
    }

    /**
     * Split the escrow total into RN's two named lines
     * (`WalletTab.tsx:161-173`). Gated on `total_pending_cents > 0` — the
     * same condition RN uses — so an empty escrow hides the section instead
     * of rendering two `$0.00` rows. The server's own cents are formatted;
     * nothing is re-derived. Mirrors iOS `WalletViewModel.pendingBreakdown`.
     */
    fun pendingBreakdown(pending: WalletPendingReleaseResponse?): WalletPendingBreakdown? {
        if (pending == null || pending.totalPendingCents <= 0L) return null
        return WalletPendingBreakdown(
            inReview = centsToCurrency(pending.inReviewCents),
            releasingSoon = centsToCurrency(pending.releasingSoonCents),
            inReviewCount = pending.inReviewCount,
            releasingSoonCount = pending.releasingSoonCount,
        )
    }

    private fun pendingMeta(
        count: Int,
        cents: Long,
    ): String =
        if (cents <= 0L) {
            "Nothing in escrow"
        } else {
            "$count ${if (count == 1) "payment" else "payments"} · releases after review"
        }

    private fun monthMeta(count: Int): String = "$count ${if (count == 1) "task" else "tasks"} this month"

    // Integer cents → grouped 2-dp string with no symbol, e.g. "1,284.50".
    fun centsToPlain(cents: Long): String {
        val formatter = NumberFormat.getNumberInstance(Locale.US)
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.format(cents / 100.0)
    }

    fun centsToCurrency(cents: Long): String = "$" + centsToPlain(cents)

    fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrEmpty()) return null
        return runCatching { Instant.parse(raw) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
    }

    fun dayLabel(
        instant: Instant?,
        zone: ZoneId,
        now: Instant,
    ): String {
        if (instant == null) return "—"
        val date = instant.atZone(zone).toLocalDate()
        val nowDate = now.atZone(zone).toLocalDate()
        return when (ChronoUnit.DAYS.between(date, nowDate)) {
            0L -> "Today"
            1L -> "Yesterday"
            else -> date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        }
    }

    fun timeLabel(
        instant: Instant?,
        zone: ZoneId,
    ): String {
        if (instant == null) return ""
        val time = instant.atZone(zone).toLocalTime()
        return time
            .format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
            .replace("AM", "am")
            .replace("PM", "pm")
    }
}
