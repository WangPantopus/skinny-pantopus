package app.pantopus.android.data.api.models.wallet

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Read-path DTOs for `backend/routes/wallet.js`. Monetary values are integer
 * cents (`Wallet.balance` / `WalletTransaction.amount` are `bigint`); the
 * view-model formats them into display strings.
 */

// GET /api/wallet — backend/routes/wallet.js:55
@JsonClass(generateAdapter = true)
data class WalletBalanceResponse(
    val wallet: WalletDto,
)

@JsonClass(generateAdapter = true)
data class WalletDto(
    val id: String,
    /** Available balance in integer cents. */
    val balance: Long,
    val currency: String? = null,
    val frozen: Boolean = false,
    @Json(name = "lifetime_withdrawals") val lifetimeWithdrawals: Long? = null,
    @Json(name = "lifetime_received") val lifetimeReceived: Long? = null,
)

// GET /api/wallet/transactions — backend/routes/wallet.js:124
@JsonClass(generateAdapter = true)
data class WalletTransactionsResponse(
    val transactions: List<WalletTransactionDto> = emptyList(),
    val total: Int? = null,
    val limit: Int? = null,
    val offset: Int? = null,
)

@JsonClass(generateAdapter = true)
data class WalletTransactionDto(
    val id: String,
    /** `deposit | withdrawal | gig_income | gig_payment | tip_income |
     *  tip_sent | refund | adjustment | transfer_in | transfer_out |
     *  cancellation_fee`. */
    val type: String,
    /** Positive integer cents; the sign comes from [direction]. */
    val amount: Long,
    /**
     * `credit | debit` — authoritative. `NOT NULL` with a CHECK constraint on
     * `WalletTransaction` (backend/database/schema.sql:4526,4541) and returned by
     * `select('*')` in `walletService.getTransactions`. Nullable here only so an
     * older payload still decodes; callers fall back to the [type] heuristic.
     */
    val direction: String? = null,
    val description: String? = null,
    val currency: String? = null,
    /** `completed | pending | failed | reversed`. */
    val status: String,
    @Json(name = "counterparty_id") val counterpartyId: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

// GET /api/wallet/pending-release — backend/routes/wallet.js:160
@JsonClass(generateAdapter = true)
data class WalletPendingReleaseResponse(
    @Json(name = "in_review_cents") val inReviewCents: Long = 0,
    @Json(name = "releasing_soon_cents") val releasingSoonCents: Long = 0,
    @Json(name = "total_pending_cents") val totalPendingCents: Long = 0,
    @Json(name = "in_review_count") val inReviewCount: Int = 0,
    @Json(name = "releasing_soon_count") val releasingSoonCount: Int = 0,
)

// POST /api/wallet/withdraw — backend/routes/wallet.js:84 (Block 3C)
@JsonClass(generateAdapter = true)
data class WalletWithdrawRequest(
    /** Amount in integer cents (min 100). */
    val amount: Long,
    val idempotencyKey: String? = null,
)

@JsonClass(generateAdapter = true)
data class WalletWithdrawResponse(
    val success: Boolean = false,
    val transaction: WalletTransactionDto? = null,
    val message: String? = null,
)
