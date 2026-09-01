@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

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
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.graphics.Brush
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
 * Bidder profile card for the Gig mail body (A17.6) — avatar (initials on
 * an identity-tinted gradient) + name + handle + blurb + a 3-up stats strip
 * (rating · jobs · response time) + skill badge chips + a "See full
 * profile" affordance.
 */
@Composable
fun BidderProfileCard(
    bidder: GigDetailDto.Bidder,
    modifier: Modifier = Modifier,
    onViewProfile: () -> Unit = {},
) {
    GigCard(modifier = modifier.testTag("gigBidderProfileCard")) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            GigSectionLabel("BIDDER")
            Header(bidder)
            StatsStrip(bidder)
            if (bidder.badges.isNotEmpty()) {
                Badges(bidder.badges)
            }
            SeeProfileButton(name = bidder.name, onViewProfile = onViewProfile)
        }
    }
}

@Composable
private fun Header(bidder: GigDetailDto.Bidder) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Avatar(bidder)
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(bidder.name, style = PantopusTextStyle.body, color = PantopusColors.appText)
                IdentityChip(bidder.identityLabel)
            }
            val handleAndBlurb =
                listOf(bidder.handle, bidder.blurb).filter { it.isNotEmpty() }.joinToString(" · ")
            Text(
                handleAndBlurb,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun Avatar(bidder: GigDetailDto.Bidder) {
    Box(contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(
                        Brush.linearGradient(
                            listOf(PantopusColors.handyman, PantopusColors.handyman.copy(alpha = 0.7f)),
                        ),
                    )
                    .semantics { contentDescription = "${bidder.name} avatar" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                bidder.initials,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appTextInverse,
            )
        }
        if (bidder.isVerified) {
            Box(
                modifier =
                    Modifier
                        .size(16.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.success)
                        .border(2.dp, PantopusColors.appSurface, RoundedCornerShape(Radii.pill)),
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
}

@Composable
private fun IdentityChip(label: String) {
    Text(
        text = label,
        style = PantopusTextStyle.overline,
        color = PantopusColors.personal,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.personalBg)
                .padding(horizontal = Spacing.s1, vertical = 2.dp)
                .semantics { contentDescription = "$label identity" },
    )
}

@Composable
private fun StatsStrip(bidder: GigDetailDto.Bidder) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatCell(modifier = Modifier.weight(1f), label = "Rating") {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Star,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    "%.1f".format(bidder.rating),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = PantopusColors.appText,
                )
            }
        }
        Divider()
        StatCell(modifier = Modifier.weight(1f), label = "Jobs done") {
            Text(
                "${bidder.jobs}",
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appText,
            )
        }
        Divider()
        StatCell(modifier = Modifier.weight(1f), label = "Responds") {
            Text(
                bidder.responseTime,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun StatCell(
    modifier: Modifier,
    label: String,
    value: @Composable () -> Unit,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        value()
        Text(label, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun Divider() {
    Box(
        modifier =
            Modifier
                .width(1.dp)
                .height(28.dp)
                .background(PantopusColors.appBorder),
    )
}

@Composable
private fun Badges(badges: List<String>) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        badges.forEach { badge ->
            Text(
                text = badge,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            )
        }
    }
}

@Composable
private fun SeeProfileButton(
    name: String,
    onViewProfile: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onViewProfile)
                .testTag("gigBidderSeeProfile")
                .semantics { contentDescription = "See $name's full profile" }
                .padding(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
    ) {
        Text("See full profile", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        PantopusIconImage(
            icon = PantopusIcon.ArrowRight,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appText,
        )
    }
}
