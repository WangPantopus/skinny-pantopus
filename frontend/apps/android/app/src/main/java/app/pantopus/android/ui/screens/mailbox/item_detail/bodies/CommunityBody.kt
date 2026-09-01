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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.mailbox.v2.CommunityAttendee
import app.pantopus.android.data.api.models.mailbox.v2.CommunityDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityEventInfo
import app.pantopus.android.data.api.models.mailbox.v2.CommunityMailSubtype
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPollInfo
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPollOption
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPulseThread
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpStatus
import app.pantopus.android.data.api.models.mailbox.v2.CommunityUpdateInfo
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A17.4 Community mailbox body: group seal, Pantopus summary, one subtype
 * card (poll / event / neighborhood update), attendee strip, author note,
 * Pulse thread link, and RSVP/action chips.
 */
@Composable
fun CommunityBody(
    community: CommunityDetailDto,
    authorName: String,
    authorInitials: String,
    modifier: Modifier = Modifier,
    paragraphs: List<String> = defaultCommunityParagraphs(community.subtype),
) {
    var rsvp by rememberSaveable { mutableStateOf(community.rsvp) }
    var selectedPollOptionId by rememberSaveable {
        mutableStateOf(community.poll?.options?.firstOrNull { it.isSelected }?.id)
    }

    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("communityBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        CommunityBodyBadgeCard(community)
        CommunityBodyInsightCard(community = community, rsvp = rsvp)
        when (community.subtype) {
            CommunityMailSubtype.Poll ->
                community.poll?.let {
                    CommunityBodyPollCard(
                        poll = it,
                        selectedOptionId = selectedPollOptionId,
                        onSelect = { selectedPollOptionId = it },
                    )
                } ?: CommunityBodyUpdateCard(fallbackCommunityUpdate)
            CommunityMailSubtype.Event ->
                community.event?.let {
                    CommunityBodyEventCard(event = it, accent = PantopusColors.home)
                } ?: CommunityBodyUpdateCard(community.update ?: fallbackCommunityUpdate)
            CommunityMailSubtype.NeighborhoodUpdate ->
                CommunityBodyUpdateCard(community.update ?: fallbackCommunityUpdate)
        }
        if (community.attendeeCount > 0 || community.attendees.isNotEmpty()) {
            CommunityBodyAttendeesCard(community = community, isGoing = rsvp == CommunityRsvpStatus.Going)
        }
        CommunityBodyMessageCard(
            authorName = authorName,
            authorInitials = authorInitials,
            paragraphs = paragraphs,
        )
        community.pulseThread?.let {
            CommunityBodyPulseThreadCard(thread = it, isGoing = rsvp == CommunityRsvpStatus.Going)
        }
        CommunityBodyActions(rsvp = rsvp, onRsvpChange = { rsvp = it })
    }
}

private fun defaultCommunityParagraphs(subtype: CommunityMailSubtype): List<String> =
    when (subtype) {
        CommunityMailSubtype.Event ->
            listOf(
                "Hi neighbors - quick reminder that we are doing the spring playground cleanup this Saturday from 9 to 11 AM.",
                "If you have gardening gloves please bring them. We will have spares from the tool library and a few extra rakes.",
            )
        CommunityMailSubtype.Poll ->
            listOf(
                "Please vote when you have a minute. The board will use this to pick the final timing " +
                    "and post the decision Friday afternoon.",
            )
        CommunityMailSubtype.NeighborhoodUpdate ->
            listOf("Sharing the latest neighborhood notes so everyone has the same plan before the weekend.")
    }

@Composable
private fun CommunityBodyCard(
    modifier: Modifier = Modifier,
    noPadding: Boolean = false,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .pantopusShadow(PantopusElevations.sm, shape = RoundedCornerShape(Radii.xl)),
        verticalArrangement = Arrangement.spacedBy(if (noPadding) 0.dp else Spacing.s3),
    ) {
        Box(modifier = if (noPadding) Modifier.fillMaxWidth() else Modifier.fillMaxWidth().padding(Spacing.s3)) {
            content()
        }
    }
}

