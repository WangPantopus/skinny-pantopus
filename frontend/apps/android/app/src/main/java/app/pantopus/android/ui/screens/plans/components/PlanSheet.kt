@file:Suppress("MagicNumber", "MatchingDeclarationName", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The sheet's resting places (board P3, retuned 2026-10-23 so the map leads, as on iOS): peek shows its first lines
 * (the title and the first plans, or the suggestion card), half about half the screen or the whole card or message
 * when it fits, and full stops just under the floating chrome, which stays on screen.
 */
enum class PlanSheetStop {
    Peek,
    Half,
    Full,
}

/** Where the sheet's top rests at each stop, in pixels from the top of the screen box. */
@Immutable
data class PlanSheetTops(
    val box: Float,
    val peek: Float,
    val half: Float,
    val full: Float,
    /** How far past the lowest stop a pull can go, at most. */
    val resistPx: Float,
) {
    fun top(stop: PlanSheetStop): Float =
        when (stop) {
            PlanSheetStop.Peek -> peek
            PlanSheetStop.Half -> half
            PlanSheetStop.Full -> full
        }

    /** The sheet's height above the bottom of the box at [stop]. */
    fun visible(stop: PlanSheetStop): Float = (box - top(stop)).coerceAtLeast(0f)

    /** The top under a finger at [position]: never above full, and giving less and less below the lowest stop. */
    fun held(position: Float): Float =
        when {
            position < full -> full
            position > peek -> peek + resistPx * (1 - 1 / ((position - peek) * 0.55f / resistPx + 1))
            else -> position
        }

    /**
     * Where a release at [position] moving at [velocity] (pixels a second, down positive) comes to rest, as on iOS:
     * the stop nearest where the drag aims, and after a fling at least the next stop its way.
     */
    fun target(
        position: Float,
        velocity: Float,
        flingPx: Float,
    ): PlanSheetStop {
        val aimed = position + velocity * 0.18f
        val stops = PlanSheetStop.entries
        var target = stops.minBy { abs(top(it) - aimed) }
        if (velocity < -flingPx && top(target) > position - 1f) {
            stops.filter { top(it) < position - 1f }.maxByOrNull { top(it) }?.let { target = it }
        } else if (velocity > flingPx && top(target) < position + 1f) {
            stops.filter { top(it) > position + 1f }.minByOrNull { top(it) }?.let { target = it }
        }
        return target
    }
}

/**
 * The sheet's live position and what its content says about itself, hoisted so the map's floating controls can follow
 * a drag without recomposing anything. Read [topPx] and [visiblePx] in a layout or draw block, never in composition.
 */
@Stable
class PlanSheetState {
    /** The sheet's top in the screen box, live; NaN until it is first laid out. */
    var topPx by mutableFloatStateOf(Float.NaN)
        private set

    /** Where each stop rests, as last laid out. */
    var tops by mutableStateOf<PlanSheetTops?>(null)
        internal set

    /** Where the first lines end, from the top of the content: the lowest stop shows down to here. */
    var peekPx by mutableFloatStateOf(0f)
        private set

    /** The whole card or message, measured: the middle stop fits it. */
    var fitPx by mutableFloatStateOf(0f)
        private set

    internal var dragging = false
        private set
    private var finger = Float.NaN
    private var animation: Job? = null
    private var glidingTo = Float.NaN

    /** The sheet's height above the bottom of the box, live. */
    fun visiblePx(): Float {
        val box = tops?.box ?: return 0f
        return if (topPx.isNaN()) 0f else (box - topPx).coerceAtLeast(0f)
    }

    /** The content's first lines end [px] from its top (the lowest stop shows them). */
    fun reportPeek(px: Int) {
        if (abs(peekPx - px) > 0.5f) peekPx = px.toFloat()
    }

    /** The whole card or message is [px] tall (the middle stop fits it). */
    fun reportFit(px: Int) {
        if (abs(fitPx - px) > 0.5f) fitPx = px.toFloat()
    }

    internal fun place(top: Float) {
        topPx = top
    }

    internal fun isGlidingTo(top: Float): Boolean = animation?.isActive == true && abs(glidingTo - top) < 0.5f

    /** A finger moved the sheet by [delta]: it follows at once, on the same frame. */
    internal fun dragBy(
        delta: Float,
        tops: PlanSheetTops,
    ) {
        if (!dragging) {
            stopGliding()
            dragging = true
            finger = topPx
        }
        finger += delta
        topPx = tops.held(finger)
    }

    internal fun endDrag() {
        dragging = false
        finger = Float.NaN
    }

    internal fun glide(
        scope: CoroutineScope,
        target: Float,
        velocity: Float,
        spec: AnimationSpec<Float>,
    ) {
        stopGliding()
        if (topPx.isNaN() || abs(topPx - target) < 0.5f) {
            topPx = target
            return
        }
        glidingTo = target
        animation = scope.launch { animate(topPx, target, velocity, spec) { value, _ -> topPx = value } }
    }

    private fun stopGliding() {
        animation?.cancel()
        animation = null
        glidingTo = Float.NaN
    }
}

/** The sheet the content sits in, for the lines that set its stops (null outside a sheet). */
val LocalPlanSheet = staticCompositionLocalOf<PlanSheetState?> { null }

/**
 * The list sheet over the map (boards F1 to F5): a grab handle, three stops and a spring of about 0.35 s. It is laid
 * out once at its full height and slides by an offset, so a drag frame moves it without measuring its content again or
 * recomposing the map. A drag anywhere on it moves it, and it follows the finger on the same frame. Its content
 * scrolls only once it is full: pulling the content up raises the sheet first, and pulling it down at its top lowers
 * the sheet. A release springs to the stop the drag aims at, at the finger's speed. Tapping the handle opens the sheet
 * or lowers it; TalkBack gets "Expand" and "Collapse" on the handle, so nothing needs a drag.
 *
 * [stop] is the wanted stop; [onStop] reports where a drag left it. [fullTopPx] is where the full stop rests (under
 * the floating chrome). [fits] lets a card or message take its own height in the middle, and [lowest] keeps a
 * question with buttons (F5) from going below half. The content reports its first lines and its height through
 * [LocalPlanSheet].
 */
@Composable
fun PlanSheet(
    stop: PlanSheetStop,
    onStop: (PlanSheetStop) -> Unit,
    modifier: Modifier = Modifier,
    state: PlanSheetState = remember { PlanSheetState() },
    fullTopPx: Float = 0f,
    fits: Boolean = false,
    lowest: PlanSheetStop = PlanSheetStop.Peek,
    reduceMotion: Boolean = false,
    content: @Composable ColumnScope.(PlanSheetStop) -> Unit,
) {
    // The sheet hangs below the box at its lower stops: clip it there, so nothing shows through the bottom bar.
    BoxWithConstraints(modifier = modifier.clipToBounds()) {
        val density = LocalDensity.current
        val box = with(density) { maxHeight.toPx() }
        val tops =
            remember(box, fullTopPx, state.peekPx, state.fitPx, fits, lowest, density) {
                sheetTops(box, fullTopPx, state.peekPx, if (fits) state.fitPx else 0f, lowest, density)
            }
        val scope = rememberCoroutineScope()
        val spec: AnimationSpec<Float> =
            if (reduceMotion) tween(150) else spring(dampingRatio = 0.86f, stiffness = Spring.StiffnessMediumLow)
        val flingPx = with(density) { FLING_DP.toPx() }
        val latestTops by rememberUpdatedState(tops)
        val latestStop by rememberUpdatedState(stop)
        val latestSpec by rememberUpdatedState(spec)
        val reportStop by rememberUpdatedState(onStop)
        SideEffect { state.tops = tops }

        // The stop or the content changed: glide there, unless a finger has the sheet or a release already goes there.
        LaunchedEffect(tops, stop) {
            val target = tops.top(stop)
            when {
                state.topPx.isNaN() -> state.place(target)
                state.dragging || state.isGlidingTo(target) -> Unit
                else -> state.glide(scope, target, 0f, spec)
            }
        }

        fun settle(velocity: Float) {
            state.endDrag()
            val current = latestTops
            val target = current.target(state.topPx, velocity, flingPx)
            state.glide(scope, current.top(target), velocity, latestSpec)
            if (target != latestStop) reportStop(target)
        }

        val nested =
            remember(state) {
                object : NestedScrollConnection {
                    override fun onPreScroll(
                        available: Offset,
                        source: NestedScrollSource,
                    ): Offset {
                        if (source != NestedScrollSource.UserInput || available.y >= 0f) return Offset.Zero
                        // Pulling up below full raises the sheet first; at full the content scrolls.
                        val room = state.topPx - latestTops.full
                        if (room <= 0.5f) return Offset.Zero
                        val move = maxOf(available.y, -room)
                        state.dragBy(move, latestTops)
                        return Offset(0f, move)
                    }

                    override fun onPostScroll(
                        consumed: Offset,
                        available: Offset,
                        source: NestedScrollSource,
                    ): Offset {
                        if (source != NestedScrollSource.UserInput || available.y <= 0f) return Offset.Zero
                        // The content is at its top and still pulled down: the sheet comes down with the finger.
                        state.dragBy(available.y, latestTops)
                        return Offset(0f, available.y)
                    }

                    override suspend fun onPreFling(available: Velocity): Velocity {
                        if (!state.dragging) return Velocity.Zero
                        // Raised all the way and still flung up: the sheet stays full and the content keeps the fling.
                        if (available.y < 0f && state.topPx <= latestTops.full + 0.5f) {
                            settle(0f)
                            return Velocity.Zero
                        }
                        settle(available.y)
                        return available
                    }
                }
            }

        val shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        val surface = PantopusColors.appSurface
        Column(
            modifier =
                Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .height(with(density) { (box - tops.full).coerceAtLeast(0f).toDp() })
                    // Placement only: a drag frame moves the sheet and measures nothing.
                    .offset { IntOffset(0, (if (state.topPx.isNaN()) tops.top(stop) else state.topPx).roundToInt()) }
                    // A little surface below the sheet, so a spring past full never shows the map under it.
                    .drawBehind { drawRect(surface, topLeft = Offset(0f, size.height - 1f), size = Size(size.width, OVERSHOOT_DP.toPx())) }
                    .shadow(16.dp, shape)
                    .clip(shape)
                    .background(surface)
                    .nestedScroll(nested)
                    .draggable(
                        state = rememberDraggableState { state.dragBy(it, latestTops) },
                        orientation = Orientation.Vertical,
                        onDragStopped = { velocity -> settle(velocity) },
                    ),
        ) {
            SheetHandle(
                onTap = { reportStop(if (latestStop == PlanSheetStop.Full) PlanSheetStop.Peek else PlanSheetStop.Full) },
                onExpand = { reportStop(if (latestStop == PlanSheetStop.Peek) PlanSheetStop.Half else PlanSheetStop.Full) },
                onCollapse = { reportStop(PlanSheetStop.Peek) },
            )
            Column(modifier = Modifier.fillMaxWidth().weight(1f).padding(horizontal = Spacing.s4)) {
                CompositionLocalProvider(LocalPlanSheet provides state) { content(stop) }
            }
        }
    }
}

/** The stops for a [box] this tall: full under the chrome, half or the content's own height, peek its first lines. */
private fun sheetTops(
    box: Float,
    fullTopPx: Float,
    peekPx: Float,
    fitPx: Float,
    lowest: PlanSheetStop,
    density: Density,
): PlanSheetTops {
    val handle = with(density) { HANDLE_DP.toPx() }
    val full = if (fullTopPx > 0f) fullTopPx else box * 0.08f
    val halfShown = if (fitPx > 0f) minOf(fitPx + handle, box * 0.62f) else box * 0.5f
    val half = maxOf(box - halfShown, full)
    val peek =
        if (lowest == PlanSheetStop.Peek) {
            val lines = if (peekPx > 0f) peekPx + handle + with(density) { Spacing.s3.toPx() } else box * 0.28f
            maxOf(box - lines.coerceIn(with(density) { 112.dp.toPx() }, box * 0.45f), half)
        } else {
            half
        }
    return PlanSheetTops(box = box, peek = peek, half = half, full = full, resistPx = with(density) { 120.dp.toPx() })
}

/** The grab handle: drag it or tap it to open or lower the sheet; TalkBack gets "Expand" and "Collapse" instead. */
@Composable
private fun SheetHandle(
    onTap: () -> Unit,
    onExpand: () -> Unit,
    onCollapse: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(HANDLE_DP)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onTap)
                .semantics {
                    contentDescription = "Plans list"
                    customActions =
                        listOf(
                            CustomAccessibilityAction("Expand") {
                                onExpand()
                                true
                            },
                            CustomAccessibilityAction("Collapse") {
                                onCollapse()
                                true
                            },
                        )
                },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = 36.dp, height = 5.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(PantopusColors.appBorderStrong),
        )
    }
}

/** Faster than this a release moves at least one stop its way (as on iOS). */
private val FLING_DP = 300.dp
private val HANDLE_DP = 28.dp
private val OVERSHOOT_DP = 48.dp

/** Keeps a floating control just above the sheet, following it during a drag without recomposing. */
fun Modifier.aboveSheet(
    sheet: PlanSheetState,
    gapPx: Float,
): Modifier = this.offset { IntOffset(0, -(sheet.visiblePx() + gapPx).roundToInt()) }
