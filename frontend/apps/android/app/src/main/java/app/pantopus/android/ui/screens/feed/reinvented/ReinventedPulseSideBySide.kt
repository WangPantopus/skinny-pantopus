@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/*
 * PHASE-6 E (the founder's points 8 and 9, 2026-11-28): on a window 700 dp wide or more (a tablet either way up, an open
 * foldable), the map fills the window and the list is a floating panel at the left, 380 dp wide and 12 dp from the edges,
 * rounded, over the map. A tab on its right edge folds it away to a 28 dp peek and back. The map counts only its
 * uncovered part as "on the map", and keeps its middle there. The top line floats at the top left in the panel's width,
 * the rail stays at the right. A narrower window (a phone, a tablet in split view) keeps the phone's sheet. On an open
 * foldable the panel sits on the left half, clear of the hinge. Heights read: Map is the panel folded away; Middle and
 * List are the panel open.
 */

/** The panel's width, its gap to the window's edges, and the tab left showing when it is folded away. */
internal val REINVENTED_PANEL = 380.dp
private val PANEL_GAP = 12.dp
private val PANEL_TAB = 28.dp

/** The narrowest window that shows the panel. */
private val PANEL_WINDOW = 700.dp

/** Whether a window this wide shows the list as a floating panel over the map (PHASE-6 E). */
internal fun reinventedPanel(width: Dp): Boolean = width >= PANEL_WINDOW

/** What the two layouts (the sheet on a phone, the panel on a wide window) both draw. */
internal class ReinventedLayoutParts(
    /** The top line (and, on a phone, what floats under it). */
    val header: @Composable (Modifier) -> Unit,
    /** The live map, keeping its middle inside the padding. */
    val map: @Composable (padding: PaddingValues) -> Unit,
    /** "Guess the spot", where [chip] puts it. */
    val mapExtras: @Composable BoxScope.(chip: Modifier) -> Unit,
    /** + : the Studio, as a round button. */
    val add: @Composable (Modifier) -> Unit,
    /** What + does, for the small + in the phone's sheet header at full. */
    val onAdd: () -> Unit,
    /** The list (or My Atlas's); following: what is on the map now (PHASE-6 B), else the reach's whole list. */
    val list: @Composable (Modifier, following: Boolean) -> Unit,
)

/**
 * The wide window: the map behind everything, the panel at the left with its line and list, its fold tab, the top line
 * at the top left, + at the bottom right; [overMap] draws the rail and the pill, right of [left] (the panel's edge).
 * [onUncovered] gets the map's uncovered part in pixels (left, top, right, bottom) once the panel rests.
 */
@Composable
@Suppress("LongParameterList") // Its rest, the parts, the panel's line and end, and what goes over the map.
internal fun BoxScope.ReinventedPanelLayout(
    height: ReinventedHeight,
    onHeight: (ReinventedHeight) -> Unit,
    size: Pair<Dp, Dp>,
    line: String,
    parts: ReinventedLayoutParts,
    panelEnd: @Composable RowScope.() -> Unit,
    onUncovered: (left: Float, top: Float, right: Float, bottom: Float) -> Unit,
    lineDim: Boolean,
    overMap: @Composable BoxScope.(top: Dp, left: Dp) -> Unit,
) {
    val (width, full) = size
    val density = LocalDensity.current
    val open = height != ReinventedHeight.Map
    var headerPx by remember { mutableIntStateOf(0) }
    val header = with(density) { headerPx.toDp() }
    val shown = PANEL_GAP + REINVENTED_PANEL
    val left by animateDpAsState(if (open) 0.dp else -shown, spring(dampingRatio = 0.86f), label = "panel")
    val uncoveredLeft = if (open) shown else PANEL_TAB
    parts.map(PaddingValues(start = uncoveredLeft))
    LaunchedEffect(open, width, full) { with(density) { onUncovered(uncoveredLeft.toPx(), 0f, width.toPx(), full.toPx()) } }
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier =
            Modifier
                .offset(x = left)
                .padding(start = PANEL_GAP, top = header + 8.dp, bottom = PANEL_GAP)
                .navigationBarsPadding()
                .width(REINVENTED_PANEL)
                .fillMaxHeight()
                .shadow(8.dp, shape)
                .clip(shape)
                .background(PantopusColors.appBg.copy(alpha = 0.96f))
                .testTag("reinventedPulse.panel"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().height(48.dp).padding(start = 16.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                line,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).alpha(if (lineDim) 0.5f else 1f).testTag("reinventedPulse.sheet.line"),
            )
            panelEnd()
        }
        parts.list(Modifier.fillMaxWidth().weight(1f), open)
    }
    FoldTab(open, onHeight, Modifier.align(Alignment.CenterStart).offset(x = left + shown))
    parts.header(Modifier.width(REINVENTED_PANEL + PANEL_GAP).onSizeChanged { headerPx = it.height })
    parts.mapExtras(this, Modifier.align(Alignment.BottomStart).padding(start = uncoveredLeft + 16.dp, bottom = 16.dp))
    parts.add(Modifier.align(Alignment.BottomEnd).navigationBarsPadding())
    overMap(header, uncoveredLeft)
}

/** The tab on the panel's right edge: folds the panel away to the map, or brings it back. */
@Composable
private fun FoldTab(
    open: Boolean,
    onHeight: (ReinventedHeight) -> Unit,
    modifier: Modifier,
) {
    val shape = RoundedCornerShape(topEnd = 12.dp, bottomEnd = 12.dp)
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .size(width = PANEL_TAB + 16.dp, height = 64.dp)
                .clickable(role = Role.Button) { onHeight(if (open) ReinventedHeight.Map else ReinventedHeight.Middle) }
                .semantics { contentDescription = if (open) "Fold the list away" else "Show the list" }
                .testTag("reinventedPulse.panel.tab"),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .size(width = PANEL_TAB, height = 56.dp)
                    .clip(shape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, shape),
        ) {
            PantopusIconImage(
                icon = if (open) PantopusIcon.ChevronLeft else PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appText,
            )
        }
    }
}
