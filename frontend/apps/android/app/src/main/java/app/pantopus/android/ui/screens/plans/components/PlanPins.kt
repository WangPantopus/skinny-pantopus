@file:Suppress("MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.icon
import app.pantopus.android.ui.screens.plans.planPinInk
import app.pantopus.android.ui.screens.plans.planPinRing
import app.pantopus.android.ui.screens.plans.plansDark
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle

/** Pin sizes (board P1): 34 dp head with a 2.5 dp ring and a 17 dp glyph; selected 46 dp, 3 dp ring, 22 dp glyph. */
object PlanPinSize {
    val head: Dp = 34.dp
    val headSelected: Dp = 46.dp
    val ring: Dp = 2.5.dp
    val ringSelected: Dp = 3.dp
    val glyph: Dp = 17.dp
    val glyphSelected: Dp = 22.dp
    val badge: Dp = 18.dp

    /** The tip of the teardrop sits this far above the map point; the tag hangs just below it. */
    val tipLift: Dp = 7.dp
}

/** The small square badge on a pin's shoulder (board P1). */
enum class PlanPinBadge { None, In, Hosting, Waiting }

/**
 * The teardrop: a circle with one sharp corner turned to point down (board P1 "never a plain disc or ring: in
 * Pantopus those mean where a fact came from").
 */
private val teardrop = RoundedCornerShape(topStartPercent = 50, topEndPercent = 50, bottomEndPercent = 50, bottomStartPercent = 20)

/**
 * One plan pin: the colored head with its glyph, an optional badge, an optional "happening now" halo, and the time
 * tag under the point. The caller places the composable so the point (the bottom of the head plus [PlanPinSize.tipLift])
 * lands on the map position; [anchorFromTop] gives that distance.
 */
@Composable
fun PlanPin(
    kind: PlanKind,
    tag: String?,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    dimmed: Boolean = false,
    full: Boolean = false,
    live: Boolean = false,
    badge: PlanPinBadge = PlanPinBadge.None,
    reduceMotion: Boolean = false,
) {
    val head by animateDpAsState(
        targetValue = if (selected) PlanPinSize.headSelected else PlanPinSize.head,
        animationSpec = tween(if (reduceMotion) 0 else 180, easing = FastOutSlowInEasing),
        label = "plan-pin-size",
    )
    val alpha by animateFloatAsState(
        targetValue = if (dimmed) 0.4f else 1f,
        animationSpec = tween(if (reduceMotion) 150 else 180),
        label = "plan-pin-dim",
    )
    val colors = kind.colors
    val fill = if (full) PantopusColors.appBorderStrong else colors.accent
    val ink = if (full) PantopusColors.appTextStrong else planPinInk
    Column(
        modifier = modifier.alpha(alpha),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(modifier = Modifier.size(PlanPinSize.headSelected + 16.dp), contentAlignment = Alignment.BottomCenter) {
            if (live) LiveHalo(color = colors.accent, size = head, reduceMotion = reduceMotion)
            PinHead(size = head, fill = fill, ink = ink, icon = kind.icon, selected = selected)
            if (badge != PlanPinBadge.None) {
                PinBadge(
                    badge = badge,
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = PlanPinSize.tipLift + head - 10.dp)
                            .graphicsLayer { translationX = (head.toPx() / 2f) - 1.dp.toPx() },
                )
            }
        }
        if (!tag.isNullOrBlank()) {
            Text(
                text = tag,
                style = pinTagStyle(selected),
                color = PantopusColors.appText,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp).widthIn(max = 120.dp),
            )
        }
    }
}

/** Distance from the top of a [PlanPin] to its map point (the tip sits just above it). */
fun planPinAnchorFromTop(): Dp = PlanPinSize.headSelected + 16.dp

@Composable
private fun pinTagStyle(selected: Boolean): TextStyle {
    val halo = if (plansDark) PantopusColors.appBgDark else PantopusColors.appSurface
    return PantopusTextStyle.caption.copy(
        fontSize = if (selected) 12.sp else 11.sp,
        lineHeight = 13.sp,
        fontWeight = FontWeight.Bold,
        shadow = Shadow(color = halo, offset = Offset.Zero, blurRadius = 6f),
    )
}

