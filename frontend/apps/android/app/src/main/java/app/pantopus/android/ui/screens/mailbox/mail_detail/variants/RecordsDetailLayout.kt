@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "ComplexMethod",
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.RecordsDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.RecordsElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.RecordsFact
import app.pantopus.android.ui.components.PaperStack
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.RecordsBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.IssuerCard
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailItemDetailShell
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailOverflowItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarConfig
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarTrailingAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.10 — Records ceremonial variant of the mail item detail. Mirrors
 * iOS `RecordsDetailLayout`. The hero embeds a multi-page [PaperStack]
 * (P1.1) with the institution letterhead overlay; the body slot is the
 * cover-letter excerpt + vault breadcrumb (+ related strip once filed);
 * the sender slot is the bespoke [IssuerCard]. Actions are "File in
 * Vault" (open) → retention banner + PDF/Share/JSON tiles (filed).
 */
@Composable
fun RecordsDetailLayout(
    content: MailDetailContent,
    records: RecordsDetailDto,
    fileInFlight: Boolean,
    onBack: () -> Unit,
    onFileInVault: () -> Unit,
    onSaveToVault: () -> Unit = {},
) {
    Box(modifier = Modifier.testTag("mailDetail_records")) {
        MailItemDetailShell(
            topBar = makeTopBar(onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(records = records),
            hero = { RecordsHeroCard(content = content, records = records) },
            keyFacts = { RecordsKeyFactsCard(rows = records.factsForState(records.isFiled)) },
            body = { RecordsBody(records = records) },
            sender = { IssuerCard(issuer = records.issuer) },
            actions = {
                RecordsActions(
                    isFiled = records.isFiled,
                    inFlight = fileInFlight,
                    onFileInVault = onFileInVault,
                    onSaveToVault = onSaveToVault,
                )
            },
        )
    }
}

private fun makeTopBar(
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        // Slate dot eyebrow — neutral is the archival/institutional tone.
        eyebrow = "Records",
        trust = MailDetailTrust.Neutral,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Download,
                contentDescription = "Download PDF",
                onClick = {},
            ),
        overflowItems =
            listOf(
                MailOverflowItem("openPDF", PantopusIcon.FileText, "Open PDF") {},
                MailOverflowItem("downloadJSON", PantopusIcon.Download, "Download JSON") {},
                MailOverflowItem("share", PantopusIcon.Share, "Share copy") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("dispute", PantopusIcon.Flag, "Dispute") {},
                MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
            ),
    )

private fun makeAIElf(records: RecordsDetailDto): AIElfStripContent {
    val elf = if (records.isFiled) records.elfFiled else records.elfOpen
    return AIElfStripContent(
        headline = elf.headline,
        summary = elf.summary,
        bullets =
            elf.bullets.mapIndexed { index, bullet ->
                AIElfBullet(
                    id = "records-elf-$index",
                    icon = elfGlyph(bullet.glyph),
                    label = bullet.label,
                    text = bullet.text,
                )
            },
    )
}

private fun elfGlyph(glyph: RecordsElfBullet.Glyph): PantopusIcon =
    when (glyph) {
        RecordsElfBullet.Glyph.FileCheck -> PantopusIcon.CheckCircle
        RecordsElfBullet.Glyph.TrendingUp -> PantopusIcon.TrendingUp
        RecordsElfBullet.Glyph.Archive -> PantopusIcon.Archive
        RecordsElfBullet.Glyph.Lock -> PantopusIcon.Lock
        RecordsElfBullet.Glyph.CalendarClock -> PantopusIcon.CalendarClock
        RecordsElfBullet.Glyph.Search -> PantopusIcon.Search
    }

// MARK: - Hero

@Composable
private fun RecordsHeroCard(
    content: MailDetailContent,
    records: RecordsDetailDto,
) {
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
                    .background(PantopusColors.categoryRecords),
        )
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ClassChip(label = records.docClassLabel)
                Spacer(Modifier.weight(1f))
                content.createdAtLabel?.let {
                    Text(text = it, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
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
                text = records.title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                lineHeight = 23.sp,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = records.reference,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
                lineHeight = 15.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
            PaperStackPreview(records = records)
            if (records.isFiled) {
                FiledStamp(filedAtLabel = records.filedAtLabel)
            }
        }
    }
}

@Composable
private fun ClassChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.categoryRecordsBg)
                .border(1.dp, PantopusColors.categoryRecordsBorder, RoundedCornerShape(Radii.xs))
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FileText,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.categoryRecordsDeep,
        )
        Text(
            text = label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.4.sp,
            color = PantopusColors.categoryRecordsDeep,
        )
    }
}

@Composable
private fun PaperStackPreview(records: RecordsDetailDto) {
    // PaperStack is a fixed 320×384 primitive. `graphicsLayer` scaling
    // only transforms drawing (not layout), so we center the 320×384
    // element inside a 176×211 (= 320·0.55 × 384·0.55) band and clip:
    // the centered, center-scaled drawing fills the band exactly. Mirror
    // of the iOS `scaleEffect(0.55).frame(176×211).clipped()` approach.
    Box(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(modifier = Modifier.size(width = 176.dp, height = 211.dp)) {
            Box(
                modifier = Modifier.fillMaxSize().clip(RectangleShape),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier =
                        Modifier.graphicsLayer {
                            scaleX = 0.55f
                            scaleY = 0.55f
                        },
                ) {
                    PaperStack {
                        Letterhead(records = records)
                    }
                }
            }
            PageCountChip(pageCount = records.pageCount, modifier = Modifier.align(Alignment.TopEnd))
        }
    }
}

