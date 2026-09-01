@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.shared.list_of_rows

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

// MARK: - Templates

/** Visual template for a list row. */
enum class RowTemplate { StatusChip, FileChevron, AvatarKebab }

// MARK: - Supporting types (T5 additions)

/** Two-stop gradient for category / avatar / thumbnail backgrounds. */
data class GradientPair(
    val start: Color,
    val end: Color,
)

/** Size variants for [RowLeading.AvatarWithBadge]. */
enum class AvatarBadgeSize(val sizeDp: Int) {
    /** 36dp — inside grouped sections (Discover hub). */
    Small(36),

    /** 40dp — Review claims rows. */
    Medium(40),

    /** 44dp — Connections row. */
    Large(44),
}

/** Background fill for [RowLeading.AvatarWithBadge]. */
sealed interface AvatarBackground {
    data class Solid(val color: Color) : AvatarBackground

    data class Gradient(val gradient: GradientPair) : AvatarBackground
}

/** Thumbnail payload for [RowLeading.Thumbnail]. */
sealed interface ThumbnailImage {
    data class IconOnGradient(
        val icon: PantopusIcon,
        val gradient: GradientPair,
    ) : ThumbnailImage

    data class Remote(
        val url: String,
        val fallback: PantopusIcon,
        val gradient: GradientPair,
    ) : ThumbnailImage
}

/** Size variants for [RowLeading.Thumbnail]. */
enum class ThumbnailSize(val sizeDp: Int) {
    /** 56dp — Offers row. */
    Medium(56),

    /** 64dp — Pets row. */
    Large(64),
}

/** Tone palette for [Bidder] avatars inside [RowLeading.BidderStack]. */
enum class BidderTone { Sky, Teal, Amber, Rose, Violet, Slate }

/** Mini-avatar inside [BidderStack][RowLeading.BidderStack]. */
data class Bidder(
    val id: String,
    val initials: String,
    val tone: BidderTone,
)

/**
 * Bidder-stack payload rendered inline on the chip row — used by My
 * tasks V2 (T5.3.2). Separate from [RowLeading.BidderStack] because
 * the design positions the stack next to the status chip rather than
 * in the leading slot (which holds the 40dp category icon).
 */
data class BidderStackData(
    val bidders: List<Bidder>,
    val overflow: Int = 0,
)

// MARK: - Split stack (T6.0a Bills)

/**
 * One member in a split-payer stack. Geometry is smaller than [Bidder]
 * (18dp vs 22dp) so the visual reads as a property tag, not social
 * proof. Tone palette is shared with [Bidder] so split members and
 * bidders pick from the same six-color set.
 */
data class SplitMember(
    val id: String,
    val initials: String,
    val tone: BidderTone,
)

/**
 * Split-payer stack payload rendered at the RIGHT EDGE of the chip
 * line — used by Bills (T6.0a) when a bill is split between household
 * members. Different geometry + alignment from [BidderStackData]:
 *
 *  - 18dp overlapping avatars (vs Bidder 22dp)
 *  - right-aligned (vs Bidder which sits before the chips)
 *  - includes the "Split N ways" caption alongside the avatars
 *
 * Kept as a separate data class so the two concerns don't share an enum
 * case the shell would have to disambiguate.
 */
data class SplitStackData(
    val members: List<SplitMember>,
    val overflow: Int = 0,
    /**
     * Total people in the split, including the viewer. The "Split N
     * ways" caption uses this count so the math is explicit at the
     * VM (not the renderer).
     */
    val totalWays: Int,
)

// MARK: - Leading

/** Optional leading visual. */
sealed interface RowLeading {
    data object None : RowLeading

    /** Existing — icon-only. */
    data class Icon(
        val icon: PantopusIcon,
        val tint: Color,
    ) : RowLeading

    /** Existing — avatar with identity-pillar ring. */
    data class Avatar(
        val name: String,
        val imageUrl: String?,
        val identity: IdentityPillar,
        val ringProgress: Float,
    ) : RowLeading

    // ─── T5 additions ──────────────────────────────────────────

    /**
     * 40dp rounded-square tile with a tinted background + foreground icon.
     * Used by Notifications (per type) and Bills (receipt icon).
     */
    data class TypeIcon(
        val icon: PantopusIcon,
        val background: Color,
        val foreground: Color,
    ) : RowLeading

    /**
     * 40dp rounded-square tile with a two-stop gradient background + white
     * foreground icon. Used by My bids / My tasks category icons.
     */
    data class CategoryGradientIcon(
        val icon: PantopusIcon,
        val gradient: GradientPair,
    ) : RowLeading

