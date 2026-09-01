@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.PartyAttendee
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.9 — "+N going" friend pile. Section header carries the headcount
 * + maybe count + a "See all" affordance; body wraps the friend avatars
 * with a +N plus-one badge stacked on each. In the going state a
 * primary-tinted "You" avatar is prepended so the user reads as part of
 * the pile.
 */
@Composable
fun GoingStrip(
    party: PartyDetailDto,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("partyGoingStrip"),
    ) {
        Header(party)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        AvatarFlow(party)
    }
}

@Composable
private fun Header(party: PartyDetailDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "${party.headcount} GOING · ${party.maybeCount} MAYBE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text =
                    if (party.rsvp == PartyRsvpStatus.Going) {
                        "Including you + ${party.plusOneCount}"
                    } else {
                        "5 friends · 2 plus-ones"
                    },
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "See all",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun AvatarFlow(party: PartyDetailDto) {
    FlowRow(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        spacing = Spacing.s2,
    ) {
        if (party.rsvp == PartyRsvpStatus.Going) {
            YouAvatar(plusCount = party.plusOneCount)
        }
        party.goingAttendees.forEach { attendee ->
            AttendeeAvatar(attendee = attendee)
        }
    }
}

@Composable
private fun AttendeeAvatar(attendee: PartyAttendee) {
    Column(
        modifier =
            Modifier
                .widthIn(min = 44.dp)
                .testTag("partyGoingStrip_attendee_${attendee.id}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(40.dp)) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(attendee.accent.color()),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = attendee.initials,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            if (attendee.plusCount > 0) {
                PlusBadge(text = "+${attendee.plusCount}", modifier = Modifier.align(Alignment.BottomEnd))
            }
        }
        Text(
            text = attendee.name,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
        )
    }
}

@Composable
private fun YouAvatar(plusCount: Int) {
    Column(
        modifier =
            Modifier
                .widthIn(min = 44.dp)
                .testTag("partyGoingStrip_you"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(40.dp)) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(PantopusColors.primary500, PantopusColors.primary700),
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
            PlusBadge(
                text = if (plusCount > 0) "+$plusCount" else "+1",
                modifier = Modifier.align(Alignment.BottomEnd),
            )
        }
        Text(
            text = "You",
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Black,
            color = PantopusColors.primary700,
            maxLines = 1,
        )
    }
}

@Composable
private fun PlusBadge(
    text: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.categoryParty)
                .border(2.dp, PantopusColors.appSurface, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s1, vertical = 1.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = PantopusColors.appTextInverse,
        )
    }
}

/** Map the data-side accent enum onto the design system. View stays out
 *  of the hex palette. */
private fun PartyAttendee.AccentTint.color(): Color =
    when (this) {
        PartyAttendee.AccentTint.Home -> PantopusColors.home
        PartyAttendee.AccentTint.Personal -> PantopusColors.personal
        PartyAttendee.AccentTint.Business -> PantopusColors.business
        PartyAttendee.AccentTint.Warning -> PantopusColors.handyman
        PartyAttendee.AccentTint.Error -> PantopusColors.error
        PartyAttendee.AccentTint.Primary -> PantopusColors.primary600
        PartyAttendee.AccentTint.Party -> PantopusColors.categoryParty
    }

/** Minimal flow layout — wraps children left-to-right and starts a new
 *  line when the next item would overflow the available width. */
@Composable
private fun FlowRow(
    modifier: Modifier = Modifier,
    spacing: Dp,
    content: @Composable () -> Unit,
) {
    Layout(modifier = modifier, content = content) { measurables, constraints ->
        val spacingPx = spacing.roundToPx()
        var x = 0
        var y = 0
        var rowHeight = 0
        val placements = mutableListOf<Triple<androidx.compose.ui.layout.Placeable, Int, Int>>()
        measurables.forEach { measurable ->
            val placeable = measurable.measure(constraints.copy(minWidth = 0))
            if (x + placeable.width > constraints.maxWidth && x > 0) {
                x = 0
                y += rowHeight + spacingPx
                rowHeight = 0
            }
            placements += Triple(placeable, x, y)
            x += placeable.width + spacingPx
            rowHeight = maxOf(rowHeight, placeable.height)
        }
        val totalHeight = y + rowHeight
        layout(constraints.maxWidth, totalHeight) {
            placements.forEach { (placeable, px, py) -> placeable.placeRelative(px, py) }
        }
    }
}
