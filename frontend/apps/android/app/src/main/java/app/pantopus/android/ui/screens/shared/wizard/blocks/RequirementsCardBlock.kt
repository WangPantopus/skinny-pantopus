@file:Suppress("MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.wizard.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * One row inside [RequirementsCardBlock] — checklist icon, bold title,
 * secondary subcopy.
 */
data class RequirementsRow(
    val id: String,
    val icon: PantopusIcon,
    val title: String,
    val subcopy: String,
    val emphasized: Boolean = false,
)

/**
 * Card block listing prerequisite requirements for a wizard flow. Used by
 * P20's claim ownership Step 1.
 */
@Composable
fun RequirementsCardBlock(
    rows: List<RequirementsRow>,
    title: String = "What you'll need",
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = title.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        rows.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    modifier =
                        Modifier
                            .padding(top = 1.dp)
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(if (row.emphasized) PantopusColors.warningBg else PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = row.icon,
                        contentDescription = null,
                        size = if (row.emphasized) 12.dp else 13.dp,
                        tint = if (row.emphasized) PantopusColors.warning else PantopusColors.home,
                    )
                }
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = row.title,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = row.subcopy,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}
