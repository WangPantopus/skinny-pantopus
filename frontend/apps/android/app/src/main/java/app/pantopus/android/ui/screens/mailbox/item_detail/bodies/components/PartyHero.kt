@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.ui.components.ConfettiSpray
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.9 — Festive event hero. Three-layer card:
 *  1. Pink-gradient band carrying the trust + party-invite chips, the
 *     time-ago stamp, the "You're invited by …" eyebrow, and the serif
 *     event title. A `ConfettiSpray` overlay is anchored to the top-left.
 *  2. A `PartyDateTile` + location row that overlaps the band by 46 dp.
 *  3. Optional green confirmation banner in the going state.
 */
@Composable
fun PartyHero(
    party: PartyDetailDto,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.categoryParty.copy(alpha = 0.25f), RoundedCornerShape(Radii.lg))
                .testTag("partyHero"),
    ) {
        FestiveBand(party)
        DatePanel(
            party,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3)
                    .offset(y = (-46).dp),
        )
        if (party.rsvp == PartyRsvpStatus.Going) {
            GoingBanner(
                party,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s3)
                        .padding(bottom = Spacing.s3)
                        .offset(y = (-46).dp),
            )
        } else {
            Spacer(modifier = Modifier.size(Spacing.s0))
        }
    }
}

@Composable
private fun FestiveBand(party: PartyDetailDto) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        0.0f to PantopusColors.errorBg,
                        0.55f to PantopusColors.categoryParty.copy(alpha = 0.20f),
                        1.0f to PantopusColors.categoryParty.copy(alpha = 0.32f),
                    ),
                ),
    ) {
        ConfettiSpray(modifier = Modifier.size(width = 200.dp, height = 140.dp))

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = 60.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                TrustPill()
                PartyInvitePill()
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = party.timeAgoLabel,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.categoryParty.copy(alpha = 0.7f),
                )
            }
            val firstName = party.host.name.split(" ").firstOrNull() ?: party.host.name
            Text(
                text = "You're invited by $firstName",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp,
                color = PantopusColors.categoryParty.copy(alpha = 0.85f),
            )
            val title =
                if (party.rsvp == PartyRsvpStatus.Going) {
                    val month = party.event.date.monthLabel.lowercase().replaceFirstChar { it.uppercase() }
                    "You're going on $month ${party.event.date.dayNumber}"
                } else {
                    party.event.what
                }
            Text(
                modifier = Modifier.semantics { heading() },
                text = title,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Serif,
                letterSpacing = (-0.3).sp,
                color = PantopusColors.appText,
                lineHeight = 27.sp,
            )
        }
    }
}

@Composable
private fun DatePanel(
    party: PartyDetailDto,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PartyDateTile(
            monthLabel = party.event.date.monthLabel,
            dayNumber = party.event.date.dayNumber,
            dayLabel = party.event.date.dayLabel,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "${party.event.date.weekday} · ${party.event.date.timeRange}",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.categoryParty,
                )
                Text(
                    text = party.event.location,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextStrong,
                )
            }
            Text(
                modifier = Modifier.padding(start = 17.dp),
                text = party.event.locationNote,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun GoingBanner(
    party: PartyDetailDto,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s2, vertical = 9.dp)
                .testTag("partyHero_goingBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(20.dp).clip(CircleShape).background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Black)) {
                        append("You're going")
                    }
                    if (party.plusOneCount > 0) {
                        withStyle(SpanStyle(fontWeight = FontWeight.Black)) {
                            append(" · +${party.plusOneCount}")
                        }
                    }
                    party.rsvpConfirmedAtLabel?.let { stamp ->
                        withStyle(
                            SpanStyle(
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.success.copy(alpha = 0.85f),
                            ),
                        ) { append(" · RSVP'd $stamp") }
                    }
                },
            fontSize = 12.sp,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun TrustPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successBg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "Verified",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun PartyInvitePill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.categoryParty.copy(alpha = 0.45f), RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(PantopusColors.categoryParty))
        Text(
            text = "Party invite",
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.2.sp,
            color = PantopusColors.categoryParty,
        )
    }
}
