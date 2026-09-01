@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.shared.mail_item_detail

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.5a (P19) — Typed slot payloads for the A17 Mailbox item detail
 * archetype shell. The shell at [MailItemDetailShell] accepts these as
 * constructor inputs; variants (Generic, Booklet, Certified, Community,
 * Ceremonial) build the payloads and hand them in.
 *
 * Slots in render order:
 *   1. Top nav bar          (required — [MailTopBarConfig])
 *   2. Hero card            (generic `@Composable () -> Unit`)
 *   3. AI elf strip         (optional — [AIElfStripContent])
 *   4. Key facts panel      (generic `@Composable () -> Unit`)
 *   5. Body card            (generic `@Composable () -> Unit`)
 *   6. Attachments row      (optional — [AttachmentsRowContent])
 *   7. Sender card          (generic `@Composable () -> Unit`)
 *   8. Action buttons       (sticky bottom — generic `@Composable () -> Unit`)
 */

// MARK: - Top bar

/** Trust level for the eyebrow dot on the top bar. */
enum class MailDetailTrust {
    /** Verified sender — emerald dot. */
    Verified,

    /** Neutral — slate dot. */
    Neutral,

    /** Warning — amber dot. */
    Warning,

    /** Celebration / personal-invite — rose dot (A17.9 Party variant). */
    Celebration,
    ;

    val dotColor: Color
        get() =
            when (this) {
                Verified -> PantopusColors.success
                Neutral -> PantopusColors.appTextSecondary
                Warning -> PantopusColors.warning
                Celebration -> PantopusColors.categoryParty
            }
}

/**
 * One row in the overflow menu (Forward / Archive / Mark unread /
 * Delete / Report). Variants add or drop items as the design specs.
 */
@Immutable
data class MailOverflowItem(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val isDestructive: Boolean = false,
    val onClick: () -> Unit,
)

/**
 * Trailing top-bar action that sits left of the overflow menu — used by
 * the design's bookmark / pin / save affordance on certain variants.
 */
@Immutable
data class MailTopBarTrailingAction(
    val icon: PantopusIcon,
    val contentDescription: String,
    val isActive: Boolean = false,
    val onClick: () -> Unit,
)

/** Required configuration for the top nav bar. */
@Immutable
data class MailTopBarConfig(
    /** Eyebrow label sandwiched between back button + actions. */
    val eyebrow: String?,
    val trust: MailDetailTrust,
    /** "Back" callback. `null` hides the leading chevron. */
    val onBack: (() -> Unit)? = null,
    val trailingAction: MailTopBarTrailingAction? = null,
    val overflowItems: List<MailOverflowItem> = emptyList(),
)

// MARK: - AI elf strip

/** One bullet in the AI elf summary. */
@Immutable
data class AIElfBullet(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val text: String? = null,
)

/**
 * Sparkles-headed extracted-info strip. Per `mail-detail.jsx:137`,
 * rendered as a sky-tinted gradient card with a sparkles disc +
 * headline + summary paragraph + bullet list, plus an optional trailing
 * badge (e.g. "2 min summary").
 */
@Immutable
data class AIElfStripContent(
    /** Bold sentence at the top of the card. */
    val headline: String = "Pantopus read this for you",
    val summary: String,
    val bullets: List<AIElfBullet> = emptyList(),
    val trailingBadge: String? = null,
    /** Optional refresh / redo handler — `null` hides the affordance. */
    val onRedo: (() -> Unit)? = null,
)

// MARK: - Attachments

/** File kind drives the 36×44dp thumbnail tile color + glyph. */
enum class AttachmentKind {
    Pdf,
    Image,
    Video,
    Audio,
    Link,
    Other,
}

/** One row in the attachments list. */
@Immutable
data class AttachmentItem(
    val id: String,
    val kind: AttachmentKind,
    val name: String,
    val meta: String? = null,
    val onClick: () -> Unit = {},
)

/** Attachments section payload. */
@Immutable
data class AttachmentsRowContent(
    val title: String = "Attachments",
    val items: List<AttachmentItem>,
)
