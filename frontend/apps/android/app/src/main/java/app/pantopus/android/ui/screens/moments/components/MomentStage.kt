package app.pantopus.android.ui.screens.moments.components

import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalView
import app.pantopus.android.ui.components.KeyboardResizeEffect

/**
 * Keeps the window resizing for the keyboard on the Moments viewer and posting screens.
 *
 * [KeyboardResizeEffect] alone doesn't hold there. The app's window is made with no keyboard mode of its own, so each
 * time an Android view in it shows or hides (the video player's surface, the camera preview, the Post sheet's small
 * map) Android picks one again, and with nothing scrollable in the window it picks "pan": the whole screen slides up
 * under the keyboard while the reply box is also lifted over it, and the box lands in the middle of the screen. Marking
 * the window's root as scrollable while the stage is up makes that pick "resize", which is what the effect asked for.
 */
@Composable
fun StageKeyboardResize() {
    KeyboardResizeEffect()
    val view = LocalView.current
    DisposableEffect(view) {
        val root = view.rootView
        val was = root.isScrollContainer
        root.isScrollContainer = true
        onDispose { root.isScrollContainer = was }
    }
}

/** The few taps you can feel in Moments, where a camera has them (founder 2026-11-10); nothing on plain taps. */
object MomentHaptics {
    /** The shutter, a reaction picked. */
    fun light(view: View) {
        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    }

    /** A video starts or stops recording. */
    fun firm(view: View) {
        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
    }

    /** Your Moment is live. */
    fun success(view: View) {
        val pattern =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
        view.performHapticFeedback(pattern)
    }
}
