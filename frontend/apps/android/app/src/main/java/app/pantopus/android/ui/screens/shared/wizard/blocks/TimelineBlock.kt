@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.wizard.blocks

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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** One stage in the timeline. */
data class TimelineStage(
    val id: String,
    val label: String,
)

private enum class TimelineStageState { Done, Current, Upcoming }

/**
 * Horizontal timeline with progress dots and a connecting line. The
 * stage with id matching [currentStageId] is highlighted; earlier
 * stages render as "done" (filled + check), later as "upcoming".
 */
@Composable
fun TimelineBlock(
    stages: List<TimelineStage>,
    currentStageId: String,
    modifier: Modifier = Modifier,
) {
    val currentIndex = stages.indexOfFirst { it.id == currentStageId }.coerceAtLeast(0)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceMuted)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics {
                    contentDescription = "Verification timeline. Current stage: ${stages[currentIndex].label}."
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            stages.forEachIndexed { index, _ ->
                val state =
                    when {
                        index < currentIndex -> TimelineStageState.Done
                        index == currentIndex -> TimelineStageState.Current
                        else -> TimelineStageState.Upcoming
                    }
                StageDot(state = state)
                if (index != stages.size - 1) {
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(2.dp)
                                .background(
                                    if (index < currentIndex) {
                                        PantopusColors.primary600
                                    } else {
                                        PantopusColors.appBorder
                                    },
                                ),
                    )
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            stages.forEachIndexed { index, stage ->
                val isCurrent = index == currentIndex
                Text(
                    text = stage.label,
                    style = PantopusTextStyle.caption,
                    color = if (isCurrent) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    textAlign =
                        when (index) {
                            0 -> TextAlign.Start
                            stages.lastIndex -> TextAlign.End
                            else -> TextAlign.Center
                        },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun StageDot(state: TimelineStageState) {
    Box(
        modifier = Modifier.size(22.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (state == TimelineStageState.Current) {
            Box(
                modifier =
                    Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .border(2.dp, PantopusColors.primary600, CircleShape),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(
                        when (state) {
                            TimelineStageState.Done -> PantopusColors.primary600
                            TimelineStageState.Current -> PantopusColors.appSurface
                            TimelineStageState.Upcoming -> PantopusColors.appBorder
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (state == TimelineStageState.Done) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
