@file:Suppress("MagicNumber")
@file:OptIn(ExperimentalFoundationApi::class)

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.rememberSplineBasedDecay
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.AnchoredDraggableState
import androidx.compose.foundation.gestures.DraggableAnchors
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.anchoredDraggable
import androidx.compose.foundation.gestures.animateTo
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlin.math.roundToInt

/*
 * PHASE-6 A3 (the founder's points 4 and 6, 2026-11-28): on a phone the list is a sheet over the map with three rests,
 * peek (a grabber and one line), half (about 45% of the height) and full (up to under the top line). It moves only when
 * its header is dragged or tapped: scrolling the list never moves it, at any rest, and it never closes by itself. A fling
 * on the header goes to the rest its speed points at. The heights keep their names: Map is the sheet at peek (the map
 * shown), Middle the sheet at half (how Pulse opens), List the sheet full.
 */

/** The sheet's height at peek: its header, a grabber and one line. */
internal val REINVENTED_SHEET_PEEK = 64.dp

/** The part of the height the sheet takes at half. */
private const val HALF_SHARE = 0.45f

/** A fling faster than this on the header goes on to the next rest. */
private val FLING = 125.dp

/** How far over the sheet's top edge + sits. */
private val ADD_GAP = 12.dp

/**
 * Where the sheet's top rests for each height, measured from the screen's top: under the top line ([top]) at List, at
 * [half] at Middle (55% of the height when not given), [REINVENTED_SHEET_PEEK] over the bottom at Map. On a short
 * window the rests never cross.
 */
internal fun reinventedSheetTop(
    height: ReinventedHeight,
    top: Float,
    full: Float,
    peek: Float,
    half: Float? = null,
): Float {
    val peekAt = (full - peek).coerceAtLeast(top)
    return when (height) {
        ReinventedHeight.List -> top
        ReinventedHeight.Middle -> (half ?: (full * (1f - HALF_SHARE))).coerceIn(top, peekAt)
        ReinventedHeight.Map -> peekAt
    }
}

/**
 * The half rest set against the window, not against Pulse's own box: today's tab bar slides away while a list scrolls
 * and the box grows by its height, and a rest measured in the box would follow it down under the finger. Half of the
 * window's height, in the box's pixels; null until the box has been placed.
 */
@Composable
internal fun rememberReinventedHalf(): Pair<Float?, Modifier> {
    val window = LocalView.current.rootView.height.toFloat()
    var boxTop by remember { mutableFloatStateOf(Float.NaN) }
    val half = if (boxTop.isNaN() || window <= 0f) null else window * WINDOW_HALF - boxTop
    return half to Modifier.onGloballyPositioned { boxTop = it.positionInWindow().y }
}

/** The share of the window's height above the sheet's top at half. */
private const val WINDOW_HALF = 0.5f

/**
 * The sheet's drag state, kept in step with [height]: a drag or a fling that settles reports its rest through
 * [onHeight]; a height set elsewhere (the switch, Back, a second tap on the tab) glides the sheet there.
 */
@Composable
internal fun rememberReinventedSheet(
    height: ReinventedHeight,
    onHeight: (ReinventedHeight) -> Unit,
    top: Dp,
    full: Dp,
    half: Float? = null,
): AnchoredDraggableState<ReinventedHeight> {
    val density = LocalDensity.current
    val decay = rememberSplineBasedDecay<Float>()
    val sheet =
        remember(decay) {
            AnchoredDraggableState(
                initialValue = height,
                positionalThreshold = { distance -> distance * 0.5f },
                velocityThreshold = { with(density) { FLING.toPx() } },
                // The system's spring, close to the iPhone's interactive one (response 0.35, damping 0.86).
                snapAnimationSpec = spring(dampingRatio = 0.86f, stiffness = Spring.StiffnessMediumLow),
                decayAnimationSpec = decay,
            )
        }
    val anchors =
        with(density) {
            val topPx = top.toPx()
            val fullPx = full.toPx()
            val peekPx = REINVENTED_SHEET_PEEK.toPx()
            DraggableAnchors {
                ReinventedHeight.entries.forEach { it at reinventedSheetTop(it, topPx, fullPx, peekPx, half) }
            }
        }
    SideEffect { sheet.updateAnchors(anchors, sheet.targetValue) }
    val latest by rememberUpdatedState(height)
    val report by rememberUpdatedState(onHeight)
    LaunchedEffect(height) {
        if (sheet.settledValue != height || sheet.targetValue != height) sheet.animateTo(height)
    }
    LaunchedEffect(sheet) {
        snapshotFlow { sheet.settledValue }.collect { if (it != latest) report(it) }
    }
    return sheet
}

/** The sheet's top edge now, from the screen's top, in pixels; the rest's place while the anchors are not laid yet. */
internal fun AnchoredDraggableState<ReinventedHeight>.topNow(): Float {
    val now = offset
    return if (now.isNaN()) anchors.positionOf(settledValue).takeUnless { it.isNaN() } ?: 0f else now
}

/**
 * The sheet: its header (the grabber and [line], with [headerEnd] at its right) is the only handle; the list below it
 * scrolls on its own. The sheet is laid out once at its full height and slid, so moving it never measures the list
 * again; the list's bottom is lifted by the part of the sheet below the screen at the rest it settled at.
 */
