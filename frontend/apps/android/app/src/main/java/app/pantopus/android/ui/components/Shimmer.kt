@file:Suppress("MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.Radii

private val ShimmerBase = Color(0xFFEEF0F3)
private val ShimmerHighlight = Color(0xFFF6F7F9)

/**
 * 1.4-second linear-gradient shimmer placeholder. Collapses to a flat
 * [ShimmerBase] fill when the Android "Remove animations" setting is on.
 *
 * @param width Fixed width; defaults to 120.dp.
 * @param height Fixed height.
 * @param cornerRadius Corner radius; defaults to 6.dp (`Radii.sm`).
 */
@Composable
fun Shimmer(
    width: Dp = 120.dp,
    height: Dp = 16.dp,
    cornerRadius: Dp = 6.dp,
    modifier: Modifier = Modifier,
) {
    val motionEnabled = rememberAnimationsEnabled()

    if (!motionEnabled) {
        Box(
            modifier =
                modifier
                    .width(width)
                    .heightIn(min = height)
                    .size(width = width, height = height)
                    .clip(RoundedCornerShape(cornerRadius))
                    .background(ShimmerBase)
                    .semantics(mergeDescendants = false) { },
        )
        return
    }

    val transition = rememberInfiniteTransition(label = "shimmer")
    val phase by transition.animateFloat(
        initialValue = -1f,
        targetValue = 2f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1400, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
        label = "shimmer-phase",
    )

    Box(
        modifier =
            modifier
                .width(width)
                .size(width = width, height = height)
                .clip(RoundedCornerShape(cornerRadius))
                .background(ShimmerBase)
                .drawBehind {
                    val widthPx = size.width
                    val start = widthPx * (phase - 1f)
                    val end = widthPx * phase
                    drawRect(
                        brush =
                            Brush.linearGradient(
                                colors =
                                    listOf(
                                        ShimmerBase.copy(alpha = 0f),
                                        ShimmerHighlight,
                                        ShimmerBase.copy(alpha = 0f),
                                    ),
                                start = Offset(start, size.height / 2),
                                end = Offset(end, size.height / 2),
                            ),
                        size = Size(widthPx, size.height),
                        style = Stroke(width = size.height * 2),
                    )
                }.semantics(mergeDescendants = false) { },
    )
}

/**
 * True when the system animator-duration scale is non-zero. Mirrors iOS's
 * `accessibilityReduceMotion` check.
 */
@Composable
private fun rememberAnimationsEnabled(): Boolean {
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

@Preview(showBackground = true, widthDp = 200, heightDp = 120)
@Composable
private fun ShimmerPreview() {
    androidx.compose.foundation.layout.Column(
        modifier = Modifier.background(Color.White),
        verticalArrangement =
            androidx.compose.foundation.layout.Arrangement
                .spacedBy(8.dp),
    ) {
        Shimmer(width = 160.dp, height = 16.dp)
        Shimmer(width = 120.dp, height = 12.dp, cornerRadius = Radii.xs)
    }
}