    /**
     * Plain circular avatar with optional 16dp verified-check overlay at
     * the bottom-right. Used by Connections (large) and Review claims
     * (medium) and Discover hub people rows (small).
     */
    data class AvatarWithBadge(
        val name: String,
        val imageUrl: String?,
        val background: AvatarBackground,
        val size: AvatarBadgeSize,
        val verified: Boolean = false,
    ) : RowLeading

    /** Rounded thumbnail (56dp or 64dp) used by Offers and Pets. */
    data class Thumbnail(
        val image: ThumbnailImage,
        val size: ThumbnailSize,
    ) : RowLeading

    /**
     * Overlapping mini-avatars + `+N` overflow tile, used by My tasks
     * bidder summary.
     */
    data class BidderStack(
        val bidders: List<Bidder>,
        val overflow: Int = 0,
    ) : RowLeading

    // ─── T6.0b additions ──────────────────────────────────────

    /**
     * T6.0b — 44dp rounded-square tile with a two-stop gradient
     * background + white foreground icon + a small sparkles disc
     * clipped over the top-right corner. The disc is the scannable
     * "Magic Task understood this" signal.
     *
     * Used by My tasks V2 when the gig was posted via Magic Task
     * (derived from `source_flow === 'magic'`). The tile renders at
     * 44dp to make room for the disc overlay; the disc is 18dp with a
     * 1.5dp magic-border ring and a 10dp magic-violet sparkles glyph.
     */
    data class MagicArchetypeTile(
        val icon: PantopusIcon,
        val gradient: GradientPair,
    ) : RowLeading
}

// MARK: - Compact button shared variant

/** Variant for compact in-row buttons. Used by [RowTrailing.VerticalActions]
 *  and [RowFooterAction]. */
enum class CompactButtonVariant { Primary, Ghost, Destructive }

/**
 * Tone for [RowTrailing.PillButton] — mirrors the design's PillButton
 * palette: [Neutral] (white bg · grey border · fg2 label), [Primary]
 * (sky fill · white label), [Danger] (white bg · red border · red label).
 */
enum class RowPillTone { Neutral, Primary, Danger }

/** Single action description for [RowTrailing.VerticalActions]. */
data class VerticalAction(
    val label: String,
    val variant: CompactButtonVariant,
    val onClick: () -> Unit,
)

// MARK: - Trailing

/** Trailing payload — rendered according to the chosen [RowTemplate]. */
sealed interface RowTrailing {
    data object None : RowTrailing

    data object Chevron : RowTrailing

    data object Kebab : RowTrailing

    data class Status(
        val text: String,
        val variant: StatusChipVariant,
    ) : RowTrailing

    // ─── T5 additions ──────────────────────────────────────────

    /** Amount on top + status chip stacked below — Bills. */
    data class AmountWithChip(
        val amount: String,
        val chipText: String,
        val chipVariant: StatusChipVariant,
        val chipIcon: PantopusIcon? = null,
    ) : RowTrailing

    /** Single circular icon-button — Connections "message" CTA. */
    data class CircularAction(
        val icon: PantopusIcon,
        val accessibilityLabel: String,
        val background: Color,
        val foreground: Color,
        val onClick: () -> Unit,
    ) : RowTrailing

    /** Stacked Accept / Ignore pair — Connections pending requests. */
    data class VerticalActions(
        val primary: VerticalAction,
        val secondary: VerticalAction,
    ) : RowTrailing

    /** Price stack — amount on top, optional sublabel below. */
    data class PriceStack(
        val amount: String,
        val sublabel: String? = null,
    ) : RowTrailing

    /**
     * Two small (32dp) icon-only buttons rendered side by side. Used by
     * Access codes for the copy + kebab pair on each row — every other
     * existing trailing case is either a single button or non-button
     * content, so this slot fills the gap without conflating with
     * [Kebab] (which reads `onSecondary`) or [CircularAction] (single
     * primary). Both handlers are explicit so the kebab and copy can
     * each carry their own a11y label.
     */
    data class IconActions(
        val primary: RowIconAction,
        val secondary: RowIconAction,
    ) : RowTrailing

    /**
     * A14.4 — single inline labelled pill (the design's PillButton
     * primitive: 6×14 padding · capsule radius · 1px border · 13sp
     * semibold label · no icon). Used by Blocked users ("Unblock" in
     * [RowPillTone.Neutral]). Distinct from [VerticalActions] (a stacked
     * pair) and [CircularAction] (icon-only): a single text pill with its
     * own tap handler.
     */
    data class PillButton(
        val label: String,
        val tone: RowPillTone,
        val onClick: () -> Unit,
    ) : RowTrailing
}

