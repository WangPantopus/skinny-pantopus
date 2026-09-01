@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.MemoryDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.MemoryElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.MemoryElfContent
import app.pantopus.android.data.api.models.mailbox.v2.MemoryFact
import app.pantopus.android.data.api.models.mailbox.v2.MemoryVaultCrumb
import app.pantopus.android.data.api.models.mailbox.v2.MemoryVaultInfo
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.PolaroidFrame
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.StationeryCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Concrete body for the Memory mailbox category (A17.7). A keepsake
 * delivery: a serif title + reference, the polaroid photograph, the
 * handwritten note, the "Pantopus surfaced this" elf, and a contextual
 * summary that swaps from the facts grid (fresh) to the vault-location
 * card once kept. The shell owns the accent strip, sender block, trust
 * pill, and the sticky Save-to-Vault / Share shelf.
 */
@Composable
fun MemoryBody(
    memory: MemoryDetailDto,
    isSaved: Boolean,
    modifier: Modifier = Modifier,
    onOpenThread: (() -> Unit)? = null,
    onOpenVault: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag("memoryBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        TitleBlock(memory, Modifier.padding(horizontal = Spacing.s4))

        if (isSaved) {
            SavedBanner(Modifier.padding(horizontal = Spacing.s4))
        }

        PolaroidFrame(
            photoUrl = memory.photoUrl,
            caption = memory.photoCaption,
            label = memory.photoLabel,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )

        StationeryCard(
            eyebrow = "The note",
            paragraphs = memory.note,
            signature = memory.noteSignature,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )

        MemoryElfCard(
            content = if (isSaved) memory.elfSaved else memory.elfFresh,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )

        if (isSaved) {
            MemoryVaultCard(
                vault = memory.vault,
                onOpenVault = onOpenVault,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        } else {
            MemoryFactsCard(
                facts = memory.facts,
                onOpenThread = onOpenThread,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
    }
}

@Composable
private fun TitleBlock(
    memory: MemoryDetailDto,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = memory.title,
            fontFamily = FontFamily.Serif,
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = memory.reference,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SavedBanner(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { contentDescription = "Kept in your Vault, only you can see it" },
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
                size = 11.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.success)) {
                        append("Kept in your Vault")
                    }
                    withStyle(SpanStyle(color = PantopusColors.appTextSecondary)) {
                        append(" · only you can see it")
                    }
                },
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun MemoryElfCard(
    content: MemoryElfContent,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
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
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary800,
            )
        }

        Text(
            text = content.summary,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.primary900,
        )

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            content.bullets.forEach { bullet -> BulletRow(bullet) }
        }
    }
}

