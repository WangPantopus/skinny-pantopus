package app.pantopus.android.data.moments

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import app.pantopus.android.ui.screens.moments.compose.marks.MomentLooks
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarks
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarksPainter
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacement
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacementPainter
import app.pantopus.android.ui.screens.moments.compose.marks.inStep
import java.io.File
import java.io.FileOutputStream

/**
 * Text and Draw drawn into a Moment's photo on the phone (plan part 1): the server and every app receive an ordinary
 * JPEG. The editor works on one upright copy at most 2048 px on its long side, the size a photo uploads at. A picture
 * Resize placed becomes the 9:16 canvas (1152 × 2048): its background, the picture at its placement, then the marks.
 */
object MomentMarksFlatten {
    /** The editor's copy's long side: what a photo uploads at. */
    private const val LONG_EDGE = 2048

    /** Near-lossless: the upload encodes it again at 85. */
    private const val QUALITY = 95

    /** The photo upright, at most 2048 px on its long side; null when it can't be read. */
    fun picture(file: File): Bitmap? = MomentMedia.decodeUpright(file, LONG_EDGE)

    /**
     * [marks] drawn over a copy of [picture], or over the canvas with [picture] at [placement] (as the editor drew them),
     * written as a new JPEG in the Moments folder.
     */
    fun flatten(
        context: Context,
        picture: Bitmap,
        marks: MomentMarks,
        placement: MomentPlacement? = null,
    ): File {
        // "Pulse, reinvented"'s Studio: what the person chose blurred into the photo as it came, then the film look over it
        // (the same bitmap with neither).
        val blurred = app.pantopus.android.ui.screens.moments.studio.blur.MomentBlurPainter.applied(picture, marks.blur)
        val looked = MomentLooks.applied(blurred, marks.look)
        val drawn =
            if (placement == null) {
                looked.copy(Bitmap.Config.ARGB_8888, true) ?: error("Couldn't copy the photo.")
            } else {
                Bitmap.createBitmap(MomentPlacement.CANVAS_WIDTH, MomentPlacement.CANVAS_HEIGHT, Bitmap.Config.ARGB_8888)
            }
        val out = MomentMedia.newFile(context, "jpg")
        var written = false
        try {
            val canvas = Canvas(drawn)
            val width = drawn.width.toFloat()
            val height = drawn.height.toFloat()
            if (placement != null) {
                MomentPlacementPainter.draw(canvas, looked, placement, MomentPlacementPainter.backdrop(looked), width, height)
            }
            // "Pulse, reinvented"'s Studio: a subject lifted where the picture sits now (marks as they are otherwise).
            MomentMarksPainter.draw(canvas, marks.inStep(placement), width, height)
            written = FileOutputStream(out).use { drawn.compress(Bitmap.CompressFormat.JPEG, QUALITY, it) }
        } finally {
            drawn.recycle()
            if (looked !== picture) looked.recycle()
            if (blurred !== picture && blurred !== looked) blurred.recycle()
            // Half a file never stays behind.
            if (!written) out.delete()
        }
        if (!written) error("Couldn't write the photo.")
        return out
    }
}
