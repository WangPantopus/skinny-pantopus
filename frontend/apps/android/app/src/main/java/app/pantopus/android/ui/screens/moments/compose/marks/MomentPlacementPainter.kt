package app.pantopus.android.ui.screens.moments.compose.marks

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import androidx.compose.runtime.Immutable
import kotlin.math.max

/**
 * Draws a placed picture's canvas onto an `android.graphics.Canvas` [width] × [height] px: the background, then the
 * picture at its placement. The one routine for both the editor and the photo that uploads (1152 × 2048), so what the
 * author sees is what posts; the marks go over it ([MomentMarksPainter]).
 */
object MomentPlacementPainter {
    /**
     * Where the picture doesn't cover the canvas: a blend from the average colour of the picture's top third (at the
     * top) to that of its bottom third (at the bottom), read from the upright picture before any turn.
     */
    @Immutable
    data class Backdrop(
        val top: Int,
        val bottom: Int,
    )

    /** About this many samples along the picture's long side: plenty for an average. */
    private const val SAMPLES = 128

    /** The top and bottom thirds are averaged. */
    private const val THIRDS = 3

    fun backdrop(picture: Bitmap): Backdrop {
        val step = max(1, max(picture.width, picture.height) / SAMPLES)
        val third = (picture.height / THIRDS).coerceAtLeast(1)
        val row = IntArray(picture.width)
        return Backdrop(
            top = average(picture, 0 until third, step, row),
            bottom = average(picture, (picture.height - third).coerceAtLeast(0) until picture.height, step, row),
        )
    }

    private fun average(
        picture: Bitmap,
        rows: IntRange,
        step: Int,
        row: IntArray,
    ): Int {
        var red = 0L
        var green = 0L
        var blue = 0L
        var count = 0
        for (y in rows step step) {
            picture.getPixels(row, 0, picture.width, 0, y, picture.width, 1)
            for (x in 0 until picture.width step step) {
                val pixel = row[x]
                red += android.graphics.Color.red(pixel)
                green += android.graphics.Color.green(pixel)
                blue += android.graphics.Color.blue(pixel)
                count++
            }
        }
        if (count == 0) return android.graphics.Color.BLACK
        return android.graphics.Color.rgb((red / count).toInt(), (green / count).toInt(), (blue / count).toInt())
    }

    fun draw(
        canvas: Canvas,
        picture: Bitmap,
        placement: MomentPlacement,
        backdrop: Backdrop,
        width: Float,
        height: Float,
    ) {
        val restore = canvas.save()
        // Nothing past the canvas's edges: the upload ends there.
        canvas.clipRect(0f, 0f, width, height)
        val fill = Paint().apply { shader = LinearGradient(0f, 0f, 0f, height, backdrop.top, backdrop.bottom, Shader.TileMode.CLAMP) }
        canvas.drawRect(0f, 0f, width, height, fill)
        val scale = placement.width * width / picture.width
        val matrix =
            Matrix().apply {
                setScale(scale, scale)
                postTranslate(-picture.width * scale / 2, -picture.height * scale / 2)
                postRotate(placement.turn)
                postTranslate(placement.x * width, placement.y * height)
            }
        canvas.drawBitmap(picture, matrix, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        canvas.restoreToCount(restore)
    }
}
