@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

package app.pantopus.android.ui.components

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Lifecycle state of a single step. */
enum class TimelineStepState { Done, Current, Upcoming }

/** One step row. */
data class TimelineStep(
    val title: String,
    val state: TimelineStepState,
    val subtitle: String? = null,
)

/** Vertical timeline with state-aware markers and connectors. */
@Composable
fun TimelineStepper(
    steps: List<TimelineStep>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        steps.forEachIndexed { index, step ->
            StepRow(step = step, isLast = index == steps.lastIndex)
        }
    }
}

@Composable
private fun StepRow(
    step: TimelineStep,
    isLast: Boolean,
) {
    Row(
        modifier =
            Modifier
                .semantics { contentDescription = "${step.state.a11y()}: ${step.title}" }
                .padding(bottom = if (isLast) 0.dp else Spacing.s4),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        StepMarker(state = step.state, isLast = isLast)
        Column {
            Text(
                text = step.title,
                style = PantopusTextStyle.body,
                color =
                    if (step.state == TimelineStepState.Upcoming) {
                        PantopusColors.appTextMuted
                    } else {
                        PantopusColors.appText
                    },
            )
            if (step.subtitle != null) {
                Text(
                    text = step.subtitle,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun StepMarker(
    state: TimelineStepState,
    isLast: Boolean,
) {
    val motion = rememberMotionEnabled()
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(28.dp)) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(28.dp)) {
            if (state == TimelineStepState.Current && motion) {
                val transition = rememberInfiniteTransition(label = "pulse")
                val scale by transition.animateFloat(
                    initialValue = 1f,
                    targetValue = 1.4f,
                    animationSpec =
                        infiniteRepeatable(tween(1_200, easing = LinearEasing), RepeatMode.Restart),
                    label = "pulse-scale",
                )
                val alpha by transition.animateFloat(
                    initialValue = 1f,
                    targetValue = 0f,
                    animationSpec =
                        infiniteRepeatable(tween(1_200, easing = LinearEasing), RepeatMode.Restart),
                    label = "pulse-alpha",
                )
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .scale(scale)
                            .clip(CircleShape)
                            .border(2.dp, PantopusColors.primary600.copy(alpha = alpha), CircleShape),
                )
            }
            when (state) {
                TimelineStepState.Done -> {
                    Box(
                        modifier =
                            Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.success),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = Radii.lg,
                            tint = PantopusColors.appTextInverse,
                        )
                    }
                }
                TimelineStepState.Current -> {
                    Box(
                        modifier =
                            Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.primary600),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(PantopusColors.appTextInverse),
                        )
                    }
                }
                TimelineStepState.Upcoming ->
                    Box(
                        modifier =
                            Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .border(2.dp, PantopusColors.appBorderStrong, CircleShape),
                    )
            }
        }
        if (!isLast) {
            Spacer(
                modifier =
                    Modifier
                        .width(2.dp)
                        .fillMaxHeight()
                        .background(
                            if (state == TimelineStepState.Done) {
                                PantopusColors.success
                            } else {
                                PantopusColors.appBorder
                            },
                        ),
            )
        }
    }
}

@Composable
private fun rememberMotionEnabled(): Boolean {
    if (LocalInspectionMode.current) return true
    val resolver = LocalContext.current.contentResolver
    return remember {
        val scale =
            Settings.Global.getFloat(
                resolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            )
        scale > 0f
    }
}

private fun TimelineStepState.a11y(): String =
    when (this) {
        TimelineStepState.Done -> "Completed"
        TimelineStepState.Current -> "Current step"
        TimelineStepState.Upcoming -> "Upcoming"
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 320)
@Composable
private fun TimelineStepperPreview() {
    TimelineStepper(
        steps =
            listOf(
                TimelineStep("Order placed", TimelineStepState.Done, "Mar 17"),
                TimelineStep("In transit", TimelineStepState.Done, "Mar 18"),
                TimelineStep("Out for delivery", TimelineStepState.Current, "Today"),
                TimelineStep("Delivered", TimelineStepState.Upcoming),
            ),
        modifier = Modifier.background(Color.White).padding(Spacing.s4),
    )
}
