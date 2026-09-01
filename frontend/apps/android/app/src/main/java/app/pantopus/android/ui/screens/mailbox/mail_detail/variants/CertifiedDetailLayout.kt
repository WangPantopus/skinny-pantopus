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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedConfirmGate
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedTermsSheet
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedTermsSummaryCard
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.components.CertifiedStampBadge
import app.pantopus.android.ui.screens.mailbox.mail_detail.components.CombinedSenderCarrierCard
import app.pantopus.android.ui.screens.mailbox.mail_detail.components.MailCarrierInfo
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentKind
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentsRowContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.ChainOfCustodyEvent
import app.pantopus.android.ui.screens.shared.mail_item_detail.ChainOfCustodyStatus
import app.pantopus.android.ui.screens.shared.mail_item_detail.ChainOfCustodyTimeline
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
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/** Dimmed opacity for a secondary tile whose action is in flight. */
private const val DISABLED_TILE_ALPHA = 0.6f

/**
 * T6.5c (P21) — Certified (A17.3) variant layout. Adds the stamp +
 * chain-of-custody timeline + combined sender/carrier card on top of
 * the shared shell. Mirrors iOS `CertifiedDetailLayout`.
 */
@Composable
fun CertifiedDetailLayout(
    content: MailDetailContent,
    certified: CertifiedDetailDto,
    ackInFlight: Boolean,
    onBack: () -> Unit,
    onAcknowledge: () -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    // T6.5e (P19.5) — Defaults to a no-op so existing call sites
    // compile unchanged.
    onSaveToVault: () -> Unit = {},
    // A17.12 — opens the Elf-extracted task Pantopus made from this
    // certified notice. Null hides the affordance (e.g. snapshot
    // fixtures), so existing call sites compile unchanged.
    onOpenExtractedTask: (() -> Unit)? = null,
    // A17.3 — fetches the legal delivery proof
    // (`GET …/p2/certified/:mailId/proof`). RN only offers this once the
    // item is acknowledged (`src/app/mailbox/certified.tsx:200`), which
    // matches the route's own 400 gate.
    onDownloadProof: () -> Unit = {},
    // `true` once the proof has been fetched — the tile flips to "Saved"
    // (RN's `✓ Saved`).
    proofSaved: Boolean = false,
    // `true` while the proof fetch is in flight.
    proofInFlight: Boolean = false,
) {
    val shouldShowConfirmGate =
        content.readStatusLabel.lowercase() == "unread" &&
            !content.isAcknowledged &&
            !content.isArchived
    var showsConfirmGate by remember(content.mailId) { mutableStateOf(shouldShowConfirmGate) }
    var didAutoPresentConfirmGate by remember(content.mailId) { mutableStateOf(shouldShowConfirmGate) }
    var showsTermsSheet by remember { mutableStateOf(false) }
    LaunchedEffect(shouldShowConfirmGate) {
        if (shouldShowConfirmGate && !didAutoPresentConfirmGate) {
            didAutoPresentConfirmGate = true
            showsConfirmGate = true
        }
    }
    Box(modifier = Modifier.testTag("mailDetail_certified")) {
        MailItemDetailShell(
            topBar = makeTopBar(onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(content = content),
            attachments = makeAttachments(content = content),
            hero = { HeroCard(content = content, certified = certified) },
            keyFacts = { CertifiedKeyFactsCard(rows = makeKeyFacts(content, certified)) },
            body = {
                ChainOfCustodyTimeline(
                    events = makeChainEvents(certified),
                    subtitle = "Postal scans · cryptographic receipts",
                    status = chainStatus(certified),
                )
            },
            sender = {
                SenderAndNotice(
                    content = content,
                    certified = certified,
                    onOpenSenderProfile = onOpenSenderProfile,
                    onViewTerms = { showsTermsSheet = true },
                    onOpenExtractedTask = onOpenExtractedTask,
                )
            },
            actions = {
                ActionsRow(
                    isAcknowledged = content.isAcknowledged,
                    isArchived = content.isArchived,
                    ackInFlight = ackInFlight,
                    onAcknowledge = {
                        if (shouldShowConfirmGate) {
                            showsConfirmGate = true
                        } else {
                            onAcknowledge()
                        }
                    },
                    onDownloadProof = onDownloadProof,
                    proofSaved = proofSaved,
                    proofInFlight = proofInFlight,
                )
            },
        )
        if (showsConfirmGate) {
            CertifiedConfirmGate(
                senderName = content.senderDisplayName,
                referenceNumber = certified.referenceNumber,
                deadlineLabel = certified.acknowledgeBy?.let(::formatLongDate),
                isSigning = ackInFlight,
                onReviewFirst = { showsConfirmGate = false },
                onSign = {
                    showsConfirmGate = false
                    onAcknowledge()
                },
            )
        }
        if (showsTermsSheet && !certified.termsUrl.isNullOrEmpty()) {
            CertifiedTermsSheet(
                termsUrl = certified.termsUrl,
                onDismiss = { showsTermsSheet = false },
            )
        }
    }
}

// ─── Top bar / AI elf / attachments ──────────────────────────

private fun makeTopBar(
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = "Certified mail",
        trust = MailDetailTrust.Verified,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save to vault",
            ) { onSaveToVault() },
        overflowItems =
            listOf(
                MailOverflowItem("forward", PantopusIcon.Send, "Forward") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
                MailOverflowItem("report", PantopusIcon.Info, "Report") {},
                MailOverflowItem(
                    id = "delete",
                    icon = PantopusIcon.Trash2,
                    label = "Delete",
                    isDestructive = true,
                ) {},
            ),
    )