@Composable
@Suppress("LongParameterList") // The drag state, its rests, the header's line and end, and the list inside.
internal fun ReinventedSheet(
    sheet: AnchoredDraggableState<ReinventedHeight>,
    top: Dp,
    full: Dp,
    line: String,
    headerEnd: @Composable RowScope.() -> Unit,
    list: @Composable (Modifier) -> Unit,
    half: Float? = null,
) {
    val density = LocalDensity.current
    val settled = sheet.settledValue
    val corner = if (settled == ReinventedHeight.List) 0.dp else 22.dp
    val shape = RoundedCornerShape(topStart = corner, topEnd = corner)
    val hidden =
        with(density) {
            (reinventedSheetTop(settled, top.toPx(), full.toPx(), REINVENTED_SHEET_PEEK.toPx(), half) - top.toPx()).toDp()
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .height((full - top).coerceAtLeast(REINVENTED_SHEET_PEEK))
                .offset { IntOffset(0, sheet.topNow().roundToInt()) }
                .shadow(if (settled == ReinventedHeight.List) 0.dp else 8.dp, shape)
                .clip(shape)
                .background(PantopusColors.appBg)
                .testTag("reinventedPulse.sheet"),
    ) {
        SheetHeader(sheet, line, headerEnd)
        list(Modifier.fillMaxWidth().weight(1f).padding(bottom = hidden))
    }
}

/** The grabber and the line: dragged, it moves the sheet; tapped, it opens it one rest further (full goes back to half). */
@Composable
private fun SheetHeader(
    sheet: AnchoredDraggableState<ReinventedHeight>,
    line: String,
    end: @Composable RowScope.() -> Unit,
) {
    val settled = sheet.settledValue
    val next =
        when (settled) {
            ReinventedHeight.Map -> ReinventedHeight.Middle
            ReinventedHeight.Middle -> ReinventedHeight.List
            ReinventedHeight.List -> ReinventedHeight.Middle
        }
    var go by remember { mutableStateOf<ReinventedHeight?>(null) }
    LaunchedEffect(go) {
        val to = go ?: return@LaunchedEffect
        sheet.animateTo(to)
        go = null
    }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(REINVENTED_SHEET_PEEK)
                .anchoredDraggable(sheet, Orientation.Vertical)
                .pointerInput(next) { detectTapGestures { go = next } }
                .semantics(mergeDescendants = true) {
                    contentDescription = line
                    stateDescription =
                        when (settled) {
                            ReinventedHeight.Map -> "The list is lowered"
                            ReinventedHeight.Middle -> "The list is half open"
                            ReinventedHeight.List -> "The list is open"
                        }
                    onClick(label = if (settled == ReinventedHeight.List) "Lower the list" else "Raise the list") {
                        go = next
                        true
                    }
                }.testTag("reinventedPulse.sheet.header"),
    ) {
        Box(Modifier.fillMaxWidth().height(16.dp).testTag("reinventedPulse.handle"), contentAlignment = Alignment.Center) {
            Box(Modifier.size(width = 36.dp, height = 4.dp).clip(CircleShape).background(PantopusColors.appBorder))
        }
        Row(
            modifier = Modifier.fillMaxWidth().height(48.dp).padding(start = 16.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = line,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).testTag("reinventedPulse.sheet.line"),
            )
            end()
        }
    }
}

/**
 * + over the sheet: [ADD_GAP] over its top edge at peek, riding up with it to half and no higher; above half it fades,
 * and at full it is drawn in the sheet's header instead ([add] is laid out only while the sheet is not full).
 */
@Composable
internal fun BoxScope.ReinventedSheetAdd(
    sheet: AnchoredDraggableState<ReinventedHeight>,
    top: Dp,
    full: Dp,
    size: Dp,
    add: @Composable (Modifier) -> Unit,
    half: Float? = null,
) {
    if (sheet.settledValue == ReinventedHeight.List && sheet.targetValue == ReinventedHeight.List) return
    val density = LocalDensity.current
    val topPx = with(density) { top.toPx() }
    val fullPx = with(density) { full.toPx() }
    val peekPx = with(density) { REINVENTED_SHEET_PEEK.toPx() }
    val halfAt = reinventedSheetTop(ReinventedHeight.Middle, topPx, fullPx, peekPx, half)
    val peekAt = reinventedSheetTop(ReinventedHeight.Map, topPx, fullPx, peekPx)
    val lift = with(density) { (size + ADD_GAP).toPx() }
    add(
        Modifier
            .align(Alignment.TopEnd)
            .offset { IntOffset(0, (sheet.topNow().coerceIn(halfAt, peekAt) - lift).roundToInt()) }
            .graphicsLayer {
                val span = (halfAt - topPx).coerceAtLeast(1f)
                alpha = ((sheet.topNow() - topPx) / span).coerceIn(0f, 1f)
            },
    )
}

/** The sheet's line: "23 here · Tonight", or the person's own count in My Atlas. */
internal fun reinventedSheetLine(
    count: Int,
    time: String,
    atlas: Boolean,
): String {
    if (atlas) return if (count == 0) "My Atlas" else "My Atlas · $count here"
    val title = REINVENTED_TIMES.firstOrNull { it.first == time }?.second ?: "Live"
    return if (count == 0) "Nothing here yet · $title" else "$count here · $title"
}

/** + in the sheet's header while the sheet is full: a small round button, 44 dp to the finger. */
@Composable
internal fun ReinventedSheetHeaderAdd(onAdd: () -> Unit) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .clickable(onClick = onAdd)
                .semantics { contentDescription = "Add a Moment" }
                .testTag("reinventedPulse.sheet.add"),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(32.dp).clip(CircleShape).background(PantopusColors.primary600), contentAlignment = Alignment.Center) {
            PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 18.dp, strokeWidth = 2.6f, tint = Color.White)
        }
    }
}
