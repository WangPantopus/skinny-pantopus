@file:Suppress("PackageNaming", "MatchingDeclarationName", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.earn

/**
 * A10.11 — render payloads for the Earn dashboard, the earnings-IN
 * sibling of the A10.10 Wallet. Pure value types so the view-model can
 * be fed deterministic stub data ([EarnSampleData]) and every state
 * snapshots reproducibly. Colour is a semantic enum ([EarnCategory] /
 * [EarnAccent]); the screen maps cases → `PantopusColors`. Mirrors the
 * iOS `EarnContent.swift` value types line-for-line.
 */

/** Earnings-row category — the money-in subset of the Wallet activity
 *  palette (no bank / fee rows). Drives the per-row icon tile + glyph. */
enum class EarnCategory {
    Cleaning,
    ChildCare,
    Handyman,
    PetCare,
}

/**
 * Clearing status for an earnings row. [Paid] renders the green cleared
 * amount; [Pending] renders the amber "Pending" chip + amount and the
 * "clears …" sub-line.
 */
sealed interface EarnStatus {
    data object Paid : EarnStatus

    data class Pending(val clearsLabel: String) : EarnStatus
}

/** A single earnings row inside the Recent-earnings card. */
data class EarnEarning(
    val id: String,
    val day: String,
    val dateLabel: String,
    val description: String,
    val counterparty: String,
    /** Gig category drives the tinted tile. Live ad-payout rows have no
     *  gig category, so this is null and the row renders a neutral tile. */
    val category: EarnCategory? = null,
    val status: EarnStatus,
    /**
     * Pre-formatted amount string without the leading sign or "$" —
     * e.g. `"140.00"`. The row renders "+$140.00".
     */
    val amount: String,
)

/**
 * Accent role for a `Ways to earn` row — the view maps the role onto a
 * design token so colour stays out of the model: [Primary] (Browse),
 * [Home] green (Refer), [Business] violet (Offer a service).
 */
enum class EarnAccent {
    Primary,
    Home,
    Business,
}

/** Which `Ways to earn` entry was tapped — lets the host route each row. */
enum class EarnWayKind {
    Browse,
    Refer,
    Offer,
}

/**
 * A single `Ways to earn` row. [featured] lifts the first row onto the
 * `primary50` tinted surface with a filled `primary600` icon tile.
 */
data class EarnWayToEarn(
    val kind: EarnWayKind,
    val title: String,
    val meta: String,
    val accent: EarnAccent,
    val featured: Boolean = false,
)

/**
 * Weekly-goal momentum payload — drives the WeeklyGoalCard's
 * [app.pantopus.android.ui.components.ProgressRing] plus its headline /
 * subcopy.
 */
data class EarnWeeklyGoal(
    /** Completion in 0..1 (clamped by ProgressRing). */
    val progress: Float,
    /** Ring centre headline ("74%"). */
    val ringLabel: String,
    /** Ring centre caption ("to goal"). */
    val ringSublabel: String,
    /** Card headline ("$52 to go"). */
    val headline: String,
    /** Card subcopy ("$148 of your $200 goal this week"). */
    val subcopy: String,
)

/** Linked payout-method payload — Chase debit-card tile + meta line. */
data class EarnPayoutMethod(
    val bankLabel: String,
    val last4: String,
    val bodyText: String,
)

/** Auto-cash-out row payload — the recurring-payout toggle row. */
data class EarnAutoCashOut(
    val title: String,
    val detail: String,
    val isOn: Boolean,
)

/** Tax-docs row payload — file-text row with the YTD / 1099 meta line. */
data class EarnTaxDocs(
    val bodyText: String,
)

/**
 * Top-level populated Earn payload. The empty (new-earner) state carries
 * only [EarnWayToEarn]s — every other slot collapses to a fixed gated /
 * nudge treatment owned by the screen.
 */
data class EarnContent(
    /** Pre-formatted available-to-cash-out balance — e.g. `"312.40"`. */
    val available: String,
    val thisWeek: String,
    val thisWeekMeta: String,
    val pending: String,
    val pendingMeta: String,
    // The weekly-goal target, linked payout method, auto-cash-out, and 1099
    // tax docs have no `/earnings/*` source (the last three are Stripe
    // Connect — Phase 3), so the live path leaves them null and the screen
    // hides them. [EarnSampleData] fills them for previews/snapshots.
    val weeklyGoal: EarnWeeklyGoal? = null,
    val waysToEarn: List<EarnWayToEarn>,
    val earnings: List<EarnEarning>,
    val payoutMethod: EarnPayoutMethod? = null,
    val autoCashOut: EarnAutoCashOut? = null,
    val taxDocs: EarnTaxDocs? = null,
)

/**
 * Four-state machine: loading / populated / empty / error. Matches iOS
 * `EarnViewModel.State`. [Empty] is the new-earner frame — no hero, gated
 * rows, add-payout nudge — and carries only the shared `Ways to earn` rows.
 */
sealed interface EarnUiState {
    data object Loading : EarnUiState

    data class Populated(val content: EarnContent) : EarnUiState

    data class Empty(val waysToEarn: List<EarnWayToEarn>) : EarnUiState

    data class Error(val message: String) : EarnUiState
}
