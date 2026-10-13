@file:Suppress("MagicNumber", "MatchingDeclarationName", "LongParameterList")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/** The sheet's resting places (board P3: peek about a third, half, and full at 92%). */
enum class PlanSheetStop(
    val fraction: Float,
) {
    Peek(0.36f),
    Half(0.52f),
    Full(0.92f),
}

/**
 * The list sheet over the map (boards F1 to F5): a grab handle, three stops and a spring of about 0.35 s. Dragging
 * the handle, flinging, or scrolling the content past its top moves it between stops. TalkBack gets "Expand" and
 * "Collapse" on the handle, so nothing needs a drag.
 *
 * [stop] is the wanted stop; [onStop] reports where a drag left it. [halfFraction] lets a state (the plan card,
 * the empty or no-location state) ask for its own middle height, and [halfContentPx] (the content's own height, when
 * it knows it) grows the middle stop so a small screen still shows the whole plan card. The sheet reports its visible
 * height through [onHeight] so the map can keep its center above it.
 */
@Composable
fun PlanSheet(
    stop: PlanSheetStop,
    onStop: (PlanSheetStop) -> Unit,
    modifier: Modifier = Modifier,
    halfFraction: Float = PlanSheetStop.Half.fraction,
    halfContentPx: Float = 0f,
    reduceMotion: Boolean = false,
    onHeight: (Float) -> Unit = {},
    content: @Composable ColumnScope.(PlanSheetStop) -> Unit,
) {
    BoxWithConstraints(modifier = modifier) {
        val density = LocalDensity.current
        val total = with(density) { maxHeight.toPx() }
        val halfFitPx = if (halfContentPx > 0f) halfContentPx + with(density) { (HANDLE_DP + Spacing.s3).toPx() } else 0f

        fun heightOf(target: PlanSheetStop): Float =
            when (target) {
                PlanSheetStop.Half -> maxOf(total * halfFraction, halfFitPx).coerceAtMost(total * PlanSheetStop.Full.fraction)
                else -> total * target.fraction
            }
        val heightPx = remember { Animatable(heightOf(stop)) }
        val currentStop by rememberUpdatedState(stop)
        val reportStop by rememberUpdatedState(onStop)
        val scope = rememberCoroutineScope()
        val spec = if (reduceMotion) tween<Float>(150) else spring(dampingRatio = 0.86f, stiffness = Spring.StiffnessMediumLow)

        LaunchedEffect(stop, total, halfFraction, halfFitPx) { heightPx.animateTo(heightOf(stop), spec) }
        val reportHeight by rememberUpdatedState(onHeight)
        LaunchedEffect(Unit) { snapshotFlow { heightPx.value }.collect { reportHeight(it) } }

        fun settle(velocity: Float) {
            val current = heightPx.value
            val stops = PlanSheetStop.entries
            val nearest = stops.minBy { abs(heightOf(it) - current) }
            val target =
                when {
                    velocity < -FLING_PX -> stops.firstOrNull { heightOf(it) > current + 1f } ?: PlanSheetStop.Full
                    velocity > FLING_PX -> stops.lastOrNull { heightOf(it) < current - 1f } ?: PlanSheetStop.Peek
                    else -> nearest
                }
            scope.launch { heightPx.animateTo(heightOf(target), spec) }
            reportStop(target)
        }

        fun dragBy(delta: Float) {
            val min = heightOf(PlanSheetStop.Peek) * 0.8f
            val max = heightOf(PlanSheetStop.Full)
            scope.launch { heightPx.snapTo((heightPx.value - delta).coerceIn(min, max)) }
        }

        val nested =
            remember(total, halfFraction, halfFitPx) {
                object : NestedScrollConnection {
                    override fun onPreScroll(
                        available: Offset,
                        source: NestedScrollSource,
                    ): Offset {
                        // Pulling up while not yet full grows the sheet before the content scrolls.
                        val growing = available.y < 0 && heightPx.value < heightOf(PlanSheetStop.Full) - 1f
                        if (growing && source == NestedScrollSource.UserInput) {
                            dragBy(available.y)
                            return Offset(0f, available.y)
                        }
                        return Offset.Zero
                    }

                    override fun onPostScroll(
                        consumed: Offset,
                        available: Offset,
                        source: NestedScrollSource,
                    ): Offset {
                        // The content is at its top and still being pulled down: shrink the sheet.
                        if (available.y > 0 && source == NestedScrollSource.UserInput) {
                            dragBy(available.y)
                            return Offset(0f, available.y)
                        }
                        return Offset.Zero
                    }

                    override suspend fun onPreFling(available: Velocity): Velocity {
                        val atStop = PlanSheetStop.entries.any { abs(heightOf(it) - heightPx.value) < 1f }
                        if (atStop && currentStop == PlanSheetStop.Full && available.y < 0) return Velocity.Zero
                        if (!atStop) {
                            settle(available.y)
                            return available
                        }
                        return Velocity.Zero
                    }
                }
            }

        val sheetHeight = with(density) { heightPx.value.toDp() }
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(sheetHeight)
                    .shadow(16.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .background(PantopusColors.appSurface)
                    .nestedScroll(nested),
        ) {
            SheetHandle(
                onDrag = ::dragBy,
                onDragStopped = ::settle,
                onExpand = { reportStop(if (currentStop == PlanSheetStop.Peek) PlanSheetStop.Half else PlanSheetStop.Full) },
                onCollapse = { reportStop(PlanSheetStop.Peek) },
            )
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = Spacing.s4)
                        .draggable(
                            state = rememberDraggableState { dragBy(it) },
                            orientation = Orientation.Vertical,
                            onDragStopped = { velocity -> settle(velocity) },
                        ),
            ) {
                content(currentStop)
            }
        }
    }
}

/** The grab handle: drag or fling it between stops; TalkBack gets "Expand" and "Collapse" instead. */
@Composable
private fun SheetHandle(
    onDrag: (Float) -> Unit,
    onDragStopped: (Float) -> Unit,
    onExpand: () -> Unit,
    onCollapse: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(HANDLE_DP)
                .draggable(
                    state = rememberDraggableState { onDrag(it) },
                    orientation = Orientation.Vertical,
                    onDragStopped = { velocity -> onDragStopped(velocity) },
                ).semantics {
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

private const val FLING_PX = 1200f
private val HANDLE_DP = 28.dp

/** Keeps a floating control just above the sheet: the offset from the bottom of the map area. */
fun Modifier.aboveSheet(
    sheetHeightPx: Float,
    gapPx: Float,
): Modifier = this.offset { IntOffset(0, -(sheetHeightPx + gapPx).roundToInt()) }
