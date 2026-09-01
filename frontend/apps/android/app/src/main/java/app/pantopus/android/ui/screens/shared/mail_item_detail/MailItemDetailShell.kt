@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "TooManyFunctions",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.shared.mail_item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the shell root. Mirrors iOS `mailItemDetailShell`. */
const val MAIL_ITEM_DETAIL_TAG = "mailItemDetailShell"

/**
 * T6.5a (P19) — A17 Mailbox item detail archetype shell. Mirror of
 * the iOS [`MailItemDetailShell`] at
 * `Features/Shared/MailItemDetail/MailItemDetailShell.swift`. P20–P23
 * will compose every variant (Generic, Booklet, Certified, Community,
 * Ceremonial) on top of this.
 *
 * Anatomy (top → bottom):
 *   1. Top nav bar           (required — [MailTopBarConfig])
 *   2. Hero card slot        (generic `@Composable`)
 *   3. AI elf strip          (optional — [AIElfStripContent])
 *   4. Key facts slot        (generic `@Composable`)
 *   5. Body slot             (generic `@Composable`)
 *   6. Attachments row       (optional — [AttachmentsRowContent])
 *   7. Sender slot           (generic `@Composable`)
 *   8. Action buttons slot   (generic `@Composable` — pinned at the bottom)
 *
 * The shell owns:
 *  - top bar layout + back chevron + eyebrow trust dot + overflow menu
 *  - vertical spacing + horizontal padding for the scroll body
 *  - AI elf strip render (sky gradient + sparkles disc + bullets)
 *  - attachments list render (PDF / image / video / link tiles)
 *  - sticky action buttons shelf above the system tab bar
 *
 * Every variant-specific design — hero gradient, key-facts panel, body
 * card, sender card — lives in the variant feature folder.
 */
@Composable
@Suppress("ModifierMissing") // Shell is self-styling; caller passes nothing.
fun MailItemDetailShell(
    topBar: MailTopBarConfig,
    hero: @Composable () -> Unit,
    aiElf: AIElfStripContent? = null,
    keyFacts: @Composable () -> Unit = {},
    body: @Composable () -> Unit = {},
    attachments: AttachmentsRowContent? = null,
    sender: @Composable () -> Unit = {},
    actions: (@Composable () -> Unit)? = null,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(MAIL_ITEM_DETAIL_TAG),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            MailItemDetailTopBar(config = topBar)
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(modifier = Modifier.testTag("mailItemDetail_hero")) { hero() }
                if (aiElf != null) {
                    AIElfStripView(content = aiElf)
                }
                Box(modifier = Modifier.testTag("mailItemDetail_keyFacts")) { keyFacts() }
                Box(modifier = Modifier.testTag("mailItemDetail_body")) { body() }
                if (attachments != null) {
                    AttachmentsRowView(content = attachments)
                }
                Box(modifier = Modifier.testTag("mailItemDetail_sender")) { sender() }
                // Leave room for the sticky actions shelf.
                if (actions != null) {
                    Spacer(Modifier.height(96.dp))
                } else {
                    Spacer(Modifier.height(Spacing.s4))
                }
            }
        }
        if (actions != null) {
            Column(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(PantopusColors.appSurface)
                        .testTag("mailItemDetail_actions"),
            ) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                ) {
                    actions()
                }
            }
        }
    }
}

// ─── Top bar ──────────────────────────────────────────────────

/**
 * 44dp nav bar — back chevron (with optional "Mailbox" label) + eyebrow
 * trust dot + optional bookmark/pin action + overflow menu. Mirrors
 * `mail-detail.jsx:7-39`.
 */
@Composable
fun MailItemDetailTopBar(config: MailTopBarConfig) {
    Column(modifier = Modifier.testTag("mailItemDetail_topBar")) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .height(44.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TopBarBackButton(onBack = config.onBack)
            Spacer(Modifier.weight(1f))
            TopBarEyebrow(eyebrow = config.eyebrow, trust = config.trust)
            Spacer(Modifier.weight(1f))
            TopBarTrailingCluster(
                trailingAction = config.trailingAction,
                overflowItems = config.overflowItems,
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
    }
}

@Composable
private fun TopBarBackButton(onBack: (() -> Unit)?) {
    if (onBack != null) {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .clickable(onClick = onBack)
                    .padding(horizontal = Spacing.s1, vertical = 6.dp)
                    .testTag("mailItemDetail_back")
                    .semantics { contentDescription = "Back to Mailbox" },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Mailbox",
                fontSize = 15.sp,
                color = PantopusColors.primary600,
            )
        }
    } else {
        Spacer(Modifier.size(44.dp))
    }
}