private fun makeAIElf(content: MailDetailContent): AIElfStripContent? {
    val summary = content.aiSummary?.takeIf { it.isNotEmpty() } ?: return null
    return AIElfStripContent(
        headline = if (content.isAcknowledged) "What happens next" else "Pantopus read this for you",
        summary = summary,
    )
}

private fun makeAttachments(content: MailDetailContent): AttachmentsRowContent? {
    if (content.attachments.isEmpty()) return null
    val items =
        content.attachments.mapIndexed { index, name ->
            AttachmentItem(id = "att-$index", kind = AttachmentKind.Pdf, name = name)
        }
    return AttachmentsRowContent(items = items)
}

// ─── Key facts (emphasised Deadline + Amount) ───────────────

@Immutable
private data class CertifiedKeyFact(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val value: String,
    val note: String?,
    val tag: KeyFactTag?,
    val isEmphasis: Boolean,
)

@Immutable
private data class KeyFactTag(val text: String, val background: Color, val foreground: Color)

private fun makeKeyFacts(
    content: MailDetailContent,
    certified: CertifiedDetailDto,
): List<CertifiedKeyFact> =
    buildList {
        val bodyText = content.bodyParagraphs.joinToString("\n\n")
        val amount = extractAmount(bodyText)
        amount?.let {
            add(
                CertifiedKeyFact(
                    id = "amount",
                    icon = PantopusIcon.DollarSign,
                    label = "Amount due",
                    value = it,
                    note = null,
                    tag =
                        KeyFactTag(
                            text = "New charge",
                            background = PantopusColors.errorBg,
                            foreground = PantopusColors.error,
                        ),
                    isEmphasis = true,
                ),
            )
        }
        certified.acknowledgeBy?.let { iso ->
            val pretty = formatLongDate(iso)
            if (pretty != null) {
                add(
                    CertifiedKeyFact(
                        id = "ackBy",
                        icon = PantopusIcon.CalendarClock,
                        label = if (amount == null) "Sign by" else "Pay by",
                        value = pretty,
                        note = "Required to keep the chain unbroken",
                        tag = countdownTag(iso),
                        isEmphasis = true,
                    ),
                )
            }
        }
        certified.referenceNumber
            .trim()
            .takeIf { it.isNotEmpty() }
            ?.let { ref ->
                add(
                    CertifiedKeyFact(
                        id = "ref",
                        icon = PantopusIcon.Hash,
                        label = "Reference",
                        value = ref,
                        note = null,
                        tag = null,
                        isEmphasis = false,
                    ),
                )
            }
        certified.documentType?.let { doc ->
            add(
                CertifiedKeyFact(
                    id = "doc",
                    icon = PantopusIcon.FileText,
                    label = "Document type",
                    value = doc,
                    note = null,
                    tag = null,
                    isEmphasis = false,
                ),
            )
        }
        content.createdAtLabel?.let { received ->
            add(
                CertifiedKeyFact(
                    id = "received",
                    icon = PantopusIcon.Calendar,
                    label = "Received",
                    value = received,
                    note = null,
                    tag = null,
                    isEmphasis = false,
                ),
            )
        }
    }

