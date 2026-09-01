@file:Suppress("PackageNaming", "MatchingDeclarationName", "LongParameterList")

package app.pantopus.android.ui.screens.wallet

/**
 * A10.10 — render payloads for the Wallet screen. Pure value types so
 * the view-model can be fed deterministic stub data ([WalletSampleData])
 * and every state snapshots reproducibly. Colour is a semantic
 * [ActivityCategory] enum; the screen maps cases → `PantopusColors`.
 */

/** Activity-row category — drives the per-row icon tile colour + glyph. */
enum class ActivityCategory {
    Cleaning,
    ChildCare,
    Handyman,
    PetCare,
    Bank,
    Fee,
}

/** Direction of money flow for an activity row. */
enum class ActivityDirection {
    In,
    Out,
}

/**
 * Clearing status for a single row. The view renders a trailing label
 * ("Cleared" / "On hold" / "Payout" / "Fee") and optionally an amber
 * "Pending" chip beside the description for [Pending].
 */
sealed interface ActivityStatus {
    /** Earned and cleared — counts toward the available balance. */
    data object Available : ActivityStatus

    /**
     * Earned but still in escrow. [clearsLabel] is the user-facing
     * "clears Dec 4" sub-line copy.
     */
    data class Pending(val clearsLabel: String) : ActivityStatus

    /** Already-settled outbound payout or fee. */
    data object Complete : ActivityStatus
}

/** Single transaction row inside the Recent activity card. */
data class WalletActivityItem(
    val id: String,
    val day: String,
    val dateLabel: String,
    val description: String,
    val counterparty: String,
    val category: ActivityCategory,
    val direction: ActivityDirection,
    val status: ActivityStatus,
    /**
     * Pre-formatted amount string without the leading sign or "$".
     * Example `"140.00"` — the row renders `+$140.00` / `−$2.40` based
     * on [direction].
     */
    val amount: String,
    /**
     * `true` for the service-fee row — switches the trailing label to
     * "Fee" and uses the neutral fee category tint.
     */
    val isFee: Boolean = false,
)

/**
 * Payout-method card payload. The view renders a debit-card-shaped
 * `CHASE` tile plus the meta line; [warn] = `true` flips the card to
 * the amber re-verify state.
 */
data class WalletPayoutMethod(
    val bankLabel: String,
    val last4: String,
    /**
     * Body line rendered under the bank label. In the default state
     * the view prepends the green `Zap` flash icon; in the warn state
     * it prepends the amber `AlertCircle`.
     */
    val bodyText: String,
    val warn: Boolean,
)

/**
 * Connected-payout-account card payload, derived from the real Stripe Connect
 * status (`GET api/payments/connect/account`). Stripe does not hand the
 * platform a bank name or last-4 for an Express account, so this card
 * describes the *account* — what it can do, and how to manage it in Stripe's
 * own dashboard — rather than inventing bank details.
 */
data class WalletPayoutAccount(
    /** `Stripe account connected` / `Account verification in progress`. */
    val headline: String,
    /** Supporting line — capability summary or the verification note. */
    val bodyText: String,
    /**
     * Label for the trailing control — "Open Stripe Dashboard" once
     * onboarded, "Continue setup" while Stripe is still verifying.
     */
    val actionLabel: String,
    /**
     * `true` → the account exists but isn't onboarded yet: amber treatment,
     * and the action resumes hosted onboarding instead of the dashboard.
     */
    val warn: Boolean,
    /**
     * Per-capability tiles rendered under the row once the account is
     * connected — "Card payments" (`charges_enabled`) and "Payouts"
     * (`payouts_enabled`), each Enabled/Disabled. Empty while the account is
     * still verifying, which keeps the verifying frame identical to RN's.
     * Mirrors iOS `WalletPayoutAccount.capabilities`.
     */
    val capabilities: List<WalletPayoutCapability> = emptyList(),
)

/**
 * One Connect capability tile — "CARD PAYMENTS · Enabled" / "PAYOUTS ·
 * Disabled". Mirrors RN `PayoutsTab`'s `detailsGrid`, which renders
 * `charges_enabled` and `payouts_enabled` as separate tiles instead of
 * collapsing the account to a single boolean.
 */
data class WalletPayoutCapability(
    /** Stable key for the test tag — `cardPayments` / `payouts`. */
    val key: String,
    /** Tile overline, rendered uppercased — "Card payments" / "Payouts". */
    val label: String,
    /** Server-reported flag; the tile renders "Enabled" / "Disabled". */
    val enabled: Boolean,
)

/**
 * Tax-docs row payload. [ready] lights up the home-green icon tile +
 * `New` chip + "1099-NEC ready" body. Otherwise the row renders the
 * neutral grey YTD line.
 */
data class WalletTaxDocs(
    val ready: Boolean,
    val bodyText: String,
)

/**
 * Escrow breakdown behind the hero's single "Pending" figure, projected
 * from `GET api/wallet/pending-release`. RN renders the same two lines
 * (`WalletTab.tsx:161-173`); collapsing them to `total_pending_cents` hides
 * *why* money is held — funds still inside the cooling-off review window
 * read very differently from funds already queued for transfer. Both
 * strings are pre-formatted (`"$140.00"`); the counts come straight from
 * the same payload. Mirrors iOS `WalletPendingBreakdown`.
 */