@Composable
private fun TopBarEyebrow(
    eyebrow: String?,
    trust: MailDetailTrust,
) {
    if (eyebrow != null) {
        Row(
            modifier =
                Modifier
                    .testTag("mailItemDetail_eyebrow")
                    .semantics { heading() },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(trust.dotColor),
            )
            Text(
                text = eyebrow.uppercase(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun TopBarTrailingCluster(
    trailingAction: MailTopBarTrailingAction?,
    overflowItems: List<MailOverflowItem>,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (trailingAction != null) {
            val bg =
                if (trailingAction.isActive) PantopusColors.primary100 else PantopusColors.appSurfaceSunken
            val fg =
                if (trailingAction.isActive) PantopusColors.primary600 else PantopusColors.appTextStrong
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(bg)
                        .clickable(onClick = trailingAction.onClick)
                        .testTag("mailItemDetail_trailingAction")
                        .semantics { contentDescription = trailingAction.contentDescription },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = trailingAction.icon,
                    contentDescription = null,
                    size = 18.dp,
                    tint = fg,
                )
            }
        }
        if (overflowItems.isNotEmpty()) {
            OverflowMenu(items = overflowItems)
        }
    }
}

@Composable
private fun OverflowMenu(items: List<MailOverflowItem>) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .clickable { expanded = true }
                    .testTag("mailItemDetail_overflow")
                    .semantics { contentDescription = "More actions" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextStrong,
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            items.forEach { item ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = item.label,
                            color =
                                if (item.isDestructive) {
                                    PantopusColors.error
                                } else {
                                    PantopusColors.appText
                                },
                        )
                    },
                    leadingIcon = {
                        PantopusIconImage(
                            icon = item.icon,
                            contentDescription = null,
                            size = Radii.xl,
                            tint =
                                if (item.isDestructive) {
                                    PantopusColors.error
                                } else {
                                    PantopusColors.appTextStrong
                                },
                        )
                    },
                    onClick = {
                        expanded = false
                        item.onClick()
                    },
                    modifier = Modifier.testTag("mailItemDetail_overflowItem_${item.id}"),
                )
            }
        }
    }
}

// ─── AI elf strip ─────────────────────────────────────────────

/**
 * Sky-gradient extracted-info card. Renders [AIElfStripContent] per the
 * `ElfStrip` block in `mail-detail.jsx:137-198`.
 */
@Composable
fun AIElfStripView(content: AIElfStripContent) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(PantopusColors.primary50, PantopusColors.primary100),
                    ),
                )
                .border(
                    width = 1.dp,
                    color = PantopusColors.primary100,
                    shape = RoundedCornerShape(Radii.xl),
                )
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("mailItemDetail_aiElf"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text(
                text = content.headline,
                modifier = Modifier.weight(1f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary800,
            )
            if (content.trailingBadge != null) {
                Text(
                    text = content.trailingBadge,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .border(
                                width = 1.dp,
                                color = PantopusColors.primary100,
                                shape = RoundedCornerShape(Radii.pill),
                            )
                            .background(PantopusColors.appSurface)
                            .padding(horizontal = Spacing.s2, vertical = 2.dp)
                            .testTag("mailItemDetail_aiElfBadge"),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
            }
            if (content.onRedo != null) {
                Row(
                    modifier =
                        Modifier
                            .clickable(onClick = content.onRedo)
                            .padding(horizontal = Spacing.s1, vertical = 2.dp)
                            .testTag("mailItemDetail_aiElfRedo"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ArrowsRepeat,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.primary700,
                    )
                    Text(
                        text = "Redo",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary700,
                    )
                }
            }
        }
        Text(
            text = content.summary,
            fontSize = 13.sp,
            color = PantopusColors.primary900,
            lineHeight = 20.sp,
        )
        if (content.bullets.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                content.bullets.forEach { bullet -> AIElfBulletRow(bullet = bullet) }
            }
        }
    }
}