@Composable
private fun CertifiedKeyFactsCard(rows: List<CertifiedKeyFact>) {
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
            CertifiedKeyFactRow(row = row)
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun CertifiedKeyFactRow(row: CertifiedKeyFact) {
    val tintBackground =
        if (row.isEmphasis) PantopusColors.warningLight else PantopusColors.appSurfaceSunken
    val tintForeground =
        if (row.isEmphasis) PantopusColors.warning else PantopusColors.appTextStrong
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (row.isEmphasis) PantopusColors.warningBg else Color.Transparent)
                .padding(if (row.isEmphasis) Spacing.s3 else Spacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(if (row.isEmphasis) 28.dp else 24.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(tintBackground),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = row.icon,
                contentDescription = null,
                size = if (row.isEmphasis) 15.dp else 13.dp,
                tint = tintForeground,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(if (row.isEmphasis) 2.dp else 1.dp),
        ) {
            Text(
                text = row.label.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.4.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = row.value,
                fontSize = if (row.isEmphasis) 16.sp else 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            row.note?.let {
                Text(text = it, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            }
        }
        row.tag?.let { tag ->
            Text(
                text = tag.text,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(tag.background)
                        .padding(horizontal = Spacing.s1 + 2.dp, vertical = 3.dp),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = tag.foreground,
            )
        }
    }
}

// ─── Hero + chain helpers ─────────────────────────────────────

@Composable
private fun HeroCard(
    content: MailDetailContent,
    certified: CertifiedDetailDto,
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
                    .size(width = 4.dp, height = 200.dp)
                    .background(content.category.accent),
        )
        Column(
            modifier = Modifier.weight(1f).padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TrustBadge()
                Spacer(Modifier.width(Spacing.s1))
                CategoryBadge(category = content.category)
                Spacer(Modifier.weight(1f))
                content.createdAtLabel?.let { received ->
                    Text(text = received, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = content.senderDisplayName.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.6.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = content.title,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        lineHeight = 23.sp,
                    )
                    Text(
                        text = certified.referenceNumber,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                CertifiedStampBadge(trackingId = certified.referenceNumber)
            }
            if (content.isAcknowledged) {
                AcknowledgedBanner()
            }
            if (content.isArchived) {
                ArchivedBanner()
            }
        }
    }
}

@Composable
private fun AcknowledgedBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))
                .padding(horizontal = 9.dp, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.success),
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
            text = "Acknowledged · receipt on file",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun ArchivedBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))
                .padding(horizontal = 9.dp, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Archive,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "Archived · saved with certified receipt",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun TrustBadge() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successBg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .semantics { contentDescription = "Verified sender" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "Verified",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.3.sp,
            color = PantopusColors.success,
        )
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
private fun BodyCard(paragraphs: List<String>) {
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
            text = "NOTICE TEXT",
            modifier = Modifier.semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        paragraphs.forEach { paragraph ->
            Text(
                text = paragraph,
                fontSize = 13.sp,
                color = PantopusColors.appTextStrong,
                lineHeight = 20.sp,
            )
        }
    }
}

@Composable
private fun SenderAndNotice(
    content: MailDetailContent,
    certified: CertifiedDetailDto,
    onOpenSenderProfile: (String) -> Unit,
    onViewTerms: () -> Unit,
    onOpenExtractedTask: (() -> Unit)? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        if (onOpenExtractedTask != null) {
            ExtractedTaskCard(onTap = onOpenExtractedTask)
        }
        CombinedSenderCarrierCard(
            senderName = content.senderDisplayName,
            senderMeta = content.senderMeta,
            senderInitials = content.senderInitials,
            senderAvatarTint = content.category.accent,
            senderUserId = content.senderUserId,
            trust = content.trust,
            carrier = defaultCarrier(certified),
            onOpenSenderProfile = onOpenSenderProfile,
        )
        if (!certified.termsUrl.isNullOrEmpty() || !certified.acknowledgeBy.isNullOrEmpty()) {
            CertifiedTermsSummaryCard(
                termsUrl = certified.termsUrl,
                onViewTerms = if (certified.termsUrl.isNullOrEmpty()) null else onViewTerms,
            )
        }
        if (content.bodyParagraphs.isNotEmpty()) {
            BodyCard(paragraphs = content.bodyParagraphs)
        }
    }
}

