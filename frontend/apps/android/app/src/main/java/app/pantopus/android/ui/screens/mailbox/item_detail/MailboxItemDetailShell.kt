@file:Suppress("MagicNumber", "LongParameterList", "LongMethod", "MatchingDeclarationName", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

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
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.ActionChip
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.KeyFactRow
import app.pantopus.android.ui.components.KeyFactsPanel
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepper
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Payload for the sender block on the detail header. */
data class SenderBlockContent(
    val displayName: String,
    val meta: String,
    val initials: String,
    /**
     * Optional Pantopus user-id behind the sender. When populated and an
     * `onAvatarTap` callback is passed to [MailboxItemDetailShell],
     * tapping the avatar opens the public profile (P17).
     */
    val senderUserId: String? = null,
    /**
     * When true the sender block renders a small "CERTIFIED" stamp on
     * the trailing edge — used by the certified body (P18).
     */
    val showStamp: Boolean = false,
)

/** AI elf suggestion card payload. */
data class AIElfContent(
    val suggestion: String,
    val primaryChip: String,
    val secondaryChip: String,
)

/** Chip kinds emitted by the AI elf card. */
enum class MailboxItemDetailAIChipKind { Primary, Secondary }

/** Sticky CTA shelf payload for the mailbox item detail shell. */
data class MailboxCTAShelfContent(
    val primaryTitle: String,
    val ghostTitle: String? = null,
    val primaryLoading: Boolean = false,
    val ghostLoading: Boolean = false,
    val primaryEnabled: Boolean = true,
)

/**
 * Test tag on the mailbox-item detail shell root. Mirrors iOS
 * `accessibilityIdentifier("mailboxItemDetailShell")`.
 */
const val MAILBOX_ITEM_DETAIL_TAG = "mailboxItemDetailShell"

/**
 * Scaffold for every Mailbox Item Detail screen. Slots: 4dp accent strip +
 * top bar + trust pill + sender block + optional AI elf + KeyFacts +
 * optional TimelineStepper + category body + sticky CTA shelf.
 */
@Composable
fun MailboxItemDetailShell(
    category: MailItemCategory,
    trust: MailTrust,
    sender: SenderBlockContent,
    aiElf: AIElfContent? = null,
    keyFacts: List<KeyFactRow> = emptyList(),
    timeline: List<TimelineStep> = emptyList(),
    cta: MailboxCTAShelfContent? = null,
    onBack: () -> Unit,
    onAIChip: (MailboxItemDetailAIChipKind) -> Unit = {},
    onPrimary: () -> Unit = {},
    onGhost: () -> Unit = {},
    onSenderAvatarTap: ((String) -> Unit)? = null,
    body: @Composable () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(MAILBOX_ITEM_DETAIL_TAG),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            AccentStrip(color = category.accent)
            MailboxItemDetailTopBar(onBack = onBack)
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                TrustPill(
                    trust = trust,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
                SenderBlock(
                    content = sender,
                    onAvatarTap = onSenderAvatarTap,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
                if (aiElf != null) {
                    AIElfCard(
                        content = aiElf,
                        onChip = onAIChip,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                    )
                }
                if (keyFacts.isNotEmpty()) {
                    KeyFactsPanel(
                        rows = keyFacts,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                    )
                }
                if (timeline.isNotEmpty()) {
                    SectionHeader("Timeline", modifier = Modifier.padding(horizontal = Spacing.s4))
                    TimelineStepper(
                        steps = timeline,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                    )
                }
                body()
                Spacer(Modifier.height(120.dp))
            }
            if (cta != null) {
                StickyCTAShelf(content = cta, onPrimary = onPrimary, onGhost = onGhost)
            }
        }
    }
}

@Composable
private fun MailboxItemDetailTopBar(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .padding(horizontal = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack)
                    .semantics { contentDescription = "Back" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowLeft,
                contentDescription = null,
                tint = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun AccentStrip(color: Color) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .background(color),
    )
}

/** Pill showing the sender's trust level. */
@Composable
fun TrustPill(
    trust: MailTrust,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(trust.background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "${trust.label} sender" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = trust.icon,
            contentDescription = null,
            size = 14.dp,
            tint = trust.foreground,
        )
        Text(trust.label, style = PantopusTextStyle.caption, color = trust.foreground)
    }
}

/**
 * Avatar + display name + meta row. When both [onAvatarTap] is non-null
 * and [SenderBlockContent.senderUserId] is set, the avatar becomes a
 * clickable button that opens the sender's public profile.
 */
@Composable
fun SenderBlock(
    content: SenderBlockContent,
    modifier: Modifier = Modifier,
    onAvatarTap: ((String) -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        val userId = content.senderUserId
        val avatar: @Composable () -> Unit = {
            AvatarWithIdentityRing(
                name = content.initials,
                identity = IdentityPillar.Business,
                ringProgress = 1f,
                size = 36.dp,
            )
        }
        if (onAvatarTap != null && userId != null) {
            Box(
                modifier =
                    Modifier
                        .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                        .clickable { onAvatarTap(userId) }
                        .semantics { contentDescription = "Open ${content.displayName}'s profile" },
                contentAlignment = Alignment.Center,
            ) { avatar() }
        } else {
            avatar()
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(content.displayName, style = PantopusTextStyle.body, color = PantopusColors.appText)
            Text(
                content.meta,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (content.showStamp) {
            CertifiedStamp()
        }
    }
}

/**
 * Tilted "CERTIFIED" stamp rendered on the trailing edge of the sender
 * block when [SenderBlockContent.showStamp] is true.
 */
@Composable
fun CertifiedStamp(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .rotate(-12f)
                .border(
                    1.5.dp,
                    PantopusColors.primary600,
                    RoundedCornerShape(Radii.sm),
                )
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "Certified" },
    ) {
        Text(
            text = "CERTIFIED",
            style = PantopusTextStyle.overline,
            color = PantopusColors.primary600,
        )
    }
}

/** Blue-tinted AI suggestion card. */
@Composable
fun AIElfCard(
    content: AIElfContent,
    onChip: (MailboxItemDetailAIChipKind) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary100)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Info,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.primary600,
            )
            Text("AI ELF", style = PantopusTextStyle.overline, color = PantopusColors.primary600)
        }
        Text(content.suggestion, style = PantopusTextStyle.body, color = PantopusColors.appText)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ActionChip(
                icon = PantopusIcon.Check,
                label = content.primaryChip,
                onClick = { onChip(MailboxItemDetailAIChipKind.Primary) },
                isActive = true,
            )
            ActionChip(
                icon = PantopusIcon.X,
                label = content.secondaryChip,
                onClick = { onChip(MailboxItemDetailAIChipKind.Secondary) },
            )
        }
    }
}

/** Sticky bottom shelf — primary + optional ghost CTA. */
@Composable
fun StickyCTAShelf(
    content: MailboxCTAShelfContent,
    onPrimary: () -> Unit,
    onGhost: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (content.ghostTitle != null) {
                GhostButton(
                    title = content.ghostTitle,
                    onClick = onGhost,
                    isLoading = content.ghostLoading,
                    isEnabled = !content.primaryLoading,
                    modifier = Modifier.weight(1f),
                )
            }
            PrimaryButton(
                title = content.primaryTitle,
                onClick = onPrimary,
                isLoading = content.primaryLoading,
                isEnabled = content.primaryEnabled && !content.ghostLoading,
                modifier = Modifier.weight(1f),
            )
        }
    }
}
