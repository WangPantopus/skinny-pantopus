@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.compose.marks

import androidx.compose.runtime.Immutable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.unit.IntSize
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/*
 * Resize (set 2026-11-21, the same on iPhone): the author moves, resizes and turns the picture on a 9:16 canvas. A
 * picture is "placed" only while its placement differs from cover; then it uploads as that canvas (the background, the
 * picture, the marks), and its marks are in the canvas's coordinates. At cover it is "as taken": it uploads at its own
 * shape, exactly as before, with its marks in its own coordinates.
 */

/** Where the picture sits on the canvas. "Shape" is width over height; the canvas's is [CANVAS_SHAPE]. */
@Immutable
data class MomentPlacement(
    /** The picture's width as a share of the canvas's width, before turning. */
    val width: Float,
    /** The picture's middle: 0 to 1 across the canvas and down it. */
    val x: Float,
    val y: Float,
    /** Degrees clockwise, kept in (−180, 180] (any while a gesture runs; [stuck] settles it). */
    val turn: Float,
) {
    /** The placement at cover: the picture just covers the canvas, a picture nobody resized. */
    fun isCover(shape: Float): Boolean {
        val cover = coverWidth(shape)
        return abs(width - cover) <= cover * SAME && abs(x - 0.5f) <= SAME && abs(y - 0.5f) <= SAME && normalised(turn) == 0f
    }

    /** Inside the limits: 0.25 to 4 times cover's width, the middle on the canvas. */
    fun limited(shape: Float): MomentPlacement {
        val cover = coverWidth(shape)
        return copy(width = width.coerceIn(cover * SMALLEST, cover * LARGEST), x = x.coerceIn(0f, 1f), y = y.coerceIn(0f, 1f))
    }

    /** Sticking: the turn to a quarter turn within 3°, the middle's x and y each to 0.5 within 0.015. */
    fun stuck(): MomentPlacement {
        val turned = normalised(turn)
        val quarter = (turned / QUARTER).roundToInt() * QUARTER
        return copy(
            turn = if (abs(turned - quarter) <= TURN_STICKS) normalised(quarter) else turned,
            x = if (abs(x - 0.5f) <= MIDDLE_STICKS) 0.5f else x,
            y = if (abs(y - 0.5f) <= MIDDLE_STICKS) 0.5f else y,
        )
    }

    /** Which values sit where they stick (one bit each: a quarter turn, the middle across, the middle down). */
    val caught: Int
        get() = (if (turn % QUARTER == 0f) 1 else 0) or (if (x == 0.5f) 2 else 0) or (if (y == 0.5f) 4 else 0)

    /**
     * A gesture on the canvas drawn [canvas] px: fingers around [centroid] (px on the canvas) moved by [pan], spread by
     * [zoom] and twisted [turnBy] degrees clockwise. The point under the fingers stays under them, within the limits.
     */
    fun gestured(
        canvas: Size,
        centroid: Offset,
        pan: Offset,
        zoom: Float,
        turnBy: Float,
        shape: Float,
    ): MomentPlacement {
        val cover = coverWidth(shape)
        val sized = (width * zoom).coerceIn(cover * SMALLEST, cover * LARGEST)
        val scale = sized / width
        val radians = Math.toRadians(turnBy.toDouble())
        val dx = x * canvas.width - centroid.x
        val dy = y * canvas.height - centroid.y
        val movedX = centroid.x + pan.x + scale * (dx * cos(radians) - dy * sin(radians)).toFloat()
        val movedY = centroid.y + pan.y + scale * (dx * sin(radians) + dy * cos(radians)).toFloat()
        return MomentPlacement(sized, movedX / canvas.width, movedY / canvas.height, turn + turnBy).limited(shape)
    }

    companion object {
        /** The canvas a placed picture uploads as: 9:16, 1152 × 2048 px. */
        const val CANVAS_SHAPE = 9f / 16f
        const val CANVAS_WIDTH = 1152
        const val CANVAS_HEIGHT = 2048
        val CANVAS = IntSize(CANVAS_WIDTH, CANVAS_HEIGHT)

        /** The limits on the picture's width, as shares of cover's. */
        private const val SMALLEST = 0.25f
        private const val LARGEST = 4f

        private const val QUARTER = 90f
        private const val TURN_STICKS = 3f
        private const val MIDDLE_STICKS = 0.015f

        /** Closer than this is cover still (a TalkBack resize and its undo come back within a rounding of it). */
        private const val SAME = 0.0001f

        /** TalkBack's steps: ×1.2, 15°, 5% of the canvas. */
        const val SIZE_STEP = 1.2f
        const val TURN_STEP = 15f
        const val MOVE_STEP = 0.05f

        /** Cover's width for a picture of [shape]: its height is the canvas's, or its width when it's taller than 9:16. */
        fun coverWidth(shape: Float): Float = max(1f, shape / CANVAS_SHAPE)

        fun cover(shape: Float): MomentPlacement = MomentPlacement(coverWidth(shape), 0.5f, 0.5f, 0f)

        /** [degrees] in (−180, 180]. */
        fun normalised(degrees: Float): Float {
            var turned = degrees % 360f
            if (turned <= -180f) turned += 360f
            if (turned > 180f) turned -= 360f
            return if (turned == -0f) 0f else turned
        }
    }
}

