@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "FunctionNaming",
    "LongMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.9 — RSVP action shelf. Two state shapes:
 *  - Open: three-way Going / Maybe / Can't (rose-filled Going takes more
 *    column width) + plus-one stepper + "Add to calendar" + tertiary
 *    chip row.
 *  - Going: rose "Get directions" primary CTA + 2-up Drop-+1 / Can't-make-it
 *    chip row + 3-up Message / Share / "In calendar" muted-success chip.
 */
@Composable
fun RsvpCluster(
    party: PartyDetailDto,
    inFlight: Boolean,
    onSetRsvp: (PartyRsvpStatus) -> Unit,
    onAdjustPlusOne: (Int) -> Unit,
    onAddToCalendar: () -> Unit,
    onGetDirections: () -> Unit,
    onMessageHost: () -> Unit,
    onShareInvite: () -> Unit,
    onMute: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (party.rsvp == PartyRsvpStatus.Going) {
            GoingShelf(
                party = party,
                onAdjustPlusOne = onAdjustPlusOne,
                onSetRsvp = onSetRsvp,
                onAddToCalendar = onAddToCalendar,
                onGetDirections = onGetDirections,
                onMessageHost = onMessageHost,
                onShareInvite = onShareInvite,
            )
        } else {
            OpenShelf(
                party = party,
                inFlight = inFlight,
                onSetRsvp = onSetRsvp,
                onAdjustPlusOne = onAdjustPlusOne,
                onAddToCalendar = onAddToCalendar,
                onMessageHost = onMessageHost,
                onShareInvite = onShareInvite,
                onMute = onMute,
            )
        }
    }
}

@Composable
private fun OpenShelf(
    party: PartyDetailDto,
    inFlight: Boolean,
    onSetRsvp: (PartyRsvpStatus) -> Unit,
    onAdjustPlusOne: (Int) -> Unit,
    onAddToCalendar: () -> Unit,
    onMessageHost: () -> Unit,
    onShareInvite: () -> Unit,
    onMute: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        RsvpButton(
            status = PartyRsvpStatus.Going,
            icon = PantopusIcon.PartyPopper,
            label = "Going",
            primary = true,
            inFlight = inFlight,
            onClick = onSetRsvp,
            modifier = Modifier.weight(1.4f),
        )
        RsvpButton(
            status = PartyRsvpStatus.Maybe,
            icon = PantopusIcon.HelpCircle,
            label = "Maybe",
            primary = false,
            inFlight = inFlight,
            onClick = onSetRsvp,
            modifier = Modifier.weight(1f),
        )
        RsvpButton(
            status = PartyRsvpStatus.NotGoing,
            icon = PantopusIcon.X,
            label = "Can't",
            primary = false,
            inFlight = inFlight,
            onClick = onSetRsvp,
            modifier = Modifier.weight(1f),
        )
    }
    PlusOneStepper(plusOneCount = party.plusOneCount, onAdjust = onAdjustPlusOne)
    CalendarHold(onClick = onAddToCalendar)
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Tertiary(icon = PantopusIcon.MessageSquare, label = "Ask Priya", modifier = Modifier.weight(1f), onClick = onMessageHost)
        Tertiary(icon = PantopusIcon.UserPlus, label = "Forward", modifier = Modifier.weight(1f), onClick = onShareInvite)
        Tertiary(icon = PantopusIcon.BellOff, label = "Mute", modifier = Modifier.weight(1f), onClick = onMute)
    }
}

@Composable
private fun GoingShelf(
    party: PartyDetailDto,
    onAdjustPlusOne: (Int) -> Unit,
    onSetRsvp: (PartyRsvpStatus) -> Unit,
    onAddToCalendar: () -> Unit,
    onGetDirections: () -> Unit,
    onMessageHost: () -> Unit,
    onShareInvite: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.categoryParty)
                .clickable { onGetDirections() }
                .padding(vertical = 14.dp)
                .testTag("partyRsvpCluster_directions"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Navigation,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = "Get directions · party in 2 days",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Tertiary(
            icon = PantopusIcon.UserMinus,
            label = "Drop +1",
            modifier = Modifier.weight(1f),
            onClick = { onAdjustPlusOne(maxOf(0, party.plusOneCount - 1)) },
        )
        Tertiary(
            icon = PantopusIcon.XCircle,
            label = "Can't make it",
            warn = true,
            modifier = Modifier.weight(1f),
            onClick = { onSetRsvp(PartyRsvpStatus.NotGoing) },
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Tertiary(icon = PantopusIcon.MessageSquare, label = "Message Priya", modifier = Modifier.weight(1f), onClick = onMessageHost)
        Tertiary(icon = PantopusIcon.Share, label = "Share invite", modifier = Modifier.weight(1f), onClick = onShareInvite)
        Tertiary(
            icon = PantopusIcon.CalendarCheck,
            label = "In calendar",
            muted = true,
            modifier = Modifier.weight(1f),
            onClick = onAddToCalendar,
        )
    }
}

@Composable
private fun RsvpButton(
    status: PartyRsvpStatus,
    icon: PantopusIcon,
    label: String,
    primary: Boolean,
    inFlight: Boolean,
    onClick: (PartyRsvpStatus) -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (primary) PantopusColors.categoryParty else PantopusColors.appSurface
    val border = if (primary) Color.Transparent else PantopusColors.appBorder
    val fg = if (primary) PantopusColors.appTextInverse else PantopusColors.appText
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(Radii.lg))
                .clickable(enabled = !inFlight) { onClick(status) }
                .padding(vertical = 13.dp)
                .alpha(if (inFlight) 0.6f else 1f)
                .testTag("partyRsvpCluster_${status.raw}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = fg)
        Spacer(modifier = Modifier.size(6.dp))
        Text(text = label, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = fg)
    }
}

@Composable
private fun CalendarHold(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s3)
                .testTag("partyRsvpCluster_addToCalendar"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarPlus,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.primary700,
        )
        Spacer(modifier = Modifier.size(6.dp))
        Text(
            text = "Add to calendar (hold the date)",
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun Tertiary(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    warn: Boolean = false,
    muted: Boolean = false,
) {
    val fg =
        when {
            warn -> PantopusColors.error
            muted -> PantopusColors.success
            else -> PantopusColors.appTextStrong
        }
    val bg = if (muted) PantopusColors.successBg else PantopusColors.appSurface
    val border = if (muted) PantopusColors.successLight else PantopusColors.appBorder
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = fg)
        Text(text = label, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, color = fg, maxLines = 1)
    }
}

@Composable
private fun PlusOneStepper(
    plusOneCount: Int,
    onAdjust: (Int) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("partyRsvpCluster_plusOneStepper"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.errorBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UserPlus,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.categoryParty,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = "Bring a +1?", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                text = "Priya said plus-ones are welcome",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            StepperButton(icon = PantopusIcon.Minus, primary = false) { onAdjust(maxOf(0, plusOneCount - 1)) }
            Text(
                text = "$plusOneCount",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = 6.dp),
            )
            StepperButton(icon = PantopusIcon.Plus, primary = true) { onAdjust(plusOneCount + 1) }
        }
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    primary: Boolean,
    onClick: () -> Unit,
) {
    val bg = if (primary) PantopusColors.categoryParty else PantopusColors.appSurface
    val fg = if (primary) PantopusColors.appTextInverse else PantopusColors.appTextSecondary
    val border = if (primary) Color.Transparent else PantopusColors.appBorder
    val label = if (primary) "Add a plus-one" else "Remove a plus-one"
    Box(
        modifier =
            Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(bg)
                .border(1.dp, border, CircleShape)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 12.dp, tint = fg)
    }
}
