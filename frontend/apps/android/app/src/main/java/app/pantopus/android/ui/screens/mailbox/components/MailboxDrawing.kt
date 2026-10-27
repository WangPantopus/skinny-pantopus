@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.ui.theme.PantopusColors

/**
 * The person's mailbox on its post, from the Mail tab drawings (`Main`, `R2-Delivery`): a blue arched box, the house
 * [number] on its plate, the red flag. [doorOpen] runs from 0 (closed) to 1 (the door folded down with today's mail
 * inside), for the delivery moment; [mailInside] puts the day's pieces in the open box.
 */
@Composable
fun MailboxDrawing(
    modifier: Modifier = Modifier,
    number: String? = null,
    doorOpen: Float = 0f,
    mailInside: Boolean = false,
) {
    Canvas(modifier = modifier) {
        // The drawing's 120 × 130 viewbox, fitted and centered.
        val unit = minOf(size.width / 120f, size.height / 130f)
        val left = (size.width - 120f * unit) / 2f
        val top = (size.height - 130f * unit) / 2f

        fun at(
            x: Float,
            y: Float,
        ) = Offset(left + x * unit, top + y * unit)

        fun rect(
            x: Float,
            y: Float,
            w: Float,
            h: Float,
            color: Color,
            r: Float = 0f,
        ) = drawRoundRect(color, topLeft = at(x, y), size = Size(w * unit, h * unit), cornerRadius = CornerRadius(r * unit))

        // Post, body and the dark inside.
        rect(54f, 94f, 12f, 36f, PantopusColors.mailboxPost, r = 2f)
        drawPath(arch(18f, 94f, 50f, 42f, ::at, unit), PantopusColors.mailboxBody)
        drawPath(arch(27f, 90f, 53f, 33f, ::at, unit), if (doorOpen > 0f) PantopusColors.mailboxInside else PantopusColors.primary600)
        if (doorOpen > 0f && mailInside) {
            // Today's pieces, standing in the open box.
            rotate(-4f, pivot = at(60f, 74f)) { rect(35f, 66f, 50f, 16f, PantopusColors.mailLetterPaper, r = 1.5f) }
            rotate(3f, pivot = at(60f, 79f)) { rect(37f, 72f, 46f, 14f, PantopusColors.appSurface, r = 1.5f) }
            rect(39f, 79f, 44f, 10f, PantopusColors.primary900, r = 1.5f)
        }
        // The door: upright and closed at 0, folding toward the viewer around its bottom hinge, then lying open.
        if (doorOpen < 0.5f) {
            val fold = 1f - doorOpen * 2f
            val doorTop = 90f - 37f * fold
            drawPath(arch(27f, 90f, doorTop + 0f, 33f * fold.coerceAtLeast(0.01f), ::at, unit, flat = fold < 1f), PantopusColors.primary600)
            if (fold > 0.6f) {
                rect(51f, doorTop - 15f * fold, 18f, 6f, PantopusColors.primary100, r = 3f)
                number?.takeIf { it.isNotBlank() }?.let { plate(it, at(40f, doorTop + 15f * fold), unit) }
            }
        } else {
            val lay = (doorOpen - 0.5f) * 2f
            val flap =
                Path().apply {
                    moveTo(at(27f, 90f).x, at(27f, 90f).y)
                    lineTo(at(93f, 90f).x, at(93f, 90f).y)
                    lineTo(at(93f + 11f * lay, 90f + 20f * lay).x, at(93f + 11f * lay, 90f + 20f * lay).y)
                    lineTo(at(27f - 11f * lay, 90f + 20f * lay).x, at(27f - 11f * lay, 90f + 20f * lay).y)
                    close()
                }
            drawPath(flap, PantopusColors.primary600)
            rect(51f, 90f + 12f * lay, 18f, 5f, PantopusColors.primary100, r = 2.5f)
            if (lay > 0.6f && mailInside) sparkles(::at, unit, alpha = (lay - 0.6f) / 0.4f)
        }
        // The flag, up: the carrier has been.
        rect(102f, 64f, 16f, 7f, PantopusColors.mailboxFlag, r = 1.5f)
    }
}

/** An arched shape from (x, bottom) up to [archY], with the arch's [radius]; [flat] draws a squashed door instead. */
private fun arch(
    x: Float,
    bottom: Float,
    archY: Float,
    radius: Float,
    at: (Float, Float) -> Offset,
    unit: Float,
    flat: Boolean = false,
): Path {
    val width = radius * 2f
    return Path().apply {
        val start = at(x, bottom)
        moveTo(start.x, start.y)
        if (flat) {
            // A folding door seen edge-on: a plain rectangle, as tall as the fold allows.
            lineTo(at(x, archY).x, at(x, archY).y)
            lineTo(at(93f, archY).x, at(93f, archY).y)
            lineTo(at(93f, bottom).x, at(93f, bottom).y)
            close()
            return@apply
        }
        lineTo(at(x, archY).x, at(x, archY).y)
        val corner = at(x, archY - radius)
        arcTo(Rect(corner, Size(width * unit, width * unit)), startAngleDegrees = 180f, sweepAngleDegrees = 180f, forceMoveTo = false)
        lineTo(at(x + width, bottom).x, at(x + width, bottom).y)
        close()
    }
}

/** The number plate on the door: white, with the house number in typewriter letters. */
private fun DrawScope.plate(
    number: String,
    topLeft: Offset,
    unit: Float,
) {
    drawRoundRect(
        PantopusColors.appSurfaceMuted,
        topLeft = topLeft,
        size = Size(40f * unit, 13f * unit),
        cornerRadius = CornerRadius(2f * unit),
    )
    val paint =
        android.graphics.Paint().apply {
            isAntiAlias = true
            color = PantopusColors.appText.toArgb()
            textAlign = android.graphics.Paint.Align.CENTER
            typeface = android.graphics.Typeface.create(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD)
            textSize = 9f * unit
        }
    drawContext.canvas.nativeCanvas.drawText(number.takeLast(5), topLeft.x + 20f * unit, topLeft.y + 10f * unit, paint)
}

/** Short amber rays around the open box. */
private fun DrawScope.sparkles(
    at: (Float, Float) -> Offset,
    unit: Float,
    alpha: Float,
) {
    listOf(
        12f to 40f to (-6f to -4f),
        14f to 30f to (-7f to -1f),
        108f to 40f to (6f to -4f),
        106f to 30f to (7f to -1f),
    ).forEach { (from, delta) ->
        val start = at(from.first, from.second)
        drawLine(
            color = PantopusColors.mailboxFlag.copy(alpha = alpha.coerceIn(0f, 1f)),
            start = start,
            end = Offset(start.x + delta.first * unit, start.y + delta.second * unit),
            strokeWidth = 1.6f * unit,
            cap = StrokeCap.Round,
        )
    }
}
