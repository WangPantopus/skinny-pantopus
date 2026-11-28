package app.pantopus.android.ui.screens.moments.studio

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf

/**
 * Where the middle of an item on the picture (a stamp, a dot, moving words, a playable item) may go, as shares of the
 * frame it is placed on (PHASE-6 F): on the whole stage, anywhere on the 9:16 canvas, the backdrop around the picture
 * included; elsewhere, null, and each kind keeps its own limits as before.
 */
@Immutable
internal data class StudioReach(
    val left: Double,
    val top: Double,
    val right: Double,
    val bottom: Double,
) {
    fun x(v: Double): Double = v.coerceIn(left, right)

    fun y(v: Double): Double = v.coerceIn(top, bottom)
}

internal val LocalStudioReach = compositionLocalOf<StudioReach?> { null }
