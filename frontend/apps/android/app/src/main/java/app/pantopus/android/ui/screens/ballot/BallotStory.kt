package app.pantopus.android.ui.screens.ballot

import androidx.compose.animation.core.CubicBezierEasing

/**
 * The peel story's timing (Board: The peel). Each government gets 1.2 s:
 * in by 0.18 s (ease-out), held to 1.02 s, out by 1.2 s, which is the
 * board's 12 s cycle at 1.5%, 8.5% and 10% per step. The finished frame
 * follows the last government and holds (the board loops only as a
 * prototype); the progress bar runs the whole story. Times are seconds.
 * Parity twin of iOS `BallotStory` and the web keyframes.
 */
data class BallotStory(
    /** Governments in the story; the finished frame is step [steps]. */
    val steps: Int,
) {
    /** The whole story, finished frame included. */
    val duration: Float get() = (steps + 1) * STEP

    /**
     * 0…1: how present step [k] is at [t] — its caption's and highlight's
     * opacity, and the fraction of its layer's lift.
     */
    fun presence(
        k: Int,
        t: Float,
    ): Float {
        val u = t - k * STEP
        return when {
            u <= 0f -> 0f
            u < FADE -> ease(u / FADE)
            k == steps || u <= HOLD_END -> 1f
            u < STEP -> 1f - ease((u - HOLD_END) / FADE)
            else -> 0f
        }
    }

    /** A caption rises from 8 below while arriving and leaves 4 above. */
    fun captionOffset(
        k: Int,
        t: Float,
    ): Float {
        val u = t - k * STEP
        val rest = 1f - presence(k, t)
        return when {
            u < FADE -> ARRIVE_FROM * rest
            k != steps && u > HOLD_END -> LEAVE_TO * rest
            else -> 0f
        }
    }

    /** A government's layer lifts 8 while it is being told. */
    fun lift(
        k: Int,
        t: Float,
    ): Float = if (k < steps) LIFT * presence(k, t) else 0f

    /** The progress bar, 0…1. */
    fun bar(t: Float): Float = (t / duration).coerceIn(0f, 1f)

    companion object {
        const val STEP = 1.2f
        const val FADE = 0.18f
        const val HOLD_END = 1.02f
        private const val ARRIVE_FROM = 8f
        private const val LEAVE_TO = -4f
        private const val LIFT = -8f

        /** CSS `ease-out`, the board's timing function. */
        private val EASE_OUT = CubicBezierEasing(0f, 0f, 0.58f, 1f)

        fun ease(x: Float): Float = EASE_OUT.transform(x.coerceIn(0f, 1f))
    }
}
