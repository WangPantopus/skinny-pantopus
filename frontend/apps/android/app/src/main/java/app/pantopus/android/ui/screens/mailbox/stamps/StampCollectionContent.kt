@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.stamps

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors

/**
 * A17.11 — render models for the two *backend-backed* halves of the
 * Stamps screen:
 *
 *  - the stamp **collection** (`GET api/mailbox/v2/p3/stamps`,
 *    `backend/routes/mailboxV2Phase3.js:1204`), and
 *  - the seasonal **themes** view (`GET api/mailbox/v2/p3/themes`,
 *    `:1249` + `POST /themes/apply`, `:1285`).
 *
 * Mirrors RN `src/app/mailbox/stamps.tsx`, whose header toggles between
 * "Stamp Gallery" and "Seasonal Themes".
 *
 * PALETTE NOTE: the backend hands each theme an `accent_color` hex. We
 * deliberately map the *season* onto a design token instead of parsing
 * the raw hex — `ui/screens/…` is tokens-only and CI greps for
 * `Color(0xFF…)`.
 *
 * Mirrors iOS `Features/Mailbox/Stamps/StampCollectionContent.swift`.
 */

/** Which half of the Stamps screen is on screen (RN's header toggle). */
enum class StampsViewMode(
    val title: String,
    /** Label on the toggle button, which names the *other* mode. */
    val toggleLabel: String,
) {
    Stamps("Stamp Gallery", "Themes"),
    Themes("Seasonal Themes", "Stamps"),
    ;

    val toggled: StampsViewMode get() = if (this == Stamps) Themes else Stamps
}

/** Wire rarity of a stamp (`backend/routes/mailboxV2Phase3.js:1214`). */
enum class StampRarity(
    val slug: String,
    val label: String,
) {
    Common("common", "Common"),
    Uncommon("uncommon", "Uncommon"),
    Rare("rare", "Rare"),
    Legendary("legendary", "Legendary"),
    ;

    val accent: Color
        get() =
            when (this) {
                Common -> PantopusColors.slate
                Uncommon -> PantopusColors.success
                Rare -> PantopusColors.info
                Legendary -> PantopusColors.magic
            }

    val accentBg: Color
        get() =
            when (this) {
                Common -> PantopusColors.slateBg
                Uncommon -> PantopusColors.successBg
                Rare -> PantopusColors.infoBg
                Legendary -> PantopusColors.magicBg
            }

    companion object {
        fun fromRaw(raw: String?): StampRarity = entries.firstOrNull { it.slug == raw?.lowercase() } ?: Common
    }
}

/** One card in the collection grid / locked list. */
data class CollectedStamp(
    val id: String,
    val name: String,
    val detail: String?,
    val rarity: StampRarity,
    /** "Earned May 4, 2026" — null for locked entries. */
    val earnedLabel: String?,
    val isLocked: Boolean,
)

/** The projected `GET /p3/stamps` payload. */
data class StampCollectionContent(
    val earned: List<CollectedStamp>,
    val locked: List<CollectedStamp>,
    val totalEarned: Int,
    val totalAvailable: Int,
) {
    /** "3 of 13 collected" — RN `stamps.tsx:104`. */
    val progressLabel: String get() = "$totalEarned of $totalAvailable collected"
}

/** Four-state contract for the collection section. */
sealed interface StampCollectionUiState {
    data object Loading : StampCollectionUiState

    data class Loaded(val content: StampCollectionContent) : StampCollectionUiState

    data object Empty : StampCollectionUiState

    data class Error(val message: String) : StampCollectionUiState
}

/** Wire season of a `SeasonalTheme` row. */
enum class MailboxThemeSeason(
    val slug: String,
    val label: String,
) {
    Spring("spring", "Spring"),
    Summer("summer", "Summer"),
    Autumn("autumn", "Autumn"),
    Winter("winter", "Winter"),
    Custom("custom", "Custom"),
    ;

    /** Token swatch standing in for the row's `accent_color` hex. */
    val accent: Color
        get() =
            when (this) {
                Spring -> PantopusColors.success
                Summer -> PantopusColors.warmAmber
                Autumn -> PantopusColors.rose
                Winter -> PantopusColors.info
                Custom -> PantopusColors.slate
            }

    val accentBg: Color
        get() =
            when (this) {
                Spring -> PantopusColors.successBg
                Summer -> PantopusColors.warmAmberBg
                Autumn -> PantopusColors.roseBg
                Winter -> PantopusColors.infoBg
                Custom -> PantopusColors.slateBg
            }

    companion object {
        fun fromRaw(raw: String?): MailboxThemeSeason = entries.firstOrNull { it.slug == raw?.lowercase() } ?: Custom
    }
}

/** One row in the "Available themes" list. */
data class MailboxTheme(
    val id: String,
    val name: String,
    val season: MailboxThemeSeason,
    val isUnlocked: Boolean,
    /**
     * The row carries an `active_from` window, so it auto-applies in
     * season — RN renders " · Auto-applies" (`stamps.tsx:186`).
     */
    val autoApplies: Boolean,
) {
    /** "Winter · Auto-applies". */
    val subtitle: String
        get() = if (autoApplies) "${season.label} · Auto-applies" else season.label
}

/** The projected `GET /p3/themes` payload. */
data class StampThemesContent(
    val themes: List<MailboxTheme>,
    val activeThemeId: String?,
) {
    val activeTheme: MailboxTheme? get() = themes.firstOrNull { it.id == activeThemeId }
}

/** Four-state contract for the themes view. */
sealed interface StampThemesUiState {
    data object Loading : StampThemesUiState

    data class Loaded(val content: StampThemesContent) : StampThemesUiState

    data object Empty : StampThemesUiState

    data class Error(val message: String) : StampThemesUiState
}
