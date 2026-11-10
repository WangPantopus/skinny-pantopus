@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.zIndex
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/** The soft shadows under the envelope and the card, drawn once for this screen's sizes. */
private class TableShadows(
    val envelope: SoftShadow,
    val cardWide: SoftShadow,
    val cardTight: SoftShadow,
)

/**
 * Everything on the table: the cloth, the envelope's layers, the card between them, and the room's light over it all.
 * Nothing here recomposes as it moves: each layer reads its springs in its own graphics layer or draw.
 */
@Composable
internal fun CardTableScene(
    state: CardTableState,
    art: CardTableArt,
    faceArt: CardFaceArt?,
    picture: CardPictureState,
    geometry: TableGeometry,
    modifier: Modifier = Modifier,
) {
    val shadows by produceState<TableShadows?>(null, geometry) {
        value =
            withContext(Dispatchers.Default) {
                val g = geometry
                TableShadows(
                    envelope =
                        SoftShadow.of(
                            g.envelopeWidth,
                            g.envelopeHeight,
                            blur = g.envelopeWidth * 0.08f,
                            spread = g.envelopeWidth * 0.02f,
                            alpha = 0.72f,
                        ),
                    cardWide = SoftShadow.of(g.cardWidth, g.cardHeight, g.cardWidth * 0.14f, g.cardWidth * 0.035f, 1f),
                    cardTight = SoftShadow.of(g.cardWidth, g.cardHeight, g.cardWidth * 0.03f, g.cardWidth * 0.0075f, 1f),
                )
            }
    }
    Box(modifier = modifier.fillMaxSize()) {
        TableCloth(state, art, geometry)
        shadows?.let { EnvelopeShadow(state, geometry, it.envelope) }
        EnvelopeUnder(state, art, geometry)
        shadows?.let { CardShadows(state, geometry, it) }
        TableCardLayer(state, faceArt, picture, geometry)
        EnvelopeOver(state, art, geometry)
        EnvelopeFront(state, art, faceArt, geometry)
        TableLight(state, art)
    }
}

/** A layer with a fixed size, wherever it's placed: it moves by its graphics layer and may run past the screen's edges. */
private fun Modifier.pinned(
    width: Float,
    height: Float,
): Modifier =
    layout { measurable, constraints ->
        val placeable = measurable.measure(Constraints.fixed(width.toInt().coerceAtLeast(1), height.toInt().coerceAtLeast(1)))
        layout(min(placeable.width, constraints.maxWidth), min(placeable.height, constraints.maxHeight)) { placeable.place(0, 0) }
    }

/** The grey cloth multiplied by the picture's colour, filling the screen with room to move against the tilt. */
@Composable
private fun TableCloth(
    state: CardTableState,
    art: CardTableArt,
    g: TableGeometry,
) {
    val tint = remember(state.card.table) { clothTint(state.card.table).toArgb() }
    val paint =
        remember(tint) {
            Paint(Paint.FILTER_BITMAP_FLAG).apply { colorFilter = PorterDuffColorFilter(tint, PorterDuff.Mode.MULTIPLY) }
        }
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .zIndex(0f)
                .graphicsLayer {
                    translationX = -state.lightX.x * 7f * g.density
                    translationY = -state.lightY.x * 7f * g.density
                }.drawBehind {
                    val over = 14f * g.density
                    drawIntoCanvas { canvas ->
                        drawCover(canvas.nativeCanvas, art.cloth, RectF(-over, -over, size.width + over, size.height + over), paint)
                    }
                },
    )
}

/** [bitmap] centred and cut to cover [target], never stretched. */
internal fun drawCover(
    canvas: Canvas,
    bitmap: Bitmap,
    target: RectF,
    paint: Paint,
) {
    val shape = target.width() / target.height()
    val cutWidth = min(bitmap.width.toFloat(), bitmap.height * shape)
    val cutHeight = cutWidth / shape
    val left = (bitmap.width - cutWidth) / 2f
    val top = (bitmap.height - cutHeight) / 2f
    canvas.drawBitmap(bitmap, Rect(left.toInt(), top.toInt(), (left + cutWidth).toInt(), (top + cutHeight).toInt()), target, paint)
}

