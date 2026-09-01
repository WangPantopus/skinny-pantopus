@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.payments

import androidx.compose.runtime.Immutable

/**
 * Render models for A14.6 Payments (Settings → Payments). This is the
 * payments-OUT surface — cards on file · Stripe Connect setup · payout
 * routing — distinct from A10.10 Wallet which surfaces earnings-IN.
 * Mirrors `docs/designs/A14/payments-frames.jsx`: balance hero + three
 * grouped cards (Payment methods · Payouts · Activity) + an optional
 * destructive Close-account card.
 */

/** Top-level state for the Payments screen. */
sealed interface PaymentsUiState {
    data object Loading : PaymentsUiState

    data class Loaded(val content: PaymentsLoaded) : PaymentsUiState

    data class Error(val message: String) : PaymentsUiState
}

/** Loaded projection of the Payments screen. */
@Immutable
data class PaymentsLoaded(
    /** Hero card — `null` on the empty-account frame (nothing to surface). */
    val balance: PaymentsBalance?,
    /**
     * Saved payment methods (cards / wallets / bank). Empty list → the
     * methods card renders an inline empty hero above the Add row.
     */
    val methods: List<PaymentMethod>,
    /** Stripe Connect row + payout method row + tax row. */
    val payouts: PaymentsPayouts,
    /**
     * Populated has 3 stat rows (lifetime · YTD · last payout); empty
     * collapses to one muted "No transactions yet" row.
     */
    val activity: PaymentsActivity,
    /** Gates the "Close payment account" destructive card. */
    val canCloseAccount: Boolean,
    /** Monospaced footer caption rendered below the destructive card. */
    val footerCaption: String,
    /**
     * Lifetime TOTAL EARNED / TOTAL SPENT tiles
     * (`GET api/payments/earnings` + `/spending`). `null` when neither figure
     * could be read — the card is hidden rather than showing "$0".
     */
    val earnings: PaymentsEarnings? = null,
)

/**
 * "Earnings & Spending" card — the two lifetime totals rendered at the bottom
 * of the payouts surface. Values are pre-formatted from the server's integer
 * cents; an unreadable figure stays an em-dash rather than a misleading
 * "$0.00".
 */
@Immutable
data class PaymentsEarnings(
    /** `"$1,284.50"` or `"—"` when `GET api/payments/earnings` failed. */
    val totalEarned: String,
    /** `"$318.00"` or `"—"` when `GET api/payments/spending` failed. */
    val totalSpent: String,
    /** Caption clarifying that earned includes funds still in review. */
    val caption: String,
)

/** Balance hero — A14.6's compact `BalanceHero` payout variant. */
@Immutable
data class PaymentsBalance(
    val overline: String,
    val amount: String,
    val nextPayoutLabel: String,
    val frequencyPill: String,
)

/** One saved payment method row. */
@Immutable
data class PaymentMethod(
    val id: String,
    val brand: PaymentMethodBrand,
    val label: String,
    val subtext: String? = null,
    val chip: PaymentMethodChip? = null,
    /**
     * Last four digits of the card / bank account, when the server sent them.
     * Only used to name the method in the destructive remove confirmation,
     * mirroring RN's "…ending in 4421" alert (`PaymentMethodsTab.tsx:48-69`).
     */
    val last4: String? = null,
)

/** Brand badge variants for `PaymentMethodRow`. */
enum class PaymentMethodBrand {
    Visa,
    Mastercard,
    Amex,
    ApplePay,
    Bank,
    Stripe,

    /**
     * Generic card mark for brands without a bespoke badge (Discover, JCB,
     * Diners, UnionPay, …) so real saved cards always render.
     */
    Card,
}

/** Small status chip rendered before the trailing chevron. */
@Immutable
data class PaymentMethodChip(
    val label: String,
    val tone: PaymentsChipTone,
)

/** Chip color tones — mirrors `RowControl.ChipTone`. */
enum class PaymentsChipTone {
    Primary,
    Success,
    Neutral,
}

/** Payouts card content (Stripe row + 2–3 sibling rows). */
@Immutable
data class PaymentsPayouts(
    val stripe: PaymentsPayoutRow,
    val payoutMethod: PaymentsPayoutRow,
    val payoutSchedule: PaymentsPayoutRow? = null,
    val taxInfo: PaymentsPayoutRow,
    val helper: String? = null,
)

/** One row inside the Payouts card. */
@Immutable
data class PaymentsPayoutRow(
    val id: String,
    val leadingBrand: PaymentMethodBrand? = null,
    val label: String,
    val subtext: String? = null,
    val trailing: PaymentsRowTrailing,
)

/** Trailing affordance vocabulary for `PaymentsPayoutRow`. */
sealed interface PaymentsRowTrailing {
    data object Chevron : PaymentsRowTrailing

    @Immutable
    data class ChipChevron(val label: String, val tone: PaymentsChipTone) : PaymentsRowTrailing

    @Immutable
    data class CtaChip(val label: String, val tone: PaymentsChipTone) : PaymentsRowTrailing

    /** Em-dash "—" value — empty frame's payout-method / tax rows. */
    data object GatedDash : PaymentsRowTrailing
}

/** Activity card content. */
sealed interface PaymentsActivity {
    @Immutable
    data class Stats(val rows: List<PaymentsActivityStat>) : PaymentsActivity

    /** The real transaction-history feed from `GET api/payments/history`. */
    @Immutable
    data class Transactions(val rows: List<PaymentsTransaction>) : PaymentsActivity

    /**
     * Single muted row. Used when the history feed came back empty (or
     * couldn't be read — with the honest copy).
     */
    @Immutable
    data class Empty(val title: String, val body: String) : PaymentsActivity
}

/** One row inside the activity card. */
@Immutable
data class PaymentsActivityStat(
    val id: String,
    val label: String,
    val subtext: String? = null,
)

/**
 * One row of the transaction-history feed (`GET api/payments/history`).
 * Amounts are pre-formatted from the server's `amount_cents`; [isOutgoing]
 * drives the sign and the red/green treatment.
 */
@Immutable
data class PaymentsTransaction(
    val id: String,
    val kind: Kind,
    /** Gig title / description / humanised payment type. */
    val title: String,
    /** "Mar 4 · Succeeded · to Ana Ruiz" — date, status and counterparty. */
    val meta: String,
    /** Signed, formatted amount — e.g. `"-$40.00"` / `"+$120.00"`. */
    val amount: String,
    val isOutgoing: Boolean,
) {
    /**
     * Drives the leading icon disc, mirroring RN `HistoryTab` iconography:
     * tip → star, payout → arrow-up disc, money out → arrow-up, money in →
     * arrow-down.
     */
    enum class Kind { Tip, Payout, Sent, Received }
}
