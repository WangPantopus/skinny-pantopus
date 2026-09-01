@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
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
 * Horizontal comparison strip of the competing bids on the gig (A17.6) —
 * one compact card per bid showing initials, amount, rating, and a
 * "cheapest" / "top-rated" flag. A "Compare all" affordance opens the full
 * bid comparison.
 */
@Composable
fun OtherBidsStrip(
    bids: List<GigDetailDto.OtherBid>,
    modifier: Modifier = Modifier,
    onCompareAll: () -> Unit = {},
) {
    Column(
        modifier = modifier.testTag("gigOtherBidsStrip"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            GigSectionLabel("THE OTHER ${bids.size} BIDS")
            Box(modifier = Modifier.weight(1f))
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onCompareAll)
                        .testTag("gigCompareAllBids")
                        .semantics { contentDescription = "Compare all bids" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text("Compare all", style = PantopusTextStyle.caption, color = PantopusColors.primary600)
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.primary600,
                )
            }
        }
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            bids.forEach { bid -> CompactCard(bid) }
        }
    }
}

@Composable
private fun CompactCard(bid: GigDetailDto.OtherBid) {
    val avatarColor: Color =
        when (bid.flag) {
            "cheapest" -> PantopusColors.success
            "top-rated" -> PantopusColors.business
            else -> PantopusColors.primary600
        }
    Column(
        modifier =
            Modifier
                .width(150.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s2)
                .semantics { contentDescription = accessibilityText(bid) },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.pill)).background(avatarColor),
                contentAlignment = Alignment.Center,
            ) {
                Text(bid.initials, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
            }
            Text("$${bid.amount}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = PantopusColors.appText)
        }
        Text(bid.who, style = PantopusTextStyle.small, color = PantopusColors.appText)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = PantopusIcon.Star,
                contentDescription = null,
                size = 9.dp,
                tint = PantopusColors.warning,
            )
            Text(
                "%.1f · ${bid.jobs} jobs".format(bid.rating),
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        bid.flag?.let { FlagPill(it) }
    }
}

@Composable
private fun FlagPill(flag: String) {
    val isCheapest = flag == "cheapest"
    Text(
        text = flag.uppercase(),
        fontSize = 9.sp,
        fontWeight = FontWeight.Black,
        color = if (isCheapest) PantopusColors.success else PantopusColors.business,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isCheapest) PantopusColors.successBg else PantopusColors.businessBg)
                .padding(horizontal = Spacing.s1, vertical = 2.dp),
    )
}

private fun accessibilityText(bid: GigDetailDto.OtherBid): String {
    val base =
        "${bid.who}, $${bid.amount}, %.1f stars, ${bid.jobs} jobs".format(bid.rating)
    return bid.flag?.let { "$base, $it" } ?: base
}
