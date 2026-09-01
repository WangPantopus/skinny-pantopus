@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANAGE_TRAIN_STAT_CELL_ROW_TAG: String = "manageTrainStatCellRow"

fun manageTrainStatCellValueTag(id: String): String = "manageTrainStatCellValue.$id"

/** Visual tone for a single stat cell — drives the value's color. */
enum class StatCellTone { NEUTRAL, SUCCESS, WARN }

/** One cell in [StatCellRow]. */
data class StatCellContent(
    val id: String,
    val value: String,
    val label: String,
    val tone: StatCellTone,
)

/**
 * 4-cell at-a-glance stat row used on the Manage Train screen. Each
 * cell shows a 19sp value + a 10sp uppercase label. Mirrors the iOS
 * [StatCellRow] geometry.
 */
@Composable
fun StatCellRow(
    cells: List<StatCellContent>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(60.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .testTag(MANAGE_TRAIN_STAT_CELL_ROW_TAG),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        cells.forEachIndexed { index, cell ->
            CellView(cell = cell, modifier = Modifier.weight(1f).fillMaxHeight())
            if (index < cells.size - 1) {
                Box(
                    modifier =
                        Modifier
                            .width(1.dp)
                            .fillMaxHeight()
                            .background(PantopusColors.appBorderSubtle),
                )
            }
        }
    }
}

@Composable
private fun CellView(
    cell: StatCellContent,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .padding(horizontal = Spacing.s1, vertical = Spacing.s3)
                .semantics { contentDescription = "${cell.label} ${cell.value}" },
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = cell.value,
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Default,
            color = valueColor(cell.tone),
            modifier = Modifier.testTag(manageTrainStatCellValueTag(cell.id)),
        )
        Text(
            text = cell.label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.66.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun valueColor(tone: StatCellTone): Color =
    when (tone) {
        StatCellTone.SUCCESS -> PantopusColors.success
        StatCellTone.WARN -> PantopusColors.warmAmber
        StatCellTone.NEUTRAL -> PantopusColors.appText
    }