@Composable
private fun EnvelopeShadow(
    state: CardTableState,
    g: TableGeometry,
    shadow: SoftShadow,
) {
    Box(
        modifier =
            Modifier
                .zIndex(1f)
                .pinned(g.envelopeWidth, g.envelopeHeight)
                .graphicsLayer {
                    val narrow = abs(cos(Math.toRadians(state.envelopeTurn.x.toDouble())).toFloat())
                    translationX = state.envelopeX(g) + (3f - state.lightX.x * 7f) * g.density
                    translationY = state.envelopeY(g) + (7f - state.lightY.x * 7f) * g.density
                    rotationZ = state.envelopeTurnZ
                    scaleX = max(0.02f, narrow)
                    alpha = 0.78f
                    compositingStrategy = CompositingStrategy.ModulateAlpha
                }.drawBehind { drawShadow(shadow) },
    )
}

internal fun DrawScope.drawShadow(shadow: SoftShadow) {
    val pad = shadow.pad
    drawIntoCanvas { canvas ->
        canvas.nativeCanvas.drawBitmap(
            shadow.bitmap,
            null,
            RectF(-pad, -pad, size.width + pad, size.height + pad),
            Paint(Paint.FILTER_BITMAP_FLAG),
        )
    }
}

/** How an envelope layer sits: where it lies, its small turn, and, while it's being turned over, its turn over. */
private fun Modifier.envelopeLayer(
    state: CardTableState,
    g: TableGeometry,
    flapSide: Boolean,
): Modifier =
    graphicsLayer {
        val angle = state.envelopeTurn.x
        val settled = abs(sin(Math.toRadians(angle.toDouble()))) < 0.001
        translationX = state.envelopeX(g)
        translationY = state.envelopeY(g)
        rotationZ = state.envelopeTurnZ
        rotationY = if (settled) 0f else angle + if (flapSide) 180f else 0f
        cameraDistance = g.envelopeWidth * 3.6f / PIXELS_PER_CAMERA_UNIT
        alpha = if (state.flapSideUp == flapSide) 1f else 0f
    }

/** The inside of the envelope and the flap's lining: what lies under the card. */
@Composable
private fun EnvelopeUnder(
    state: CardTableState,
    art: CardTableArt,
    g: TableGeometry,
) {
    Box(
        modifier =
            Modifier
                .zIndex(2f)
                .pinned(g.envelopeWidth, g.envelopeHeight)
                .envelopeLayer(state, g, flapSide = true),
    ) {
        Box(Modifier.matchParentSize().drawBehind { drawArt(art.inside) })
        FlapLining(state, art, g)
    }
}

/** The open flap: its lining with the gold's glint, standing above the envelope's top edge. */
@Composable
private fun FlapLining(
    state: CardTableState,
    art: CardTableArt,
    g: TableGeometry,
) {
    val paints = remember { GlintPaints() }
    Box(
        modifier =
            Modifier
                .pinned(g.envelopeWidth, g.flapDepth)
                .graphicsLayer {
                    val angle = state.flapAngle
                    translationY = -g.flapDepth
                    transformOrigin = TransformOrigin(0.5f, 1f)
                    alpha = if (angle >= 90f) 1f else 0f
                    // CSS turns it by angle - 180 about its bottom edge; Android's X turn runs the other way.
                    rotationX = if (angle < 179.99f) 180f - angle else 0f
                    cameraDistance = g.envelopeWidth * 2.4f / PIXELS_PER_CAMERA_UNIT
                }.drawBehind {
                    val angle = state.flapAngle
                    val shade = 1f - 0.45f * sin(angle * PI.toFloat() / 180f)
                    drawIntoCanvas { canvas ->
                        val native = canvas.nativeCanvas
                        native.drawBitmap(art.flapIn, null, RectF(0f, 0f, size.width, size.height), paints.shaded(shade))
                        drawGlint(native, art.flapGold, size.width, size.height, state.lightX.x, state.lightY.x, paints)
                    }
                },
    )
}

