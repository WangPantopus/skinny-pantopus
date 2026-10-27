@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.feed

import android.content.Context
import android.view.accessibility.AccessibilityManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.input.pointer.util.addPointerInputChange
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

/*
 * The Pulse page's collapsible header (founder request 2026-10-22: the list or map fills the screen, and nothing on it
 * is removed). Every header item — the Nearby segment row when the tab hands it over, the title row, Nearby |
 * Connections, search, the area bar and the chip rows — is one block over the content. It slides out of view as the
 * person scrolls into the content or drags the map up, and back as they scroll back (Facebook's quick return). Over the
 * map the block itself can be flicked up out of the way, and the reveal capsule pulled down (or tapped) to bring it
 * back. iOS draws the same block (`pulseHeader`) and the same reveal capsule (`pulseHeaderReveal`).
 */

/** How long the header takes to slide (or, with Reduce motion, fade) in or out. */
internal const val PULSE_HEADER_MS = 220

/** A scroll has to keep one direction this far before the header follows it. */
internal val PULSE_HEADER_HYSTERESIS = 12.dp

/** A drag on the header this far up tucks it away… */
private val FLICK_DISTANCE = 24.dp

/** …and a quick flick sooner: once it has gone this far at this speed (per second). */
private val FLICK_MIN_DISTANCE = 10.dp
private val FLICK_SPEED = 900.dp

/** Pulling the reveal capsule down this far brings the header back. */
private val REVEAL_PULL_DISTANCE = 16.dp

/** The reveal capsule's height, until it has been measured. */
private val REVEAL_HEIGHT = 36.dp

/** Whether the header shows, its measured height, and the quick-return rules that move it. */
@Stable
internal class PulseHeaderState {
    /** True while the header is out of view. */
    var isHidden by mutableStateOf(false)
        private set

    /** The header block's height, in px. */
    var heightPx by mutableIntStateOf(0)

    /** The reveal capsule's bottom edge (its top margin included), in px; 0 until it has shown. */
    var revealBottomPx by mutableIntStateOf(0)

    /**
     * False keeps the header in view: a screen reader is on, the search field has focus, or there is nothing to
     * scroll (loading, empty, error, Beacons). Turning it off shows the header.
     */
    var canHide: Boolean = true
        set(value) {
            field = value
            if (!value) show()
        }

    /** Travel in the current scroll direction, in px: negative while the content moves up. */
    private var travel = 0f

    fun show() {
        travel = 0f
        isHidden = false
    }

    fun hide() {
        travel = 0f
        if (canHide) isHidden = true
    }

    /**
     * The list scrolled by [delta] px (negative: its content moved up, the person reading on). A direction toggles the
     * header once it has kept going for [thresholdPx]; turning back starts the count again. Near the top of the list
     * ([nearTop]) the header always shows.
     */
    fun onListScroll(
        delta: Float,
        nearTop: Boolean,
        thresholdPx: Float,
    ) {
        if (nearTop) {
            show()
            return
        }
        if (delta == 0f) return
        if (travel != 0f && (travel < 0f) != (delta < 0f)) travel = 0f
        travel += delta
        if (travel <= -thresholdPx) {
            hide()
        } else if (travel >= thresholdPx) {
            show()
        }
    }

    /** Where the header's bottom edge is drawn at [progress] (0 shown, 1 hidden), in px. */
    fun visibleBottomPx(
        progress: Float,
        reduceMotion: Boolean,
    ): Int =
        when {
            reduceMotion -> if (progress >= 1f) 0 else heightPx
            else -> (heightPx * (1f - progress)).roundToInt()
        }

    /**
     * The top of the map's floating controls at [progress]: the header's bottom edge while it shows, the reveal
     * capsule's while it is hidden ([revealFallbackPx] until the capsule has been measured), moving with the header.
     */
    fun mapTopInsetPx(
        progress: Float,
        reduceMotion: Boolean,
        revealFallbackPx: Int,
    ): Int {
        val reveal = revealBottomPx.takeIf { it > 0 } ?: revealFallbackPx
        return when {
            reduceMotion -> if (progress >= 1f) reveal else heightPx
            else -> (heightPx + (reveal - heightPx) * progress).roundToInt()
        }
    }
}