data class WalletPendingBreakdown(
    /** `in_review_cents` — still inside the cooling-off window. */
    val inReview: String,
    /** `releasing_soon_cents` — past cooling-off, awaiting the transfer job. */
    val releasingSoon: String,
    /** `in_review_count`. */
    val inReviewCount: Int = 0,
    /** `releasing_soon_count`. */
    val releasingSoonCount: Int = 0,
)

/**
 * Hold-state payload — populated only in the [Hold] state. Drives the
 * amber top banner above the BalanceHero and the locked Withdraw CTA
 * footnote at the bottom.
 */
data class WalletHoldState(
    val bannerHeadline: String,
    val bannerBody: String,
    /** Compact one-line summary surfaced inside the BalanceHero's
     *  inset amber strip ("Re-verify your bank to release funds."). */
    val heroBannerHeadline: String,
    val heroBannerBody: String,
    /** Centred footnote under the locked Withdraw CTA. */
    val withdrawFootnote: String,
)

/** Top-level Wallet render payload. */
data class WalletContent(
    /** Pre-formatted available balance — e.g. `"847.50"`. */
    val available: String,
    val pending: String,
    val pendingMeta: String,
    /**
     * Split of [pending] into "In review" / "Releasing soon". `null` when
     * nothing is in escrow (or the supplementary call failed) — the section
     * is hidden rather than showing two `$0.00` lines, matching RN's
     * `total_pending_cents > 0` gate.
     */
    val pendingBreakdown: WalletPendingBreakdown? = null,
    val monthValue: String,
    val monthMeta: String,
    val activity: List<WalletActivityItem>,
    /**
     * `null` until a real payout method is known — the live read path has no
     * Stripe payout-method feed yet, and the section is hidden rather than
     * filled with fabricated bank details.
     */
    val payoutMethod: WalletPayoutMethod? = null,
    /**
     * The seller's Stripe Connect account, when they have one. Drives the
     * "Payout account" card — and with it the "Open Stripe Dashboard" action,
     * which is otherwise unreachable. `null` when no connected account exists
     * (the bottom bar's "Set up payouts" covers that case).
     */
    val payoutAccount: WalletPayoutAccount? = null,
    /**
     * `null` until real tax-document data is known — same rule as
     * [payoutMethod]; never show invented YTD earnings.
     */
    val taxDocs: WalletTaxDocs? = null,
    /** Populated only in the [Hold] state. */
    val holdState: WalletHoldState? = null,
    /**
     * Block 3C — whether the seller's Stripe Connect account has payouts
     * enabled. `false` gates the Withdraw CTA behind "Set up payouts". Defaults
     * `true` so existing fixtures / snapshots render the Withdraw CTA unchanged;
     * the live path sets it from `GET /connect/account`.
     */
    val payoutsEnabled: Boolean = true,
    /**
     * Lifetime credited earnings (`Wallet.lifetime_received`), pre-formatted as
     * `"$4,120.00"`. RN surfaces this as "Total Earned" beside the balance
     * (`WalletTab.tsx:152`). `null` when the payload omitted the column — the
     * section hides rather than claiming `$0.00`.
     */
    val lifetimeEarned: String? = null,
    /**
     * Lifetime withdrawals (`Wallet.lifetime_withdrawals`), pre-formatted.
     * RN's "Withdrawn" figure (`WalletTab.tsx:157`).
     */
    val lifetimeWithdrawn: String? = null,
    /**
     * The server's `Wallet.frozen` flag (`GET api/wallet`). A frozen wallet is
     * rejected by `POST api/wallet/withdraw` with 403, so the CTA is locked
     * rather than left tappable — RN's `canWithdraw` includes `!frozen`
     * (`components/payments/WalletTab.tsx:121`).
     */
    val frozen: Boolean = false,
    /**
     * `false` when the available balance is zero — RN's `balance > 0` leg of
     * `canWithdraw`, which renders the disabled "No funds to withdraw" CTA.
     */
    val hasBalance: Boolean = true,
) {
    val isOnHold: Boolean get() = holdState != null

    /**
     * `true` when the server sent at least one lifetime total — drives the
     * "Lifetime" section's visibility.
     */
    val hasLifetimeTotals: Boolean get() = lifetimeEarned != null || lifetimeWithdrawn != null

    /**
     * RN `canWithdraw = hasWallet && !wallet.frozen && balance > 0`, plus the
     * native payouts-enabled gate (the server also requires a verified Connect
     * account) and the designed hold frame. Mirrors iOS `WalletContent`.
     */
    val canWithdraw: Boolean get() = payoutsEnabled && !frozen && hasBalance && !isOnHold
}

/**
 * Four-state machine: loading / populated / hold / error. Matches iOS
 * `WalletViewModel.State`.
 */
sealed interface WalletUiState {
    data object Loading : WalletUiState

    data class Populated(val content: WalletContent) : WalletUiState

    data class Hold(val content: WalletContent) : WalletUiState

    data class Error(val message: String) : WalletUiState
}
