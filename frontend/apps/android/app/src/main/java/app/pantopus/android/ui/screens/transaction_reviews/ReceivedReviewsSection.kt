@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.transaction_reviews

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.RatingDistribution
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import java.util.Locale
import kotlin.math.roundToInt

/**
 * BLOCK 2D — embeddable "received reviews" section for a profile. Self-loads
 * via [ReceivedReviewsViewModel]; a host only passes [userId]. Renders the
 * overall average (shared [RatingDistribution]), the per-criterion breakdown,
 * and the list of received transaction reviews. Compose mirror of iOS
 * `ReceivedReviewsSection`.
 */
@Composable
fun ReceivedTransactionReviewsSection(
    userId: String,
    modifier: Modifier = Modifier,
    viewModel: ReceivedReviewsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(userId) { viewModel.load(userId) }

    Column(
        modifier = modifier.fillMaxWidth().testTag("txnReview.receivedSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = "Marketplace reviews",
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        when (val s = state) {
            ReceivedReviewsUiState.Loading -> LoadingView()
            ReceivedReviewsUiState.Empty -> EmptyView()
            is ReceivedReviewsUiState.Loaded -> LoadedView(s.summary)
            is ReceivedReviewsUiState.Error -> ErrorView(s.message) { viewModel.refresh() }
        }
    }
}

@Composable
private fun LoadingView() {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("txnReview.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(height = 84.dp, cornerRadius = Radii.lg)
        Shimmer(height = 64.dp, cornerRadius = Radii.lg)
        Shimmer(height = 64.dp, cornerRadius = Radii.lg)
    }
}

@Composable
private fun EmptyView() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("txnReview.empty"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Star,
            contentDescription = null,
            size = 22.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "No marketplace reviews yet.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ErrorView(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("txnReview.error"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Couldn't load reviews",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(text = message, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .testTag("txnReview.retry")
                    .clickable(onClick = onRetry)
                    .padding(vertical = Spacing.s1),
        ) {
            Text(
                text = "Retry",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun LoadedView(summary: ReceivedReviewsSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3), modifier = Modifier.fillMaxWidth()) {
        RatingDistribution(
            average = summary.average,
            count = summary.total,
            distribution = summary.distribution,
        )
        CriterionBreakdown(summary)
        Column(
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.fillMaxWidth().testTag("txnReview.receivedList"),
        ) {
            for (row in summary.rows) {
                ReviewRow(row)
            }
        }
    }
}

@Composable
private fun CriterionBreakdown(summary: ReceivedReviewsSummary) {
    val criteria =
        listOf(
            "Communication" to summary.communication,
            "Item accuracy" to summary.accuracy,
            "Punctuality" to summary.punctuality,
        ).mapNotNull { (title, value) -> value?.let { title to it } }
    if (criteria.isEmpty()) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("txnReview.criteria"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        for ((title, value) in criteria) {
            CriterionRow(title, value)
        }
    }
}

@Composable
private fun CriterionRow(
    title: String,
    value: CriterionAverage,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        StaticStarRow(rating = value.average.roundToInt())
        Text(
            text = String.format(Locale.US, "%.1f", value.average),
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun ReviewRow(row: ReceivedReviewRow) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("txnReview.row.${row.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.Top) {
            Avatar(row)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1), modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = row.reviewerName,
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                    if (row.timestamp.isNotEmpty()) {
                        Text(
                            text = row.timestamp,
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                }
                StaticStarRow(rating = row.rating)
                row.comment?.let {
                    Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Chip(row.contextLabel)
                    row.roleLabel?.let { Chip(it) }
                }
            }
        }
    }
}

@Composable
private fun Avatar(row: ReceivedReviewRow) {
    Box(
        modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = row.initials,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
        if (!row.avatarUrl.isNullOrEmpty()) {
            AsyncImage(
                model = row.avatarUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize().clip(CircleShape),
            )
        }
    }
}

@Composable
private fun Chip(text: String) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
    ) {
        Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

@Composable
private fun StaticStarRow(rating: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
        for (index in 0 until 5) {
            PantopusIconImage(
                icon = PantopusIcon.Star,
                contentDescription = null,
                size = 12.dp,
                tint = if (index < rating) PantopusColors.star else PantopusColors.appBorder,
            )
        }
    }
}
