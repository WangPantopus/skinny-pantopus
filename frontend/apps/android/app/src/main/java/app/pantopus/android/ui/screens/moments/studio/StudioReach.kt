package app.pantopus.android.ui.screens.moments.studio

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import kotlin.math.min

/**
 * Where the middle of an item on the picture (a stamp, a dot, moving words, a playable item) may go, as shares of the
 * frame it is placed on (PHASE-6 F): on the whole stage, anywhere on the 9:16 canvas, the backdrop around the picture
 * included; elsewhere, null, and each kind keeps its own limits as before. At least [keepX] / [keepY] (24 dp, as shares of
 * the frame) of the item's own box stays on the canvas on each axis (PHASE-6 K2), so it can always be picked up again.
 */
@Immutable
internal data class StudioReach(
    val left: Double,
    val top: Double,
    val right: Double,
    val bottom: Double,
    val keepX: Double = 0.0,
    val keepY: Double = 0.0,
) {
    /** The middle across of an item [half] wide on each side (shares of the frame), kept with 24 dp of it on the canvas. */
    fun x(
        v: Double,
        half: Double = 0.0,
    ): Double = kept(v, half, keepX, left, right)

    /** The middle down of an item [half] tall on each side (shares of the frame), kept with 24 dp of it on the canvas. */
    fun y(
        v: Double,
        half: Double = 0.0,
    ): Double = kept(v, half, keepY, top, bottom)

    private fun kept(
        v: Double,
        half: Double,
        keep: Double,
        from: Double,
        to: Double,
    ): Double {
        // An item smaller than the 24 dp stays on the canvas whole.
        val on = min(keep, 2 * half.coerceAtLeast(0.0))
        val low = from + on - half
        val high = to - on + half
        return if (low <= high) v.coerceIn(low, high) else (from + to) / 2
    }
}

internal val LocalStudioReach = compositionLocalOf<StudioReach?> { null }

/**
 * Whether an item on the picture is being dragged now (PHASE-6 K3): the Studio's small controls (the close button, the
 * tool rail) fade to 30% and take no touches until it is let go.
 */
internal object StudioItemDrag {
    val active = mutableStateOf(false)
}

/** The X and the tools while an item on the picture is dragged (PHASE-6 K3). */
private const val DRAG_FADE = 0.3f

/** The Studio's small controls (the X, the tool rail) while an item is dragged: faded, and they take no touches. */
internal fun Modifier.fadesWhileAnItemMoves(): Modifier =
    graphicsLayer { alpha = if (StudioItemDrag.active.value) DRAG_FADE else 1f }
        .pointerInput(Unit) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                if (StudioItemDrag.active.value) {
                    down.consume()
                    do {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        event.changes.forEach { it.consume() }
                    } while (event.changes.any { it.pressed })
                }
            }
        }

/** Marks [StudioItemDrag] while a finger that landed on this item has moved past the touch slop, until it lifts. */
internal fun Modifier.studioItemDrag(): Modifier =
    pointerInput(Unit) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            try {
                do {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    if (!StudioItemDrag.active.value &&
                        event.changes.any { (it.position - down.position).getDistance() > viewConfiguration.touchSlop }
                    ) {
                        StudioItemDrag.active.value = true
                    }
                } while (event.changes.any { it.pressed })
            } finally {
                StudioItemDrag.active.value = false
            }
        }
    }