private fun makeChainEvents(certified: CertifiedDetailDto): List<ChainOfCustodyEvent> =
    certified.chain.map { step ->
        ChainOfCustodyEvent(
            id = step.id,
            icon = iconForChainStep(step.id),
            label = step.label,
            meta = null,
            timestamp = step.occurredAt?.let(::formatChainTimestamp),
            isPantopusEvent =
                step.id.lowercase()
                    .let { it.contains("ack") || it.contains("pantopus") },
            isComplete = step.isComplete,
        )
    }

private fun chainStatus(certified: CertifiedDetailDto): ChainOfCustodyStatus =
    if (certified.chain.any { it.isComplete }) {
        ChainOfCustodyStatus.Unbroken
    } else {
        ChainOfCustodyStatus.Custom(
            label = "Pending",
            background = PantopusColors.appSurfaceSunken,
            foreground = PantopusColors.appTextSecondary,
        )
    }

private fun defaultCarrier(certified: CertifiedDetailDto): MailCarrierInfo =
    MailCarrierInfo(
        service = "USPS Certified Mail",
        trackingId = certified.referenceNumber.trim().takeIf { it.isNotEmpty() },
        signatureRequired = true,
        postmarkVerified = true,
    )

private fun iconForChainStep(id: String): PantopusIcon {
    val lower = id.lowercase()
    return when {
        "ack" in lower -> PantopusIcon.BadgeCheck
        "deliver" in lower -> PantopusIcon.Mailbox
        "transit" in lower || "plane" in lower -> PantopusIcon.Package
        "scan" in lower -> PantopusIcon.ScanLine
        "postmark" in lower || "postal" in lower -> PantopusIcon.Stamp
        else -> PantopusIcon.Check
    }
}

private fun formatLongDate(iso: String): String? {
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
    val zoned = instant.atZone(ZoneId.systemDefault())
    return DateTimeFormatter.ofPattern("EEE MMM d, yyyy", Locale.US).format(zoned)
}

private fun formatChainTimestamp(iso: String): String {
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return iso
    return DateTimeFormatter
        .ofPattern("EEE · h:mm a", Locale.US)
        .withZone(ZoneId.systemDefault())
        .format(instant)
}

private fun countdownTag(iso: String): KeyFactTag? {
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
    val daysOut = ChronoUnit.DAYS.between(Instant.now(), instant).toInt()
    return when {
        daysOut < 0 ->
            KeyFactTag(
                text = "Overdue",
                background = PantopusColors.errorBg,
                foreground = PantopusColors.error,
            )
        daysOut == 0 ->
            KeyFactTag(
                text = "Today",
                background = PantopusColors.warningBg,
                foreground = PantopusColors.warning,
            )
        else ->
            KeyFactTag(
                text = "$daysOut days left",
                background = PantopusColors.warningBg,
                foreground = PantopusColors.warning,
            )
    }
}

private fun extractAmount(body: String): String? {
    val regex = Regex("\\$\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})")
    return regex.find(body)?.value
}

// ─── Actions ──────────────────────────────────────────────────