private class GlintPaints {
    val art = Paint(Paint.FILTER_BITMAP_FLAG)
    val layer = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.SCREEN) }
    val band = Paint(Paint.ANTI_ALIAS_FLAG)
    val mask = Paint(Paint.FILTER_BITMAP_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN) }

    fun shaded(shade: Float): Paint {
        art.colorFilter =
            if (shade >= 0.999f) {
                null
            } else {
                PorterDuffColorFilter(Color(shade, shade, shade).toArgb(), PorterDuff.Mode.MULTIPLY)
            }
        return art
    }
}

/** A band of light over the lining's gold, screen-blended and masked to the gold, sliding with the tilt. */
private fun drawGlint(
    canvas: Canvas,
    mask: Bitmap,
    width: Float,
    height: Float,
    tx: Float,
    ty: Float,
    paints: GlintPaints,
) {
    val saved = canvas.saveLayer(0f, 0f, width, height, paints.layer)
    val boxWidth = width * 2.2f
    val boxHeight = height * 1.4f
    val centerX = width / 2f + tx * 0.28f * boxWidth
    val centerY = height / 2f + ty * 0.1f * boxHeight
    val edge = PantopusColors.tableGlintEdge.toArgb()
    paints.band.shader =
        cssGradient(
            centerX,
            centerY,
            boxWidth,
            boxHeight,
            105f,
            intArrayOf(edge, PantopusColors.tableGlint.toArgb(), edge),
            floatArrayOf(0.38f, 0.5f, 0.62f),
        )
    // The band stays inside the mask's clear margin, or the layer's edge shows as a hairline when it's turned.
    val margin = height * 0.02f
    canvas.drawRect(margin, margin, width - margin, height, paints.band)
    canvas.drawBitmap(mask, null, RectF(0f, 0f, width, height), paints.mask)
    canvas.restoreToCount(saved)
}

/** A CSS `linear-gradient(<deg>deg, …)` across a box of that size, centred where it's asked. */
internal fun cssGradient(
    centerX: Float,
    centerY: Float,
    boxWidth: Float,
    boxHeight: Float,
    degrees: Float,
    colors: IntArray,
    stops: FloatArray,
): LinearGradient {
    val radians = degrees * PI.toFloat() / 180f
    val dx = sin(radians)
    val dy = -cos(radians)
    val half = (abs(boxWidth * dx) + abs(boxHeight * dy)) / 2f
    return LinearGradient(
        centerX - dx * half,
        centerY - dy * half,
        centerX + dx * half,
        centerY + dy * half,
        colors,
        stops,
        Shader.TileMode.CLAMP,
    )
}

/** The pocket, its shadow on the card, and the closed flap with the wax seal: what lies over the card. */
@Composable
private fun EnvelopeOver(
    state: CardTableState,
    art: CardTableArt,
    g: TableGeometry,
) {
    Box(
        modifier =
            Modifier
                .zIndex(6f)
                .pinned(g.envelopeWidth, g.envelopeHeight)
                .envelopeLayer(state, g, flapSide = true),
    ) {
        Box(
            Modifier.matchParentSize().drawBehind {
                drawArt(art.pocketShadow)
                drawArt(art.pocket)
                drawArt(art.flapShadow, alpha = state.flapShadowAlpha)
            },
        )
        FlapShut(state, art, g)
    }
}

