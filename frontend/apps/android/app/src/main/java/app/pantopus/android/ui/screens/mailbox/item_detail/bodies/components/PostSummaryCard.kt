@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
 * Summary of the gig being bid on (A17.6). The whole card is tappable and
 * opens the gig detail thread. Shows a thumbnail with a category chip, the
 * title + posted/expires meta, budget/schedule chips, the details blurb,
 * and a bid-count footer.
 */
@Composable
fun PostSummaryCard(
    post: GigDetailDto.Post,
    modifier: Modifier = Modifier,
    onOpenGig: () -> Unit = {},
) {
    GigCard(
        modifier =
            modifier
                .clickable(onClick = onOpenGig)
                .testTag("gigPostSummaryCard")
                .semantics {
                    contentDescription =
                        "Your gig: ${post.title}. ${post.bidCount} bids received. Opens the gig thread."
                },
        padded = false,
    ) {
        Header()
        BodyRow(post)
        if (post.details.isNotEmpty()) {
            Text(
                post.details,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s3).padding(bottom = Spacing.s3),
            )
        }
        Footer(post.bidCount)
    }
}

@Composable
private fun Header() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .padding(top = Spacing.s3, bottom = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GigSectionLabel("YOUR GIG")
        Box(modifier = Modifier.weight(1f))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ExternalLink,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.primary600,
            )
            Text("Open gig", style = PantopusTextStyle.caption, color = PantopusColors.primary600)
        }
    }
}

@Composable
private fun BodyRow(post: GigDetailDto.Post) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3).padding(bottom = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Thumbnail(post.categoryLabel)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(post.title, style = PantopusTextStyle.body, color = PantopusColors.appText)
            val meta = listOf(post.posted, post.expires).filter { it.isNotEmpty() }.joinToString(" · ")
            Text(meta, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                if (post.budget.isNotEmpty()) SummaryChip(PantopusIcon.DollarSign, post.budget)
                if (post.schedule.isNotEmpty()) SummaryChip(PantopusIcon.CalendarDays, post.schedule)
            }
        }
    }
}

@Composable
private fun Thumbnail(category: String) {
    Box(
        modifier =
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(
                    Brush.linearGradient(
                        listOf(
                            PantopusColors.handyman.copy(alpha = 0.25f),
                            PantopusColors.handyman.copy(alpha = 0.6f),
                        ),
                    ),
                )
                .semantics { contentDescription = "$category gig" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Package,
            contentDescription = null,
            size = 22.dp,
            tint = PantopusColors.appTextInverse,
        )
        Row(
            modifier =
                Modifier
                    .align(Alignment.TopStart)
                    .padding(Spacing.s1)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = 5.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Package,
                contentDescription = null,
                size = 9.dp,
                tint = PantopusColors.handyman,
            )
            Text(category, fontSize = 8.5.sp, fontWeight = FontWeight.Black, color = PantopusColors.handyman)
        }
    }
}

@Composable
private fun SummaryChip(
    icon: PantopusIcon,
    text: String,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(text, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun Footer(bidCount: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Users,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text("$bidCount bids received", style = PantopusTextStyle.caption, color = PantopusColors.appText)
    }
}
