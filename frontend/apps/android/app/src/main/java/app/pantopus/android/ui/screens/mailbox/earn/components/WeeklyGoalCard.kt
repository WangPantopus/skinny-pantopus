@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming")

package app.pantopus.android.ui.screens.mailbox.earn.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import app.pantopus.android.ui.components.ProgressRing
import app.pantopus.android.ui.screens.mailbox.earn.EarnWeeklyGoal
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.11 — weekly-goal momentum card. Sits directly under the earnings
 * BalanceHero as a continuation of the balance story. Reuses the B1.5
 * [ProgressRing] (green goal arc) beside a "$X to go" headline + progress
 * subcopy. The design's in-hero teal→green goal bar is lifted out into
 * this dedicated card so the momentum reads as its own beat.
 */
@Composable
fun WeeklyGoalCard(
    goal: EarnWeeklyGoal,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), shape)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics {
                    contentDescription = "Weekly goal. ${goal.headline}. ${goal.subcopy}"
                }
                .testTag("earnWeeklyGoalCard"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        ProgressRing(
            progress = goal.progress,
            diameter = 64.dp,
            lineWidth = 7.dp,
            tint = PantopusColors.success,
            label = goal.ringLabel,
            sublabel = goal.ringSublabel,
            contentDescription = "${goal.ringLabel} ${goal.ringSublabel}",
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = "WEEKLY GOAL",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
            )
            Text(
                text = goal.headline,
                color = PantopusColors.appText,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.3).sp,
            )
            Text(
                text = goal.subcopy,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
            )
        }
    }
}
