@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.shared.list_of_rows

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/** Lifecycle state for the List-of-Rows shell. */
sealed interface ListOfRowsUiState {
    /** Initial / refreshing state. */
    data object Loading : ListOfRowsUiState

    /** Loaded content. */
    data class Loaded(
        val sections: List<RowSection>,
        val hasMore: Boolean,
    ) : ListOfRowsUiState

    /** No items — render the shared EmptyState. */
    data class Empty(
        val icon: PantopusIcon,
        val headline: String,
        val subcopy: String,
        val ctaTitle: String? = null,
        val onCta: (() -> Unit)? = null,
        /**
         * Hero-circle background. `null` keeps the [EmptyState] default
         * (personal-identity sky). A14.4 passes a neutral sunken tint so
         * the Blocked-users empty hero reads as a quiet grey disc.
         */
        val tint: Color? = null,
        /**
         * Icon stroke colour. `null` keeps the [EmptyState] default
         * (primary600). A14.4 pairs the grey disc with a secondary-text
         * glyph.
         */
        val accent: Color? = null,
    ) : ListOfRowsUiState

    /** Transport / server error — render banner + retry. */
    data class Error(
        val message: String,
    ) : ListOfRowsUiState
}

/** Tab strip entry. */
data class ListOfRowsTab(
    val id: String,
    val label: String,
    val count: Int? = null,
)

/**
 * Top-bar trailing action payload.
 *
 * T5.0 additive: [label] and [isEnabled] are new optional fields with
 * backwards-compatible defaults. Existing call sites pass
 * `(icon=, contentDescription=, onClick=)` and render as an icon-only
 * button. Notifications V2 passes a text [label] instead — the shell
 * renders the text in primary tint and respects [isEnabled] for the
 * disabled state in the design's empty-unread frame.
 */
data class TopBarAction(
    val icon: PantopusIcon,
    val contentDescription: String,
    val onClick: () -> Unit,
    val label: String? = null,
    val isEnabled: Boolean = true,
    /**
     * Optional count badge rendered over the icon's top-trailing corner
     * (e.g. number of active filters). `null` or `0` hides the badge.
     * Only honoured by the icon variant.
     */
    val badgeCount: Int? = null,
)

/**
 * Identity tint for a FAB. Resolved at render time to a fill color.
 * Defaults to [Sky] so every existing FAB call site — which doesn't
 * pass a tint — keeps the T5 sky-blue render.
 *
 * T6.0a added [Home] + [Business] tints so home-pillar screens (Bills,
 * Maintenance, Calendar, etc.) and business-pillar screens
 * (My businesses) can swap the FAB color to match their identity
 * without forking the FAB variant taxonomy.
 */
enum class FabTint {
    /** primary600 — default. */
    Sky,

    /** Home green. */
    Home,

    /** Business violet. */
    Business,
}

/**
 * FAB payload.
 *
 * T5.0 adds a [variant]:
 *  - [FabVariant.CanonicalCreate] (56dp) — primary create action of the
 *    screen (My tasks V2 "Post a task"). **Default** for backwards
 *    compat — every existing `FabAction(icon=, contentDescription=, onClick=)`
 *    constructor call renders 56dp exactly as before.
 *  - [FabVariant.SecondaryCreate] (52dp) — non-canonical create action
 *    (My posts, Connections, Bills, Pets).
 *  - [FabVariant.ExtendedNav] (48dp pill with label) — navigation FAB
 *    that signals "go elsewhere", not "create" (My bids "Browse tasks").
 *
 * T6.0a adds an optional [tint] (default [FabTint.Sky]) for the
 * home / business identity tints. Existing call sites compile
 * unchanged because the parameter defaults.
 */
data class FabAction(
    val icon: PantopusIcon = PantopusIcon.PlusCircle,
    val contentDescription: String,
    val variant: FabVariant = FabVariant.CanonicalCreate,
    val tint: FabTint = FabTint.Sky,
    val onClick: () -> Unit,
)

sealed interface FabVariant {
    /** 56dp round. Default — historical T1–T4.1 geometry. */
    data object CanonicalCreate : FabVariant

    /** 52dp round. */
    data object SecondaryCreate : FabVariant

    /** 48dp pill with a label beside the icon. */
    data class ExtendedNav(val label: String) : FabVariant

    /**
     * T6.0b — 60dp Magic Task FAB. Gradient primary600 → primary700,
     * plus glyph (or icon override), 18dp white sparkles disc clipped
     * over the top-right corner. Used by My tasks V2 (sparkles+plus)
     * and Mailbox-A17 root (scan-line variant for magic ingest).
     */
    data object MagicCreate : FabVariant
}

// ─── T5 chrome slots (all default-null) ─────────────────────────

/**
 * Optional search bar rendered between the top bar and the tab strip.
 * Used by Connections and Discover businesses.
 */
data class SearchBarConfig(
    val placeholder: String,
    val text: String,
    val onChange: (String) -> Unit,
    val onSubmit: (() -> Unit)? = null,
)

/**
 * Horizontally scrollable chip-filter strip used as an alternative to
 * tabs for filtering. Used by Discover hub and Discover businesses.
 */
