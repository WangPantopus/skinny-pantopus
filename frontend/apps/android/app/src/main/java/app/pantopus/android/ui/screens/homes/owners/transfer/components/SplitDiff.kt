@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.owners.transfer.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * One segment in a [SplitDiff] bar — driven by the host VM's owner
 * roster + the live transfer amount.
 */
data class SplitSegment(
    val id: String,
    val owner: String,
    val percent: Int,
    val color: Color,
    val delta: Int? = null,
    val isNew: Boolean = false,
)

/**
 * Before/after split card showing current ownership versus the projected
 * split after the transfer commits. Mirrors iOS `SplitDiff`.
 */
@Composable
fun SplitDiff(
    before: List<SplitSegment>,
    after: List<SplitSegment>,
    amount: Int,
    recipientName: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3 + 2.dp, vertical = Spacing.s3)
                .semantics { contentDescription = "Move $amount percent to $recipientName" }
                .testTag("splitDiff"),
    ) {
        DiffRow(label = "Before", segments = before)
        DiffDivider(amount = amount, recipientName = recipientName)
        DiffRow(label = "After", segments = after)
    }
}

@Composable
private fun DiffRow(
    label: String,
    segments: List<SplitSegment>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp)) {
        Text(
            text = label.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        StakeBar(segments = segments)
        LegendStrip(segments = segments)
    }
}

@Composable
private fun StakeBar(segments: List<SplitSegment>) {
    val totalPercent = segments.sumOf { it.percent }.coerceAtLeast(1)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(14.dp)
                .clip(RoundedCornerShape(7.dp))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(7.dp)),
    ) {
        Row(modifier = Modifier.fillMaxWidth().fillMaxHeight()) {
            segments.forEachIndexed { index, segment ->
                val animatedWeight by animateFloatAsState(
                    targetValue = segment.percent.toFloat() / totalPercent,
                    label = "stake_${segment.id}",
                )
                Box(
                    modifier =
                        Modifier
                            .weight(animatedWeight.coerceAtLeast(0.001f))
                            .fillMaxHeight()
                            .background(segment.color),
                )
                if (index < segments.size - 1) {
                    Box(modifier = Modifier.width(1.dp).fillMaxHeight().background(Color.White.copy(alpha = 0.7f)))
                }
            }
        }
    }
}

@Composable
private fun LegendStrip(segments: List<SplitSegment>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        segments.forEach { segment ->
            LegendChip(segment)
        }
    }
}

@Composable
private fun LegendChip(segment: SplitSegment) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(segment.color),
        )
        Text(
            text = segment.owner,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = "${segment.percent}%",
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            color = PantopusColors.appTextSecondary,
        )
        segment.delta?.takeIf { it != 0 }?.let { delta ->
            Text(
                text = if (delta > 0) "+$delta" else "$delta",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = if (delta < 0) PantopusColors.error else PantopusColors.success,
            )
        }
        if (segment.isNew) {
            Text(
                text = "NEW",
                fontSize = 8.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = PantopusColors.businessDark,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(3.dp))
                        .background(PantopusColors.businessBg)
                        .padding(horizontal = Spacing.s1, vertical = 1.dp),
            )
        }
    }
}

private val DividerHeight = 1.dp

@Composable
private fun DiffDivider(
    amount: Int,
    recipientName: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.weight(1f).height(DividerHeight).background(PantopusColors.appBorderSubtle))
        PantopusIconImage(
            icon = PantopusIcon.ArrowDown,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "MOVE $amount% → ${recipientName.uppercase()}",
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextMuted,
        )
        Box(modifier = Modifier.weight(1f).height(DividerHeight).background(PantopusColors.appBorderSubtle))
    }
}
