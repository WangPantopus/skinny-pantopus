@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "ComplexMethod",
    "LargeClass",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.variants

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
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.CommunityAttendee
import app.pantopus.android.data.api.models.mailbox.v2.CommunityDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityEventInfo
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPulseThread
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpStatus
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
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
 * T6.5d (P22) — Community (A17.4) variant layout. Mirrors iOS
 * `CommunityDetailLayout`. Replaces the generic shell body with a
 * stack of community-specific cards: badge (HOA crest), event details
 * (when/where/bring/weather), attendees strip, author body, optional
 * pulse-thread cross-link. Actions slot is the RSVP chip row.
 */
@Composable
fun CommunityDetailLayout(
    content: MailDetailContent,
    community: CommunityDetailDto,
    rsvpInFlight: Boolean,
    onBack: () -> Unit,
    onRsvp: (CommunityRsvpStatus) -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    // T6.5e (P19.5) — Defaults to a no-op so existing call sites
    // compile unchanged.
    onSaveToVault: () -> Unit = {},
) {
    Box(modifier = Modifier.testTag("mailDetail_community")) {
        MailItemDetailShell(
            topBar = makeTopBar(onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(content = content, community = community),
            attachments = buildAttachments(content.attachments),
            hero = { CommunityHeroCard(content = content, community = community) },
            keyFacts = { CommunityBadgeCard(community = community) },
            body = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    community.event?.let { CommunityEventCard(it, accent = content.category.accent) }
                    CommunityAttendeesStrip(
                        attendees = community.attendees,
                        attendeeCount = community.attendeeCount,
                        attendeesFromBlock = community.attendeesFromBlock,
                        going = community.rsvp == CommunityRsvpStatus.Going,
                    )
                    if (content.bodyParagraphs.isNotEmpty()) {
                        CommunityBodyCard(
                            paragraphs = content.bodyParagraphs,
                            authorName = content.senderDisplayName,
                            authorInitials = content.senderInitials,
                        )
                    }
                    community.pulseThread?.let {
                        CommunityPulseThreadCard(
                            thread = it,
                            going = community.rsvp == CommunityRsvpStatus.Going,
                        )
                    }
                }
            },
            sender = { CommunitySenderCard(content = content, onOpenProfile = onOpenSenderProfile) },
            actions = {
                CommunityRsvpActions(
                    rsvp = community.rsvp,
                    inFlight = rsvpInFlight,
                    onSelect = onRsvp,
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
        eyebrow = "Community mail",
        trust = MailDetailTrust.Verified,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save to vault",
                onClick = { onSaveToVault() },
            ),
        overflowItems =
            listOf(
                MailOverflowItem("share", PantopusIcon.Share, "Share") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("addToCalendar", PantopusIcon.Calendar, "Add to calendar") {},
                MailOverflowItem("mute", PantopusIcon.Bell, "Mute thread") {},
                MailOverflowItem("report", PantopusIcon.Info, "Report") {},
                MailOverflowItem("delete", PantopusIcon.Trash2, "Delete", isDestructive = true) {},
            ),
    )

private fun makeAIElf(
    content: MailDetailContent,
    community: CommunityDetailDto,
): AIElfStripContent {
    val going = community.rsvp == CommunityRsvpStatus.Going
    val summary = content.aiSummary ?: defaultElfSummary(community = community, going = going)
    val bullets = if (going) makeGoingBullets(community) else makeOpenBullets(community)
    return AIElfStripContent(
        headline = if (going) "You're going to this" else "Pantopus read this for you",
        summary = summary,
        bullets = bullets,
    )
}

private fun defaultElfSummary(
    community: CommunityDetailDto,
    going: Boolean,
): String {
    if (going) {
        return "Saved to your calendar with a reminder. The organizer was notified you're coming."
    }
    val neighbors = community.attendeeCount
    val block = community.attendeesFromBlock ?: 0
    var line = "$neighbors neighbor${if (neighbors == 1) "" else "s"} going"
    if (block > 0) line += " · $block from your block"
    community.event?.weatherSummary?.let { line += ". Weather: ${it.lowercase()}." }
    if (community.event?.weatherSummary == null) line += "."
    return line
}

private fun makeOpenBullets(community: CommunityDetailDto): List<AIElfBullet> {
    val list = mutableListOf<AIElfBullet>()
    list.add(
        AIElfBullet(
            id = "neighbors",
            icon = PantopusIcon.Users,
            label = "${community.attendeeCount} neighbors going",
            text = community.attendeesFromBlock?.let { "$it from your block" },
        ),
    )
    val event = community.event
    if (event != null) {
        val temp = event.weatherTemperatureF
        val summary = event.weatherSummary
        if (temp != null && summary != null) {
            list.add(AIElfBullet(id = "weather", icon = PantopusIcon.Info, label = "$temp° ${summary.lowercase()}", text = null))
        }
        if (event.dayLabel != null) {
            list.add(AIElfBullet(id = "calendar", icon = PantopusIcon.Calendar, label = "Your ${event.dayLabel} is clear", text = null))
        }
    }
    return list
}

private fun makeGoingBullets(community: CommunityDetailDto): List<AIElfBullet> {
    val list = mutableListOf<AIElfBullet>()
    list.add(
        AIElfBullet(
            id = "calendar-added",
            icon = PantopusIcon.CalendarClock,
            label = "Calendar event added",
            text = "reminder set",
        ),
    )
    if (community.pulseThread != null) {
        list.add(
            AIElfBullet(
                id = "day-of",
                icon = PantopusIcon.MessageCircle,
                label = "Day-of thread joined",
                text = "so you can find folks when you arrive",
            ),
        )
    }
    if (community.event?.weatherSummary != null) {
        list.add(
            AIElfBullet(
                id = "weather-watch",
                icon = PantopusIcon.Info,
                label = "Weather watch on",
                text = "we'll ping if forecast changes",
            ),
        )
    }
    return list
}

private fun buildAttachments(names: List<String>): AttachmentsRowContent? {
    if (names.isEmpty()) return null
    val items =
        names.mapIndexed { idx, name ->
            AttachmentItem(id = "att-$idx", kind = AttachmentKind.Other, name = name)
        }
    return AttachmentsRowContent(items = items)
}

// ─── Hero ───────────────────────────────────────────────

@Composable
private fun CommunityHeroCard(
    content: MailDetailContent,
    community: CommunityDetailDto,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Box(modifier = Modifier.width(4.dp).fillMaxHeight().background(content.category.accent))
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CategoryBadge(category = content.category)
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
                text = content.title,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                lineHeight = 24.sp,
            )
            content.excerpt?.takeIf { it.isNotEmpty() }?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
            if (community.rsvp == CommunityRsvpStatus.Going) {
                GoingChip()
            }
        }
    }
}

