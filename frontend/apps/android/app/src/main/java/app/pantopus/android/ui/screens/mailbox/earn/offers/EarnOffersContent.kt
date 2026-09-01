@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.earn.offers

/**
 * Projections for the Earn drawer's paid-offer wall (the `Offers` tab of
 * A10.11). Presentation-ready value types only — every string is formatted
 * in [EarnOffersViewModel] so the screen does no arithmetic and no date
 * maths.
 *
 * Mirrors iOS `EarnOffersContent.swift`.
 */

/** The dwell contract shared by the view-model and the card. */
object EarnOfferDwell {
    /**
     * The server's `MIN_DWELL_MS / 1000` — `backend/routes/mailboxV2.js:955`.
     * `POST /earn/close/:offerId` only banks the reward at or above this.
     */
    const val SECONDS = 15

    /** Same contract in milliseconds — what the close call reports. */
    const val MILLIS = 15_000L
}

/**
 * Server-computed earn balance, formatted for display. Never mutated
 * locally — the view-model re-reads `GET /earn/balance` after every
 * state-changing call so the hero always shows the server's number.
 */
data class EarnOffersBalance(
    /** `available + pending`, e.g. `"3.40"` (no leading glyph). */
    val total: String,
    /** Cleared payouts (`available | paid` transactions). */
    val available: String,
    /** Held payouts (`pending | verified` transactions). */
    val pending: String,
    /** Whether the pending note should render at all. */
    val hasPending: Boolean,
) {
    companion object {
        /** Zeroed placeholder used before the first balance read resolves. */
        val Zero = EarnOffersBalance(total = "0.00", available = "0.00", pending = "0.00", hasPending = false)
    }
}

/** Where an offer sits in the open then dwell then bank cycle. */
sealed interface EarnOfferEngagement {
    /** Sealed envelope — tapping it calls `POST /earn/open`. */
    data object Unopened : EarnOfferEngagement

    /**
     * Opened in this session; the 15s dwell window is still running.
     * [secondsRemaining] counts down to the server's `MIN_DWELL_MS`.
     */
    data class Dwelling(
        val secondsRemaining: Int,
    ) : EarnOfferEngagement

    /**
     * Opened, but the dwell never completed — the transaction is still
     * `pending` and the payout has not been banked.
     */
    data object Pending : EarnOfferEngagement

    /** The server accepted the dwell (`verified | available | paid`). */
    data object Earned : EarnOfferEngagement

    /** The transaction is `flagged` — held while fraud review runs. */
    data object Held : EarnOfferEngagement
}

/** Whether the offer body (title, actions) is revealed. */
val EarnOfferEngagement.isOpen: Boolean
    get() = this !is EarnOfferEngagement.Unopened

/** One offer envelope on the wall. */
data class EarnOfferItem(
    val id: String,
    val businessName: String,
    /** One-or-two letter avatar tile text. */
    val initials: String,
    val title: String,
    val subtitle: String?,
    /** `"Offer expires Mar 4"` or `"Limited time"`. */
    val expiryLabel: String,
    /** `"25¢"` under a dollar, `"$1.50"` at or above it. */
    val payoutLabel: String,
    val engagement: EarnOfferEngagement,
)

/**
 * First-class daily-cap state. The backend answers `POST /earn/open` with
 * **429** `{ capped: true }` after 10 opens in a calendar day
 * (`backend/routes/mailboxV2.js:869`); RN surfaces exactly this copy.
 */
data class EarnCapNotice(
    val headline: String = "Daily cap reached",
    val body: String = "You can open up to 10 offers per day.",
)

/**
 * Payload for the reveal-code dialog. [code] is null when the advertiser
 * never attached one — the dialog says so rather than showing a blank.
 */
data class EarnRevealedCode(
    val id: String,
    val businessName: String,
    val code: String?,
)

/** Render states for the offer wall. Mirrors iOS `EarnOffersViewModel.State`. */
sealed interface EarnOffersUiState {
    data object Loading : EarnOffersUiState

    /** At least one active offer. [balance] is the server's numbers. */
    data class Loaded(
        val balance: EarnOffersBalance,
        val offers: List<EarnOfferItem>,
    ) : EarnOffersUiState

    /**
     * No active offers in the caller's area — the balance hero still
     * renders so a returning earner can see what they banked.
     */
    data class Empty(
        val balance: EarnOffersBalance,
    ) : EarnOffersUiState

    data class Error(
        val message: String,
    ) : EarnOffersUiState
}