@Composable
private fun CommunityBodyBadgeCard(community: CommunityDetailDto) {
    CommunityBodyCard(
        modifier = Modifier.background(PantopusColors.successBg).testTag("communityBody.badge"),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(modifier = Modifier.size(56.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier =
                        Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .border(2.dp, PantopusColors.home, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Trees, contentDescription = null, size = 26.dp, tint = PantopusColors.home)
                }
                if (community.group.isVerified) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.BottomEnd)
                                .size(18.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.success)
                                .border(2.dp, PantopusColors.appSurface, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(PantopusIcon.Check, contentDescription = null, size = 9.dp, tint = PantopusColors.appTextInverse)
                    }
                }
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = community.group.name,
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                        color = PantopusColors.appText,
                    )
                    if (community.group.isVerified) {
                        Text(
                            text = "VERIFIED HOA",
                            modifier =
                                Modifier
                                    .clip(RoundedCornerShape(Radii.pill))
                                    .background(PantopusColors.successBg)
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            style = PantopusTextStyle.overline,
                            color = PantopusColors.success,
                        )
                    }
                }
                community.group.tagline?.let {
                    Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
                Text(text = communityMetaLine(community), style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
            }
            PantopusIconImage(PantopusIcon.ChevronRight, contentDescription = null, size = Radii.xl, tint = PantopusColors.appTextMuted)
        }
    }
}

private fun communityMetaLine(community: CommunityDetailDto): String {
    val parts =
        buildList {
            community.group.role?.let { add(it + (community.group.membershipSince?.let { since -> " since $since" } ?: "")) }
            community.group.memberCount?.let { add("$it members") }
            community.group.founded?.let { add(it) }
        }
    return parts.ifEmpty { listOf("Verified neighborhood group") }.joinToString(" - ")
}

@Composable
private fun CommunityBodyInsightCard(
    community: CommunityDetailDto,
    rsvp: CommunityRsvpStatus,
) {
    CommunityBodyCard(
        modifier = Modifier.background(PantopusColors.infoBg).testTag("communityBody.insight"),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(26.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary600),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(PantopusIcon.Sparkles, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextInverse)
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = if (rsvp == CommunityRsvpStatus.Going) "You're going to this" else "Pantopus read this for you",
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.primary800,
                )
                Text(
                    text = communityInsightSummary(community, rsvp),
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.primary900,
                )
                communityInsightBullets(community).forEach { bullet ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Top) {
                        Box(
                            modifier = Modifier.size(18.dp).clip(RoundedCornerShape(Radii.xs)).background(PantopusColors.appSurface),
                            contentAlignment = Alignment.Center,
                        ) {
                            PantopusIconImage(bullet.first, contentDescription = null, size = 11.dp, tint = PantopusColors.primary700)
                        }
                        Text(
                            text = bullet.second,
                            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appTextStrong,
                        )
                    }
                }
            }
        }
    }
}

private fun communityInsightSummary(
    community: CommunityDetailDto,
    rsvp: CommunityRsvpStatus,
): String =
    if (rsvp == CommunityRsvpStatus.Going) {
        "Saved with a reminder. The organizer can see that you are coming."
    } else {
        when (community.subtype) {
            CommunityMailSubtype.Event ->
                "${community.attendeeCount} neighbors are going" +
                    (community.attendeesFromBlock?.let { " - $it from your block." } ?: ".")
            CommunityMailSubtype.Poll ->
                "A quick neighborhood poll is open. Your response helps the group pick the next step."
            CommunityMailSubtype.NeighborhoodUpdate ->
                "A verified neighborhood update was sent to households near you."
        }
    }

private fun communityInsightBullets(community: CommunityDetailDto): List<Pair<PantopusIcon, String>> =
    when (community.subtype) {
        CommunityMailSubtype.Event ->
            listOf(
                Pair(PantopusIcon.Users, "${community.attendeeCount} neighbors going"),
                Pair(PantopusIcon.Calendar, community.event?.timeRange ?: "Schedule included"),
                Pair(PantopusIcon.Info, community.event?.weatherSummary ?: "Details are ready"),
            )
        CommunityMailSubtype.Poll ->
            listOf(
                Pair(PantopusIcon.ListChecks, "${community.poll?.totalVotes ?: 0} votes so far"),
                Pair(PantopusIcon.Clock, community.poll?.closesAtLabel ?: "Poll still open"),
                Pair(PantopusIcon.ShieldCheck, "Verified residents only"),
            )
        CommunityMailSubtype.NeighborhoodUpdate ->
            listOf(
                Pair(PantopusIcon.Radio, "Neighborhood-wide note"),
                Pair(PantopusIcon.ShieldCheck, "Verified sender"),
                Pair(PantopusIcon.MessageCircle, "Discussion thread linked"),
            )
    }

