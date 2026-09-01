@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember", "LongMethod")

package app.pantopus.android.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.MotionTokens
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/** Discrete fuzz radius for the privacy slider on A14.7 Privacy. */
enum class FuzzStop(
    val radius: Dp,
    val label: String,
) {
    Exact(0.dp, "Exact"),
    Block(18.dp, "Block"),
    QuarterMile(42.dp, "Quarter mile"),
    HalfMile(62.dp, "Half mile"),
    Neighborhood(110.dp, "Neighborhood"),
}

/**
 * Animated concentric-circle privacy fuzz preview.
 *
 * Mirrors `Core/Design/Components/FuzzMap.swift` — 280dp × 140dp canvas
 * with a stylised street-grid backdrop. The fuzz ring grows in five
 * discrete stops; the radius transitions through a 300ms ease-in-out
 * curve (100ms when reduce-motion is on).
 *
 * @param stop The current fuzz level. Pass a new stop to animate.
 */
@Composable
fun FuzzMap(
    stop: FuzzStop,
    modifier: Modifier = Modifier,
) {
    val reduceMotion = rememberReduceMotion()
    val animatedRadius by animateDpAsState(
        targetValue = stop.radius,
        animationSpec =
            if (reduceMotion) {
                MotionTokens.componentState(reduceMotion = true)
            } else {
                tween(durationMillis = FUZZ_DURATION_MS, easing = androidx.compose.animation.core.EaseInOut)
            },
        label = "fuzzRadius",
    )

    val shape = RoundedCornerShape(Radii.md)

    Box(
        modifier =
            modifier
                .testTag("fuzzMap")
                .semantics { contentDescription = "Location fuzz: ${stop.label}" }
                .size(width = CANVAS_WIDTH, height = CANVAS_HEIGHT)
                .clip(shape)
                // `appSurfaceRaised` keeps the canvas distinct from both
                // the surrounding `appSurface` and the `appBorderSubtle`
                // grid hairlines drawn on top.
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, shape),
        contentAlignment = Alignment.Center,
    ) {
        // Faint street grid.
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .drawBehind {
                        val total = (GRID_LINE_COUNT + 1).toFloat()
                        val stroke = 1.dp.toPx()
                        val argb = PantopusColors.appBorderSubtle.toArgb()
                        val gridColor = androidx.compose.ui.graphics.Color(argb)
                        for (i in 1..GRID_LINE_COUNT) {
                            val y = (i / total) * size.height
                            drawLine(
                                color = gridColor,
                                start = Offset(0f, y),
                                end = Offset(size.width, y),
                                strokeWidth = stroke,
                            )
                            val x = (i / total) * size.width
                            drawLine(
                                color = gridColor,
                                start = Offset(x, 0f),
                                end = Offset(x, size.height),
                                strokeWidth = stroke,
                            )
                        }
                    },
        )

        // Fuzz ring — translucent fill + 1.5dp stroke.
        if (animatedRadius > 0.dp) {
            Box(
                modifier =
                    Modifier
                        .size(animatedRadius * 2)
                        .drawBehind {
                            drawCircle(
                                color = PantopusColors.primary600.copy(alpha = 0.18f),
                                radius = size.minDimension / 2f,
                                center = Offset(size.width / 2f, size.height / 2f),
                            )
                            drawCircle(
                                color = PantopusColors.primary600,
                                radius = size.minDimension / 2f - (1.5.dp.toPx() / 2f),
                                center = Offset(size.width / 2f, size.height / 2f),
                                style = Stroke(width = 1.5.dp.toPx()),
                            )
                        },
            )
        }

        // Centre pin — 8dp dot ringed by surface white.
        Box(
            modifier =
                Modifier
                    .size(PIN_DIAMETER)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .border(1.5.dp, PantopusColors.appSurface, RoundedCornerShape(Radii.pill)),
        )

        // Mono corner tag.
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .padding(Spacing.s2),
            contentAlignment = Alignment.TopStart,
        ) {
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.appSurface.copy(alpha = 0.85f))
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            ) {
                Text(
                    text = stop.label.uppercase(),
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.6.sp,
                )
            }
        }
    }
}

private val CANVAS_WIDTH: Dp = 280.dp
private val CANVAS_HEIGHT: Dp = 140.dp
private val PIN_DIAMETER: Dp = 8.dp
private const val GRID_LINE_COUNT = 12
private const val FUZZ_DURATION_MS = 300

// MARK: - Preview

@Preview(showBackground = true, widthDp = 360, heightDp = 900)
@Composable
private fun FuzzMapPreview() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        for (stop in FuzzStop.values()) {
            FuzzMap(stop = stop)
        }
    }
}
