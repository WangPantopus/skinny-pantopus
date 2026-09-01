@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The bid headline card for the Gig mail body (A17.6) — large amount on the
 * left, unit + ETA, an expiry / "Locked in" pill on the right, and the
 * bidder's multi-line message below. Tinted with the gig accent (orange)
 * so it reads as the focal surface.
 */
@Composable
fun BidCard(
    bid: GigDetailDto.Bid,
    isAccepted: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.handyman.copy(alpha = 0.06f))
                .border(1.5.dp, PantopusColors.handyman.copy(alpha = 0.4f), RoundedCornerShape(Radii.xl))
                .testTag("gigBidCard"),
    ) {
        AmountRow(bid, isAccepted)
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.handyman.copy(alpha = 0.3f)),
        )
        MessageBlock(bid)
    }
}

@Composable
private fun AmountRow(
    bid: GigDetailDto.Bid,
    isAccepted: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text("BID AMOUNT", style = PantopusTextStyle.overline, color = PantopusColors.handyman)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    "$${bid.amount}",
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black,
                    color = PantopusColors.appTextStrong,
                )
                Text(
                    "· ${bid.unit}",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.handyman,
                    modifier = Modifier.padding(bottom = Spacing.s1),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Clock,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.handyman,
                )
                Text(bid.eta, style = PantopusTextStyle.caption, color = PantopusColors.appText)
            }
        }
        ExpiryPill(bid = bid, isAccepted = isAccepted)
    }
}

@Composable
private fun ExpiryPill(
    bid: GigDetailDto.Bid,
    isAccepted: Boolean,
) {
    val text = if (isAccepted) "Locked in" else bid.expires
    if (text.isEmpty()) return
    val tint: Color = if (isAccepted) PantopusColors.success else PantopusColors.handyman
    val background: Color = if (isAccepted) PantopusColors.successBg else PantopusColors.appSurface
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.Black,
        color = tint,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .border(1.dp, tint.copy(alpha = 0.4f), RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
    )
}

@Composable
private fun MessageBlock(bid: GigDetailDto.Bid) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text("THEIR MESSAGE", style = PantopusTextStyle.overline, color = PantopusColors.handyman)
        bid.message.forEach { paragraph ->
            Text("“$paragraph”", style = PantopusTextStyle.small, color = PantopusColors.appText)
        }
    }
}
