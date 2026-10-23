@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.feed.map

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.feed.pulse.tintColors
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevation
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.pantopusShadow
import kotlin.math.ln

/*
 * The Pulse map's pins and cluster bubbles (founder request 2026-10-22: "feel the events going on around you"). The
 * Explore pins' disc vocabulary (ExploreTypedPin: a 26 dp disc with a white ring in a 50 dp frame, the selected pin
 * haloed), coloured and drawn with the post's intent as the feed's cards show it, a halo on posts from the last 24
 * hours, and bubbles that grow with their count and ring their intent mix. MarkerComposable renders these to bitmaps
 * on a software canvas, so everything here is drawn by hand: blurred-paint shadows (elevation shadows don't render
 * there) and a static live ring (no animation).
 */

/** A pin's fill: the colour of the feed card's intent chip. */
internal val PulseIntent.pinColor: Color
    get() = tintColors().first

/** A post's pin: its intent's colour and glyph, haloed when [isActive] (and 1.15× larger), ringed when live. */
@Composable
internal fun PulseMapPin(
    style: PulsePinStyle,
    isActive: Boolean,
) {
    val color = style.intent.pinColor
    Box(modifier = Modifier.size(PIN_FRAME), contentAlignment = Alignment.Center) {
        if (isActive || style.isLive) {
            Canvas(modifier = Modifier.matchParentSize()) {
                if (isActive) {
                    drawCircle(color = color.copy(alpha = 0.25f), radius = 23.dp.toPx())
                    drawCircle(color = color.copy(alpha = 0.35f), radius = 17.dp.toPx())
                } else {
                    drawLiveRing(color = color, radius = 21.dp.toPx())
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .size(if (isActive) PIN_DISC_ACTIVE else PIN_DISC)
                    .pantopusShadow(PinShadow, CircleShape)
                    .clip(CircleShape)
                    .background(color)
                    .border(2.dp, PantopusColors.appSurface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = style.intent.icon,
                contentDescription = null,
                size = if (isActive) 15.dp else 13.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

/**
 * A cluster of [count] posts: a bubble that grows with the count (40 → 56 dp on a log scale), ringed by its intent
 * mix (a segment per intent, in its colour), the count in white on the brand colour, haloed when it holds a live post.
 */
@Composable
internal fun PulseMapCluster(
    count: Int,
    style: PulseClusterStyle,
) {
    val bubble = clusterDiameter(count)
    val segments = style.mix.map { (intent, posts) -> intent.pinColor to posts }
    val brand = PantopusColors.primary600
    val edge = PantopusColors.appSurface
    Box(modifier = Modifier.size(bubble + CLUSTER_MARGIN * 2), contentAlignment = Alignment.Center) {
        if (style.isLive) {
            Canvas(modifier = Modifier.matchParentSize()) {
                drawLiveRing(color = brand, radius = bubble.toPx() / 2 + 6.dp.toPx())
            }
        }
        Box(
            modifier = Modifier.size(bubble).pantopusShadow(ClusterShadow, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(modifier = Modifier.matchParentSize()) {
                val radius = size.minDimension / 2
                val ringWidth = CLUSTER_RING.toPx()
                val ringRadius = radius - 2.dp.toPx() - ringWidth / 2
                drawCircle(color = edge, radius = radius)
                drawIntentRing(segments = segments, fallback = brand, radius = ringRadius, width = ringWidth)
                drawCircle(color = brand, radius = ringRadius - ringWidth / 2 - 1.5.dp.toPx())
            }
            Text(
                text = "$count",
                fontSize = if (bubble >= 50.dp) 15.sp else 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

/** The static stand-in for the live halo the other platforms animate: a soft disc and a ring in [color]. */
private fun DrawScope.drawLiveRing(
    color: Color,
    radius: Float,
) {
    drawCircle(color = color.copy(alpha = 0.16f), radius = radius)
    drawCircle(color = color.copy(alpha = 0.55f), radius = radius, style = Stroke(width = 1.5.dp.toPx()))
}

/** One arc per intent, sized by its share of the cluster, starting at 12 o'clock; one intent (or none) is a full ring. */
private fun DrawScope.drawIntentRing(
    segments: List<Pair<Color, Int>>,
    fallback: Color,
    radius: Float,
    width: Float,
) {
    val stroke = Stroke(width = width)
    val total = segments.sumOf { it.second }
    if (segments.size < 2 || total <= 0) {
        drawCircle(color = segments.firstOrNull()?.first ?: fallback, radius = radius, style = stroke)
        return
    }
    val topLeft = Offset(center.x - radius, center.y - radius)
    val arcSize = Size(radius * 2, radius * 2)
    var start = -90f
    segments.forEach { (color, posts) ->
        val sweep = 360f * posts / total
        drawArc(
            color = color,
            startAngle = start + SEGMENT_GAP / 2,
            sweepAngle = (sweep - SEGMENT_GAP).coerceAtLeast(MIN_SEGMENT),
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = stroke,
        )
        start += sweep
    }
}

/** 40 dp for 2 posts, growing on a log scale to 56 dp at 100 or more. */
private fun clusterDiameter(count: Int): Dp {
    val share = (ln(count.coerceAtLeast(2).toFloat()) - ln(2f)) / (ln(100f) - ln(2f))
    return CLUSTER_MIN + (CLUSTER_MAX - CLUSTER_MIN) * share.coerceIn(0f, 1f)
}

private val PIN_FRAME = 50.dp
private val PIN_DISC = 26.dp

/** The selected pin's disc, 1.15× the others. */
private val PIN_DISC_ACTIVE = 30.dp
private val CLUSTER_MIN = 40.dp
private val CLUSTER_MAX = 56.dp
private val CLUSTER_RING = 4.dp

/** Room around a bubble for its halo and shadow. */
private val CLUSTER_MARGIN = 10.dp

/** Degrees left blank between two intents' arcs, and the least a small share still draws. */
private const val SEGMENT_GAP = 4f
private const val MIN_SEGMENT = 2f

private val PinShadow = PantopusElevation(PantopusColors.appText, 0.3f, 3.dp, 0.dp, 1.dp)
private val ClusterShadow = PantopusElevation(PantopusColors.appText, 0.25f, 5.dp, 0.dp, 2.dp)
