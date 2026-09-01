@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.start_train.components

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.11 — Mini 5-segment preview of the support-train wizard, rendered at
 * the bottom of step 1 so the organizer sees the whole flow ahead.
 * Completed and current nodes fill in the warm-amber identity accent.
 */
@Composable
internal fun StepRail(current: Int) {
    val steps = listOf("Recipient", "Type", "Dates", "Invites", "Review")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "YOU'RE ON STEP $current OF 5",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3)
                    .testTag("startSupportTrainStepRail"),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            steps.forEachIndexed { index, label ->
                val stepNumber = index + 1
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier =
                            Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(
                                    if (stepNumber <= current) PantopusColors.warmAmber else PantopusColors.appSurfaceSunken,
                                ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = stepNumber.toString(),
                            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                            color = if (stepNumber <= current) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                        )
                    }
                    Text(
                        text = label,
                        style =
                            PantopusTextStyle.caption.copy(
                                fontWeight = if (stepNumber == current) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 9.sp,
                            ),
                        color = if (stepNumber == current) PantopusColors.warmAmber else PantopusColors.appTextMuted,
                    )
                }
                if (index < steps.lastIndex) {
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .padding(top = 10.dp)
                                .height(2.dp)
                                .background(if (stepNumber < current) PantopusColors.warmAmber else PantopusColors.appBorder),
                    )
                }
            }
        }
    }
}