/** The shape of a picture [size] px: width over height. */
internal val IntSize.shape: Float get() = width.toFloat() / height.coerceAtLeast(1)

/**
 * Marks made on a picture of [shape] as taken, moved onto the canvas over the part the picture shows at cover ([back]:
 * the other way), with every share of a width scaled with them. A line's points may go past the edges: they're kept.
 */
internal fun MomentMarks.changedState(
    shape: Float,
    back: Boolean,
): MomentMarks {
    val wide = shape >= MomentPlacement.CANVAS_SHAPE
    val k = if (wide) shape / MomentPlacement.CANVAS_SHAPE else MomentPlacement.CANVAS_SHAPE / shape
    val by = if (back) 1f / k else k
    val across = { x: Float -> if (wide) 0.5f + (x - 0.5f) * by else x }
    val down = { y: Float -> if (wide) y else 0.5f + (y - 0.5f) * by }
    val widths = if (wide) by else 1f
    return MomentMarks(
        strokes =
            strokes.map { stroke ->
                val points = stroke.points.mapIndexed { at, v -> if (at % 2 == 0) across(v) else down(v) }
                stroke.copy(points = points, width = stroke.width * widths)
            },
        labels = labels.map { it.copy(x = across(it.x), y = down(it.y), size = it.size * widths) },
    )
}

/** Labels held to the rules of a picture [size] px, as after any move (the box, the smallest and largest letters). */
private fun MomentMarks.heldTo(size: IntSize): MomentMarks =
    copy(labels = labels.map { if (it.text.isBlank()) it else MomentMarksPainter.keptIn(it, size.width, size.height) })

/**
 * Resize moved the picture of [picture] px to [placement]: on the first change away from cover the marks move onto the
 * canvas; back at cover it is as taken again ([reset]).
 */
internal fun MomentMarksEditing.placedAt(
    placement: MomentPlacement,
    picture: IntSize,
): MomentMarksEditing =
    when {
        placement.isCover(picture.shape) -> reset(picture)
        this.placement == null ->
            copy(placement = placement, marks = marks.changedState(picture.shape, back = false).heldTo(MomentPlacement.CANVAS))
        else -> copy(placement = placement)
    }

/**
 * Reset: the picture of [picture] px as taken again, its marks back in its own coordinates. A visit that opened as taken
 * gets back exactly the marks it opened with (Resize can't change them), so nothing is left changed by rounding.
 */
internal fun MomentMarksEditing.reset(picture: IntSize): MomentMarksEditing =
    when {
        placement == null -> this
        placementAtOpen == null && tool == MomentMarksTool.Resize -> copy(placement = null, marks = atOpen)
        else -> copy(placement = null, marks = marks.changedState(picture.shape, back = true).heldTo(picture))
    }

/** The size the editor shows and the marks are made on: the canvas while the picture is placed, else the picture. */
internal fun MomentMarksEditing.surface(picture: IntSize): IntSize = if (placement != null) MomentPlacement.CANVAS else picture
