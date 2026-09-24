@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * The still stack at the peel's geometry (Boards: Overview, The peel):
 * 420 tall, scale .82, layers 32 apart, 1.4 stroke. P0 draws the canvas's
 * nine decorative polygons, never real boundaries, one per counted
 * government, widest first. Each layer uses the canvas's own transform,
 * translate(cx, base − i·gap) scale(S) scale(1, .5) rotate(45). Units are
 * dp (the canvas's px). Parity twin of iOS `BallotStackGeometry`.
 */
object BallotStackGeometry {
    const val HEIGHT = 420f
    const val BASE = 350f
    const val GAP = 32f
    const val SCALE = 0.82f
    const val STROKE = 1.4f

    /** The canvas's nine polygons as x,y pairs, in its own units (Board: Overview). */
    private val RAW =
        listOf(
            floatArrayOf(-144f, -133f, 133f, -144f, 144f, 130f, -133f, 144f),
            floatArrayOf(-126f, -105f, 105f, -130f, 130f, 84f, 42f, 122f, -119f, 119f),
            floatArrayOf(-105f, -77f, 84f, -98f, 105f, 63f, -28f, 105f, -98f, 84f),
            floatArrayOf(-84f, -56f, 49f, -88f, 91f, 28f, 21f, 84f, -77f, 67f),
            floatArrayOf(-70f, -77f, 63f, -56f, 74f, 49f, -42f, 74f, -80f, 14f),
            floatArrayOf(-91f, -28f, 14f, -67f, 77f, -14f, 56f, 56f, -63f, 49f),
            floatArrayOf(-56f, -49f, 42f, -60f, 60f, 21f, 14f, 56f, -53f, 39f),
            floatArrayOf(-77f, -42f, 28f, -49f, 49f, 42f, -42f, 63f),
            floatArrayOf(-42f, -35f, 39f, -42f, 46f, 32f, -35f, 42f),
        )

    val layerCount: Int get() = RAW.size

    /** Layers drawn for [count] governments: at least one, at most nine. */
    fun layersFor(count: Int): Int = count.coerceIn(1, layerCount)

    /** Layer [index]'s corners, placed exactly as the canvas's SVG transform. */
    fun layer(
        index: Int,
        centerX: Float,
    ): List<Offset> {
        val c = cos(PI / 4).toFloat()
        val s = sin(PI / 4).toFloat()
        val baseY = BASE - index * GAP
        val raw = RAW[index]
        return (raw.indices step 2).map { k ->
            val x = raw[k]
            val y = raw[k + 1]
            Offset(centerX + (x * c - y * s) * SCALE, baseY + (x * s + y * c) * 0.5f * SCALE)
        }
    }

    /** Top of the dashed home line: 10 above the top layer's centre. */
    fun lineTop(layers: Int): Float = BASE - (layers - 1) * GAP - 10f
}

/**
 * Layer 0 fills the stack-base grey, the rest white at 94%, every layer
 * in the solid ink stroke (P0 has no verified "nothing this year"
 * status, so the dashed layer style waits). A dashed home-green line
 * drops to the home dot with its white ring. During the peel [story],
 * each told government's layer lifts 8 and takes the green highlight.
 */
@Composable
fun BallotStack(
    count: Int,
    modifier: Modifier = Modifier,
    story: BallotStory? = null,
    time: Float = Float.POSITIVE_INFINITY,
) {
    val layers = BallotStackGeometry.layersFor(count)
    Canvas(
        modifier =
            modifier
                .fillMaxWidth()
                .height(BallotStackGeometry.HEIGHT.dp)
                .semantics { contentDescription = "$count government boundary layers stacked above the address" },
    ) {
        val unit = density
        val cx = size.width / 2f / unit
        for (i in 0 until layers) {
            val lift = story?.lift(i, time) ?: 0f
            val corners = BallotStackGeometry.layer(i, cx)
            val path =
                Path().apply {
                    moveTo(corners[0].x * unit, (corners[0].y + lift) * unit)
                    corners.drop(1).forEach { lineTo(it.x * unit, (it.y + lift) * unit) }
                    close()
                }
            val fill = if (i == 0) PantopusColors.ballotStackBase else PantopusColors.appSurface.copy(alpha = 0.94f)
            drawPath(path, fill)
            drawPath(path, PantopusColors.appText, style = Stroke(width = BallotStackGeometry.STROKE.dp.toPx()))
            val highlight = if (story != null && i < story.steps) story.presence(i, time) else 0f
            if (highlight > 0f) drawHighlight(path, highlight)
        }
        val x = cx * unit
        val base = BallotStackGeometry.BASE * unit
        drawLine(
            PantopusColors.home,
            Offset(x, BallotStackGeometry.lineTop(layers) * unit),
            Offset(x, base),
            strokeWidth = 2.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 4.dp.toPx())),
        )
        drawCircle(PantopusColors.home, radius = 7.dp.toPx(), center = Offset(x, base))
        drawCircle(PantopusColors.appSurface, radius = 7.dp.toPx(), center = Offset(x, base), style = Stroke(width = 2.5.dp.toPx()))
    }
}

/** The told government's highlight: home green over its layer, faded as one. */
private fun DrawScope.drawHighlight(
    path: Path,
    alpha: Float,
) {
    drawIntoCanvas { canvas ->
        canvas.saveLayer(Rect(Offset.Zero, size), Paint().apply { this.alpha = alpha })
        drawPath(path, PantopusColors.homeBg)
        drawPath(path, PantopusColors.home, style = Stroke(width = 3.dp.toPx()))
        canvas.restore()
    }
}