@Composable
private fun CommunityBodyEventCard(
    event: CommunityEventInfo,
    accent: Color,
) {
    CommunityBodyCard(noPadding = true, modifier = Modifier.testTag("communityBody.eventCard")) {
        Column {
            CommunityBodyCardHeader("Event details")
            Column(modifier = Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                if (event.dayLabel != null || event.dateLabel != null || event.timeRange != null) {
                    EventRow(
                        icon = PantopusIcon.Calendar,
                        overline = "When",
                        title = listOfNotNull(event.dayLabel, event.dateLabel).joinToString(", "),
                        detail = event.timeRange,
                        accent = accent,
                    )
                }
                event.location?.let {
                    EventRow(
                        icon = PantopusIcon.MapPin,
                        overline = "Where",
                        title = it,
                        detail = event.locationNote ?: event.distanceLabel,
                        accent = accent,
                    )
                }
                if (event.bringItems.isNotEmpty()) BringList(event.bringItems)
                event.weatherSummary?.let { WeatherStrip(event.weatherTemperatureF, it) }
            }
        }
    }
}

@Composable
private fun EventRow(
    icon: PantopusIcon,
    overline: String,
    title: String,
    detail: String?,
    accent: Color,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Box(
            modifier =
                Modifier
                    .size(width = 52.dp, height = 56.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.successBg)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon, contentDescription = null, size = Radii.xl2, tint = accent)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = overline, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
            Text(text = title, style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold), color = PantopusColors.appText)
            detail?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary) }
        }
    }
}

@Composable
private fun BringList(items: List<String>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(text = "Bring if you can", style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Top) {
                PantopusIconImage(PantopusIcon.Check, contentDescription = null, size = Radii.lg, tint = PantopusColors.success)
                Text(text = item, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
            }
        }
    }
}

@Composable
private fun WeatherStrip(
    temp: Int?,
    summary: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(PantopusIcon.Sun, contentDescription = null, size = 18.dp, tint = PantopusColors.primary700)
        Text(
            text = temp?.let { "$it°F" } ?: "Forecast",
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.primary800,
        )
        Text(text = summary, style = PantopusTextStyle.caption, color = PantopusColors.primary700)
    }
}

@Composable
private fun CommunityBodyPollCard(
    poll: CommunityPollInfo,
    selectedOptionId: String?,
    onSelect: (String) -> Unit,
) {
    CommunityBodyCard(noPadding = true, modifier = Modifier.testTag("communityBody.pollCard")) {
        Column {
            CommunityBodyCardHeader("Poll")
            Column(modifier = Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Text(
                    text = poll.question,
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                )
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    poll.options.forEach { option ->
                        PollOptionRow(
                            option = option,
                            totalVotes = poll.totalVotes,
                            selected = selectedOptionId == option.id,
                            onSelect = onSelect,
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "${poll.totalVotes} votes", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                    poll.closesAtLabel?.let {
                        Text(text = " - closes $it", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                    }
                    Spacer(Modifier.weight(1f))
                    poll.statusLabel?.let {
                        Text(
                            text = it,
                            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.success,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PollOptionRow(
    option: CommunityPollOption,
    totalVotes: Int,
    selected: Boolean,
    onSelect: (String) -> Unit,
) {
    val share = if (totalVotes > 0) (option.voteCount.toFloat() / totalVotes.toFloat()).coerceAtLeast(0.08f) else 0f
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable { onSelect(option.id) }
                .testTag("communityBody.poll.option.${option.id}")
                .semantics {
                    contentDescription = "Vote for ${option.label}"
                    role = Role.Button
                },
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(share)
                    .background(PantopusColors.primary100),
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3).align(Alignment.CenterStart),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = if (selected) PantopusIcon.CheckCircle else PantopusIcon.Circle,
                contentDescription = null,
                size = Radii.xl,
                tint = if (selected) PantopusColors.primary600 else PantopusColors.appTextMuted,
            )
            Text(
                text = option.label,
                modifier = Modifier.weight(1f),
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "${(share * 100).toInt()}%",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.primary700,
            )
        }
    }
}

@Composable
private fun CommunityBodyUpdateCard(update: CommunityUpdateInfo) {
    CommunityBodyCard(noPadding = true, modifier = Modifier.testTag("communityBody.updateCard")) {
        Column {
            CommunityBodyCardHeader("Neighborhood update")
            Column(modifier = Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Top) {
                    Box(
                        modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.successBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(PantopusIcon.Radio, contentDescription = null, size = 18.dp, tint = PantopusColors.home)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text(
                            text = update.headline,
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold),
                            color = PantopusColors.appText,
                        )
                        update.summary?.let {
                            Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
                        }
                    }
                }
                update.items.forEach { item ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Top) {
                        PantopusIconImage(PantopusIcon.Check, contentDescription = null, size = Radii.lg, tint = PantopusColors.success)
                        Text(text = item, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
                    }
                }
                (update.footerLabel ?: update.statusLabel)?.let {
                    Text(
                        text = it,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(PantopusColors.infoBg)
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.primary700,
                    )
                }
            }
        }
    }
}

@Composable
private fun CommunityBodyAttendeesCard(
    community: CommunityDetailDto,
    isGoing: Boolean,
) {
    val visibleCount = 6
    val remaining = (community.attendeeCount - visibleCount - if (isGoing) 1 else 0).coerceAtLeast(0)
    CommunityBodyCard(noPadding = true, modifier = Modifier.testTag("communityBody.attendees")) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "${community.attendeeCount} going",
                        style = PantopusTextStyle.overline,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text =
                            if (isGoing) {
                                "Including you"
                            } else {
                                community.attendeesFromBlock?.let { "$it from your block - all verified residents" }
                                    ?: "All verified residents"
                            },
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Spacer(Modifier.weight(1f))
                Text(
                    text = "See all",
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.primary600,
                )
            }
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            Row(
                modifier =
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.Top,
            ) {
                if (isGoing) CommunityBodyAvatar("You", "You", PantopusColors.primary600, verified = false)
                community.attendees.take(visibleCount).forEach {
                    CommunityBodyAvatar(
                        initials = it.initials,
                        label = it.displayName.split(" ").firstOrNull() ?: it.displayName,
                        tint = avatarColor(it),
                        verified = it.isVerified,
                    )
                }
                if (remaining > 0) {
                    CommunityBodyAvatar("+$remaining", "more", PantopusColors.appTextStrong, verified = false, muted = true)
                }
            }
        }
    }
}

