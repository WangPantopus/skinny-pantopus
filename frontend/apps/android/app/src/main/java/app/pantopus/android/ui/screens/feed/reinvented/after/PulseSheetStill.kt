package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.Velocity

/*
 * "Pulse, reinvented" PHASE-6 D and G on Android: the Pulse track's sheets (a Retake, the sky piece, a pinboard, the crowd,
 * an opened relic, Mail it, passing on, replies, the kind) move only by their handle. On the sheet's own content root:
 * a list or a field inside still scrolls at every rest, and whatever a drag leaves over, or a drag on a part that does
 * not scroll (a picture, the words), is kept here, so it never moves or closes the sheet. The handle above the content
 * still drags it, and Back and a tap above it still close it.
 */

/** Keeps a drag on the sheet's content from moving the sheet (put first on the content's root). */
internal fun Modifier.keepsSheetStill(): Modifier =
    this
        .nestedScroll(KeepSheetStill)
        .pointerInput(Unit) { detectVerticalDragGestures { change, _ -> change.consume() } }

/** What a scroll inside leaves over at its end stays here instead of reaching the sheet. */
private object KeepSheetStill : NestedScrollConnection {
    override fun onPostScroll(
        consumed: Offset,
        available: Offset,
        source: NestedScrollSource,
    ): Offset = Offset(0f, available.y)

    override suspend fun onPostFling(
        consumed: Velocity,
        available: Velocity,
    ): Velocity = Velocity(0f, available.y)
}