@Composable
private fun ActionsRow(
    isAcknowledged: Boolean,
    isArchived: Boolean,
    ackInFlight: Boolean,
    onAcknowledge: () -> Unit,
    onDownloadProof: () -> Unit,
    proofSaved: Boolean,
    proofInFlight: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        AcknowledgeButton(
            isAcknowledged = isAcknowledged,
            isArchived = isArchived,
            ackInFlight = ackInFlight,
            onAcknowledge = onAcknowledge,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SecondaryTile(
                icon = PantopusIcon.DollarSign,
                label = "Pay",
                modifier = Modifier.weight(1f),
            )
            SecondaryTile(
                icon = PantopusIcon.Calendar,
                label = "Calendar",
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SecondaryTile(icon = PantopusIcon.Flag, label = "Dispute", modifier = Modifier.weight(1f))
            SecondaryTile(
                icon = PantopusIcon.Archive,
                label = "Archive",
                modifier = Modifier.weight(1f),
            )
        }
        // A17.3 — the legal delivery proof only exists after the
        // acknowledgement is on file, so the tile appears with it.
        if (isAcknowledged) {
            ProofTile(
                proofSaved = proofSaved,
                proofInFlight = proofInFlight,
                onDownloadProof = onDownloadProof,
            )
        }
        Text(
            text = "Acknowledging confirms receipt only · it does not waive your right to appeal or dispute the charge.",
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp),
            fontSize = 10.5.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun AcknowledgeButton(
    isAcknowledged: Boolean,
    isArchived: Boolean,
    ackInFlight: Boolean,
    onAcknowledge: () -> Unit,
) {
    val completed = isAcknowledged || isArchived
    val bg = if (completed) PantopusColors.appSurface else PantopusColors.primary600
    val fg = if (completed) PantopusColors.success else PantopusColors.appTextInverse
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(bg)
                .then(
                    if (completed) {
                        Modifier.border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                    } else {
                        Modifier
                    },
                )
                .clickable(enabled = !ackInFlight && !isArchived, onClick = onAcknowledge)
                .padding(vertical = 14.dp)
                .testTag("mailDetail_certified_acknowledge")
                .semantics { contentDescription = if (completed) "Signed receipt on file" else "Sign for delivery" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = if (completed) PantopusIcon.CheckCircle else PantopusIcon.Check,
            contentDescription = null,
            size = Radii.xl,
            tint = fg,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text =
                when {
                    isArchived -> "Archived · receipt on file"
                    isAcknowledged -> "Signed · receipt on file"
                    else -> "Sign for delivery"
                },
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
        )
    }
}

/** "⬇ Proof" → "✓ Saved" (RN `src/app/mailbox/certified.tsx:200-207`). */
@Composable
private fun ProofTile(
    proofSaved: Boolean,
    proofInFlight: Boolean,
    onDownloadProof: () -> Unit,
) {
    val background = if (proofSaved) PantopusColors.successBg else PantopusColors.appSurface
    val border = if (proofSaved) PantopusColors.successLight else PantopusColors.appBorder
    val foreground = if (proofSaved) PantopusColors.success else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .border(1.dp, border, RoundedCornerShape(Radii.lg))
                .clickable(enabled = !proofInFlight && !proofSaved) { onDownloadProof() }
                .alpha(if (proofInFlight) DISABLED_TILE_ALPHA else 1f)
                .padding(horizontal = Spacing.s2, vertical = 11.dp)
                .testTag("mailDetail_certified_proof")
                .semantics {
                    contentDescription =
                        if (proofSaved) "Delivery proof saved" else "Download delivery proof"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = if (proofSaved) PantopusIcon.BadgeCheck else PantopusIcon.Download,
            contentDescription = null,
            size = 15.dp,
            tint = if (proofSaved) PantopusColors.success else PantopusColors.primary600,
        )
        Text(
            text = if (proofSaved) "Saved" else "Proof",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = foreground,
        )
    }
}

@Composable
private fun SecondaryTile(
    icon: PantopusIcon,
    label: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable {}
                .padding(horizontal = Spacing.s2, vertical = 11.dp)
                .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
    }
}

/**
 * A17.12 — "Pantopus made a task" row surfaced on certified notices that
 * carry a deadline. Tapping it opens the A17.12 Mail-task detail. Indigo
 * task accent so it reads as the automated-productivity chrome. Mirrors
 * iOS `ExtractedTaskCard` in `CertifiedDetailLayout.swift`.
 */
@Composable
private fun ExtractedTaskCard(onTap: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.categoryTask.copy(alpha = 0.35f), RoundedCornerShape(Radii.lg))
                .clickable { onTap() }
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("mailDetail_viewExtractedTask"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.categoryTask.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ListChecks,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.categoryTask,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.categoryTask,
                )
                Text(
                    text = "Pantopus made a task",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
            }
            Text(
                text = "Submit written comment · due Fri 5:00 PM",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "View task",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.categoryTask,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}