@Composable
private fun PinHead(
    size: Dp,
    fill: Color,
    ink: Color,
    icon: PantopusIcon,
    selected: Boolean,
) {
    val ring = if (selected) PlanPinSize.ringSelected else PlanPinSize.ring
    val glyph = if (selected) PlanPinSize.glyphSelected else PlanPinSize.glyph
    Box(
        modifier =
            Modifier
                .padding(bottom = PlanPinSize.tipLift)
                .size(size)
                .graphicsLayer { rotationZ = -45f }
                .shadow(elevation = if (selected) 8.dp else 4.dp, shape = teardrop, clip = false)
                .clip(teardrop)
                .background(fill)
                .border(ring, planPinRing, teardrop),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = glyph,
            tint = ink,
            modifier = Modifier.graphicsLayer { rotationZ = 45f },
        )
    }
}

@Composable
private fun PinBadge(
    badge: PlanPinBadge,
    modifier: Modifier = Modifier,
) {
    val (bg, fg, icon) =
        when (badge) {
            PlanPinBadge.In -> Triple(PantopusColors.success, PantopusColors.appTextInverse, PantopusIcon.Check)
            PlanPinBadge.Hosting -> Triple(PantopusColors.primary600, PantopusColors.appTextInverse, PantopusIcon.Flag)
            PlanPinBadge.Waiting -> Triple(PantopusColors.appTextStrong, PantopusColors.appSurface, PantopusIcon.Clock)
            PlanPinBadge.None -> return
        }
    Box(
        modifier =
            modifier
                .size(PlanPinSize.badge)
                .clip(RoundedCornerShape(6.dp))
                .background(planPinRing)
                .padding(2.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 10.dp, tint = fg)
    }
}

/** "Happening now": a halo that grows from 70% to 150% and fades over 1.8 s; a still halo under Reduce Motion. */
@Composable
private fun LiveHalo(
    color: Color,
    size: Dp,
    reduceMotion: Boolean,
) {
    val transition = rememberInfiniteTransition(label = "plan-live")
    val progress by
        if (reduceMotion) {
            remember { mutableFloatStateOf(STILL_HALO) }
        } else {
            transition.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Restart),
                label = "plan-live-progress",
            )
        }
    val scale = 0.7f + 0.8f * progress
    Box(
        modifier =
            Modifier
                .size(size + 14.dp)
                .scale(scale)
                .alpha((1f - progress) * 0.6f)
                .graphicsLayer { rotationZ = -45f }
                .border(2.dp, color, RoundedCornerShape(50, 50, 50, 30)),
    )
}

private const val STILL_HALO = 0.45f

/**
 * A cluster (board P1): how many plans, with a short bar in each type's color. Tapping zooms in.
 */
@Composable
fun PlanCluster(
    count: Int,
    kinds: List<PlanKind>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .shadow(4.dp, RoundedCornerShape(12.dp))
                .clip(RoundedCornerShape(12.dp))
                .background(planPinRing)
                .padding(2.5.dp)
                .clip(RoundedCornerShape(CornerSize(10.dp)))
                .background(PantopusColors.appSurface)
                .widthIn(min = 36.dp)
                .padding(horizontal = 9.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(
            text = count.toString(),
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.ExtraBold, lineHeight = 16.sp),
            color = PantopusColors.appText,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            kinds.distinct().forEach { kind ->
                Box(
                    modifier =
                        Modifier
                            .size(width = 6.dp, height = 4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(kind.colors.accent),
                )
            }
        }
    }
}

/**
 * The area under a pin (board P1): a soft disc in the type's color, about 500 m (1 km for playdates). [radius] is
 * in pixels on screen; [strength] fades it (1 = full, the reveal takes it to 0).
 */
@Composable
fun PlanAreaGlow(
    color: Color,
    radiusPx: Float,
    modifier: Modifier = Modifier,
    strength: Float = 1f,
    ghost: Boolean = false,
) {
    Canvas(modifier = modifier) {
        if (radiusPx <= 0f) return@Canvas
        val inner = if (ghost) 0.10f else 0.24f
        val mid = if (ghost) 0.06f else 0.20f
        drawCircle(
            brush =
                Brush.radialGradient(
                    0f to color.copy(alpha = inner * strength),
                    0.72f to color.copy(alpha = mid * strength),
                    1f to Color.Transparent,
                    center = center,
                    radius = radiusPx,
                ),
            radius = radiusPx,
            center = center,
        )
    }
}

/** The label printed in a playdate's neighborhood (board P1 "Downtown Camas"). */
@Composable
fun PlanAreaLabel(
    text: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    val halo = if (plansDark) PantopusColors.appBgDark else PantopusColors.appSurface
    Text(
        text = text,
        style =
            PantopusTextStyle.caption.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                shadow = Shadow(color = halo, offset = Offset.Zero, blurRadius = 5f),
            ),
        color = color,
        modifier = modifier,
    )
}