@Composable
private fun AIElfBulletRow(bullet: AIElfBullet) {
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .padding(top = 1.dp)
                    .size(16.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = PantopusColors.primary100,
                        shape = RoundedCornerShape(Radii.xs),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = bullet.icon,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.primary700,
            )
        }
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(bullet.label)
                    }
                    bullet.text?.let { text ->
                        withStyle(SpanStyle(color = PantopusColors.appTextStrong)) {
                            append(" — $text")
                        }
                    }
                },
            fontSize = 12.sp,
            color = PantopusColors.appText,
        )
    }
}

// ─── Attachments row ──────────────────────────────────────────

/**
 * Section-card render for [AttachmentsRowContent]. Per
 * `mail-detail.jsx:289`, each row is a 36×44dp type-color tile + name +
 * meta + 32dp download button.
 */
@Composable
fun AttachmentsRowView(content: AttachmentsRowContent) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.xl),
                )
                .testTag("mailItemDetail_attachments"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .semantics { heading() },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = content.title.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "· ${content.items.size}",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextMuted,
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        content.items.forEachIndexed { index, item ->
            AttachmentRowItem(item = item)
            if (index < content.items.size - 1) {
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    modifier = Modifier.padding(start = 60.dp),
                )
            }
        }
    }
}

@Composable
private fun AttachmentRowItem(item: AttachmentItem) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = item.onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("mailItemDetail_attachment_${item.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        AttachmentTile(kind = item.kind)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = item.name,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            if (item.meta != null) {
                Text(
                    text = item.meta,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Download,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun AttachmentTile(kind: AttachmentKind) {
    val tokens = AttachmentTileTokens.tokens(kind)
    Box(
        modifier =
            Modifier
                .size(width = 36.dp, height = 44.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(tokens.background)
                .border(
                    width = 1.dp,
                    color = tokens.border,
                    shape = RoundedCornerShape(Radii.sm),
                ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = tokens.label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            color = tokens.foreground,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
        )
    }
}

/**
 * Per-kind tile colors. Documented per-feature palette exception so the
 * shell file is the only place these hex literals appear in screen code.
 */
private object AttachmentTileTokens {
    data class Tokens(
        val label: String,
        val background: Color,
        val foreground: Color,
        val border: Color,
    )

    fun tokens(kind: AttachmentKind): Tokens =
        when (kind) {
            // CSS fee2e2 / b91c1c / fecaca
            AttachmentKind.Pdf ->
                Tokens(
                    label = "PDF",
                    background = Color(0xFFFEE2E2),
                    foreground = Color(0xFFB91C1C),
                    border = Color(0xFFFECACA),
                )
            // CSS dbeafe / 1d4ed8 / bfdbfe
            AttachmentKind.Image ->
                Tokens(
                    label = "IMG",
                    background = Color(0xFFDBEAFE),
                    foreground = Color(0xFF1D4ED8),
                    border = Color(0xFFBFDBFE),
                )
            // CSS fce7f3 / be185d / fbcfe8
            AttachmentKind.Video ->
                Tokens(
                    label = "VID",
                    background = Color(0xFFFCE7F3),
                    foreground = Color(0xFFBE185D),
                    border = Color(0xFFFBCFE8),
                )
            // CSS ede9fe / 6d28d9 / ddd6fe
            AttachmentKind.Audio ->
                Tokens(
                    label = "AUD",
                    background = Color(0xFFEDE9FE),
                    foreground = Color(0xFF6D28D9),
                    border = Color(0xFFDDD6FE),
                )
            // CSS f3f4f6 / 374151 / e5e7eb
            AttachmentKind.Link ->
                Tokens(
                    label = "URL",
                    background = Color(0xFFF3F4F6),
                    foreground = Color(0xFF374151),
                    border = Color(0xFFE5E7EB),
                )
            AttachmentKind.Other ->
                Tokens(
                    label = "FILE",
                    background = Color(0xFFF3F4F6),
                    foreground = Color(0xFF374151),
                    border = Color(0xFFE5E7EB),
                )
        }
}