/** The flap's outside and the seal on it; it turns away about its top edge until the lining shows. */
@Composable
private fun FlapShut(
    state: CardTableState,
    art: CardTableArt,
    g: TableGeometry,
) {
    val paint = remember { Paint(Paint.FILTER_BITMAP_FLAG) }
    val sealPaint = remember { Paint(Paint.FILTER_BITMAP_FLAG) }
    val placePaint = remember { Paint(Paint.ANTI_ALIAS_FLAG) }
    val cracked = state.cracked
    Box(
        modifier =
            Modifier
                .pinned(g.envelopeWidth, g.flapDepth)
                .graphicsLayer {
                    val angle = state.flapAngle
                    transformOrigin = TransformOrigin(0.5f, 0f)
                    alpha = if (angle < 90f) 1f else 0f
                    // CSS turns it by angle about its top edge; Android's X turn runs the other way.
                    rotationX = if (angle > 0.01f) -angle else 0f
                    cameraDistance = g.envelopeWidth * 2.4f / PIXELS_PER_CAMERA_UNIT
                }.drawBehind {
                    val angle = state.flapAngle
                    val shade = 1f - 0.3f * sin(angle * PI.toFloat() / 180f)
                    val filter =
                        if (shade >= 0.999f) null else PorterDuffColorFilter(Color(shade, shade, shade).toArgb(), PorterDuff.Mode.MULTIPLY)
                    paint.colorFilter = filter
                    sealPaint.colorFilter = filter
                    drawIntoCanvas { canvas ->
                        val native = canvas.nativeCanvas
                        native.drawBitmap(art.flapOut, null, RectF(0f, 0f, size.width, size.height), paint)
                        val moment = state.sending
                        when {
                            moment == null -> drawSeal(native, art, size.width, size.height, cracked, sealPaint)
                            moment.sealShown -> drawSeal(native, art, size.width, size.height, false, sealPaint)
                            moment.step == SendStep.Seal -> drawSealPlace(native, size.width, size.height, moment.sealPress, placePaint)
                        }
                    }
                },
    )
}

/** The wax seal, 28% of the flap wide, at the flap's tip; broken, it's turned a little. */
private fun drawSeal(
    canvas: Canvas,
    art: CardTableArt,
    flapWidth: Float,
    flapHeight: Float,
    cracked: Boolean,
    paint: Paint,
) {
    val width = flapWidth * 0.28f
    val height = width * art.wax.height / art.wax.width
    val left = flapWidth * 0.36f
    val top = flapHeight * 0.71f
    val saved = canvas.save()
    if (cracked) {
        canvas.translate(0f, -height * 0.01f)
        canvas.rotate(2.5f, left + width / 2f, top + height / 2f)
    }
    canvas.drawBitmap(if (cracked) art.waxCracked else art.wax, null, RectF(left, top, left + width, top + height), paint)
    canvas.restoreToCount(saved)
}

/**
 * Where the seal goes, while the sender is about to seal it: a soft gold ring, and while a finger holds it, the round
 * shadow of the stamp head growing over the spot ([press], 0 … 1).
 */
