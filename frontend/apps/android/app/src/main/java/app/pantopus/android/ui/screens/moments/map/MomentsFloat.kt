@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.map

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentSunDto
import app.pantopus.android.data.moments.MomentShownHeight
import app.pantopus.android.ui.screens.moments.components.MOMENT_PIN_WIDTH
import app.pantopus.android.ui.screens.moments.components.MomentMapPin
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/*
 * Part D of Moment elevation, by day (board F1, approved by the founder on 2026-11-13): a pin whose Moment carries an
 * elevation floats over the map. It loses its tail, its disc sits right over its spot, it is a little bigger the higher
 * it was made (a quarter bigger in flight), and its shadow falls on the map where the real sun puts it now, farther and
 * softer the higher it is, turned with the map. Its height tag takes the side away from the shadow. A pin with no
 * elevation keeps its tail and stands on its spot, so floating always means height; crowded spots and fans stay as they
 * are. A chip beside the colour key says the time the shadows are drawn for.
 *
 * Only while the map's answer says `float_on` (the `moment_float` switch, contract v3.10), the Elevation chip is on and
 * the sun is up. Otherwise the map draws today's pins. The shadows are drawn under every pin in the overlay's draw step,
 * from the camera as it is then, so the pins still move with the map without recomposing. The same numbers as iPhone's
 * `MomentsFloat.swift`.
 */

/** How a floating pin is drawn, from its elevation and the sun. */
internal object MomentsFloat {
    /** The shadow's radius before its soft edge: the disc's own. */
    const val SHADOW_RADIUS_DP = 31f

    /** How high it floats on the map's own scale, 0 to 1: a square root of the feet up to 15,000; flights at the top. */
    fun lift(height: MomentShownHeight): Double = if (height.flying) 1.0 else min(1.0, sqrt(max(height.feet, 0) / 15000.0))

    fun scale(height: MomentShownHeight): Float = (1 + 0.25 * lift(height)).toFloat()

    /**
     * A floating pin's shadow: where its middle is from the spot (dp, screen y down), how soft its edge is (dp) and how
     * dark it is. Away from the sun, turned with the map's [bearing]; longer the higher the pin and the lower the sun.
     */
    fun shadow(
        height: MomentShownHeight,
        sun: MomentSunDto,
        bearing: Float,
    ): MomentFloatShadow {
        val lift = lift(height)
        val atThirty = 1 / tan(Math.toRadians(30.0))
        val lowSun = (1 / tan(Math.toRadians(max(sun.elevationDeg ?: 0.0, 4.0))) / atThirty).coerceIn(0.55, 1.9)
        val length = (4 + 30 * lift) * lowSun
        val away = away(sun, bearing)
        return MomentFloatShadow(
            dx = (sin(away) * length).toFloat(),
            dy = (-cos(away) * length).toFloat(),
            blur = (1 + 7.5 * lift).toFloat(),
            opacity = (0.36 - 0.14 * lift).toFloat(),
        )
    }

    /** The sides a tag tries, in order: away from the shadow across, away from it up or down, then the other two. */
    fun sides(
        sun: MomentSunDto,
        bearing: Float,
    ): List<MomentTagSide> {
        val away = away(sun, bearing)
        // Shadow to the right: the tag goes before the disc; shadow up the screen: under it.
        val across = listOf(MomentTagSide.BEFORE, MomentTagSide.AFTER).let { if (sin(away) > 0) it else it.reversed() }
        val upDown = listOf(MomentTagSide.BELOW, MomentTagSide.ABOVE).let { if (-cos(away) < 0) it else it.reversed() }
        return listOf(across[0], upDown[0], across[1], upDown[1])
    }

    /** The map's bearing the tags are laid out for, in 10-degree steps, so turning the map moves them only now and then. */
    fun tagBearing(bearing: Float): Float = (bearing / 10f).roundToInt() * 10f % 360f

    /** The way the shadow falls on screen, in radians clockwise from up: away from the sun, less the map's turn. */
    private fun away(
        sun: MomentSunDto,
        bearing: Float,
    ): Double = Math.toRadians((sun.azimuthDeg ?: 0.0) + 180 - bearing)
}

/** Where a floating pin's shadow falls from its spot and how it looks (`MomentsFloat.shadow`), in dp. */
internal data class MomentFloatShadow(
    val dx: Float,
    val dy: Float,
    val blur: Float,
    val opacity: Float,
)

/**
 * A floating pin's shadow, its middle [spot] (px) plus its offset: solid out to its radius less half its soft edge,
 * then fading to nothing. A radial gradient, so no blur filter is drawn each frame.
 */
