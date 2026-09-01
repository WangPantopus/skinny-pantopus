@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.community.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.community.CommunityFeedItem
import app.pantopus.android.ui.screens.mailbox.community.CommunityFeedType
import app.pantopus.android.ui.screens.mailbox.community.CommunityReactionType
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.4 — one card in the Community-mail feed: type badge + verified
 * mark + title, sender / time, body excerpt, the reach stats strip, the
 * four-reaction bar, and (events only) the RSVP button. Flag-for-review
 * lives in the header.
 *
 * Mirrors iOS `CommunityFeedCard`.
 */
@Composable
fun CommunityFeedCard(
    item: CommunityFeedItem,
    onReact: (CommunityReactionType) -> Unit,
    onRsvp: () -> Unit,
    onFlag: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("communityMail_card_${item.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Header(item = item, onFlag = onFlag)
        SenderRow(item = item)
        if (item.body != null) {
            Text(
                text = item.body,
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("communityMail_card_body_${item.id}"),
            )
        }
        StatsRow(item = item)
        ReactionBar(item = item, onReact = onReact)
        if (item.offersRsvp) {
            RsvpButton(itemId = item.id, onRsvp = onRsvp)
        }
    }
}

@Composable
private fun Header(
    item: CommunityFeedItem,
    onFlag: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = item.type.icon,
            contentDescription = null,
            size = 18.dp,
            tint = accentFor(item.type),
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.type.label,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = accentFor(item.type),
                    modifier =
                        Modifier
                            .clip(CircleShape)
                            .background(accentBgFor(item.type))
                            .padding(horizontal = 7.dp, vertical = 2.dp),
                )
                if (item.verifiedSender) {
                    PantopusIconImage(
                        icon = PantopusIcon.BadgeCheck,
                        contentDescription = "Verified sender",
                        size = 14.dp,
                        tint = PantopusColors.success,
                    )
                }
            }
            Text(
                text = item.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onFlag)
                    .testTag("communityMail_flag_${item.id}"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Flag,
                contentDescription = "Flag for review",
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun SenderRow(item: CommunityFeedItem) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = item.senderDisplay,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (item.timeAgo != null) {
            Text(text = item.timeAgo, fontSize = 11.sp, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun StatsRow(item: CommunityFeedItem) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("communityMail_stats_${item.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Stat(icon = PantopusIcon.Eye, text = "${item.views}")
        Stat(icon = PantopusIcon.Users, text = "${item.neighborsReceived} reached")
        if (item.rsvpCount > 0) {
            Stat(icon = PantopusIcon.CalendarCheck, text = "${item.rsvpCount} RSVP")
        }
    }
}

@Composable
private fun Stat(
    icon: PantopusIcon,
    text: String,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(text = text, fontSize = 11.sp, color = PantopusColors.appTextMuted)
    }
}

@Composable
private fun ReactionBar(
    item: CommunityFeedItem,
    onReact: (CommunityReactionType) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CommunityReactionType.entries.forEach { reaction ->
            val active = item.isReacted(reaction)
            val count = item.countFor(reaction)
            val tint = if (active) PantopusColors.primary600 else PantopusColors.appTextMuted
            Row(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(
                            if (active) PantopusColors.primary50 else PantopusColors.appSurfaceSunken,
                        )
                        .clickable { onReact(reaction) }
                        .padding(horizontal = Spacing.s2, vertical = 5.dp)
                        .testTag("communityMail_react_${reaction.slug}_${item.id}"),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = reaction.icon,
                    contentDescription = reaction.label,
                    size = 13.dp,
                    tint = tint,
                )
                Text(
                    text = if (count > 0) "$count" else reaction.label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = tint,
                )
            }
        }
    }
}

@Composable
private fun RsvpButton(
    itemId: String,
    onRsvp: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.business)
                .clickable(onClick = onRsvp)
                .testTag("communityMail_rsvp_$itemId"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "RSVP",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

private fun accentFor(type: CommunityFeedType): Color =
    when (type) {
        CommunityFeedType.CIVIC_NOTICE -> PantopusColors.info
        CommunityFeedType.NEIGHBORHOOD_EVENT -> PantopusColors.magic
        CommunityFeedType.LOCAL_BUSINESS -> PantopusColors.success
        CommunityFeedType.BUILDING_ANNOUNCEMENT -> PantopusColors.warmAmber
    }

private fun accentBgFor(type: CommunityFeedType): Color =
    when (type) {
        CommunityFeedType.CIVIC_NOTICE -> PantopusColors.infoBg
        CommunityFeedType.NEIGHBORHOOD_EVENT -> PantopusColors.magicBg
        CommunityFeedType.LOCAL_BUSINESS -> PantopusColors.successBg
        CommunityFeedType.BUILDING_ANNOUNCEMENT -> PantopusColors.warmAmberBg
    }
