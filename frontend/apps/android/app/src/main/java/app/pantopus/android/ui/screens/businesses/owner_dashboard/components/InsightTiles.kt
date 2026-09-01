@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.owner_dashboard.OwnerInsightTile
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.7 — the owner's "This week" insight strip: a bordered card with a
 * header row ("This week" + an "Insights" link) over equal-width Views /
 * Saves / Contacts tiles, each a value with an optional week-over-week delta
 * pill. Sample-driven in B3.2. Mirrors iOS `InsightTiles.swift`.
 */
@Composable
fun InsightTiles(
    insights: List<OwnerInsightTile>,
    onOpenInsights: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .testTag("businessOwner.insights"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp)
                    .padding(top = 9.dp, bottom = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "This week",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.3.sp,
            )
            Box(modifier = Modifier.weight(1f))
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onOpenInsights)
                        .testTag("businessOwner.openInsights"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = "Insights",
                    color = PantopusColors.business,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.business,
                )
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            insights.forEachIndexed { index, tile ->
                if (index > 0) {
                    Box(modifier = Modifier.width(1.dp).fillMaxHeight().background(PantopusColors.appBorderSubtle))
                }
                Metric(tile = tile, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun Metric(
    tile: OwnerInsightTile,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .padding(horizontal = Spacing.s2, vertical = 11.dp)
                .semantics { contentDescription = metricLabel(tile) },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = tile.icon,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2f,
                tint = PantopusColors.business,
            )
            Text(
                text = tile.value,
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.3).sp,
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = tile.label.uppercase(),
                color = PantopusColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.3.sp,
            )
            tile.delta?.let { delta ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PantopusIconImage(
                        icon = PantopusIcon.ArrowUp,
                        contentDescription = null,
                        size = 9.dp,
                        strokeWidth = 3f,
                        tint = PantopusColors.success,
                    )
                    Text(
                        text = delta,
                        color = PantopusColors.success,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

private fun metricLabel(tile: OwnerInsightTile): String {
    var label = "${tile.value} ${tile.label}"
    tile.delta?.let { label += ", up $it" }
    return label
}
