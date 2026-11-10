@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max

/**
 * The card enlarged on the table (plan 6.1): pinched or double-tapped up to [MAX_ZOOM] times, and moved around while
 * it's enlarged, never so far that the card leaves its own place on the table. [size] is 1 to 3; [dx] and [dy] are in
 * pixels. [onEnlarged] runs when it becomes enlarged or comes back, so the words under the button follow.
 */
@Stable
internal class TableZoom(
    private val reduceMotion: Boolean,
    private val onEnlarged: () -> Unit,
    private val wake: () -> Unit,
) {
    val size = TableSpring(150f, 24f, start = 1f)
    val dx = TableSpring(150f, 24f)
    val dy = TableSpring(150f, 24f)
    val springs = listOf(size, dx, dy)

    /** Enlarged: a drag moves around it, one tap does nothing, a double-tap or Back brings it back. */
    var enlarged by mutableStateOf(false)
        private set

    private var pinch: Pinch? = null

    fun set(
        g: TableGeometry?,
        scale: Float,
        x: Float,
        y: Float,
        immediate: Boolean = false,
    ) {
        val next = scale.coerceIn(1f, MAX_ZOOM)
        val reachX = (g?.cardWidth ?: 0f) * (next - 1f) / 2f
        val reachY = (g?.cardHeight ?: 0f) * (next - 1f) / 2f
        for ((spring, value) in listOf(size to next, dx to x.coerceIn(-reachX, reachX), dy to y.coerceIn(-reachY, reachY))) {
            if (immediate || reduceMotion) spring.jump(value) else spring.target = value
        }
        if ((next > 1.02f) != enlarged) {
            enlarged = next > 1.02f
            onEnlarged()
        }
        wake()
    }

    /** Back to its size on the table. */
    fun reset(immediate: Boolean = false) {
        if (size.target == 1f && dx.target == 0f && dy.target == 0f) return
        set(null, 1f, 0f, 0f, immediate)
    }

    /** A double-tap at ([x], [y]): enlarged [DOUBLE_TAP_ZOOM] times around that spot of the card centred at ([cx], [cy]). */
    fun around(
        g: TableGeometry,
        cx: Float,
        cy: Float,
        x: Float,
        y: Float,
    ) {
        set(g, DOUBLE_TAP_ZOOM, (cx - x) * (DOUBLE_TAP_ZOOM - 1f), (cy - y) * (DOUBLE_TAP_ZOOM - 1f))
    }

    /** Is ([x], [y]) on the card, the place it covers now, enlarged or not, around the card centred at ([cx], [cy])? */
    fun covers(
        g: TableGeometry,
        cx: Float,
        cy: Float,
        x: Float,
        y: Float,
    ): Boolean {
        val across = abs(x - cx - dx.x) < g.cardWidth * size.x / 2f
        return across && abs(y - cy - dy.x) < g.cardHeight * size.x / 2f
    }

    fun pinchStart(
        ax: Float,
        ay: Float,
        bx: Float,
        by: Float,
    ) {
        pinch = Pinch(max(1f, hypot(ax - bx, ay - by)), size.target, (ax + bx) / 2f, (ay + by) / 2f, dx.target, dy.target)
    }

    fun pinchTo(
        g: TableGeometry?,
        ax: Float,
        ay: Float,
        bx: Float,
        by: Float,
    ) {
        val start = pinch ?: return
        val scale = start.size0 * hypot(ax - bx, ay - by) / start.distance0
        set(g, scale, start.dx0 + (ax + bx) / 2f - start.midX0, start.dy0 + (ay + by) / 2f - start.midY0, immediate = true)
    }

    fun pinchEnd() {
        pinch ?: return
        pinch = null
        // Hardly enlarged: back to its size.
        if (size.target < 1.08f) reset()
    }

    /** Two fingers on the card: how far apart they began, the size then, and where they and the card were. */
    private class Pinch(
        val distance0: Float,
        val size0: Float,
        val midX0: Float,
        val midY0: Float,
        val dx0: Float,
        val dy0: Float,
    )

    private companion object {
        const val MAX_ZOOM = 3f
        const val DOUBLE_TAP_ZOOM = 2.4f
    }
}