@Composable
private fun GoingChip() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .testTag("mailDetail_community_goingChip"),
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
            text = "You're going",
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

// ─── Badge card ─────────────────────────────────────────

@Composable
private fun CommunityBadgeCard(community: CommunityDetailDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(
                    Brush.linearGradient(
                        colors = listOf(PantopusColors.successBg, PantopusColors.appSurface),
                    ),
                )
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailDetail_community_badge"),
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
                        .border(2.dp, PantopusColors.success, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 26.dp,
                    tint = PantopusColors.success,
                )
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
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 9.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = community.group.name,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                if (community.group.isVerified) {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.successBg)
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            text = "VERIFIED HOA",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.success,
                        )
                    }
                }
            }
            community.group.tagline?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                community.group.role?.let { role ->
                    Row(
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
                            text = role + (community.group.membershipSince?.let { " · since $it" } ?: ""),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextStrong,
                        )
                    }
                }
                community.group.memberCount?.let { count ->
                    Text(
                        text = "$count members",
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

// ─── Event details ──────────────────────────────────────

@Composable
private fun CommunityEventCard(
    event: CommunityEventInfo,
    accent: Color,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("mailDetail_community_eventCard"),
    ) {
        Text(
            text = "EVENT DETAILS",
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
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (event.dayLabel != null || event.dateLabel != null || event.timeRange != null) {
                WhenRow(event = event, accent = accent)
            }
            if (event.location != null) {
                WhereRow(event = event, accent = accent)
            }
            if (event.bringItems.isNotEmpty()) {
                BringList(items = event.bringItems)
            }
            event.weatherSummary?.let { summary ->
                WeatherStrip(temp = event.weatherTemperatureF, summary = summary)
            }
        }
    }
}

@Composable
private fun WhenRow(
    event: CommunityEventInfo,
    accent: Color,
) {
    val dateText =
        listOfNotNull(event.dayLabel, event.dateLabel)
            .joinToString(", ")

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        DateChip(day = event.dayLabel, date = event.dateLabel, accent = accent)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = "WHEN",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = dateText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            event.timeRange?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun WhereRow(
    event: CommunityEventInfo,
    accent: Color,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        MiniMap(accent = accent)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = "WHERE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = event.location.orEmpty(),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            event.locationNote?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
            event.distanceLabel?.let {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    modifier = Modifier.padding(top = 2.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ArrowRight,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.primary600,
                    )
                    Text(
                        text = it,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                    )
                }
            }
        }
    }
}