@Composable
internal fun rememberPulseHeaderState(): PulseHeaderState = remember { PulseHeaderState() }

/**
 * True while the list has scrolled less than [headerHeightPx] from its top: its top inset still shows, and would be a
 * blank band without the header. Measured from the first row's position, since a short first row stops being the
 * "first visible item" well before that.
 */
internal fun LazyListState.isNearTop(headerHeightPx: Int): Boolean {
    val info = layoutInfo
    val first = info.visibleItemsInfo.firstOrNull() ?: return true
    if (first.index != 0) return false
    // The first row's top, from the viewport's top edge, and how far the list has scrolled.
    val firstRowTop = first.offset - info.viewportStartOffset
    return info.beforeContentPadding - firstRowTop < headerHeightPx
}

/**
 * Quick return for a list under the header: the connection its container installs (`Modifier.nestedScroll`) hides
 * the header once the posts have scrolled up [PULSE_HEADER_HYSTERESIS] and brings it back after as much down, and
 * near the top (however the list got there) the header shows. A null [state] (no collapsible header) does nothing.
 */
@Composable
internal fun rememberPulseHeaderScroll(
    state: PulseHeaderState?,
    listState: LazyListState,
): NestedScrollConnection {
    val thresholdPx = with(LocalDensity.current) { PULSE_HEADER_HYSTERESIS.toPx() }
    LaunchedEffect(state, listState) {
        if (state == null) return@LaunchedEffect
        snapshotFlow { listState.isNearTop(state.heightPx) }
            .distinctUntilChanged()
            .collect { nearTop -> if (nearTop) state.show() }
    }
    return remember(state, listState, thresholdPx) {
        object : NestedScrollConnection {
            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource,
            ): Offset {
                if (state != null) state.onListScroll(consumed.y, listState.isNearTop(state.heightPx), thresholdPx)
                return Offset.Zero
            }
        }
    }
}

/** The capsule's bottom edge before it has been measured, in px. */
@Composable
internal fun revealFallbackBottomPx(): Int = with(LocalDensity.current) { (Spacing.s2 + REVEAL_HEIGHT).roundToPx() }

private enum class PulseHeaderSlot { Header, Content }

/**
 * The [headerItems] block pinned over the full-size [content]. The header is measured first, so the content is laid out
 * with its height from the first frame (a list's top inset, a state's top padding). Hiding translates the block up
 * by its own height (with [reduceMotion], fades it and then moves it out of the way); it never relayouts, so the map
 * under it never resizes. With [flickEnabled] (the map, where the header may hide), a mostly vertical drag on the
 * block follows the finger up and tucks it away once it has gone [FLICK_DISTANCE] or been flicked; let go sooner, it
 * springs back. Over the list it stays put: hidden at the top of the posts it would leave a blank band.
 */
@Composable
internal fun PulseHeaderLayout(
    state: PulseHeaderState,
    progress: () -> Float,
    reduceMotion: Boolean,
    headerItems: @Composable ColumnScope.() -> Unit,
    content: @Composable (headerHeight: Dp) -> Unit,
    modifier: Modifier = Modifier,
    flickEnabled: Boolean = false,
) {
    // How far up a finger has pulled the header, in px (≤ 0): it eases back to 0 as the header slides away or back.
    val drag = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(flickEnabled) { if (!flickEnabled) drag.snapTo(0f) }
    SubcomposeLayout(modifier = modifier.fillMaxSize()) { constraints ->
        val width = constraints.maxWidth
        val height = constraints.maxHeight
        val headerPlaceables =
            subcompose(PulseHeaderSlot.Header) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .onSizeChanged { state.heightPx = it.height }
                            .graphicsLayer { headerMotion(progress(), reduceMotion, drag.value) }
                            .background(PantopusColors.appBg)
                            // A touch between the header's controls stays on the header, as it did when the header
                            // sat above the content: it doesn't pan the map or scroll the posts underneath.
                            .pointerInput(flickEnabled, reduceMotion) {
                                if (flickEnabled) {
                                    val settle = tween<Float>(PULSE_HEADER_MS, easing = EaseOut)
                                    detectHeaderFlick(
                                        onDrag = { up ->
                                            if (!reduceMotion) {
                                                scope.launch(start = CoroutineStart.UNDISPATCHED) { drag.snapTo(up) }
                                            }
                                        },
                                        onFlick = {
                                            state.hide()
                                            // Eases off as the slide takes over, the same curve: one movement.
                                            scope.launch { drag.animateTo(0f, settle) }
                                        },
                                        onRelease = { scope.launch { drag.animateTo(0f, settle) } },
                                    )
                                } else {
                                    awaitPointerEventScope { while (true) awaitPointerEvent() }
                                }
                            }
                            .testTag("pulseHeader"),
                    content = headerItems,
                )
            }.map { it.measure(Constraints(minWidth = width, maxWidth = width, maxHeight = height)) }
        val headerHeight = headerPlaceables.maxOfOrNull { it.height } ?: 0
        val contentPlaceables =
            subcompose(PulseHeaderSlot.Content) { content(headerHeight.toDp()) }
                .map { it.measure(constraints) }
        layout(width, height) {
            // The header reads first (it is placed first) and draws over the content.
            headerPlaceables.forEach { it.place(0, 0, zIndex = 1f) }
            contentPlaceables.forEach { it.place(0, 0) }
        }
    }
}

