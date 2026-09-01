@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepState
import app.pantopus.android.ui.components.TimelineStepper
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BidCard
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BidderProfileCard
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.GigCard
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.GigSectionLabel
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.OtherBidsStrip
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.PostSummaryCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Concrete body for the Gig mailbox category (A17.6 "bid on your gig").
 * Renders inside `MailboxItemDetailShell`'s body slot. Two states:
 *  - received  → bidder + post + bid cards, the other-bids strip, and a
 *                three-way Accept / Counter / Decline action row.
 *  - accepted  → the action row is replaced by a next-steps timeline and a
 *                primary "Open thread" CTA.
 */
@Composable
fun GigBody(
    gig: GigDetailDto,
    modifier: Modifier = Modifier,
    onAccept: () -> Unit = {},
    onCounter: () -> Unit = {},
    onDecline: () -> Unit = {},
    onOpenThread: () -> Unit = {},
    onOpenGig: () -> Unit = {},
    onViewProfile: () -> Unit = {},
    onCompareBids: () -> Unit = {},
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("gigBody"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (gig.isAccepted) {
            AcceptedBanner()
        }
        BidderProfileCard(bidder = gig.bidder, onViewProfile = onViewProfile)
        PostSummaryCard(post = gig.post, onOpenGig = onOpenGig)
        BidCard(bid = gig.bid, isAccepted = gig.isAccepted)

        if (gig.isAccepted) {
            NextStepsCard(steps = gig.nextSteps)
            PrimaryButton(
                title = "Open thread",
                onClick = onOpenThread,
                modifier = Modifier.fillMaxWidth().testTag("gigOpenThreadButton"),
            )
        } else {
            if (gig.otherBids.isNotEmpty()) {
                OtherBidsStrip(bids = gig.otherBids, onCompareAll = onCompareBids)
            }
            ActionRow(
                amount = gig.bid.amount,
                onAccept = onAccept,
                onCounter = onCounter,
                onDecline = onDecline,
            )
        }
    }
}

@Composable
private fun AcceptedBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.successBg)
                .padding(Spacing.s2)
                .testTag("gigAcceptedBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(20.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            "Bid accepted · funds held in escrow",
            style = PantopusTextStyle.small,
            color = PantopusColors.success,
        )
    }
}

/** Accept (success) · Counter (ghost) · Decline (destructive). Equal width. */
@Composable
private fun ActionRow(
    amount: Int,
    onAccept: () -> Unit,
    onCounter: () -> Unit,
    onDecline: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("gigActionRow"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ActionButton(
            icon = PantopusIcon.Check,
            label = "Accept · $$amount",
            kind = ActionKind.Success,
            tag = "gigAcceptButton",
            onClick = onAccept,
            modifier = Modifier.weight(1f),
        )
        ActionButton(
            icon = PantopusIcon.ArrowsRepeat,
            label = "Counter",
            kind = ActionKind.Ghost,
            tag = "gigCounterButton",
            onClick = onCounter,
            modifier = Modifier.weight(1f),
        )
        ActionButton(
            icon = PantopusIcon.X,
            label = "Decline",
            kind = ActionKind.Destructive,
            tag = "gigDeclineButton",
            onClick = onDecline,
            modifier = Modifier.weight(1f),
        )
    }
}

private enum class ActionKind { Success, Ghost, Destructive }

@Composable
private fun ActionButton(
    icon: PantopusIcon,
    label: String,
    kind: ActionKind,
    tag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val foreground: Color = if (kind == ActionKind.Ghost) PantopusColors.appText else PantopusColors.appTextInverse
    val background: Color =
        when (kind) {
            ActionKind.Success -> PantopusColors.success
            ActionKind.Ghost -> PantopusColors.appSurface
            ActionKind.Destructive -> PantopusColors.error
        }
    Row(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .then(
                    if (kind == ActionKind.Ghost) {
                        Modifier.border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    } else {
                        Modifier
                    },
                )
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics { contentDescription = label }
                .padding(vertical = Spacing.s2, horizontal = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = foreground)
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun NextStepsCard(steps: List<GigDetailDto.NextStep>) {
    GigCard(modifier = Modifier.testTag("gigNextStepsCard")) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            GigSectionLabel("WHAT HAPPENS NEXT")
            TimelineStepper(steps = steps.map(::toTimelineStep))
        }
    }
}

private fun toTimelineStep(step: GigDetailDto.NextStep): TimelineStep =
    TimelineStep(
        title = step.label,
        subtitle = step.whenText,
        state =
            when (step.state) {
                GigDetailDto.StepState.Active -> TimelineStepState.Done
                GigDetailDto.StepState.Pending -> TimelineStepState.Current
                GigDetailDto.StepState.Upcoming -> TimelineStepState.Upcoming
            },
    )