@Composable
private fun BringList(items: List<String>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = "BRING IF YOU CAN",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        items.forEach { item ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Top,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.success,
                    modifier = Modifier.padding(top = 3.dp),
                )
                Text(
                    text = item,
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextStrong,
                )
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
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary700,
        )
        if (temp != null) {
            Text(
                text = "$temp°F",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary800,
            )
        }
        Text(
            text = summary,
            fontSize = 12.sp,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun DateChip(
    day: String?,
    date: String?,
    accent: Color,
) {
    val monthAbbr = date?.split(" ")?.firstOrNull().orEmpty()
    val dayNum = date?.split(" ")?.getOrNull(1).orEmpty()
    Column(
        modifier =
            Modifier
                .size(width = 52.dp, height = 56.dp)
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp)),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(accent)
                    .padding(vertical = 3.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = monthAbbr.uppercase(),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Text(
                text = dayNum,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            day?.let {
                Text(
                    text = it.uppercase(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.4.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// Abstract mini-map preview (community.jsx MiniMap): park block +
// crossing paths + tree dots under a centered drop pin. Purely
// decorative — geometry mirrors the design's 52×56 SVG.
@Composable
private fun MiniMap(accent: Color) {
    Box(
        modifier =
            Modifier
                .size(width = 52.dp, height = 56.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))
                .testTag("mailDetail_community_miniMap"),
    ) {
        Box(
            Modifier
                .offset(x = 6.dp, y = 14.dp)
                .size(width = 40.dp, height = 28.dp)
                .background(PantopusColors.successLight),
        )
        Box(
            Modifier
                .offset(y = 20.dp)
                .size(width = 52.dp, height = 3.dp)
                .background(PantopusColors.appSurface),
        )
        Box(
            Modifier
                .offset(x = 20.dp)
                .size(width = 3.dp, height = 56.dp)
                .background(PantopusColors.appSurface),
        )
        Box(
            Modifier
                .offset(x = 8.dp, y = 16.dp)
                .size(4.dp)
                .alpha(0.7f)
                .background(PantopusColors.success, CircleShape),
        )
        Box(
            Modifier
                .offset(x = 36.dp, y = 34.dp)
                .size(4.dp)
                .alpha(0.7f)
                .background(PantopusColors.success, CircleShape),
        )
        Box(
            Modifier
                .offset(x = 38.dp, y = 16.dp)
                .size(3.dp)
                .alpha(0.7f)
                .background(PantopusColors.success, CircleShape),
        )
        MapPinDrop(
            accent = accent,
            pinSize = 18.dp,
            modifier = Modifier.offset(x = 17.dp, y = 11.dp),
        )
    }
}

// Teardrop map pin — rounded square with one sharp corner, rotated so
// the point faces down (JSX `borderRadius: '50% 50% 50% 0'` trick).
@Composable
private fun MapPinDrop(
    accent: Color,
    pinSize: Dp,
    modifier: Modifier = Modifier,
) {
    val teardrop =
        RoundedCornerShape(
            topStart = pinSize / 2,
            topEnd = pinSize / 2,
            bottomEnd = pinSize / 2,
            bottomStart = 0.dp,
        )
    Box(
        modifier =
            modifier
                .size(pinSize)
                .rotate(-45f)
                .clip(teardrop)
                .background(accent)
                .border(2.dp, PantopusColors.appSurface, teardrop),
    )
}

// ─── Attendees strip ────────────────────────────────────

@Composable
private fun CommunityAttendeesStrip(
    attendees: List<CommunityAttendee>,
    attendeeCount: Int,
    attendeesFromBlock: Int?,
    going: Boolean,
) {
    val visibleSlots = 6
    val visible = attendees.take(visibleSlots)
    val remaining = (attendeeCount - visibleSlots - if (going) 1 else 0).coerceAtLeast(0)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("mailDetail_community_attendees"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
                Text(
                    text = "$attendeeCount GOING",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
                val subtitle =
                    if (going) {
                        "Including you"
                    } else {
                        attendeesFromBlock?.let { "$it from your block · all verified residents" }
                            ?: "All verified residents"
                    }
                Text(
                    text = subtitle,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = "See all",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary600,
                )
            }
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
            if (going) YouAvatar()
            visible.forEach { AvatarBubble(it) }
            if (remaining > 0) OverflowBubble(remaining)
        }
    }
}

@Composable
private fun AvatarBubble(attendee: CommunityAttendee) {
    val palette =
        listOf(
            PantopusColors.home,
            PantopusColors.tutoring,
            PantopusColors.business,
            PantopusColors.handyman,
            PantopusColors.error,
            PantopusColors.cleaning,
        )
    val hash = attendee.initials.sumOf { it.code }
    val bg = palette[hash % palette.size]
    Column(
        modifier = Modifier.width(44.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(36.dp)) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(bg),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = attendee.initials,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            if (attendee.isVerified) {
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
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 7.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Text(
            text = attendee.displayName.split(" ").firstOrNull() ?: attendee.displayName,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
        )
    }
}

@Composable
private fun YouAvatar() {
    Column(
        modifier = Modifier.width(44.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(PantopusColors.primary500, PantopusColors.primary700),
                        ),
                    )
                    .border(2.5.dp, PantopusColors.primary300, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "You",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = "You",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun OverflowBubble(count: Int) {
    Column(
        modifier = Modifier.width(44.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.5.dp, PantopusColors.appBorderStrong, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "+$count",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
        }
        Text(
            text = "more",
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// ─── Body card ──────────────────────────────────────────

@Composable
private fun CommunityBodyCard(
    paragraphs: List<String>,
    authorName: String,
    authorInitials: String,
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
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.business),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = authorInitials,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = authorName,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "posted by neighbor",
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        paragraphs.forEach {
            Text(
                text = it,
                fontSize = 14.sp,
                color = PantopusColors.appText,
                lineHeight = 21.sp,
            )
        }
    }
}

// ─── Pulse thread cross-link ────────────────────────────

@Composable
private fun CommunityPulseThreadCard(
    thread: CommunityPulseThread,
    going: Boolean,
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
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.primary100),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.primary700,
                )
            }
            Text(
                text = "PULSE THREAD",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = thread.title,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        val meta =
            buildString {
                append("${thread.replyCount} replies")
                if (thread.lastReplyAuthor != null && thread.lastReplyAge != null) {
                    append(" · last from ${thread.lastReplyAuthor} ${thread.lastReplyAge} ago")
                }
            }
        Text(text = meta, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        if (thread.lastReplyPreview != null && thread.lastReplyAuthor != null) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.success),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = thread.lastReplyAuthor.take(2).uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
                Text(
                    text = "${thread.lastReplyAuthor}: ${thread.lastReplyPreview}",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.appSurface)
                    .border(1.5.dp, PantopusColors.primary200, RoundedCornerShape(10.dp))
                    .clickable {}
                    .padding(vertical = 9.dp)
                    .testTag("mailDetail_community_pulseThread"),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = if (going) "Open thread · you're in" else "Join the thread",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.primary700,
                )
            }
        }
    }
}

// ─── Sender ─────────────────────────────────────────────

@Composable
private fun CommunitySenderCard(
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
                Row(
                    modifier = Modifier.padding(top = 2.dp),
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
                        text = "Verified neighbor",
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
}

// ─── RSVP actions ───────────────────────────────────────

@Composable
fun CommunityRsvpActions(
    rsvp: CommunityRsvpStatus,
    inFlight: Boolean,
    onSelect: (CommunityRsvpStatus) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (rsvp == CommunityRsvpStatus.Going) {
            GoingPill(inFlight = inFlight, onChange = { onSelect(CommunityRsvpStatus.Undecided) })
        } else {
            RsvpChipRow(inFlight = inFlight, onSelect = onSelect)
        }
        SecondaryRow()
    }
}

@Composable
private fun GoingPill(
    inFlight: Boolean,
    onChange: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                .clickable(enabled = !inFlight, onClick = onChange)
                .padding(vertical = 14.dp)
                .alpha(if (inFlight) 0.6f else 1f)
                .semantics { contentDescription = "You're going. Tap to change." }
                .testTag("mailDetail_community_goingPill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.success,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "You're going · tap to change",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun RsvpChipRow(
    inFlight: Boolean,
    onSelect: (CommunityRsvpStatus) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        RsvpChip(
            status = CommunityRsvpStatus.Going,
            icon = PantopusIcon.Check,
            label = "Going",
            isPrimary = true,
            inFlight = inFlight,
            modifier = Modifier.weight(1f),
            onSelect = onSelect,
        )
        RsvpChip(
            status = CommunityRsvpStatus.Maybe,
            icon = PantopusIcon.Info,
            label = "Maybe",
            isPrimary = false,
            inFlight = inFlight,
            modifier = Modifier.weight(1f),
            onSelect = onSelect,
        )
        RsvpChip(
            status = CommunityRsvpStatus.NotGoing,
            icon = PantopusIcon.X,
            label = "Can't make it",
            isPrimary = false,
            inFlight = inFlight,
            modifier = Modifier.weight(1f),
            onSelect = onSelect,
        )
    }
}

@Composable
private fun RsvpChip(
    status: CommunityRsvpStatus,
    icon: PantopusIcon,
    label: String,
    isPrimary: Boolean,
    inFlight: Boolean,
    modifier: Modifier = Modifier,
    onSelect: (CommunityRsvpStatus) -> Unit,
) {
    val bg = if (isPrimary) PantopusColors.primary600 else PantopusColors.appSurface
    val fg = if (isPrimary) PantopusColors.appTextInverse else PantopusColors.appText
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .then(
                    if (isPrimary) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    },
                )
                .clickable(enabled = !inFlight) { onSelect(status) }
                .padding(vertical = Spacing.s3)
                .alpha(if (inFlight) 0.6f else 1f)
                .semantics { contentDescription = label }
                .testTag("mailDetail_community_rsvp_${status.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = fg)
        Spacer(Modifier.width(5.dp))
        Text(text = label, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = fg, maxLines = 1)
    }
}

@Composable
private fun SecondaryRow() {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SecondaryChip(
            icon = PantopusIcon.MessageSquarePlus,
            label = "Ask a question",
            id = "mailDetail_community_ask",
            modifier = Modifier.weight(1f),
        )
        SecondaryChip(
            icon = PantopusIcon.Users,
            label = "Add housemate",
            id = "mailDetail_community_addHousemate",
            modifier = Modifier.weight(1f),
        )
        SecondaryChip(
            icon = PantopusIcon.Bell,
            label = "Mute thread",
            id = "mailDetail_community_mute",
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun SecondaryChip(
    icon: PantopusIcon,
    label: String,
    id: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable {}
                .padding(vertical = 10.dp)
                .semantics { contentDescription = label }
                .testTag(id),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = Radii.xl, tint = PantopusColors.appTextStrong)
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
            maxLines = 2,
        )
    }
}