private fun avatarColor(attendee: CommunityAttendee): Color {
    val palette =
        listOf(
            PantopusColors.home,
            PantopusColors.primary600,
            PantopusColors.business,
            PantopusColors.warning,
            PantopusColors.error,
            PantopusColors.home,
        )
    val hash = attendee.initials.sumOf { it.code }
    return palette[hash % palette.size]
}

@Composable
private fun CommunityBodyAvatar(
    initials: String,
    label: String,
    tint: Color,
    verified: Boolean,
    muted: Boolean = false,
) {
    Column(
        modifier = Modifier.width(44.dp).semantics { contentDescription = label },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(36.dp), contentAlignment = Alignment.Center) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(if (muted) PantopusColors.appSurfaceSunken else tint)
                        .border(if (muted) 1.5.dp else 0.dp, if (muted) PantopusColors.appBorderStrong else Color.Transparent, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = initials,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                    color = if (muted) PantopusColors.appTextStrong else PantopusColors.appTextInverse,
                )
            }
            if (verified) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.success)
                            .border(2.dp, PantopusColors.appSurface, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Check, contentDescription = null, size = 7.dp, tint = PantopusColors.appTextInverse)
                }
            }
        }
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun CommunityBodyMessageCard(
    authorName: String,
    authorInitials: String,
    paragraphs: List<String>,
) {
    CommunityBodyCard(modifier = Modifier.testTag("communityBody.message")) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Box(
                    modifier = Modifier.size(28.dp).clip(CircleShape).background(PantopusColors.business),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = authorInitials,
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                        color = PantopusColors.appTextInverse,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        text = authorName,
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                        color = PantopusColors.appText,
                    )
                    Text(text = "posted by neighbor", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
            paragraphs.forEach {
                Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appText)
            }
        }
    }
}

@Composable
private fun CommunityBodyPulseThreadCard(
    thread: CommunityPulseThread,
    isGoing: Boolean,
) {
    CommunityBodyCard(modifier = Modifier.testTag("communityBody.pulseThread")) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Box(
                    modifier = Modifier.size(24.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.primary100),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.Radio, contentDescription = null, size = 13.dp, tint = PantopusColors.primary700)
                }
                Text(text = "Pulse thread", style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
            }
            Text(text = thread.title, style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold), color = PantopusColors.appText)
            Text(text = threadMetaLine(thread), style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            if (thread.lastReplyPreview != null && thread.lastReplyAuthor != null) {
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurfaceSunken)
                            .padding(Spacing.s2),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalAlignment = Alignment.Top,
                ) {
                    Box(
                        modifier = Modifier.size(22.dp).clip(CircleShape).background(PantopusColors.success),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = thread.lastReplyAuthor.take(2).uppercase(),
                            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                            color = PantopusColors.appTextInverse,
                        )
                    }
                    Text(
                        text = "${thread.lastReplyAuthor} ${thread.lastReplyPreview}",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextStrong,
                    )
                }
            }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.5.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                        .clickable {}
                        .testTag("communityBody.openThread")
                        .semantics {
                            contentDescription = if (isGoing) "Open thread, you're in" else "Join the thread"
                            role = Role.Button
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = if (isGoing) "Open thread - you're in" else "Join the thread",
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.primary700,
                )
                PantopusIconImage(PantopusIcon.ArrowRight, contentDescription = null, size = 14.dp, tint = PantopusColors.primary700)
            }
        }
    }
}

