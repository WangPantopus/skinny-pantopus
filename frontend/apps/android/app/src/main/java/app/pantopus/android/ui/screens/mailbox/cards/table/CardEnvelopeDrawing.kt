@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Bitmap
import android.graphics.BlendMode
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import androidx.compose.ui.graphics.toArgb
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.max

/** Soft light needs Android 10; before it, Overlay at about half strength is the closest there is. */
private val softLightWorks = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

/** The envelope's paints, kept so a draw makes nothing new. */
internal class EnvelopePaints {
    val bitmap = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    val text = Paint(Paint.ANTI_ALIAS_FLAG)
    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
}

/**
 * The postmark art with the real day it was mailed printed over it: its place on the art's own width and height, in
 * dark ink, turned as the ring is. Without a day (it hasn't been mailed), the ring stays empty.
 */
internal fun drawEnvelopePostmark(
    canvas: Canvas,
    postmark: Bitmap,
    left: Float,
    top: Float,
    width: Float,
    day: String,
    year: Int,
    paints: EnvelopePaints,
) {
    val height = width * postmark.height / postmark.width
    canvas.drawBitmap(postmark, null, RectF(left, top, left + width, top + height), paints.bitmap)
    if (day.isEmpty()) return

    fun print(
        words: String,
        x: Float,
        y: Float,
        size: Float,
        spacing: Float,
    ) {
        val paint = paints.text
        paint.reset()
        paint.isAntiAlias = true
        paint.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        paint.textAlign = Paint.Align.CENTER
        paint.textSize = width * size
        paint.letterSpacing = spacing / size
        paint.color = PantopusColors.tablePostmarkDay.toArgb()
        val atX = left + width * x
        val atY = top + height * y
        val saved = canvas.save()
        canvas.rotate(7f, atX, atY)
        canvas.drawText(words, atX, atY, paint)
        canvas.restoreToCount(saved)
    }
    print(day, 0.2652f, 0.4427f, 0.064f, 0.0028f)
    print(year.toString(), 0.2577f, 0.5468f, 0.0522f, 0.0024f)
}

/** "DO NOT OPEN / UNTIL CHRISTMAS", stamped in gold ink in a double border, turned −7°. */
internal fun drawSealedMark(
    canvas: Canvas,
    centerX: Float,
    centerY: Float,
    size: Float,
    border: Float,
    padY: Float,
    padX: Float,
    radius: Float,
    paints: EnvelopePaints,
    lineHeight: Float = 1.18f,
) {
    val paint = paints.text
    markStyle(paint, size)
    paint.textAlign = Paint.Align.CENTER
    val ink = PantopusColors.tableGoldInk.toArgb()
    paint.color = ink
    val line = size * lineHeight
    val width = sealedMarkWidth(size, border, padX, paints)
    markStyle(paint, size)
    paint.textAlign = Paint.Align.CENTER
    paint.color = ink
    val height = line * 2f + (padY + border) * 2f
    val metrics = paint.fontMetrics
    val saved = canvas.save()
    canvas.rotate(-7f, centerX, centerY)
    val top = centerY - height / 2f
    val toBaseline = (line - (metrics.descent - metrics.ascent)) / 2f - metrics.ascent
    canvas.drawText(MARK_FIRST, centerX, top + border + padY + toBaseline, paint)
    canvas.drawText(MARK_SECOND, centerX, top + border + padY + line + toBaseline, paint)
    val stroke = paints.stroke
    stroke.color = ink
    stroke.strokeWidth = border / 3f
    val outer = RectF(centerX - width / 2f, top, centerX + width / 2f, top + height)
    outer.inset(border / 6f, border / 6f)
    canvas.drawRoundRect(outer, radius, radius, stroke)
    outer.inset(border * 2f / 3f, border * 2f / 3f)
    canvas.drawRoundRect(outer, max(0f, radius - border), max(0f, radius - border), stroke)
    canvas.restoreToCount(saved)
}

/** How wide the stamped words are, border and padding included. */
internal fun sealedMarkWidth(
    size: Float,
    border: Float,
    padX: Float,
    paints: EnvelopePaints,
): Float {
    val paint = paints.text
    markStyle(paint, size)
    return max(paint.measureText(MARK_FIRST), paint.measureText(MARK_SECOND)) + (padX + border) * 2f
}

private fun markStyle(
    paint: Paint,
    size: Float,
) {
    paint.reset()
    paint.textAlign = Paint.Align.LEFT
    paint.isAntiAlias = true
    paint.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    paint.textSize = size
    paint.letterSpacing = 0.11f
}

private const val MARK_FIRST = "DO NOT OPEN"
private const val MARK_SECOND = "UNTIL CHRISTMAS"

/** Soft light where this Android has it; else Overlay at about half strength, the same picture but a little stronger. */
internal fun softLight(
    paint: Paint,
    strength: Float,
) {
    if (softLightWorks) {
        paint.blendMode = BlendMode.SOFT_LIGHT
        paint.alpha = (strength * 255f).toInt()
    } else {
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.OVERLAY)
        paint.alpha = (strength * 0.5f * 255f).toInt()
    }
}
