@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentPlayKinds
import app.pantopus.android.data.api.models.moments.beforeAfter
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented" phase 2 (CONTRACT 7g; as on iPhone and the web), on a switch-on reader's picture:
 * - fog-wipe: the picture opens frosted and the reader wipes it clear with a finger, on their own screen only; the viewer
 *   holds still until it is clear;
 * - the swatch slider: colours to try over one part of a real photo, a marked try-on layer with the original one tap
 *   away; the picture itself is never changed or saved changed (founder's decision 10).
 */

/** How much of the picture a reader wipes before the rest of the fog lifts by itself. */
private const val WIPED = 0.45f

/** The Moments whose fog the reader has wiped clear on this visit (by id), as on iPhone: it stays clear when reopened. */
private val fogWiped = mutableStateMapOf<String, Boolean>()

/** The fog over [moment]'s picture until the reader has wiped it clear. */
@Composable
fun MomentFogLayer(
    moment: MomentDto,
    modifier: Modifier = Modifier,
) {
    if (moment.play.orEmpty().none { it.kind == MomentPlayKinds.FOG }) return
    var clear by remember(moment.id) { mutableStateOf(fogWiped[moment.id] == true) }
    DisposableEffect(moment.id, clear) {
        if (clear) fogWiped[moment.id] = true
        MomentLayerHold.hold("fog", if (!clear) moment.id else null)
        onDispose { MomentLayerHold.release("fog", moment.id) }
    }
    val strokes = remember(moment.id) { mutableStateListOf<List<Offset>>() }
    var wiped by remember(moment.id) { mutableFloatStateOf(0f) }
    val brush = 56.dp
    val brushPx = with(LocalDensity.current) { brush.toPx() }
    AnimatedVisibility(visible = !clear, exit = fadeOut(), modifier = modifier.fillMaxSize()) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val area = constraints.maxWidth.toFloat() * constraints.maxHeight.toFloat()
            Canvas(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
                        .holdsItsFinger()
                        .pointerInput(moment.id) {
                            detectDragGestures(onDragStart = { strokes.add(listOf(it)) }) { change, amount ->
                                change.consume()
                                val last = strokes.removeAt(strokes.lastIndex)
                                strokes.add(last + change.position)
                                wiped += amount.getDistance() * brushPx / area.coerceAtLeast(1f)
                                if (wiped > WIPED) clear = true
                            }
                        }.semantics {
                            contentDescription = "A frosted picture. Wipe it to see it"
                            onClick(label = "Clear the fog") {
                                clear = true
                                true
                            }
                        }.testTag("moments.play.fog"),
            ) {
                drawRect(Color.White.copy(alpha = 0.86f))
                strokes.forEach { points ->
                    if (points.size == 1) {
                        drawCircle(Color.Black, radius = brushPx / 2, center = points.first(), blendMode = BlendMode.Clear)
                    } else {
                        val path = Path().apply { points.forEachIndexed { at, p -> if (at == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y) } }
                        drawPath(
                            path,
                            Color.Black,
                            style = Stroke(brushPx, cap = StrokeCap.Round, join = StrokeJoin.Round),
                            blendMode = BlendMode.Clear,
                        )
                    }
                }
            }
            if (strokes.isEmpty()) {
                Text(
                    text = "Wipe to see",
                    color = PantopusColors.studioBar,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.align(Alignment.Center),
                )
            }
        }
    }
}

/** The colour a reader is trying on each Moment's swatch (by Moment id); none shows the photo as it is. */
private val swatchTried = mutableStateMapOf<String, String>()

/** A swatch's box on [moment]'s photo in the layer's pixels, or null when the Moment has no swatch to try. */
private fun swatchBox(
    moment: MomentDto,
    width: Float,
    height: Float,
): Rect? {
    val box =
        moment.play
            .orEmpty()
            .firstOrNull { it.kind == MomentPlayKinds.SWATCH && !it.colors.isNullOrEmpty() && it.box != null }
            ?.box
            ?.takeIf { moment.kind == "photo" } ?: return null
    val picture =
        moment.width
            ?.let { w -> moment.height?.let { h -> IntSize(w, h) } }
            ?.let { if (moment.beforeAfter != null) halfOf(it) else it }
    val frame = stampFrame(picture, width, height)
    val left = frame.left + box.x.toFloat() * frame.width
    val top = frame.top + box.y.toFloat() * frame.height
    return Rect(left, top, left + box.w.toFloat() * frame.width, top + box.h.toFloat() * frame.height)
}

