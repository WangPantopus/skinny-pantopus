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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BidCard
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BidderProfileCard
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.OtherBidsStrip
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.PostSummaryCard
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailKeyFact
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentKind
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentsRowContent
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
 * A17.6 — Gig ceremonial variant of the mail item detail. Mirrors iOS
 * `GigDetailLayout`. The body slot composes the gig body from existing
 * components — bid card + post summary + bidder profile + (when bids
 * are still open) the other-bids strip. The actions shelf is the
 * Accept / Counter / Decline row, collapsing to a "Bid accepted" pill
 * once the recipient accepts.
 */
@Composable
fun GigDetailLayout(
    content: MailDetailContent,
    gig: GigDetailDto,
    bidInFlight: Boolean,
    onBack: () -> Unit,
    onAccept: () -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    onSaveToVault: () -> Unit = {},
) {
    Box(modifier = Modifier.testTag("mailDetail_gig")) {
        MailItemDetailShell(
            topBar = makeTopBar(content = content, onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(gig = gig),
            attachments = makeAttachments(content = content),
            hero = { GigHeroCard(content = content, gig = gig) },
            keyFacts = { GigKeyFactsCard(rows = makeKeyFacts(gig = gig)) },
            body = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    BidCard(bid = gig.bid, isAccepted = gig.isAccepted)
                    PostSummaryCard(post = gig.post)
                    BidderProfileCard(bidder = gig.bidder)
                    if (!gig.isAccepted && gig.otherBids.isNotEmpty()) {
                        OtherBidsStrip(bids = gig.otherBids)
                    }
                }
            },
            sender = { GigSenderCard(content = content, onOpenProfile = onOpenSenderProfile) },
            actions = {
                GigDetailActions(
                    isAccepted = gig.isAccepted,
                    amount = gig.bid.amount,
                    inFlight = bidInFlight,
                    onAccept = onAccept,
                )
            },
        )
    }
}

private fun makeTopBar(
    content: MailDetailContent,
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = "Gig mail",
        trust = content.detailTrust,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save to vault",
                onClick = onSaveToVault,
            ),
        overflowItems =
            listOf(
                MailOverflowItem("openGig", PantopusIcon.Briefcase, "Open gig thread") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("report", PantopusIcon.Info, "Report bidder") {},
                MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
            ),
    )

private fun makeAIElf(gig: GigDetailDto): AIElfStripContent {
    return if (gig.isAccepted) {
        AIElfStripContent(
            headline = "Bid accepted · funds held in escrow",
            summary = "Pantopus opened the thread, set a calendar reminder, and queued next-step nudges.",
            bullets =
                listOf(
                    AIElfBullet(
                        id = "calendar",
                        icon = PantopusIcon.CalendarClock,
                        label = "Calendar reminder set",
                        text = gig.bid.eta,
                    ),
                    AIElfBullet(
                        id = "thread",
                        icon = PantopusIcon.MessageCircle,
                        label = "Thread joined",
                        text = "you can chat now",
                    ),
                    AIElfBullet(
                        id = "escrow",
                        icon = PantopusIcon.ShieldCheck,
                        label = "Funds escrowed",
                        text = "released after the job",
                    ),
                ),
        )
    } else {
        val otherCount = gig.otherBids.size
        AIElfStripContent(
            headline = "Pantopus read this bid for you",
            summary =
                "Compare against the $otherCount other bid${if (otherCount == 1) "" else "s"} on the same gig before you accept.",
            bullets =
                listOf(
                    AIElfBullet(id = "amount", icon = PantopusIcon.Info, label = "$${gig.bid.amount} ${gig.bid.unit}"),
                    AIElfBullet(id = "eta", icon = PantopusIcon.CalendarClock, label = gig.bid.eta),
                    AIElfBullet(id = "expires", icon = PantopusIcon.Clock, label = gig.bid.expires),
                ),
        )
    }
}