/**
 * Single icon-only action used by [RowTrailing.IconActions]. Renders as a
 * 32dp rounded-square button with a sunken neutral background and a 15dp
 * glyph in the foreground tint.
 */
data class RowIconAction(
    val icon: PantopusIcon,
    val accessibilityLabel: String,
    val background: Color = PantopusColors.appSurfaceSunken,
    val foreground: Color = PantopusColors.appTextSecondary,
    val onClick: () -> Unit,
)

// MARK: - Chip

/** A chip rendered inline with the title (Pets species pill) or in the
 *  chip row beneath the body (My posts intent chip, status chip, counter). */
data class RowChip(
    val text: String,
    val icon: PantopusIcon? = null,
    val tint: Tint,
) {
    sealed interface Tint {
        data class Status(val variant: StatusChipVariant) : Tint

        data class Custom(val background: Color, val foreground: Color) : Tint
    }
}

// MARK: - Footer

/** One action inside [RowFooter]. */
data class RowFooterAction(
    val title: String,
    val icon: PantopusIcon? = null,
    val variant: CompactButtonVariant = CompactButtonVariant.Primary,
    /** Flex weight inside the footer row. Default 1. */
    val flex: Int = 1,
    /** Optional UI-test anchor applied to the button (Phase 5 counter rows). */
    val testTag: String? = null,
    val onClick: () -> Unit,
)

/** Optional in-card footer for a row — 1–3 inline compact buttons separated
 *  from the card body by a hairline. */
data class RowFooter(
    val actions: List<RowFooterAction>,
)

// MARK: - Engagement footer

/** One display-only stat (icon + label) inside a [RowEngagement] strip. */
data class RowEngagementItem(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
)

/** Trailing text-button on a [RowEngagement] strip (My posts Edit / Restore). */
data class RowEngagementCta(
    val label: String,
    val icon: PantopusIcon? = null,
    val accessibilityLabel: String = label,
    val onClick: () -> Unit,
)

/**
 * Hairline-separated engagement footer for a row — display-only counters
 * on the left + optional trailing CTA on the right. Used by My posts
 * (`[8 replies] [142 views] ↳ Edit`).
 */
data class RowEngagement(
    val items: List<RowEngagementItem>,
    val cta: RowEngagementCta? = null,
)

// MARK: - Destructive row action

/**
 * Optional destructive action attached to a row. The shell surfaces it
 * with the platform idiom on each side so parity holds without forcing
 * one gesture onto both: Android renders a long-press dropdown
 * (`combinedClickable(onLongClick = …)`); iOS renders a trailing swipe
 * action plus a long-press context menu.
 *
 * The handler should open a confirmation before destroying anything —
 * the shell never confirms on the screen's behalf.
 */
data class RowDestructiveAction(
    val label: String,
    /** UI-test anchor; mirror the iOS `accessibilityIdentifier(…)` string. */
    val testTag: String? = null,
    val onClick: () -> Unit,
)

// MARK: - Body emphasis

/**
 * Render emphasis for the `body` field on a row. Default `Secondary`
 * matches Notifications V2 (small dim text below the title); `Primary`
 * renders the body as the row's headline content (My posts).
 */
enum class RowBodyEmphasis {
    /** 12sp caption, secondary text colour (default — Notifications V2). */
    Secondary,

    /** 14sp small, primary text colour (My posts). */
    Primary,
}

// MARK: - Highlight

/** Optional visual highlight wrapping the whole card. */
sealed interface RowHighlight {
    /** Notification unread row — primary25 background + personalBg border + dot. */
    data object Unread : RowHighlight

    /** Listing-offer "LEADING" row — amber border + badge. */
    data object Leading : RowHighlight

    /** My-posts archived row — 0.78 opacity. */
    data object Archived : RowHighlight

    /**
     * Terminal / non-actionable row — 0.78 opacity. Used by My bids for
     * rejected / withdrawn / expired / task-cancelled rows so the user
     * can scan them at a glance without confusing them for live bids.
     * Same visual effect as [Archived] but semantically distinct so
     * other screens (Review claims, completed offers) can opt in
     * without overloading the "archived" intent.
     */
    data object Muted : RowHighlight
}

// MARK: - RowModel

/**
 * A single row. ViewModels map their DTOs into a list of these.
 *
 * **Backwards compat:** all T5 fields default to `null` / empty so every
 * existing call site compiles unchanged.
 */