/** The colour being tried over a swatch's box on [moment]'s photo (under its stamps); the photo under it is as it was. */
@Composable
fun MomentSwatchLayer(
    moment: MomentDto,
    modifier: Modifier = Modifier,
) {
    val hex = swatchTried[moment.id] ?: return
    BoxWithConstraints(modifier = modifier.fillMaxSize().testTag("moments.play.swatch")) {
        val rect = swatchBox(moment, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat()) ?: return@BoxWithConstraints
        val density = LocalDensity.current.density
        // The try-on: the colour over the box, marked as such.
        Box(
            modifier =
                Modifier
                    .offset((rect.left / density).dp, (rect.top / density).dp)
                    .size((rect.width / density).dp, (rect.height / density).dp)
                    .background(movingWordsColor(hex).copy(alpha = 0.5f))
                    .border(1.dp, Color.White.copy(alpha = 0.7f)),
        ) {
            Text(
                text = "Try-on",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier =
                    Modifier
                        .padding(4.dp)
                        .background(Color.Black.copy(alpha = 0.45f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 5.dp),
            )
        }
    }
}

/**
 * The swatch's chips, over the stamps and the fog (as on iPhone): "Original" and each colour, centred under the box and
 * kept on screen between the name row and the picture's foot. They show once the fog (if any) is wiped, and the viewer
 * holds still while a colour is being tried.
 */
@Composable
fun MomentSwatchChipsLayer(
    moment: MomentDto,
    modifier: Modifier = Modifier,
) {
    val swatch = moment.play.orEmpty().firstOrNull { it.kind == MomentPlayKinds.SWATCH && !it.colors.isNullOrEmpty() && it.box != null }
    if (swatch == null || moment.kind != "photo") return
    val tried = swatchTried[moment.id]
    DisposableEffect(moment.id, tried) {
        MomentLayerHold.hold("swatch", if (tried != null) moment.id else null)
        onDispose { MomentLayerHold.release("swatch", moment.id) }
    }
    if (moment.play.orEmpty().any { it.kind == MomentPlayKinds.FOG } && fogWiped[moment.id] != true) return
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val rect = swatchBox(moment, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat()) ?: return@BoxWithConstraints
        val density = LocalDensity.current.density
        val gap = 8f * density
        SwatchChips(
            colors = swatch.colors.orEmpty().take(6),
            tried = tried,
            onTry = { hex -> if (hex == null) swatchTried.remove(moment.id) else swatchTried[moment.id] = hex },
            modifier =
                Modifier.keptOnScreen(
                    x = rect.center.x,
                    top = rect.bottom + gap,
                    above = rect.top - gap,
                    band = HEADER_BAND_DP * density to constraints.maxHeight - FOOT_BAND_DP * density,
                ),
        )
    }
}

/** The name row over the top of the picture and the space kept at its foot, as the play cards keep them. */
private const val HEADER_BAND_DP = 112f
private const val FOOT_BAND_DP = 16f

/**
 * Places the chips centred on [x] just under [top] (or over [above] when there is no room under), inside the layer's
 * width and between [band]'s two heights.
 */
private fun Modifier.keptOnScreen(
    x: Float,
    top: Float,
    above: Float,
    band: Pair<Float, Float>,
): Modifier =
    layout { measurable, constraints ->
        val placeable = measurable.measure(constraints.copy(minWidth = 0, minHeight = 0))
        layout(constraints.maxWidth, constraints.maxHeight) {
            val (first, last) = band
            val y =
                when {
                    top + placeable.height <= last -> top
                    above - placeable.height >= first -> above - placeable.height
                    else -> last - placeable.height
                }.coerceIn(first, (last - placeable.height).coerceAtLeast(first))
            val left = (x - placeable.width / 2f).coerceIn(0f, (constraints.maxWidth - placeable.width).toFloat().coerceAtLeast(0f))
            placeable.place(left.roundToInt(), y.roundToInt())
        }
    }

/** The swatch's chips: "Original" (the photo as it is) and each colour to try, each at least 44 dp to the finger. */
@Composable
private fun SwatchChips(
    colors: List<String>,
    tried: String?,
    onTry: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            modifier
                .holdsItsFinger()
                .clip(RoundedCornerShape(22.dp))
                .background(PantopusColors.studioBar)
                .padding(horizontal = 4.dp)
                .testTag("moments.play.swatch.chips"),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .height(44.dp)
                    .clickable(role = Role.Button) { onTry(null) }
                    .semantics { selected = tried == null }
                    .testTag("moments.play.swatch.original"),
        ) {
            Text(
                text = "Original",
                color = if (tried == null) PantopusColors.studioBar else Color.White,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (tried == null) Color.White else PantopusColors.studioPillFill)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        colors.forEachIndexed { at, hex ->
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(role = Role.Button) { onTry(if (tried == hex) null else hex) }
                        .semantics {
                            contentDescription = "Try colour ${at + 1}"
                            selected = tried == hex
                        }.testTag("moments.play.swatch.color$at"),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(movingWordsColor(hex))
                            .border(if (tried == hex) 3.dp else 1.dp, Color.White, CircleShape),
                )
            }
        }
    }
}