private fun threadMetaLine(thread: CommunityPulseThread): String {
    val parts = mutableListOf("${thread.replyCount} replies")
    if (thread.lastReplyAuthor != null && thread.lastReplyAge != null) {
        parts.add("last from ${thread.lastReplyAuthor} ${thread.lastReplyAge} ago")
    }
    return parts.joinToString(" - ")
}

@Composable
private fun CommunityBodyActions(
    rsvp: CommunityRsvpStatus,
    onRsvpChange: (CommunityRsvpStatus) -> Unit,
) {
    Column(
        modifier = Modifier.testTag("communityBody.actions"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (rsvp == CommunityRsvpStatus.Going) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(Radii.lg))
                        .clickable { onRsvpChange(CommunityRsvpStatus.Undecided) }
                        .testTag("communityBody.rsvp.change")
                        .semantics {
                            contentDescription = "Change RSVP"
                            role = Role.Button
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(PantopusIcon.CheckCircle, contentDescription = null, size = Radii.xl, tint = PantopusColors.success)
                Spacer(Modifier.width(Spacing.s2))
                Text(
                    text = "You're going - tap to change",
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.success,
                )
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                RsvpButton(CommunityRsvpStatus.Going, "Going", PantopusIcon.Check, true, onRsvpChange, Modifier.weight(1f))
                RsvpButton(CommunityRsvpStatus.Maybe, "Maybe", PantopusIcon.HelpCircle, false, onRsvpChange, Modifier.weight(1f))
                RsvpButton(CommunityRsvpStatus.NotGoing, "Can't make it", PantopusIcon.X, false, onRsvpChange, Modifier.weight(1f))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ActionChip(PantopusIcon.MessageSquarePlus, "Ask", "ask", Modifier.weight(1f))
            ActionChip(PantopusIcon.UserPlus, "Housemate", "housemate", Modifier.weight(1f))
            ActionChip(PantopusIcon.Bell, "Mute", "mute", Modifier.weight(1f))
        }
    }
}

@Composable
private fun RsvpButton(
    status: CommunityRsvpStatus,
    label: String,
    icon: PantopusIcon,
    primary: Boolean,
    onRsvpChange: (CommunityRsvpStatus) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (primary) PantopusColors.primary600 else PantopusColors.appSurface)
                .border(1.dp, if (primary) Color.Transparent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable { onRsvpChange(status) }
                .testTag("communityBody.rsvp.${status.wire}")
                .semantics {
                    contentDescription = label
                    role = Role.Button
                }
                .padding(horizontal = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = if (primary) PantopusColors.appTextInverse else PantopusColors.appText,
        )
        Spacer(Modifier.width(Spacing.s1))
        Text(
            text = label,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
            color = if (primary) PantopusColors.appTextInverse else PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ActionChip(
    icon: PantopusIcon,
    label: String,
    id: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .height(52.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable {}
                .testTag("communityBody.action.$id")
                .semantics {
                    contentDescription = label
                    role = Role.Button
                },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon, contentDescription = null, size = Radii.xl, tint = PantopusColors.appTextStrong)
        Text(
            text = label,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appTextStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun CommunityBodyCardHeader(title: String) {
    Text(
        text = title,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics { heading() },
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
    )
    HorizontalDivider(color = PantopusColors.appBorderSubtle)
}

private val fallbackCommunityUpdate =
    CommunityUpdateInfo(
        headline = "Neighborhood update",
        summary = "A verified neighborhood group shared a new update.",
        items = listOf("Open the Pulse thread for discussion.", "Household members can be added to the thread."),
        statusLabel = "Verified community mail",
        footerLabel = null,
    )

@androidx.compose.ui.tooling.preview.Preview
@Composable
private fun CommunityBodyPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg).padding(vertical = Spacing.s4)) {
        CommunityBody(
            community = MailItemSampleData.communityEvent,
            authorName = "Aliyah W.",
            authorInitials = "AW",
        )
    }
}