data class RowModel(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val template: RowTemplate,
    val leading: RowLeading = RowLeading.None,
    val trailing: RowTrailing = RowTrailing.None,
    val onTap: () -> Unit = {},
    val onSecondary: (() -> Unit)? = null,
    // ─── T5 additions ──────────────────────────────────────────
    /** Multiline body rendered below the subtitle (notifications, my posts). */
    val body: String? = null,
    /**
     * Optional small icon prefix for the subtitle line. Used by Connections
     * (map-pin in front of locality).
     */
    val subtitleIcon: PantopusIcon? = null,
    /**
     * Optional small icon prefix for the body line. Used by Connections
     * (per-row interaction-type icon: message-circle / wrench / megaphone /
     * user-plus / sparkles).
     */
    val bodyIcon: PantopusIcon? = null,
    /**
     * Render emphasis for `body`. Default `Secondary` keeps the existing
     * Notifications V2 / Connections behaviour; `Primary` is used by My
     * posts where the body is the row's headline content.
     */
    val bodyEmphasis: RowBodyEmphasis = RowBodyEmphasis.Secondary,
    /** Chip rendered inline with the title (Pets species pill). */
    val inlineChip: RowChip? = null,
    /** Chip row beneath the body (intent / status / counter chips). */
    val chips: List<RowChip>? = null,
    /**
     * Chip row rendered as a header **above** the title/body, in the same
     * row as the kebab. Used by My posts; mutually compatible with [chips].
     */
    val headerChips: List<RowChip>? = null,
    /** Small far-right time text on the chip row. */
    val timeMeta: String? = null,
    /** Text appended after the chip row, separated with "·". */
    val metaTail: String? = null,
    /** Italic block quote rendered below the row body (offer notes). */
    val note: String? = null,
    /** Optional visual highlight wrapping the row. */
    val highlight: RowHighlight? = null,
    /** Optional in-card footer with 1–3 compact buttons. */
    val footer: RowFooter? = null,
    /** Optional hairline-separated engagement strip (My posts). */
    val engagement: RowEngagement? = null,
    /**
     * Optional bidder stack rendered inline on the chip line before
     * the [chips]. Used by My tasks V2 — 22dp overlapping avatars
     * with a `+N` overflow tile.
     */
    val bidderStack: BidderStackData? = null,
    /**
     * Optional split-payer stack rendered at the RIGHT EDGE of the
     * chip line. Used by Bills (T6.0a) when a bill is split between
     * household members — 18dp overlapping avatars + "Split N ways"
     * caption. Separate from [bidderStack] so the renderer can place
     * each in the correct slot (left for bidder, right for splits).
     */
    val splitWith: SplitStackData? = null,
    /**
     * T6.0b — small uppercase magic-violet text rendered ABOVE the
     * title, used by My tasks V2 when the gig was posted via Magic
     * Task (the AI-derived archetype name — e.g. "MOUNT & INSTALL",
     * "MOVING HELP", "DOG-WALK"). Renders as 10sp semibold with
     * +0.06em tracking and [PantopusColors.magic] foreground.
     *
     * Truncates with ellipsis at 24 characters so a long archetype
     * string can't push the title off-screen. Pass `null` to suppress
     * the overline entirely.
     */
    val archetypeOverline: String? = null,
    /**
     * Optional destructive row action (Notifications "Delete",
     * Connections "Remove"). Surfaced as a long-press dropdown by the
     * shell; iOS mirrors it with swipe + context menu.
     */
    val destructiveAction: RowDestructiveAction? = null,
)

// MARK: - Section

/** Rendering style for a [RowSection]. */
enum class SectionStyle {
    /** Default — matches T1–T4.1 behaviour (rows separated by spacing). */
    Flat,

    /**
     * Rows grouped inside a single rounded card with hairline dividers
     * between them. Used by Discover hub's typed sections.
     */
    Card,
}

/** Optional grouping for the list body. */
data class RowSection(
    val id: String,
    val header: String? = null,
    /**
     * A14.4 — optional 11.5sp secondary caption rendered **below** the
     * section (under the card for [SectionStyle.Card], under the rows for
     * [SectionStyle.Flat]). Mirrors `GroupedListGroup.helper` so a
     * single-card people list (Blocked users) can reaffirm the privacy
     * contract beneath the card.
     */
    val footer: String? = null,
    val rows: List<RowModel>,
    // ─── T5 additions ──────────────────────────────────────────
    val count: Int? = null,
    val onSeeAll: (() -> Unit)? = null,
    val style: SectionStyle = SectionStyle.Flat,
)