@Composable
private fun BulletRow(bullet: MemoryElfBullet) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
        modifier = Modifier.semantics { contentDescription = "${bullet.label}. ${bullet.text}" },
    ) {
        Box(
            modifier =
                Modifier
                    .size(18.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.xs)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = bulletIcon(bullet.glyph),
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.primary700,
            )
        }
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.appText)) {
                        append(bullet.label)
                    }
                    withStyle(SpanStyle(color = PantopusColors.appTextSecondary)) {
                        append(" — ${bullet.text}")
                    }
                },
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun MemoryFactsCard(
    facts: List<MemoryFact>,
    onOpenThread: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        Text(
            text = "The story behind it",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)

        facts.forEachIndexed { index, fact ->
            FactEntry(fact = fact, onOpenThread = onOpenThread)
            if (index < facts.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun FactEntry(
    fact: MemoryFact,
    onOpenThread: (() -> Unit)?,
) {
    val onThreadClick = if (fact.linkHint != null) onOpenThread else null
    val rowModifier =
        if (onThreadClick != null) {
            Modifier
                .clickable(onClick = onThreadClick)
                .testTag("memoryBody.openThread")
                .semantics { contentDescription = "Open the original Pulse thread" }
        } else {
            Modifier
        }
    FactRow(fact = fact, showHint = onThreadClick != null, modifier = rowModifier)
}

@Composable
private fun FactRow(
    fact: MemoryFact,
    showHint: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = factIcon(fact.kind),
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.warning,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = fact.label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = fact.value,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            if (showHint && fact.linkHint != null) {
                Text(
                    text = fact.linkHint,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun MemoryVaultCard(
    vault: MemoryVaultInfo,
    onOpenVault: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Filed in your Vault",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        Breadcrumb(vault)
        VaultStats(vault)
        if (onOpenVault != null) {
            OpenVaultButton(onOpenVault)
        }
    }
}

@Composable
private fun Breadcrumb(vault: MemoryVaultInfo) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .semantics {
                    contentDescription = "Path: " + vault.trail.joinToString(", ") { it.label }
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        vault.trail.forEachIndexed { index, crumb ->
            CrumbChip(crumb)
            if (index < vault.trail.lastIndex) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun CrumbChip(crumb: MemoryVaultCrumb) {
    val foreground = if (crumb.isCurrent) PantopusColors.appText else PantopusColors.appTextStrong
    val chipModifier =
        if (crumb.isCurrent) {
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
        } else {
            Modifier.clip(RoundedCornerShape(Radii.pill))
        }
    Row(
        modifier = chipModifier.padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = crumbIcon(crumb.glyph),
            contentDescription = null,
            size = 11.dp,
            tint = foreground,
        )
        Text(
            text = crumb.label,
            fontSize = 12.sp,
            fontWeight = if (crumb.isCurrent) FontWeight.Bold else FontWeight.SemiBold,
            color = foreground,
        )
    }
}

@Composable
private fun VaultStats(vault: MemoryVaultInfo) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md))
                .padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        vault.stats.forEachIndexed { index, stat ->
            if (index > 0) {
                Box(
                    modifier =
                        Modifier
                            .width(1.dp)
                            .height(28.dp)
                            .background(PantopusColors.appBorderSubtle),
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = stat.value,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                Text(
                    text = stat.label,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun OpenVaultButton(onOpenVault: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClick = onOpenVault)
                .testTag("memoryBody.openVault")
                .semantics { contentDescription = "Open Vault, Memories" }
                .padding(Spacing.s2),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Open Vault › Memories",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(Modifier.width(Spacing.s1))
        PantopusIconImage(
            icon = PantopusIcon.ArrowRight,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appText,
        )
    }
}

private fun factIcon(kind: MemoryFact.Kind): PantopusIcon =
    when (kind) {
        MemoryFact.Kind.Anniversary -> PantopusIcon.Calendar
        MemoryFact.Kind.PulseThread -> PantopusIcon.MessageSquare
        MemoryFact.Kind.Location -> PantopusIcon.MapPin
        MemoryFact.Kind.Others -> PantopusIcon.Users
    }

private fun bulletIcon(glyph: MemoryElfBullet.Glyph): PantopusIcon =
    when (glyph) {
        MemoryElfBullet.Glyph.Calendar -> PantopusIcon.Calendar
        MemoryElfBullet.Glyph.Image -> PantopusIcon.Image
        MemoryElfBullet.Glyph.ShieldCheck -> PantopusIcon.ShieldCheck
        MemoryElfBullet.Glyph.Archive -> PantopusIcon.Archive
        MemoryElfBullet.Glyph.EyeOff -> PantopusIcon.EyeOff
        MemoryElfBullet.Glyph.Bell -> PantopusIcon.Bell
    }

private fun crumbIcon(glyph: MemoryVaultCrumb.Glyph): PantopusIcon =
    when (glyph) {
        MemoryVaultCrumb.Glyph.Inbox -> PantopusIcon.Inbox
        MemoryVaultCrumb.Glyph.Archive -> PantopusIcon.Archive
        MemoryVaultCrumb.Glyph.Heart -> PantopusIcon.Heart
        MemoryVaultCrumb.Glyph.Calendar -> PantopusIcon.Calendar
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 1600)
@Composable
private fun MemoryBodyFreshPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(vertical = Spacing.s4)) {
        MemoryBody(memory = MemorySampleData.memory, isSaved = false, onOpenThread = {})
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 1600)
@Composable
private fun MemoryBodySavedPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(vertical = Spacing.s4)) {
        MemoryBody(memory = MemorySampleData.savedMemory, isSaved = true, onOpenVault = {})
    }
}
