@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.business_profile.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.business_profile.BusinessStatCell
import app.pantopus.android.ui.screens.business_profile.BusinessStatTint
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * A10.6 — the full-width stat band under the business banner: rating ·
 * jobs done · followers / "New". Each cell is value (with an optional
 * leading star) over a small uppercase label, divided by hairlines.
 *
 * Mirror of iOS `Features/BusinessProfile/Components/StatStrip.swift`.
 */
@Composable
fun StatStrip(
    stats: List<BusinessStatCell>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .background(PantopusColors.appSurface)
                .drawBehind {
                    drawRect(
                        color = PantopusColors.appBorder,
                        topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - 1.dp.toPx()),
                        size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx()),
                    )
                }
                .testTag("businessProfile.stats"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        stats.forEachIndexed { index, stat ->
            if (index > 0) {
                Box(
                    modifier =
                        Modifier
                            .width(1.dp)
                            .fillMaxHeight()
                            .background(PantopusColors.appBorderSubtle),
                )
            }
            StatCell(stat = stat, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatCell(
    stat: BusinessStatCell,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .padding(horizontal = Spacing.s2, vertical = 12.dp)
                .semantics { contentDescription = "${stat.value} ${stat.label}" },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            if (stat.leadingStar) {
                BizStarGlyph(color = valueColor(stat.tint), size = 12.dp)
            }
            Text(
                text = stat.value,
                color = valueColor(stat.tint),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.3).sp,
            )
        }
        Text(
            text = stat.label.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.4.sp,
        )
    }
}

private fun valueColor(tint: BusinessStatTint): Color =
    when (tint) {
        BusinessStatTint.Standard -> PantopusColors.appText
        BusinessStatTint.Star -> PantopusColors.star
        BusinessStatTint.Business -> PantopusColors.business
        BusinessStatTint.Muted -> PantopusColors.appTextMuted
    }

/**
 * Filled five-pointed star used by the stat strip + review cards. Matches
 * the glyph drawn by `RatingDistribution`.
 */
@Composable
internal fun BizStarGlyph(
    color: Color,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .drawBehind {
                    val cx = this.size.width / 2f
                    val cy = this.size.height / 2f
                    val outer = min(this.size.width, this.size.height) / 2f
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
