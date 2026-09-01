package app.pantopus.android.ui.theme

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode

/**
 * Canonical motion tokens. Two breathing-room durations:
 *
 *   - [componentState] (150ms easeOut) — chip toggle, button press,
 *     focus state, accordion expand/collapse, toast/banner overlay
 *     slide-in/out.
 *   - [screenTransition] (180ms easeOut) — push/pop a navigation
 *     destination, present/dismiss a sheet, modal slide.
 *
 * Other motion categories (shimmer sweep, map gestures, upload
 * progress, gesture-driven drags, decorative success animations) are
 * NOT covered by these tokens — they use bespoke curves matched to
 * their domain. See `docs/motion-audit.md` for the full taxonomy.
 *
 * Both tokens honour [rememberReduceMotion] / [systemReduceMotion]
 * when the caller passes the resolved flag — every `tween(...)` builder
 * below accepts a `reduceMotion: Boolean` and returns the 100ms
 * fallback when true.
 */
object MotionTokens {
    private const val COMPONENT_STATE_MS = 150
    private const val SCREEN_TRANSITION_MS = 180
    private const val REDUCED_MOTION_MS = 100

    /** 150ms easeOut tween for `<T>` animations, or 100ms when reduced. */
    fun <T> componentState(reduceMotion: Boolean = false): FiniteAnimationSpec<T> =
        if (reduceMotion) {
            tween(durationMillis = REDUCED_MOTION_MS, easing = EaseOut)
        } else {
            tween(durationMillis = COMPONENT_STATE_MS, easing = EaseOut)
        }

    /** 180ms easeOut tween for `<T>` animations, or 100ms when reduced. */
    fun <T> screenTransition(reduceMotion: Boolean = false): FiniteAnimationSpec<T> =
        if (reduceMotion) {
            tween(durationMillis = REDUCED_MOTION_MS, easing = EaseOut)
        } else {
            tween(durationMillis = SCREEN_TRANSITION_MS, easing = EaseOut)
        }
}

/**
 * Read the system's animator-duration-scale flag (≈ "Reduce motion").
 * When the OS animation scale is 0 (the user disabled animations in
 * accessibility settings), this returns `true`.
 *
 * Inside `@Preview` / Paparazzi, returns `false` so previews render
 * with full motion.
 */
fun systemReduceMotion(context: Context): Boolean {
    val scale =
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        )
    return scale == 0f
}

/**
 * Composable form of [systemReduceMotion] — call from any composable to
 * read the current reduce-motion state. Memoised on the context.
 */
@Composable
fun rememberReduceMotion(): Boolean {
    if (LocalInspectionMode.current) return false
    val context = LocalContext.current
    return remember(context) { systemReduceMotion(context) }
}