private fun makeAttachments(content: MailDetailContent): AttachmentsRowContent? {
    if (content.attachments.isEmpty()) return null
    val items =
        content.attachments.mapIndexed { index, name ->
            AttachmentItem(id = "att-$index", kind = AttachmentKind.Other, name = name)
        }
    return AttachmentsRowContent(items = items)
}

private fun makeKeyFacts(gig: GigDetailDto): List<MailDetailKeyFact> =
    buildList {
        add(MailDetailKeyFact(icon = PantopusIcon.Briefcase, label = "Gig", value = gig.post.title))
        add(
            MailDetailKeyFact(
                icon = PantopusIcon.Clock,
                label = "When",
                value = gig.post.schedule.ifEmpty { gig.bid.eta },
            ),
        )
        if (gig.post.location.isNotEmpty()) {
            add(MailDetailKeyFact(icon = PantopusIcon.MapPin, label = "Where", value = gig.post.location))
        }
        if (gig.post.budget.isNotEmpty()) {
            add(MailDetailKeyFact(icon = PantopusIcon.Hash, label = "Budget", value = gig.post.budget))
        }
    }

@Composable
private fun GigHeroCard(
    content: MailDetailContent,
    gig: GigDetailDto,
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
                color = PantopusColors.appText,
                lineHeight = 24.sp,
                modifier = Modifier.semantics { heading() },
            )
            if (gig.isAccepted) {
                AcceptedPill(amount = gig.bid.amount)
            } else {
                content.excerpt?.takeIf { it.isNotEmpty() }?.let {
                    Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                }
            }
        }
    }
}

@Composable
private fun AcceptedPill(amount: Int) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .testTag("mailDetail_gig_acceptedPill"),
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
            text = "Bid accepted · $$amount",
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
private fun GigKeyFactsCard(rows: List<MailDetailKeyFact>) {
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
            text = "BID FACTS",
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
private fun GigSenderCard(
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
private fun GigDetailActions(
    isAccepted: Boolean,
    amount: Int,
    inFlight: Boolean,
    onAccept: () -> Unit,
) {
    if (isAccepted) {
        AcceptedShelf()
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ActionButton(
                id = "accept",
                label = "Accept · $$amount",
                icon = PantopusIcon.Check,
                background = PantopusColors.success,
                foreground = PantopusColors.appTextInverse,
                inFlight = inFlight,
                onClick = onAccept,
                modifier = Modifier.weight(1f),
            )
            ActionButton(
                id = "counter",
                label = "Counter",
                icon = PantopusIcon.ArrowsRepeat,
                background = PantopusColors.appSurface,
                foreground = PantopusColors.appText,
                borderColor = PantopusColors.appBorder,
                inFlight = false,
                onClick = {},
                modifier = Modifier.weight(1f),
            )
            ActionButton(
                id = "decline",
                label = "Decline",
                icon = PantopusIcon.X,
                background = PantopusColors.error,
                foreground = PantopusColors.appTextInverse,
                inFlight = false,
                onClick = {},
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun AcceptedShelf() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.successBg)
                .border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                .padding(vertical = 14.dp)
                .testTag("mailDetail_gig_acceptedShelf"),
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
            text = "Bid accepted · funds in escrow",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun ActionButton(
    id: String,
    label: String,
    icon: PantopusIcon,
    background: Color,
    foreground: Color,
    borderColor: Color = Color.Transparent,
    inFlight: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .border(1.dp, borderColor, RoundedCornerShape(Radii.lg))
                .clickable(enabled = !inFlight, onClick = onClick)
                .padding(vertical = Spacing.s3)
                .alpha(if (inFlight) 0.6f else 1f)
                .semantics { contentDescription = label }
                .testTag("mailDetail_gig_$id"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = foreground,
        )
        Spacer(Modifier.width(5.dp))
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
            maxLines = 1,
        )
    }
}