internal fun DrawScope.drawFloatShadow(
    spot: Offset,
    shadow: MomentFloatShadow,
) {
    val radius = MomentsFloat.SHADOW_RADIUS_DP.dp.toPx()
    val blur = shadow.blur.dp.toPx()
    val edge = radius + blur
    val center = Offset(spot.x + shadow.dx.dp.toPx(), spot.y + shadow.dy.dp.toPx())
    val ink = PantopusColors.momentFloatShadow
    drawCircle(
        brush =
            Brush.radialGradient(
                0f to ink.copy(alpha = shadow.opacity),
                ((radius - blur / 2) / edge) to ink.copy(alpha = shadow.opacity),
                1f to ink.copy(alpha = 0f),
                center = center,
                radius = edge,
            ),
        radius = edge,
        center = center,
    )
}

/**
 * Where a floating pin drawn [width] px wide with its tag goes, so its disc's middle sits on the map's [spot] (px): the
 * disc is [disc] px across, and a tag over it pushes it down by [tagAbove] px.
 */
internal fun floatTopLeft(
    spot: android.graphics.Point,
    width: Int,
    tag: MomentTagSide?,
    disc: Int,
    tagAbove: Int,
): IntOffset {
    val (middleX, middleY) =
        when (tag) {
            MomentTagSide.AFTER -> disc / 2f to disc / 2f
            MomentTagSide.BEFORE -> width - disc / 2f to disc / 2f
            MomentTagSide.ABOVE -> width / 2f to tagAbove + disc / 2f
            MomentTagSide.BELOW, null -> width / 2f to disc / 2f
        }
    return IntOffset((spot.x - middleX).roundToInt(), (spot.y - middleY).roundToInt())
}

/** A floating pin's disc across, in px: today's 64 dp, scaled for its elevation. */
internal fun Density.floatDiscPx(height: MomentShownHeight): Int = (MOMENT_PIN_WIDTH * MomentsFloat.scale(height)).roundToPx()

/**
 * A floating ring: today's pin with no tail, scaled for its elevation, its tag beside, over or under the disc. The tag
 * is inside the ring's own tap, as on a standing pin, and TalkBack reads the same words.
 */
@Composable
internal fun FloatRingItem(
    ring: MomentRingUi,
    height: MomentShownHeight,
    tag: MomentTagSide?,
    onTap: () -> Unit,
) {
    val scale = MomentsFloat.scale(height)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(MOMENT_HEIGHT_TAG_GAP_ABOVE),
        modifier = Modifier.ringTap(ring, height, remember { MutableInteractionSource() }, onTap),
    ) {
        if (tag == MomentTagSide.ABOVE) MomentHeightTag(height = height)
        Row(horizontalArrangement = Arrangement.spacedBy(MOMENT_HEIGHT_TAG_GAP), verticalAlignment = Alignment.CenterVertically) {
            if (tag == MomentTagSide.BEFORE) MomentHeightTag(height = height)
            Box(modifier = Modifier.size(MOMENT_PIN_WIDTH * scale), contentAlignment = Alignment.Center) {
                MomentMapPin(
                    author = ring.author,
                    seen = ring.seen,
                    preview = ring.ring.preview,
                    tail = false,
                    modifier =
                        Modifier.graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                        },
                )
            }
            if (tag == MomentTagSide.AFTER) MomentHeightTag(height = height)
        }
        if (tag == MomentTagSide.BELOW) MomentHeightTag(height = height)
    }
}

/**
 * Beside the colour key while pins float: a sun and the phone's time, the moment the shadows are drawn for ("2:10 pm"),
 * moved each minute. It takes no tap. [modifier] carries the bar's glass and height.
 */
@Composable
internal fun MomentsSunChip(modifier: Modifier = Modifier) {
    val time = rememberMinuteClock()
    Row(
        modifier =
            modifier
                .padding(horizontal = Spacing.s3)
                .testTag("moments.sun.chip")
                .clearAndSetSemantics { contentDescription = "Shadows show the sun at $time" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Sun, contentDescription = null, size = 15.dp, tint = PantopusColors.momentHeightMountain)
        Text(text = time, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText, maxLines = 1)
    }
}

/** The phone's time as "2:10 pm", moved when the minute turns. */
@Composable
private fun rememberMinuteClock(): String {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(MINUTE_MS - System.currentTimeMillis() % MINUTE_MS + CLOCK_SLACK_MS)
            now = System.currentTimeMillis()
        }
    }
    val minute = now / MINUTE_MS
    return remember(minute) { SUN_CLOCK.format(Instant.ofEpochMilli(now).atZone(ZoneId.systemDefault())).lowercase(Locale.US) }
}

private val SUN_CLOCK: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private const val MINUTE_MS = 60_000L
private const val CLOCK_SLACK_MS = 50L