private fun drawSealPlace(
    canvas: Canvas,
    flapWidth: Float,
    flapHeight: Float,
    press: Float,
    paint: Paint,
) {
    val width = flapWidth * 0.28f
    val cx = flapWidth * 0.36f + width / 2f
    val cy = flapHeight * 0.71f + width / 2f
    paint.reset()
    paint.isAntiAlias = true
    paint.style = Paint.Style.FILL
    paint.color = PantopusColors.tableGold.copy(alpha = 0.16f).toArgb()
    canvas.drawCircle(cx, cy, width * 0.46f, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = width * 0.035f
    paint.color = PantopusColors.tableGold.copy(alpha = 0.7f).toArgb()
    canvas.drawCircle(cx, cy, width * 0.42f, paint)
    if (press > 0f) {
        paint.style = Paint.Style.FILL
        paint.color = PantopusColors.tableNight.copy(alpha = 0.18f + 0.3f * press).toArgb()
        paint.maskFilter = BlurMaskFilter(width * 0.06f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(cx, cy, width * (0.2f + 0.32f * press), paint)
        paint.maskFilter = null
    }
}

/** The address side: the red paper, the stamp under its postmark, the two names by hand, and its label or stamped words. */
@Composable
private fun EnvelopeFront(
    state: CardTableState,
    art: CardTableArt,
    faceArt: CardFaceArt?,
    g: TableGeometry,
) {
    val card = state.card
    val day = remember(card.mailedOn) { cardPostmarkDay(card.mailedOn) }
    val paint = remember { EnvelopePaints() }
    Box(
        modifier =
            Modifier
                .zIndex(10f)
                .pinned(g.envelopeWidth, g.envelopeHeight)
                .envelopeLayer(state, g, flapSide = false)
                .drawBehind {
                    val pen = faceArt?.pen ?: return@drawBehind
                    val moment = state.sending
                    val reveal = AddressReveal.of(moment)
                    drawIntoCanvas { canvas ->
                        // A list: the envelopes under the top one, their edges showing.
                        if ((moment?.calls?.several ?: 1) > 1) {
                            drawEnvelopeStack(canvas.nativeCanvas, art, size.width, size.height, paint)
                        }
                        drawAddressSide(canvas.nativeCanvas, art, pen, card, day, size.width, size.height, paint, reveal)
                    }
                },
    )
}

private fun drawAddressSide(
    canvas: Canvas,
    art: CardTableArt,
    pen: Typeface,
    card: CardOnTable,
    day: String,
    width: Float,
    height: Float,
    paints: EnvelopePaints,
    reveal: AddressReveal = AddressReveal.All,
) {
    canvas.drawBitmap(art.front, null, RectF(0f, 0f, width, height), paints.bitmap)
    drawPostage(canvas, art, card, day, width, height, paints, reveal)
    penLine(
        canvas,
        pen,
        card.from,
        width * 0.066f,
        height * 0.062f,
        width * 0.05f,
        1.15f,
        -0.8f,
        width * 0.6f,
        PantopusColors.tableEnvelopeFrom,
        paints,
    )
    card.to?.takeIf { it.isNotBlank() && reveal.name > 0f }?.let { to ->
        // Written left to right as it's revealed.
        val saved = canvas.save()
        if (reveal.name < 1f) canvas.clipRect(0f, 0f, width * (0.12f + 0.84f * reveal.name), height)
        penLine(
            canvas,
            pen,
            to,
            width * 0.15f,
            height * 0.46f,
            width * 0.094f,
            1.1f,
            -1.6f,
            width * 0.78f,
            PantopusColors.tableEnvelopeTo,
            paints,
        )
        canvas.restoreToCount(saved)
    }
    if (card.sealed) {
        if (reveal.sealedMark > 0f) {
            // Sealed until Christmas: the gold stamp lands last.
            val saved = canvas.save()
            val grow = 1f + 0.3f * (1f - reveal.sealedMark)
            canvas.scale(grow, grow, width * 0.5f, height * 0.74f)
            drawSealedMark(
                canvas,
                width * 0.5f,
                height * 0.74f,
                width * 0.04f,
                width * 0.007f,
                width * 0.018f,
                width * 0.03f,
                width * 0.012f,
                paints,
            )
            canvas.restoreToCount(saved)
        }
    } else {
        val size = width * 0.0235f
        paints.text.reset()
        paints.text.textAlign = Paint.Align.LEFT
        paints.text.isAntiAlias = true
        paints.text.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        paints.text.textSize = size
        paints.text.letterSpacing = 0.2f
        paints.text.color = PantopusColors.tableGold.toArgb()
        val baseline = height * (1f - 0.054f) - size * 0.2f
        canvas.drawText("CHRISTMAS CARD", width * 0.068f - size * 0.1f, baseline, paints.text)
    }
}

/**
 * The stamp, and the postmark over it with the day it was mailed. While the sender's envelope is addressed ([reveal]),
 * each drops onto the paper: from a little larger, and faint, to where it lies.
 */
private fun drawPostage(
    canvas: Canvas,
    art: CardTableArt,
    card: CardOnTable,
    day: String,
    width: Float,
    height: Float,
    paints: EnvelopePaints,
    reveal: AddressReveal,
) {
    art.stamps[card.stamp]?.takeIf { reveal.stamp > 0f }?.let { stamp ->
        val left = width * 0.755f
        val top = height * 0.0345f
        val stampWidth = width * 0.2017f
        val stampHeight = stampWidth * stamp.height / stamp.width
        val saved = canvas.save()
        val grow = 1f + 0.45f * (1f - reveal.stamp)
        canvas.scale(grow, grow, left + stampWidth / 2f, top + stampHeight / 2f)
        paints.bitmap.alpha = (255 * reveal.stamp.coerceIn(0f, 1f)).toInt()
        canvas.drawBitmap(stamp, null, RectF(left, top, left + stampWidth, top + stampHeight), paints.bitmap)
        paints.bitmap.alpha = 255
        canvas.restoreToCount(saved)
    }
    if (reveal.postmark > 0f) {
        val saved = canvas.save()
        val grow = 1f + 0.18f * (1f - reveal.postmark)
        canvas.scale(grow, grow, width * 0.6f, height * 0.12f)
        paints.bitmap.alpha = (255 * reveal.postmark.coerceIn(0f, 1f)).toInt()
        drawEnvelopePostmark(canvas, art.postmark, width * 0.345f, height * 0.0316f, width * 0.5183f, day, card.year, paints)
        paints.bitmap.alpha = 255
        canvas.restoreToCount(saved)
    }
}

/** A name by hand at its place, slightly turned, getting smaller only if it wouldn't fit. */
private fun penLine(
    canvas: Canvas,
    pen: Typeface,
    words: String,
    x: Float,
    y: Float,
    size: Float,
    lineHeight: Float,
    turn: Float,
    room: Float,
    color: Color,
    paints: EnvelopePaints,
) {
    val paint = paints.text
    paint.reset()
    // A paint's reset keeps its alignment and letter spacing.
    paint.textAlign = Paint.Align.LEFT
    paint.letterSpacing = 0f
    paint.isAntiAlias = true
    paint.typeface = pen
    paint.textSize = size
    val fitted = size * min(1f, room / max(1f, paint.measureText(words)))
    paint.textSize = fitted
    paint.color = color.toArgb()
    val metrics = paint.fontMetrics
    val line = size * lineHeight
    val baseline = y + (line - (metrics.descent - metrics.ascent)) / 2f - metrics.ascent
    val saved = canvas.save()
    canvas.rotate(turn, x + paint.measureText(words) / 2f, y + line / 2f)
    canvas.drawText(words, x, baseline, paint)
    canvas.restoreToCount(saved)
}

/** The two shadows under the card once it's clear of the envelope; they grow as it lifts off the paper. */
@Composable
private fun CardShadows(
    state: CardTableState,
    g: TableGeometry,
    shadows: TableShadows,
) {
    Box(
        modifier =
            Modifier
                .zIndex(19f)
                .pinned(g.cardWidth, g.cardHeight)
                .graphicsLayer {
                    val off = (6f + state.lift * 26f) * g.density
                    val scale = state.cardScale()
                    translationX = state.cardX(g) + off * 0.45f - state.lightX.x * 10f * g.density
                    translationY = state.cardY(g) + off - state.lightY.x * 10f * g.density
                    rotationZ = state.cardTurnZ()
                    scaleX = scale * state.cardNarrow
                    scaleY = scale
                    alpha = if (state.cardIsOut) 0.4f + state.lift * 0.16f else 0f
                    compositingStrategy = CompositingStrategy.ModulateAlpha
                }.drawBehind { drawShadow(shadows.cardWide) },
    )
    Box(
        modifier =
            Modifier
                .zIndex(19f)
                .pinned(g.cardWidth, g.cardHeight)
                .graphicsLayer {
                    val scale = state.cardScale()
                    translationX = state.cardX(g) + (1.5f - state.lightX.x * 2f) * g.density
                    translationY = state.cardY(g) + (2.5f - state.lightY.x * 2f) * g.density
                    rotationZ = state.cardTurnZ()
                    scaleX = scale * state.cardNarrow
                    scaleY = scale
                    alpha = if (state.cardIsOut) 0.55f * (1f - state.lift) else 0f
                    compositingStrategy = CompositingStrategy.ModulateAlpha
                }.drawBehind { drawShadow(shadows.cardTight) },
    )
}

/** The card itself: below the pocket while it's inside, on top once it's clear. */
@Composable
private fun TableCardLayer(
    state: CardTableState,
    faceArt: CardFaceArt?,
    picture: CardPictureState,
    g: TableGeometry,
) {
    val out = state.cardOutForOrder
    val density = LocalDensity.current.density
    val painter = remember(faceArt, density) { faceArt?.let { CardFacePainter(it, density) } }
    val words = remember(state.card) { state.card.words(cardPaperColor(state.card.paper)) }
    val loaded = (picture as? CardPictureState.Loaded)?.picture
    Box(
        modifier =
            Modifier
                .zIndex(if (out) 20f else 5f)
                .pinned(g.cardWidth, g.cardHeight)
                .graphicsLayer {
                    val scale = state.cardScale()
                    translationX = state.cardX(g)
                    translationY = state.cardY(g)
                    rotationZ = state.cardTurnZ()
                    scaleX = scale
                    scaleY = scale
                    alpha = if (state.cardShows) 1f else 0f
                },
    ) {
        Box(
            Modifier
                .matchParentSize()
                .graphicsLayer {
                    // CSS's X turn runs the other way from Android's.
                    rotationX = -state.cardAngleX
                    rotationY = state.cardAngleY
                    cameraDistance = g.cardWidth * 5.2f / PIXELS_PER_CAMERA_UNIT
                },
        ) {
            Box(
                Modifier
                    .matchParentSize()
                    .graphicsLayer { alpha = if (state.cardBackShows) 0f else 1f }
                    .drawBehind {
                        val face = painter ?: return@drawBehind
                        drawIntoCanvas { face.drawFront(it.nativeCanvas, size.width, words, loaded) }
                    },
            )
            Box(
                Modifier
                    .matchParentSize()
                    .graphicsLayer {
                        alpha = if (state.cardBackShows) 1f else 0f
                        rotationY = 180f
                    }.drawBehind {
                        val face = painter ?: return@drawBehind
                        drawIntoCanvas { face.drawBack(it.nativeCanvas, size.width, words) }
                    },
            )
            TurningLight(state)
        }
    }
}

/**
 * Over whichever face is up: a soft bright band that slides with the tilt and the turn, and the shade as it turns away.
 * The back's face is mirrored for the turn, so this is too, and the band keeps sliding the same way across the paper.
 */
@Composable
private fun TurningLight(state: CardTableState) {
    val band = remember { Paint(Paint.ANTI_ALIAS_FLAG) }
    val shade = remember { Paint().apply { color = Color.Black.toArgb() } }
    Box(
        Modifier
            .fillMaxSize()
            .graphicsLayer { rotationY = if (state.cardBackShows) 180f else 0f }
            .drawBehind {
                val u = size.width / 100f
                val corner = u * 0.7f
                drawIntoCanvas { canvas ->
                    val native = canvas.nativeCanvas
                    val saved = native.save()
                    native.clipRect(0f, 0f, size.width, size.height)
                    val boxWidth = size.width * 1.6f
                    val boxHeight = size.height * 1.6f
                    val slide = state.lightX.x * 0.9f + state.turn.x / 180f * 0.6f
                    val centerX = size.width / 2f + slide * 0.26f * boxWidth
                    val centerY = size.height / 2f + state.lightY.x * 0.16f * boxHeight
                    val clear = PantopusColors.tableSheen.copy(alpha = 0f).toArgb()
                    band.shader =
                        cssGradient(
                            centerX,
                            centerY,
                            boxWidth,
                            boxHeight,
                            112f,
                            intArrayOf(clear, PantopusColors.tableSheen.toArgb(), PantopusColors.tableSheenTail.toArgb(), clear),
                            floatArrayOf(0.34f, 0.47f, 0.54f, 0.66f),
                        )
                    softLight(band, strength = 1f)
                    native.drawRoundRect(0f, 0f, size.width, size.height, corner, corner, band)
                    val turning = state.turnShade
                    if (turning > 0.001f) {
                        shade.alpha = (turning * 255f).toInt()
                        native.drawRoundRect(0f, 0f, size.width, size.height, corner, corner, shade)
                    }
                    native.restoreToCount(saved)
                }
            },
    )
}

/** The room's light over everything on the table, moving a little with the light's springs. */
@Composable
private fun TableLight(
    state: CardTableState,
    art: CardTableArt,
) {
    RoomLight(art, Modifier.zIndex(30f), moveX = { state.lightX.x }, moveY = { state.lightY.x })
}

/**
 * The room's light: the window's light, a vignette and a fine film grain, over the table or the card rack. [moveX] and
 * [moveY] (about -1 to 1) slide the window's light; they're read while drawing, so a moving light doesn't recompose.
 */
@Composable
internal fun RoomLight(
    art: CardTableArt,
    modifier: Modifier = Modifier,
    moveX: () -> Float = { 0f },
    moveY: () -> Float = { 0f },
) {
    val density = LocalDensity.current.density
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .drawWithCache {
                    val lightPaint = Paint(Paint.FILTER_BITMAP_FLAG)
                    softLight(lightPaint, strength = 0.88f)
                    val vignette = Paint()
                    vignette.shader =
                        RadialGradient(
                            0f,
                            0f,
                            1f,
                            intArrayOf(PantopusColors.tableVignette.copy(alpha = 0f).toArgb(), PantopusColors.tableVignette.toArgb()),
                            floatArrayOf(0.44f, 1f),
                            Shader.TileMode.CLAMP,
                        ).apply {
                            setLocalMatrix(
                                Matrix().apply {
                                    setScale(size.width * 1.2f, size.height * 0.88f)
                                    postTranslate(size.width * 0.46f, size.height * 0.4f)
                                },
                            )
                        }
                    val grain = Paint(Paint.FILTER_BITMAP_FLAG)
                    grain.shader =
                        BitmapShader(art.grain, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT).apply {
                            val scale = 128f * density / art.grain.width
                            setLocalMatrix(Matrix().apply { setScale(scale, scale) })
                        }
                    grain.xfermode = PorterDuffXfermode(PorterDuff.Mode.OVERLAY)
                    grain.alpha = (0.36f * 255f).toInt()
                    onDrawBehind {
                        val over = 40f * density
                        val shiftX = moveX() * 22f * density
                        val shiftY = moveY() * 22f * density
                        val grownX = (size.width + over * 2f) * 0.02f
                        val grownY = (size.height + over * 2f) * 0.02f
                        drawIntoCanvas { canvas ->
                            val native = canvas.nativeCanvas
                            native.drawBitmap(
                                art.light,
                                null,
                                RectF(
                                    -over - grownX + shiftX,
                                    -over - grownY + shiftY,
                                    size.width + over + grownX + shiftX,
                                    size.height + over + grownY + shiftY,
                                ),
                                lightPaint,
                            )
                            native.drawRect(0f, 0f, size.width, size.height, vignette)
                            native.drawRect(0f, 0f, size.width, size.height, grain)
                        }
                    }
                },
    )
}

private fun DrawScope.drawArt(
    bitmap: Bitmap,
    alpha: Float = 1f,
) {
    drawIntoCanvas { canvas ->
        val paint = Paint(Paint.FILTER_BITMAP_FLAG)
        paint.alpha = (alpha * 255f).toInt()
        canvas.nativeCanvas.drawBitmap(bitmap, null, RectF(0f, 0f, size.width, size.height), paint)
    }
}

/** One unit of a graphics layer's camera distance is 72 screen pixels. */
private const val PIXELS_PER_CAMERA_UNIT = 72f

/** How much of the address side is there yet: all of it, except while the sender's envelope is being addressed. */
internal class AddressReveal(
    val name: Float,
    val stamp: Float,
    val postmark: Float,
    val sealedMark: Float,
) {
    companion object {
        val All = AddressReveal(1f, 1f, 1f, 1f)

        fun of(moment: SendingMoment?): AddressReveal =
            if (moment == null) All else AddressReveal(moment.nameReveal, moment.stampOn, moment.postmarkOn, moment.sealedMarkOn)
    }
}

/** A list's other envelopes under the top one: two edges, a little turned and set off, darker in the shade. */
private fun drawEnvelopeStack(
    canvas: Canvas,
    art: CardTableArt,
    width: Float,
    height: Float,
    paints: EnvelopePaints,
) {
    val shade =
        Paint(Paint.FILTER_BITMAP_FLAG).apply {
            colorFilter = PorterDuffColorFilter(PantopusColors.tableNight.copy(alpha = 0.3f).toArgb(), PorterDuff.Mode.SRC_ATOP)
        }
    for ((dx, dy, turn) in listOf(Triple(0.022f, 0.03f, 2.2f), Triple(0.011f, 0.015f, 1.1f))) {
        val saved = canvas.save()
        canvas.rotate(turn, width / 2f, height / 2f)
        canvas.translate(width * dx, height * dy)
        canvas.drawBitmap(art.front, null, RectF(0f, 0f, width, height), paints.bitmap)
        canvas.drawBitmap(art.front, null, RectF(0f, 0f, width, height), shade)
        canvas.restoreToCount(saved)
    }
}
