@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "FunctionNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * Compact review summary — a big average, a five-star glyph row, the review
 * count, and a 5★→1★ histogram of star-color bars. The Compose mirror of iOS
 * `Core/Design/Components/RatingDistribution.swift`.
 *
 * Stars are drawn as a filled path (not the outline [PantopusIcon.Star]) so the
 * rating reads as solid amber and matches the iOS baseline.
 *
 * @param average Mean rating in 0..5.
 * @param count Total number of reviews.
 * @param distribution Five fractions in 0..1, ordered 5★→1★, giving each bar's
 *   fill. Shorter lists pad with zeros; longer lists truncate.
 */
@Composable
fun RatingDistribution(
    average: Double,
    count: Int,
    distribution: List<Float>,
    modifier: Modifier = Modifier,
) {
    val avg = average.coerceIn(0.0, 5.0)
    val reviewCount = count.coerceAtLeast(0)
    val hasReviews = reviewCount > 0
    val bars = (distribution + List(5) { 0f }).take(5).map { it.coerceIn(0f, 1f) }

    Row(
        modifier =
            modifier
                .testTag("ratingDistribution")
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = 13.dp)
                .semantics { contentDescription = accessibility(hasReviews, avg, reviewCount) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SummaryColumn(
            average = avg,
            count = reviewCount,
            hasReviews = hasReviews,
            modifier = Modifier.width(84.dp),
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            for (row in 0 until 5) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    Text(
                        text = "${5 - row}",
                        color = PantopusColors.appTextSecondary,
                        fontSize = 10.5.sp,
                        modifier = Modifier.width(8.dp),
                    )
                    HistogramBar(fraction = bars[row], modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun SummaryColumn(
    average: Double,
    count: Int,
    hasReviews: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(
            text = if (hasReviews) formatAverage(average) else "—",
            color = PantopusColors.appText,
            fontSize = 30.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.5).sp,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
            for (index in 0 until 5) {
                StarGlyph(filled = hasReviews && average >= index + 0.5)
            }
        }
        Text(
            text = if (hasReviews) "$count reviews" else "No reviews",
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
        )
    }
}

@Composable
private fun HistogramBar(
    fraction: Float,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .height(5.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(fraction)
                    .height(5.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.star),
        )
    }
}

@Composable
private fun StarGlyph(
    filled: Boolean,
    modifier: Modifier = Modifier,
) {
    val color = if (filled) PantopusColors.star else PantopusColors.appBorder
    Box(
        modifier =
            modifier
                .size(11.dp)
                .drawBehind {
                    val cx = size.width / 2f
                    val cy = size.height / 2f
                    val outer = min(size.width, size.height) / 2f
                    val inner = outer * 0.42f
                    val path = Path()
                    for (i in 0 until 10) {
                        val radius = if (i % 2 == 0) outer else inner
                        val angle = (-PI / 2 + i * PI / 5).toFloat()
                        val x = cx + radius * cos(angle)
                        val y = cy + radius * sin(angle)
                        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    path.close()
                    drawPath(path, color)
                },
    )
}

private fun formatAverage(average: Double): String = String.format(Locale.US, "%.1f", average)

private fun accessibility(
    hasReviews: Boolean,
    average: Double,
    count: Int,
): String =
    if (!hasReviews) {
        "No reviews yet"
    } else {
        "Rated ${formatAverage(average)} out of 5 stars from $count reviews"
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 320, backgroundColor = 0xFFF6F7F9)
@Composable
private fun RatingDistributionPreview() {
    Column(
        modifier = Modifier.padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        RatingDistribution(average = 4.9, count = 128, distribution = listOf(0.92f, 0.06f, 0.02f, 0f, 0f))
        RatingDistribution(average = 4.2, count = 36, distribution = listOf(0.52f, 0.28f, 0.12f, 0.05f, 0.03f))
        RatingDistribution(average = 0.0, count = 0, distribution = emptyList())
    }
}
