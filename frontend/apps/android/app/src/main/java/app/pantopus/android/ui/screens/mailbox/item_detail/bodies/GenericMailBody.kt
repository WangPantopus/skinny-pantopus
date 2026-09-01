@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Generic mailbox body. Renders readable content in a themed document card
 * plus optional attachments and tags. Replaces [MailItemPlaceholderBody]
 * for the twelve non-bespoke categories. Mirrors iOS `GenericMailBody`.
 */
@Composable
fun GenericMailBody(
    content: GenericMailBodyContent,
    modifier: Modifier = Modifier,
) {
    val paragraphs =
        content.paragraphs.ifEmpty {
            listOf(explainerFor(content.category))
        }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("genericMailBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        DocumentCard(content = content, paragraphs = paragraphs)
        if (content.attachments.isNotEmpty()) {
            AttachmentsCard(names = content.attachments)
        }
        if (content.tags.isNotEmpty()) {
            TagsRow(tags = content.tags)
        }
    }
}

@Composable
private fun DocumentCard(
    content: GenericMailBodyContent,
    paragraphs: List<String>,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("genericMailBody_document"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(content.category.rowBackground),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = content.category.icon,
                    contentDescription = null,
                    size = 15.dp,
                    tint = content.category.accent,
                )
            }
            Text(
                text = content.category.label.uppercase(),
                modifier = Modifier.semantics { heading() },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            if (content.actionLabel != null) {
                Row(modifier = Modifier.weight(1f)) {}
                ActionPill(label = content.actionLabel)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            paragraphs.forEach { paragraph ->
                Text(
                    text = paragraph,
                    fontSize = 13.sp,
                    color = PantopusColors.appTextStrong,
                    lineHeight = 20.sp,
                    modifier = Modifier.semantics { contentDescription = paragraph },
                )
            }
        }
    }
}

@Composable
private fun ActionPill(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertTriangle,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.warning,
        )
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.warning,
        )
    }
}

@Composable
private fun AttachmentsCard(names: List<String>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("genericMailBody_attachments"),
    ) {
        Text(
            text = "ATTACHMENTS",
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
        names.forEachIndexed { index, name ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .semantics { contentDescription = "Attachment: $name" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.primary50),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = attachmentIcon(name),
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.primary600,
                    )
                }
                Text(
                    text = name,
                    modifier = Modifier.weight(1f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            if (index < names.lastIndex) {
                HorizontalDivider(
                    modifier = Modifier.padding(start = Spacing.s10),
                    color = PantopusColors.appBorderSubtle,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TagsRow(tags: List<String>) {
    FlowRow(
        modifier = Modifier.testTag("genericMailBody_tags"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        tags.forEach { tag ->
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary100)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Tag,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary700,
                )
                Text(
                    text = tag,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary700,
                )
            }
        }
    }
}

private fun explainerFor(category: MailItemCategory): String =
    when (category) {
        MailItemCategory.Bill ->
            "This looks like a bill. Review the amount due and the due date, then pay or schedule it."
        MailItemCategory.Statement ->
            "An account statement. Review the balance and recent activity — usually no action is needed."
        MailItemCategory.Notice ->
            "An official notice. Read the details closely; some notices ask you to respond by a deadline."
        MailItemCategory.Insurance ->
            "Insurance mail. Check your coverage, claim status, or renewal date."
        MailItemCategory.Tax ->
            "Tax mail. Keep this for your records and note any filing or payment deadlines."
        MailItemCategory.Subscription ->
            "A subscription update. Review your plan, renewal date, or billing change."
        MailItemCategory.Legal ->
            "A legal document. Read it carefully — it may need acknowledgement or a timely response."
        MailItemCategory.Healthcare ->
            "Healthcare mail. Review the appointment, billing, or coverage details inside."
        MailItemCategory.Membership ->
            "A membership update. Check your status, benefits, or renewal date."
        MailItemCategory.Delivery ->
            "A delivery update. Track the latest status and expected arrival."
        MailItemCategory.Social ->
            "A neighborhood message. Catch up on what's happening nearby."
        MailItemCategory.Party ->
            "A personal invite. Open it for the details and let the host know if you're coming."
        MailItemCategory.Records ->
            "An archived record. Filed for safekeeping — open it any time from your Vault."
        MailItemCategory.General ->
            "Mail from your neighborhood. Open it to read the full message."
        else -> "Open this item to read the full message."
    }

private fun attachmentIcon(name: String): PantopusIcon {
    val lower = name.lowercase()
    if (lower.endsWith(".pdf")) return PantopusIcon.FileText
    val imageExtensions = listOf(".jpg", ".jpeg", ".png", ".heic", ".webp")
    if (imageExtensions.any { lower.endsWith(it) }) return PantopusIcon.Image
    return PantopusIcon.Paperclip
}
