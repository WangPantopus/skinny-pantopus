package app.pantopus.android.ui.screens.moments.studio

import android.graphics.Bitmap
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.IntSize
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacementPainter
import app.pantopus.android.ui.screens.moments.compose.marks.shape

/** The photo as it came (upright, as the marks editor reads it), with its film look, and the backdrop drawn from it. */
@Immutable
internal data class StudioWholeView(
    val asCame: Bitmap,
    val looked: Bitmap,
    val backdrop: MomentPlacementPainter.Backdrop,
) {
    val size: IntSize get() = IntSize(asCame.width, asCame.height)
    val shape: Float get() = size.shape
}