private fun GraphicsLayerScope.headerMotion(
    progress: Float,
    reduceMotion: Boolean,
    drag: Float,
) {
    if (reduceMotion) {
        alpha = 1f - progress
        // Faded out, it moves away too, so it stops taking touches.
        translationY = if (progress >= 1f) -size.height else 0f
    } else {
        translationY = -progress * size.height + drag
    }
}

/**
 * A mostly vertical drag on the header: [onDrag] with how far up it has gone (px, ≤ 0) while it follows the finger,
 * then [onFlick] once it is [FLICK_DISTANCE] up or flicked up fast, or [onRelease] if the finger lets go first (a fast
 * upward flick at the release still counts). A drag that a control under the finger takes first, such as a chip row
 * scrolling sideways, stays with it; once this takes the drag it consumes it, which cancels the press on the button
 * the finger started on.
 */
private suspend fun PointerInputScope.detectHeaderFlick(
    onDrag: (Float) -> Unit,
    onFlick: () -> Unit,
    onRelease: () -> Unit,
) {
    val flick = FlickThresholds(FLICK_DISTANCE.toPx(), FLICK_MIN_DISTANCE.toPx(), FLICK_SPEED.toPx())
    try {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val velocity = VelocityTracker().apply { addPointerInputChange(down) }
            val moved = awaitVerticalSlop(down.id, velocity) ?: return@awaitEachGesture
            if (!followHeaderDrag(down.id, moved, velocity, flick, onDrag, onFlick)) onRelease()
        }
    } finally {
        // Cancelled mid-drag (the map closed, the search took focus): the header settles back.
        onRelease()
    }
}

/** How far up (px) a drag on the header tucks it away, and the shorter, faster flick (px, px per second) that does. */
private class FlickThresholds(
    val hide: Float,
    val minimum: Float,
    val speed: Float,
) {
    fun isFlick(
        moved: Offset,
        velocityY: Float,
    ): Boolean = moved.y <= -minimum && velocityY <= -speed
}

/**
 * Waits for pointer [id] to move past the touch slop and returns how far it has gone if that is mostly up or down (the
 * drag is the header's from then on). Null when it lifts first, goes sideways, or a control under it takes the drag.
 */
private suspend fun AwaitPointerEventScope.awaitVerticalSlop(
    id: PointerId,
    velocity: VelocityTracker,
): Offset? {
    var moved = Offset.Zero
    var change: PointerInputChange
    do {
        change = awaitPointerEvent().changes.firstOrNull { it.id == id } ?: return null
        if (!change.pressed || change.isConsumed) return null
        moved += change.positionChange()
        velocity.addPointerInputChange(change)
    } while (moved.getDistance() < viewConfiguration.touchSlop)
    if (abs(moved.y) <= abs(moved.x)) return null
    change.consume()
    return moved
}

/**
 * Follows the header's drag by pointer [id], [moved] so far, until it lifts: [onDrag] while it follows the finger, and
 * [onFlick] once [flick] says it has gone far or fast enough (or at the release, for a fast flick). Returns whether it
 * was flicked away.
 */
