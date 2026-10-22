package app.pantopus.android.ui.components

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.Window
import android.view.WindowManager.LayoutParams
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import java.util.WeakHashMap

/**
 * While this is in composition the window resizes for the keyboard instead of
 * panning, so a screen that makes room for the keyboard itself (the app draws
 * edge to edge) keeps its header on screen. Two such screens overlap during a
 * navigation transition, so the window's previous mode comes back only when
 * the last of them leaves.
 */
@Composable
fun KeyboardResizeEffect() {
    val context = LocalContext.current
    DisposableEffect(context) {
        val window = context.findActivity()?.window
        window?.let(KeyboardResizeHolds::take)
        onDispose { window?.let(KeyboardResizeHolds::release) }
    }
}

/** How many screens want each window resized, and the mode it had before the first of them. */
private object KeyboardResizeHolds {
    private class Hold(
        val previousMode: Int,
    ) {
        var count = 0
    }

    private val holds = WeakHashMap<Window, Hold>()

    fun take(window: Window) {
        val hold = holds.getOrPut(window) { Hold(window.attributes.softInputMode.withAdjustResolved()) }
        hold.count += 1
        window.setSoftInputMode(LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    }

    fun release(window: Window) {
        val hold = holds[window] ?: return
        hold.count -= 1
        if (hold.count == 0) {
            holds.remove(window)
            window.setSoftInputMode(hold.previousMode)
        }
    }
}

/**
 * A window handed an "unspecified" adjust mode keeps the one it last had, so
 * restoring the activity's default as is would leave it resizing. The system
 * resolves that default to pan for this app's window (no scroll-container
 * views), so it comes back as pan.
 */
private fun Int.withAdjustResolved(): Int =
    if ((this and LayoutParams.SOFT_INPUT_MASK_ADJUST) == LayoutParams.SOFT_INPUT_ADJUST_UNSPECIFIED) {
        this or LayoutParams.SOFT_INPUT_ADJUST_PAN
    } else {
        this
    }

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
