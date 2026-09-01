@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.stamps

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.11 — render-only models for the Stamps (postage wallet) screen.
 * Mirrors iOS `Features/Mailbox/Stamps/StampsContent.swift` and
 * `docs/designs/A17/stamps.jsx`. Three render states: loading (shimmer),
 * loaded (the populated wallet), empty ("No stamps yet" + starter book);
 * an error case completes the four-state contract.
 *
 * PALETTE NOTE: the philatelic series ships per-ink swatches the design
 * hands over without tokens (Express / Civic / Spring / Business). Per the
 * `GigsContent` precedent these bespoke `Color(0x…)` stops live on the
 * enum — the CI hex grep only matches `#RRGGBB`, never `Color(0x…)`. The
 * Local ink reuses the shared `PantopusColors.categoryStamps` token.
 */

// MARK: - Stamp ink palette

/** The five philatelic inks in the wallet. */
enum class StampInk {
    Local,
    Express,
    Civic,
    Spring,
    Business,
    ;

    /** Engraved paper ink for the `PerforatedStamp`. */
    val color: Color
        get() =
            when (this) {
                Local -> PantopusColors.categoryStamps
                Express -> Color(0xFFBE123C) // rose-700 — Priority
                Civic -> Color(0xFF4338CA) // indigo-700 — Certified
                Spring -> Color(0xFF4D7C0F) // lime-700 — Collectible
                Business -> Color(0xFFB45309) // amber-700 — Biz drawer
            }
}

/** Bespoke neutrals the design pack ships without tokens. */
object StampPalette {
    /** Slate ink for postmarked (used) sheet cells — slate-400. */
    val usedInk = Color(0xFF94A3B8)

    /** Deep stop for the issuer avatar gradient — cyan-800. */
    val issuerDeep = Color(0xFF155E75)
}

// MARK: - Models

/** The active Forever-series book in the hero. */
@Immutable
data class StampBook(
    val series: String,
    val total: Int,
    val used: Int,
    val purchasedLabel: String,
    val validityLabel: String,
) {
    /** Live postage left in the book. */
    val remaining: Int get() = (total - used).coerceAtLeast(0)

    /** Fraction of the book still unused — drives the balance ring. */
    val remainingFraction: Float get() = if (total > 0) remaining.toFloat() / total else 0f
}

/** One owned design in the "Other stamps you own" rail. */
@Immutable
data class WalletStamp(
    val id: String,
    val name: String,
    val tag: String,
    val denom: String,
    val quantity: Int,
    val ink: StampInk,
)

/** One send in the "Usage history" ledger. */
@Immutable
data class StampUsage(
    val id: String,
    val recipient: String,
    val kind: String,
    val dateLabel: String,
    val stampName: String,
    val ink: StampInk,
)

/** The "From" issuer card — Pantopus Post. */
@Immutable
data class StampIssuer(
    val initials: String,
    val name: String,
    val dept: String,
    val kindLabel: String,
    val proofLabel: String,
)

/** One bullet in the Stamps Elf strip. */
@Immutable
data class StampInsight(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val text: String,
)

/** The previewed starter-book offer shown on the empty state. */
@Immutable
data class StampStarterBook(
    val title: String,
    val detail: String,
    val priceLabel: String,
)

/** Everything the populated wallet renders. */
@Immutable
data class StampsContent(
    val trust: MailDetailTrust,
    val categoryLabel: String,
    val timeLabel: String,
    val book: StampBook,
    val elfHeadline: String,
    val elfSummary: String,
    val insights: List<StampInsight>,
    val wallet: List<WalletStamp>,
    val walletSummary: String,
    val usage: List<StampUsage>,
    val usageWindow: String,
    val issuer: StampIssuer,
)

/** Copy + offer for the "No stamps yet" empty state. */
@Immutable
data class StampsEmptyContent(
    val headline: String,
    val body: String,
    val buyLabel: String,
    val starterBook: StampStarterBook,
    val howItWorksTitle: String,
    val howItWorksBody: String,
)

// MARK: - Screen state

/** Four-state contract for the Stamps screen. */
sealed interface StampsUiState {
    data object Loading : StampsUiState

    data class Loaded(val content: StampsContent) : StampsUiState

    data class Empty(val content: StampsEmptyContent) : StampsUiState

    data class Error(val message: String) : StampsUiState
}
