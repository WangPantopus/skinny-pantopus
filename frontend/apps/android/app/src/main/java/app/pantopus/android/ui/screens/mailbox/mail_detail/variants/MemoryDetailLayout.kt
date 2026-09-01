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
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.MemoryDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.MemoryElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.MemoryFact
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.MemoryBody
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailKeyFact
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentKind
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentsRowContent
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
 * A17.7 — Memory ceremonial variant of the mail item detail. Mirrors
 * iOS `MemoryDetailLayout`. The body slot is the existing [MemoryBody]
 * (polaroid + note + Pantopus elf + facts → vault swap once saved).
 * The actions shelf is the prominent "Save to my Vault" CTA, swapping
 * into a saved pill once the keepsake is filed.
 */
@Composable
fun MemoryDetailLayout(
    content: MailDetailContent,
    memory: MemoryDetailDto,
    saveInFlight: Boolean,
    onBack: () -> Unit,
    onSaveMemory: () -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    onSaveToVault: () -> Unit = {},
) {
    Box(modifier = Modifier.testTag("mailDetail_memory")) {
        MailItemDetailShell(
            topBar = makeTopBar(memory = memory, onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(memory = memory),
            attachments = makeAttachments(content = content),
            hero = { MemoryHeroCard(content = content, memory = memory) },
            keyFacts = { MemoryKeyFactsCard(rows = makeKeyFacts(memory = memory)) },
            body = { MemoryBody(memory = memory, isSaved = memory.isSaved) },
            sender = { MemorySenderCard(content = content, onOpenProfile = onOpenSenderProfile) },
            actions = {
                MemoryDetailActions(
                    isSaved = memory.isSaved,
                    inFlight = saveInFlight,
                    onSave = onSaveMemory,
                    onShare = onSaveToVault,
                )
            },
        )
    }
}

private fun makeTopBar(
    memory: MemoryDetailDto,
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = "Memory",
        trust = MailDetailTrust.Verified,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = if (memory.isSaved) PantopusIcon.Heart else PantopusIcon.Bookmark,
                contentDescription = if (memory.isSaved) "Saved to vault" else "Save to vault",
                isActive = memory.isSaved,
                onClick = onSaveToVault,
            ),
        overflowItems =
            listOf(
                MailOverflowItem("share", PantopusIcon.Share, "Share with sender") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("muteAnniversary", PantopusIcon.Bell, "Mute anniversary") {},
                MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
            ),
    )

private fun makeAIElf(memory: MemoryDetailDto): AIElfStripContent {
    val elf = if (memory.isSaved) memory.elfSaved else memory.elfFresh
    return AIElfStripContent(
        headline = elf.headline,
        summary = elf.summary,
        bullets =
            elf.bullets.mapIndexed { index, bullet ->
                AIElfBullet(
                    id = "memory-elf-$index",
                    icon = glyph(bullet.glyph),
                    label = bullet.label,
                    text = bullet.text,
                )
            },
    )
}

private fun glyph(glyph: MemoryElfBullet.Glyph): PantopusIcon =
    when (glyph) {
        MemoryElfBullet.Glyph.Calendar -> PantopusIcon.Calendar
        MemoryElfBullet.Glyph.Image -> PantopusIcon.Image
        MemoryElfBullet.Glyph.ShieldCheck -> PantopusIcon.ShieldCheck
        MemoryElfBullet.Glyph.Archive -> PantopusIcon.Archive
        MemoryElfBullet.Glyph.EyeOff -> PantopusIcon.EyeOff
        MemoryElfBullet.Glyph.Bell -> PantopusIcon.Bell
    }

private fun makeAttachments(content: MailDetailContent): AttachmentsRowContent? {
    if (content.attachments.isEmpty()) return null
    val items =
        content.attachments.mapIndexed { index, name ->
            AttachmentItem(id = "att-$index", kind = AttachmentKind.Image, name = name)
        }
    return AttachmentsRowContent(title = "Attached photos", items = items)
}

private fun makeKeyFacts(memory: MemoryDetailDto): List<MailDetailKeyFact> =
    buildList {
        if (memory.reference.isNotEmpty()) {
            add(MailDetailKeyFact(icon = PantopusIcon.Hash, label = "Reference", value = memory.reference))
        }
        memory.facts.take(3).forEach { fact ->
            add(
                MailDetailKeyFact(
                    icon = factIcon(fact.kind),
                    label = fact.label,
                    value = fact.value,
                ),
            )
        }
        if (memory.isSaved) {
            memory.vault.trail.lastOrNull { it.isCurrent }?.let { folder ->
                add(MailDetailKeyFact(icon = PantopusIcon.Archive, label = "Filed in", value = folder.label))
            }
        }
    }

private fun factIcon(kind: MemoryFact.Kind): PantopusIcon =
    when (kind) {
        MemoryFact.Kind.Anniversary -> PantopusIcon.Calendar
        MemoryFact.Kind.PulseThread -> PantopusIcon.MessageSquare
        MemoryFact.Kind.Location -> PantopusIcon.MapPin
        MemoryFact.Kind.Others -> PantopusIcon.Users
    }

@Composable
private fun MemoryHeroCard(
    content: MailDetailContent,
    memory: MemoryDetailDto,
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
                fontFamily = FontFamily.Serif,
                color = PantopusColors.appText,
                lineHeight = 24.sp,
                modifier = Modifier.semantics { heading() },
            )
            if (memory.isSaved) {
                SavedChip()
            } else {
                content.excerpt?.takeIf { it.isNotEmpty() }?.let {
                    Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                }
            }
        }
    }
}

@Composable
private fun SavedChip() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .testTag("mailDetail_memory_savedChip"),
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
                icon = PantopusIcon.Heart,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = "Kept in your Vault",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
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
private fun MemoryKeyFactsCard(rows: List<MailDetailKeyFact>) {
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
            text = "KEEPSAKE FACTS",
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
private fun MemorySenderCard(
    content: MailDetailContent,
    onOpenProfile: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(enabled = content.senderUserId != null) {
                    content.senderUserId?.let(onOpenProfile)
                }
                .padding(Spacing.s3),
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
            Row(
                modifier = Modifier.padding(top = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Heart,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.success,
                )
                Text(
                    text = "Sent privately to you",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.success,
                )
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

@Composable
private fun MemoryDetailActions(
    isSaved: Boolean,
    inFlight: Boolean,
    onSave: () -> Unit,
    onShare: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (isSaved) {
            SavedShelf()
        } else {
            SaveButton(inFlight = inFlight, onSave = onSave)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SecondaryTile(
                id = "reply",
                icon = PantopusIcon.MessageSquare,
                label = "Reply",
                modifier = Modifier.weight(1f),
            )
            SecondaryTile(
                id = "share",
                icon = PantopusIcon.Share,
                label = "Share",
                onClick = onShare,
                modifier = Modifier.weight(1f),
            )
            SecondaryTile(
                id = "print",
                icon = PantopusIcon.Download,
                label = "Print",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SaveButton(
    inFlight: Boolean,
    onSave: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.primary600)
                .clickable(enabled = !inFlight, onClick = onSave)
                .padding(vertical = 14.dp)
                .alpha(if (inFlight) 0.6f else 1f)
                .semantics { contentDescription = "Save to my Vault" }
                .testTag("mailDetail_memory_save"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Heart,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "Save to my Vault",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun SavedShelf() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.successBg)
                .border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                .padding(vertical = 14.dp)
                .testTag("mailDetail_memory_savedShelf"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.success,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "Kept in your Vault · only you",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun SecondaryTile(
    id: String,
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier,
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
                .testTag("mailDetail_memory_action_$id"),
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
