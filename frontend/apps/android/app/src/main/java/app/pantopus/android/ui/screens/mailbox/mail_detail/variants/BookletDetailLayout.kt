@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.variants

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.BookletDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailKeyFact
import app.pantopus.android.ui.screens.mailbox.mail_detail.components.BookletPager
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentKind
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentsRowContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailItemDetailShell
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailOverflowItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarConfig
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.ceil

/** Dimmed opacity for a secondary tile whose action is in flight. */
private const val DISABLED_TILE_ALPHA = 0.6f

/**
 * T6.5c (P21) — Booklet (A17.2) variant layout. Mirrors iOS
 * `BookletDetailLayout`. Replaces the generic A17.1 body slot with
 * [BookletPager] (image pager + thumbnail grid) but keeps every other
 * shell slot the same shape.
 */
@Composable
fun BookletDetailLayout(
    content: MailDetailContent,
    booklet: BookletDetailDto,
    onBack: () -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    // T6.5e (P19.5) — Defaults to a no-op so existing call sites
    // compile unchanged.
    onSaveToVault: () -> Unit = {},
    // A17.2 — fetches the rendered booklet PDF
    // (`POST …/p2/booklet/:mailId/download`). RN reports the file size in
    // the confirmation (`src/app/mailbox/booklet.tsx:43`).
    onDownloadPdf: () -> Unit = {},
    // `true` while the PDF fetch is in flight — the tile disables so a
    // double-tap can't fire two downloads.
    downloadInFlight: Boolean = false,
) {
    Box(modifier = Modifier.testTag("mailDetail_booklet")) {
        MailItemDetailShell(
            topBar =
                makeTopBar(
                    content = content,
                    onBack = onBack,
                    onSaveToVault = onSaveToVault,
                    onDownloadPdf = onDownloadPdf,
                ),
            aiElf = makeAIElf(content = content, booklet = booklet),
            attachments = makeAttachments(content = content),
            hero = { HeroCard(content = content) },
            keyFacts = { KeyFactsCard(rows = makeBookletKeyFacts(content, booklet)) },
            body = {
                BookletPager(
                    pages = booklet.pages,
                    pageCount = booklet.pageCount,
                    ocrTexts = booklet.ocrTexts,
                )
            },
            sender = { SenderCard(content = content, onOpenProfile = onOpenSenderProfile) },
            actions = {
                ActionsRow(
                    onSaveToVault = onSaveToVault,
                    onDownloadPdf = onDownloadPdf,
                    downloadInFlight = downloadInFlight,
                )
            },
        )
    }
}

private fun makeTopBar(
    content: MailDetailContent,
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
    onDownloadPdf: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = content.category.label,
        trust = content.detailTrust,
        onBack = onBack,
        trailingAction = null,
        overflowItems =
            listOf(
                MailOverflowItem("share", PantopusIcon.Share, "Share") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("download", PantopusIcon.Download, "Save PDF") { onDownloadPdf() },
                MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
                MailOverflowItem(
                    id = "delete",
                    icon = PantopusIcon.Trash2,
                    label = "Delete",
                    isDestructive = true,
                ) {},
            ),
    )

private fun makeAIElf(
    content: MailDetailContent,
    booklet: BookletDetailDto,
): AIElfStripContent? {
    val summary = content.aiSummary?.takeIf { it.isNotEmpty() } ?: return null
    val readMinutes =
        if (booklet.pageCount > 0) {
            ceil(booklet.pageCount / 3.0).toInt().coerceAtLeast(1)
        } else {
            null
        }
    return AIElfStripContent(
        headline = "Pantopus read the whole booklet",
        summary = summary,
        trailingBadge = readMinutes?.let { "$it min" },
    )
}

private fun makeAttachments(content: MailDetailContent): AttachmentsRowContent? {
    if (content.attachments.isEmpty()) return null
    val items =
        content.attachments.mapIndexed { index, name ->
            AttachmentItem(id = "att-$index", kind = AttachmentKind.Pdf, name = name)
        }
    return AttachmentsRowContent(title = "Source files", items = items)
}

private fun makeBookletKeyFacts(
    content: MailDetailContent,
    booklet: BookletDetailDto,
): List<MailDetailKeyFact> =
    buildList {
        if (booklet.pageCount > 0) {
            add(
                MailDetailKeyFact(
                    icon = PantopusIcon.FileType,
                    label = "Pages",
                    value = "${booklet.pageCount}",
                ),
            )
        }
        content.createdAtLabel?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Calendar, label = "Received", value = it))
        }
        content.senderMeta?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Briefcase, label = "From", value = it))
        }
    }

// ─── Shared subviews (kept local — same shape as the generic layout) ─

@Composable
private fun HeroCard(content: MailDetailContent) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Box(
            modifier =
                Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(content.category.accent),
        )
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CategoryBadge(category = content.category)
                Spacer(Modifier.weight(1f))
                content.createdAtLabel?.let { received ->
                    Text(text = received, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                }
            }
            Text(
                text = content.senderDisplayName.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = content.title,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                lineHeight = 24.sp,
            )
            content.excerpt?.takeIf { it.isNotEmpty() }?.let { excerpt ->
                Text(
                    text = excerpt,
                    fontSize = 13.sp,
                    color = PantopusColors.appTextStrong,
                    lineHeight = 19.sp,
                )
            }
        }
    }
}

@Composable
private fun CategoryBadge(category: MailItemCategory) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(category.rowBackground)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = category.icon,
            contentDescription = null,
            size = 11.dp,
            tint = category.accent,
        )
        Text(
            text = category.label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            color = category.accent,
        )
    }
}

@Composable
private fun KeyFactsCard(rows: List<MailDetailKeyFact>) {
    if (rows.isEmpty()) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Text(
            text = "KEY FACTS",
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        rows.forEachIndexed { index, row ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(24.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = row.icon,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.appTextStrong,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        text = row.label.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.4.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = row.value,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
            }
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun SenderCard(
    content: MailDetailContent,
    onOpenProfile: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "SENDER",
            modifier = Modifier.semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = content.senderUserId != null) {
                        content.senderUserId?.let(onOpenProfile)
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(content.category.accent),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = content.senderInitials,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = content.senderDisplayName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                content.senderMeta?.let {
                    Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                }
            }
            if (content.senderUserId != null) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun ActionsRow(
    onSaveToVault: () -> Unit,
    onDownloadPdf: () -> Unit,
    downloadInFlight: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(PantopusColors.primary600)
                    .clickable { onSaveToVault() }
                    .padding(vertical = 14.dp)
                    .testTag("mailDetail_booklet_saveToVault")
                    .semantics { contentDescription = "Save to Vault" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Archive,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextInverse,
            )
            Spacer(Modifier.width(Spacing.s2))
            Text(
                text = "Save to Vault",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SecondaryTile(icon = PantopusIcon.Share, label = "Share", modifier = Modifier.weight(1f))
            SecondaryTile(
                icon = PantopusIcon.Download,
                label = "PDF",
                modifier = Modifier.weight(1f).testTag("mailDetail_booklet_downloadPdf"),
                enabled = !downloadInFlight,
                onClick = onDownloadPdf,
            )
            SecondaryTile(
                icon = PantopusIcon.Archive,
                label = "Archive",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SecondaryTile(
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(enabled = enabled) { onClick() }
                .alpha(if (enabled) 1f else DISABLED_TILE_ALPHA)
                .padding(vertical = 10.dp)
                .semantics { contentDescription = label },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}
