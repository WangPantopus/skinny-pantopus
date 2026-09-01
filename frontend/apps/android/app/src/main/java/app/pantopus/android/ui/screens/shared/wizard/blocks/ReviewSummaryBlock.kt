@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.wizard.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** A single label/value row in a [ReviewSummaryBlock]. */
data class ReviewSummaryRow(
    val label: String,
    val value: String,
)

/**
 * White card with a stack of label/value rows separated by hairlines.
 * Use on the wizard's review step.
 */
@Composable
fun ReviewSummaryBlock(
    rows: List<ReviewSummaryRow>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface),
    ) {
        rows.forEachIndexed { index, row ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Text(
                    text = row.label,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.width(96.dp),
                )
                Text(
                    text = row.value,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
            }
            if (index != rows.lastIndex) {
                HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
            }
        }
    }
}