data class ChipStripConfig(
    val chips: List<Chip>,
    val selectedId: String,
    val onSelect: (String) -> Unit,
) {
    data class Chip(
        val id: String,
        val label: String,
        val icon: PantopusIcon? = null,
    )
}

/**
 * Tint options for the banner background/border and the trailing CTA
 * pill. Resolved at render time to the matching token pair
 * (background + foreground).
 *
 *  - [Primary] — sky (T5 default)
 *  - [Home]    — soft green (Bills banner)
 *  - [Business] — violet
 *  - [Warning] — amber (overdue surfaces)
 */
enum class BannerCtaTint {
    Primary,
    Home,
    Business,
    Warning,
}

/**
 * Optional trailing CTA on a [BannerConfig]. T6.0a added this for the
 * Bills banner's "Pay all" button. When [cta] is set, the banner
 * renders the CTA as a tinted pill on the trailing edge and disables
 * the whole-card [BannerConfig.onTap] (the CTA's [onClick] is the focused
 * action). When `cta` is null, banner-wide tap behavior is unchanged from T5.0.
 */
data class BannerCta(
    val label: String,
    val icon: PantopusIcon? = null,
    val accessibilityLabel: String = label,
    /**
     * Tint for the CTA pill. Defaults to the active screen's identity
     * tone (resolved by the shell) — pass an explicit tint to force a
     * home / business / personal pill regardless of context.
     */
    val tint: BannerCtaTint = BannerCtaTint.Primary,
    val onClick: () -> Unit,
)

/**
 * Primary-tinted summary banner rendered above the first row in the
 * scroll area. Used by My bids, My tasks, Offers, Review claims, Bills.
 *
 * T6.0a — adds an optional trailing [cta] pill and a [tint] override
 * for the background + border. Defaults preserve T5 behavior.
 */
data class BannerConfig(
    val icon: PantopusIcon,
    val title: String,
    val subtitle: String? = null,
    val onTap: (() -> Unit)? = null,
    /**
     * T6.0a — optional trailing CTA pill (Bills "Pay all"). When set,
     * takes precedence over [onTap] for the user's focused action;
     * [onTap] still fires for whole-card taps outside the CTA.
     */
    val cta: BannerCta? = null,
    /**
     * T6.0a — optional override for the banner's background + border
     * tint. Default [BannerCtaTint.Primary] (sky) matches T5 behavior.
     * Bills uses [BannerCtaTint.Home] (soft green) per the home-pillar
     * identity.
     */
    val tint: BannerCtaTint = BannerCtaTint.Primary,
)

/**
 * Rich listing-context header rendered above the first row on Listing
 * offers. Differs from [BannerConfig] in that the leading slot is a
 * 64dp gradient thumbnail and the trailing slot is an ask price; the
 * strip below the card carries the offer count + sort label.
 *
 * Listing offers is the only screen using this slot today.
 */
data class ListingContextConfig(
    /** 64dp rounded thumbnail (icon-on-gradient — listing category drives the colour pair). */
    val thumbnail: ThumbnailImage,
    /** Listing title (1 line, ellipsised). */
    val title: String,
    /** Pre-formatted ask price (e.g. "$250"). */
    val askPrice: String,
    /** Inline meta items rendered with a "·" separator below the title. */
    val meta: List<ListingContextMeta> = emptyList(),
    /** Status pill rendered at the bottom-right of the header card. */
    val statusChip: ListingContextStatus,
    /** Count rendered in the sort strip below the header (e.g. "5 offers"). */
    val offerCount: Int? = null,
    /** Sort selector label (e.g. "Highest offer"). */
    val sortLabel: String? = null,
    /** Options for the sort menu rendered on the sort strip. When
     *  non-empty the strip renders a `DropdownMenu`; when empty it falls
     *  back to [onSort] or a static label. */
    val sortOptions: List<ListingContextSortOption> = emptyList(),
    /** Triggered when the user taps the sort selector — opens a sort sheet, etc.
     *  Ignored when [sortOptions] is non-empty (the menu drives sorting). */
    val onSort: (() -> Unit)? = null,
    /** P3.3 — Triggered when the seller taps the pencil chip next to
     *  the asking price. Owner-only — the projection sets it to `null`
     *  for buyers so the chip stays hidden. */
    val onEditPrice: (() -> Unit)? = null,
)

/**
 * One option in the listing-context sort menu (e.g. "Highest offer").
 * The owning view-model supplies the label, the current selection, and
 * the [select] handler that re-sorts the list in place.
 */
data class ListingContextSortOption(
    val id: String,
    val label: String,
    val isSelected: Boolean,
    val select: () -> Unit,
)

/** One meta item in the listing-context header (e.g. "2.4k views"). */
data class ListingContextMeta(
    val icon: PantopusIcon? = null,
    val text: String,
)

/** Status pill payload for [ListingContextConfig]. */
data class ListingContextStatus(
    val label: String,
    val icon: PantopusIcon? = null,
    val variant: app.pantopus.android.ui.components.StatusChipVariant =
        app.pantopus.android.ui.components.StatusChipVariant.Success,
)
