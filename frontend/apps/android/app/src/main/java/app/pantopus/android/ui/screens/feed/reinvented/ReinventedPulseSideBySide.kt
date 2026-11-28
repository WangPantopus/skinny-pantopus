@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/*
 * "Pulse, reinvented" phase 1 (PHASE-1 §2 piece 2): on a tablet and an open foldable, List and Map sit side by side, as
 * on the iPad and the open iPhone Duo (iPhone #5113). Where it applies is the same rule: room for the list's phone-wide
 * column beside a phone-wide map. A phone, and a foldable or a tablet window too narrow for both, keep the list resting
 * over the map, unchanged.
 *
 * The three heights read the same way: the middle is both side by side (List and Map both lit), List is the list alone
 * in a reading column, Map is the map alone with the top row at the top left and the deck along the bottom. Tapping
 * List or Map shows that one alone; tapping the lit one again goes back to both. My Atlas is the person's own list in
 * the column beside the map of their kept Moments.
 */

/** The list's column beside the map: a phone's width. */
internal val REINVENTED_SIDE_COLUMN = 382.dp

/** The narrowest map worth drawing beside the column: a phone's width. */
private val REINVENTED_SIDE_MAP = 375.dp

/** The list alone on a wide window: a reading column, not the whole width. */
private val REINVENTED_READING_COLUMN = 640.dp

/** Whether a window this wide shows List and Map side by side. */
internal fun reinventedSideBySide(width: Dp): Boolean = width >= REINVENTED_SIDE_COLUMN + REINVENTED_SIDE_MAP

/** What the two layouts (over the map on a phone, side by side on a wide window) both draw. */
internal class ReinventedLayoutParts(
    /** The top row, the switch, and the chips (or the time row at the Map height). */
    val header: @Composable (Modifier) -> Unit,
    /** The live map, with room kept at its bottom. */
    val map: @Composable (bottomPadding: Dp) -> Unit,
    /** The time row over the map when both are shown; null in My Atlas, which has none. */
    val timeRow: (@Composable (Modifier) -> Unit)?,
    /** At the Map height: "Guess the spot" under the top row, and the peek deck where [deck] is given (a wide window). */
    val mapExtras: @Composable BoxScope.(guessTop: Dp, deck: Modifier?) -> Unit,
    /** + : the Studio, as a round button. */
    val add: @Composable (Modifier) -> Unit,
    /** What + does, for the small + in the phone's sheet header at full. */
    val onAdd: () -> Unit,
    /** The list (or My Atlas's); following: what is on the map now (PHASE-6 B), else the reach's whole list. */
    val list: @Composable (Modifier, following: Boolean) -> Unit,
)

/** List and Map side by side, or one of them alone, on a wide window. */
@Composable
internal fun BoxScope.ReinventedSideBySide(
    height: ReinventedHeight,
    parts: ReinventedLayoutParts,
) {
    // The map stays in one place in the tree, so it is never rebuilt (nor re-centred) when the person switches views.
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(start = if (height == ReinventedHeight.Middle) REINVENTED_SIDE_COLUMN else 0.dp)
                .testTag("reinventedPulse.sideMap"),
    ) {
        parts.map(0.dp)
        if (height == ReinventedHeight.Middle) {
            parts.timeRow?.invoke(Modifier.statusBarsPadding().padding(top = Spacing.s2))
        }
    }
    when (height) {
        ReinventedHeight.Middle ->
            ListColumn(parts, Modifier.align(Alignment.TopStart).width(REINVENTED_SIDE_COLUMN).testTag("reinventedPulse.sideList"))
        ReinventedHeight.List ->
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) {
                ListColumn(
                    parts,
                    Modifier
                        .align(Alignment.TopCenter)
                        .widthIn(max = REINVENTED_READING_COLUMN)
                        .fillMaxWidth()
                        .testTag("reinventedPulse.sideList"),
                )
            }
        ReinventedHeight.Map -> MapAlone(parts)
    }
}

/** The header over the list, and + at the list's bottom corner. */
@Composable
private fun ListColumn(
    parts: ReinventedLayoutParts,
    modifier: Modifier,
) {
    Column(modifier = modifier.fillMaxHeight().background(PantopusColors.appBg)) {
        parts.header(Modifier)
        Box(Modifier.fillMaxWidth().weight(1f)) {
            parts.list(Modifier.fillMaxSize(), false)
            parts.add(Modifier.align(Alignment.BottomEnd))
        }
    }
}

/** The map alone: the top row in a column's width at the top left, "Guess the spot" under it, the deck along the bottom. */
@Composable
private fun BoxScope.MapAlone(parts: ReinventedLayoutParts) {
    val density = LocalDensity.current
    var headerPx by remember { mutableIntStateOf(0) }
    parts.header(Modifier.align(Alignment.TopStart).width(REINVENTED_SIDE_COLUMN).onSizeChanged { headerPx = it.height })
    parts.mapExtras(
        this,
        with(density) { headerPx.toDp() },
        Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s4).widthIn(max = REINVENTED_SIDE_COLUMN + 48.dp),
    )
}
