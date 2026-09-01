@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.inbox.conversation.ai.ChatAiAvatar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun ConversationRow(
    content: ConversationRowContent,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(
                    if (content.pinned) PantopusColors.primary50.copy(alpha = 0.5f) else PantopusColors.appSurface,
                )
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4)
                .semantics(mergeDescendants = true) {
                    contentDescription = buildA11yLabel(content)
                }
                .testTag("conversationRow_${content.id}"),
    ) {
        if (content.pinned) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .offset(x = (-16).dp)
                        .width(3.dp)
                        .height(48.dp)
                        .background(PantopusColors.primary600),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Avatar(content)
            Middle(content, modifier = Modifier.weight(1f))
            Trailing(content)
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

@Composable
private fun Avatar(content: ConversationRowContent) {
    when (val variant = content.variant) {
        ConversationRowVariant.AiAssistant -> ChatAiAvatar(size = 44.dp)
        ConversationRowVariant.Dm -> DmAvatar(initials = content.initials, verified = content.verified)
        is ConversationRowVariant.Group -> GroupAvatar(content.initials, variant)
    }
}

@Composable
private fun DmAvatar(
    initials: String,
    verified: Boolean,
) {
    Box(modifier = Modifier.size(52.dp), contentAlignment = Alignment.BottomEnd) {
        InitialsCircle(
            size = 52.dp,
            color = PantopusColors.personalBg,
            initials = initials,
            fg = PantopusColors.primary600,
        )
        if (verified) {
            Box(
                modifier =
                    Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .border(2.dp, PantopusColors.appSurface, CircleShape)
                        .offset(x = 1.dp, y = 1.dp)
                        .semantics { contentDescription = "Verified" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 9.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun GroupAvatar(
    primary: String,
    group: ConversationRowVariant.Group,
) {
    Box(modifier = Modifier.size(46.dp)) {
        // Back tile
        Box(modifier = Modifier.offset(x = (-3).dp, y = (-3).dp)) {
            InitialsCircle(size = 32.dp, color = PantopusColors.warning, initials = primary)
        }
        // Front tile (extras)
        val front = group.extraAvatars.firstOrNull() ?: "+${group.extraCount.coerceAtLeast(1)}"
        Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 3.dp, y = 3.dp)) {
            InitialsCircle(size = 32.dp, color = PantopusColors.success, initials = front)
        }
    }
}

@Composable
private fun InitialsCircle(
    size: Dp,
    color: Color,
    initials: String,
    fg: Color = PantopusColors.appTextInverse,
) {
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(CircleShape)
                .background(color)
                .border(2.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials,
            fontSize = (size.value * 0.34f).sp,
            fontWeight = FontWeight.Bold,
            color = fg,
        )
    }
}

@Composable
private fun Middle(
    content: ConversationRowContent,
    modifier: Modifier = Modifier,
) {
    val isAiRow = content.variant == ConversationRowVariant.AiAssistant
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = content.displayName,
                fontSize = 16.sp,
                fontWeight = if (content.unread > 0 || isAiRow) FontWeight.Bold else FontWeight.Medium,
                // A15.3 swaps the AI row's business purple for primary blues.
                color = if (isAiRow) PantopusColors.primary700 else PantopusColors.appText,
                maxLines = 1,
            )
            if (isAiRow) {
                Text(
                    text = "AI",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.primary50)
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                )
            }
            content.identityChip?.let { IdentityDisclosureChip(chip = it) }
        }
        Text(
            text = content.preview,
            fontSize = 14.sp,
            fontWeight = if (content.unread > 0) FontWeight.SemiBold else FontWeight.Normal,
            color =
                when {
                    isAiRow -> PantopusColors.primary600
                    content.unread > 0 -> PantopusColors.appTextStrong
                    else -> PantopusColors.appTextSecondary
                },
            maxLines = 1,
        )
        if (content.topics.isNotEmpty()) {
            TopicPillsRow(topics = content.topics)
        }
    }
}

/**
 * Up to two topic pills under the preview plus a "+N" overflow pill.
 * The Column's spacedBy already contributes 4dp; the extra 2dp top
 * padding lands the designed 6dp gap.
 */
@Composable
private fun TopicPillsRow(topics: List<ConversationRowTopic>) {
    Row(
        modifier = Modifier.padding(top = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        topics.take(2).forEach { topic ->
            TopicPill(title = topic.title, icon = rowTopicIcon(topic.topicType))
        }
        val overflow = topics.size - 2
        if (overflow > 0) {
            TopicPill(title = "+$overflow", icon = null)
        }
    }
}

@Composable
private fun TopicPill(
    title: String,
    icon: PantopusIcon?,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = title,
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
        )
    }
}

/** Icon per topic type — mirrors the conversation screen's topic strip. */
private fun rowTopicIcon(type: String): PantopusIcon =
    when (type) {
        "task", "gig" -> PantopusIcon.Briefcase
        "listing" -> PantopusIcon.Tag
        "marketplace" -> PantopusIcon.ShoppingBag
        else -> PantopusIcon.MessageCircle
    }

@Composable
private fun Trailing(content: ConversationRowContent) {
    if (content.variant == ConversationRowVariant.AiAssistant) {
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary600,
        )
        return
    }
    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            if (content.isMuted) {
                PantopusIconImage(
                    icon = PantopusIcon.BellOff,
                    contentDescription = "Muted",
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            Text(
                text = content.timeLabel,
                fontSize = 12.sp,
                fontWeight = if (content.unread > 0) FontWeight.SemiBold else FontWeight.Normal,
                color = if (content.unread > 0) PantopusColors.primary600 else PantopusColors.appTextMuted,
            )
        }
        if (content.unread > 0) {
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 20.dp)
                        .widthIn(min = 20.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .padding(horizontal = 6.dp, vertical = 1.dp)
                        .semantics { contentDescription = "${content.unread} unread" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "${content.unread}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun IdentityDisclosureChip(chip: ConversationIdentityChip) {
    val fg: Color
    val bg: Color
    val icon: PantopusIcon
    when (chip) {
        ConversationIdentityChip.Business -> {
            fg = PantopusColors.business
            bg = PantopusColors.businessBg
            icon = PantopusIcon.ShoppingBag
        }
        ConversationIdentityChip.Home -> {
            fg = PantopusColors.home
            bg = PantopusColors.homeBg
            icon = PantopusIcon.Home
        }
    }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(bg)
                .padding(horizontal = 6.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = Radii.md, tint = fg)
        Text(
            text = chip.label.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
        )
    }
}

private fun buildA11yLabel(content: ConversationRowContent): String {
    val parts = mutableListOf<String>()
    parts.add(content.displayName)
    content.identityChip?.label?.let { parts.add(it) }
    if (content.verified) parts.add("verified")
    parts.add(content.preview)
    if (content.unread > 0) parts.add("${content.unread} unread")
    return parts.joinToString(". ")
}