private suspend fun AwaitPointerEventScope.followHeaderDrag(
    id: PointerId,
    moved: Offset,
    velocity: VelocityTracker,
    flick: FlickThresholds,
    onDrag: (Float) -> Unit,
    onFlick: () -> Unit,
): Boolean {
    var travel = moved
    var flicked = false
    var pressed = true
    while (pressed) {
        val change = awaitPointerEvent().changes.firstOrNull { it.id == id } ?: return flicked
        pressed = change.pressed
        travel += change.positionChange()
        velocity.addPointerInputChange(change)
        change.consume()
        if (flicked) continue
        if (flick.isFlick(travel, velocity.calculateVelocity().y) || (pressed && travel.y <= -flick.hide)) {
            flicked = true
            onFlick()
        } else if (pressed) {
            onDrag(min(0f, travel.y))
        }
    }
    return flicked
}

/**
 * Map mode, header hidden: a small capsule at the top — a chevron and "Pulse · <the active intent or topic>" — that
 * brings the header back when tapped or pulled down. List mode doesn't need it: a small scroll back shows the header.
 */
@Composable
internal fun PulseHeaderReveal(
    visible: Boolean,
    label: String,
    reduceMotion: Boolean,
    onReveal: () -> Unit,
    onMeasured: (bottomPx: Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val spec = tween<Float>(PULSE_HEADER_MS)
    val reveal by rememberUpdatedState(onReveal)
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter =
            if (reduceMotion) {
                fadeIn(spec)
            } else {
                fadeIn(spec) + slideInVertically(tween(PULSE_HEADER_MS)) { -it }
            },
        exit =
            if (reduceMotion) {
                fadeOut(spec)
            } else {
                fadeOut(spec) + slideOutVertically(tween(PULSE_HEADER_MS)) { -it }
            },
    ) {
        val shape = RoundedCornerShape(Radii.pill)
        Row(
            modifier =
                Modifier
                    .onSizeChanged { onMeasured(it.height) }
                    .padding(top = Spacing.s2)
                    .shadow(elevation = 4.dp, shape = shape)
                    .clip(shape)
                    .background(PantopusColors.appSurface.copy(alpha = 0.94f))
                    .border(1.dp, PantopusColors.appBorder, shape)
                    // Pulled down, it brings the header back too, as a tap does.
                    .pointerInput(Unit) { detectRevealPull { reveal() } }
                    .clickable(role = Role.Button, onClick = onReveal)
                    .heightIn(min = REVEAL_HEIGHT)
                    .padding(horizontal = Spacing.s3)
                    .semantics { contentDescription = "Show the Pulse header" }
                    .testTag("pulseHeaderReveal"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appText,
            )
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** A mostly downward drag on the reveal capsule: [onPull] once it has gone [REVEAL_PULL_DISTANCE]. */
private suspend fun PointerInputScope.detectRevealPull(onPull: () -> Unit) {
    val pullDistance = REVEAL_PULL_DISTANCE.toPx()
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        if (awaitPull(down.id, pullDistance)) onPull()
    }
}

/** Whether pointer [id] is pulled [distance] px down, mostly vertically, before it lifts (that move is consumed). */
private suspend fun AwaitPointerEventScope.awaitPull(
    id: PointerId,
    distance: Float,
): Boolean {
    var moved = Offset.Zero
    while (true) {
        val change = awaitPointerEvent().changes.firstOrNull { it.id == id }
        if (change == null || !change.pressed) return false
        moved += change.positionChange()
        if (moved.y >= distance && moved.y > abs(moved.x)) {
            change.consume()
            return true
        }
    }
}

/** Whether a screen reader that explores by touch (TalkBack) is on; it keeps the header in view. */
@Composable
internal fun rememberTouchExplorationEnabled(): Boolean {
    val context = LocalContext.current
    val manager = remember(context) { context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager }
    var enabled by remember(manager) { mutableStateOf(manager?.isTouchExplorationEnabled == true) }
    DisposableEffect(manager) {
        val listener = AccessibilityManager.TouchExplorationStateChangeListener { enabled = it }
        manager?.addTouchExplorationStateChangeListener(listener)
        onDispose { manager?.removeTouchExplorationStateChangeListener(listener) }
    }
    return enabled
}