@Composable
private fun PageCountChip(
    pageCount: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .padding(top = Spacing.s2, end = Spacing.s2)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.categoryRecordsDeep)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.FileText,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "$pageCount PAGES · PDF",
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.4.sp,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun Letterhead(records: RecordsDetailDto) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.categoryRecordsDeep),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = records.issuer.initials,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.4.sp,
                    color = PantopusColors.appTextInverse,
                )
            }
            Column {
                Text(
                    text = records.issuer.name.uppercase(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.2.sp,
                    color = PantopusColors.categoryRecordsDeep,
                    maxLines = 1,
                )
                Text(
                    text = "RETIREMENT SERVICES",
                    fontSize = 6.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "STATEMENT",
                    fontSize = 7.sp,
                    letterSpacing = 0.4.sp,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Q1 2026",
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = PantopusColors.categoryRecordsDeep,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.5.dp)
                    .background(PantopusColors.categoryRecordsDeep),
        )
        Spacer(Modifier.weight(1f))
        HorizontalDivider(color = PantopusColors.appBorder)
        Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
            Text(
                text = "ACCT ····4421",
                fontSize = 7.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = "$84,237.16",
                fontSize = 7.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.categoryRecordsDeep,
            )
        }
    }
}

@Composable
private fun FiledStamp(filedAtLabel: String?) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .testTag("mailDetail_records_filedStamp"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(20.dp).clip(CircleShape).background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Filed in Vault") }
                    if (!filedAtLabel.isNullOrEmpty()) append(" · $filedAtLabel")
                },
            fontSize = 12.sp,
            color = PantopusColors.success,
        )
    }
}

// MARK: - Key facts

@Composable
private fun RecordsKeyFactsCard(rows: List<RecordsFact>) {
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
            FactRow(row = row)
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun FactRow(row: RecordsFact) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (row.emphasis) PantopusColors.categoryRecordsBg else PantopusColors.appSurface)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.categoryRecordsBorder, RoundedCornerShape(Radii.sm)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = factIcon(row.kind),
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.categoryRecordsDeep,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = row.label.uppercase(),
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = row.value,
                fontSize = if (row.emphasis) 17.sp else 14.sp,
                fontWeight = if (row.emphasis) FontWeight.ExtraBold else FontWeight.Bold,
                fontFamily = if (row.mono) FontFamily.Monospace else FontFamily.Default,
                color = valueColor(row),
            )
            row.note?.let {
                Text(text = it, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)
            }
        }
        if (row.tone == RecordsFact.Tone.Positive && row.emphasis && row.kind == RecordsFact.Kind.Change) {
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.successBg)
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.TrendingUp,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.success,
                )
            }
        }
    }
}

private fun valueColor(row: RecordsFact) =
    when (row.tone) {
        RecordsFact.Tone.Positive -> PantopusColors.success
        RecordsFact.Tone.Neutral -> PantopusColors.appText
    }

private fun factIcon(kind: RecordsFact.Kind): PantopusIcon =
    when (kind) {
        RecordsFact.Kind.Account -> PantopusIcon.Hash
        RecordsFact.Kind.Period -> PantopusIcon.CalendarDays
        RecordsFact.Kind.Balance -> PantopusIcon.DollarSign
        RecordsFact.Kind.Change -> PantopusIcon.TrendingUp
        RecordsFact.Kind.StatementDate -> PantopusIcon.CalendarClock
        RecordsFact.Kind.Status -> PantopusIcon.CheckCircle
    }

// MARK: - Actions

@Composable
private fun RecordsActions(
    isFiled: Boolean,
    inFlight: Boolean,
    onFileInVault: () -> Unit,
    onSaveToVault: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (isFiled) {
            RetentionBanner()
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SecondaryTile("openPDF", PantopusIcon.FileText, "Open PDF", modifier = Modifier.weight(1f))
                SecondaryTile("share", PantopusIcon.Share, "Share", modifier = Modifier.weight(1f))
                SecondaryTile("downloadJSON", PantopusIcon.Download, "JSON", modifier = Modifier.weight(1f))
            }
        } else {
            FileInVaultButton(inFlight = inFlight, onClick = onFileInVault)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                SecondaryTile("downloadPDF", PantopusIcon.Download, "Download PDF", modifier = Modifier.weight(1f))
                SecondaryTile(
                    "chooseFolder",
                    PantopusIcon.Archive,
                    "Choose folder",
                    onClick = onSaveToVault,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun FileInVaultButton(
    inFlight: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.categoryRecordsDeep)
                .clickable(enabled = !inFlight, onClick = onClick)
                .padding(vertical = 14.dp)
                .alpha(if (inFlight) 0.6f else 1f)
                .semantics { contentDescription = "File in Vault" }
                .testTag("mailDetail_records_fileInVault"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Archive,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "File in Vault",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun RetentionBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("mailDetail_records_retentionBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarClock,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            text = "Stored for 7 years · auto-delete prompt Apr 2033",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun SecondaryTile(
    id: String,
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = 10.dp)
                .semantics { contentDescription = label }
                .testTag("mailDetail_records_action_$id"),
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
