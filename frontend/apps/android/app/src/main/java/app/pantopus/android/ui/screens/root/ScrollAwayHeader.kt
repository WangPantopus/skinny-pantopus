package app.pantopus.android.ui.screens.root

import android.view.View
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.SubcomposeMeasureScope
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.offset
import app.pantopus.android.ui.screens.feed.PULSE_HEADER_HYSTERESIS
import app.pantopus.android.ui.screens.feed.PULSE_HEADER_MS
import app.pantopus.android.ui.screens.feed.rememberTouchExplorationEnabled
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlin.math.roundToInt

/*
 * The page gets the whole screen while you read (founder request 2026-11-07, as on iPhone): a screen's header slides
 * away once its page scrolls down past its top (and past the header's own height), and comes back only near the top of
 * the page, not on a scroll up as the tab bar does ([TabBarScrollState]). Another tab, page or screen starts with it in
 * view: the state lives with the screen. The page runs under the header, so it gains the header's room without moving,
 * as under the Pulse header (`PulseHeaderLayout`, which keeps its own rules).
 *
 * Headers move only on the signed-in tabs' pages ([ProvideScrollAwayHeaders]), at phone width and with TalkBack off. A
 * page in a dialog or a sheet (another window) keeps its header, as do forms and chats, which don't use this.
 * iOS: `ScrollAwayHeader.swift` and `RootTabBarScrollWatcher`.
 */

/** The header slides away only this far down its page, at least, so a page's top reads with its header (iOS too). */
private val HEADER_HIDE_OFFSET = 120.dp

/** Windows this wide or wider keep every header, as iOS does at regular width (iPad, the open Duo). */
private const val SCROLL_AWAY_MAX_WIDTH_DP = 600

/**
 * Whether headers under it may slide away: [enabled] at phone width with TalkBack off, for pages in [rootView]'s window.
 * Outside [ProvideScrollAwayHeaders] (previews, snapshots, other screens) every header stays.
 */
internal data class ScrollAwayHeaders(
    val enabled: Boolean,
    val rootView: View?,
)

internal val LocalScrollAwayHeaders = compositionLocalOf { ScrollAwayHeaders(enabled = false, rootView = null) }

/** The header over the page being composed, for [ScrollAwayHeaderPage]; null outside a [ScrollAwayHeaderLayout]. */
private val LocalScrollAwayHeaderState = staticCompositionLocalOf<ScrollAwayHeaderState?> { null }

/** Lets the headers of the screens in [content] slide away (the signed-in tabs). */
@Composable
internal fun ProvideScrollAwayHeaders(content: @Composable () -> Unit) {
    val enabled = !rememberTouchExplorationEnabled() && LocalConfiguration.current.screenWidthDp < SCROLL_AWAY_MAX_WIDTH_DP
    val view = LocalView.current
    CompositionLocalProvider(LocalScrollAwayHeaders provides ScrollAwayHeaders(enabled, view), content = content)
}

/**
 * Whether a screen's header is away, and what moves it (iOS `RootTabBarScrollWatcher`). The person scrolling the page
 * down a step ([PULSE_HEADER_HYSTERESIS], as for the tab bar) once it is [HEADER_HIDE_OFFSET] down and past the header's
 * height sends it away; the page back within the header's height of its top, however it got there, brings it back.
 * Scrolling up doesn't, and nothing but the person's own scrolling sends it away (not a page jumping to a row).
 */
@Stable
internal class ScrollAwayHeaderState {
    /** The header has slid away. */
    var isAway by mutableStateOf(false)
        private set

    /** The header's height, in px. */
    var heightPx by mutableIntStateOf(0)
        internal set

    /** How far the page is from its top, in px ([Int.MAX_VALUE] well down it); null while no page has said. */
    private var page by mutableStateOf<(() -> Int)?>(null)

    /** The person's scrolling down the page since it last turned, in px. */
    private var travel = 0f

    /** False keeps the header in view (another window, a wide screen, TalkBack); turning it off brings it back. */
    var canHide = false
        internal set(value) {
            field = value
            if (!value) show()
        }

    /** Brings the header back. */
    fun show() {
        travel = 0f
        if (isAway) isAway = false
    }

    internal fun pageFromTop(): Int? = page?.invoke()

    /** [source] says where the page is from now on; the function returned stops it. */
    internal fun follow(source: () -> Int): () -> Unit {
        page = source
        return { if (page === source) page = null }
    }

    /**
     * The page moved [consumedY] px under the person's finger or fling (negative: down the page), and [availableY] px
     * were left over (positive: pulled down past its top). [stepPx] is a step; [hideOffsetPx] the least way down.
     */
    internal fun onScrolled(
        consumedY: Float,
        availableY: Float,
        stepPx: Float,
        hideOffsetPx: Int,
    ) {
        if (consumedY == 0f) {
            if (availableY > 0f) show()
            return
        }
        if (consumedY > 0f) {
            // Up the page: the header waits for the top.
            travel = 0f
            return
        }
        travel -= consumedY
        if (isAway || !canHide || travel < stepPx) return
        val fromTop = pageFromTop() ?: return
        if (fromTop >= maxOf(hideOffsetPx, heightPx + stepPx.roundToInt())) isAway = true
    }

    /** The page is [fromTop] px from its top (null: no page): within the header's height of it, the header is back. */
    internal fun onPageMoved(fromTop: Int?) {
        if (fromTop == null || fromTop <= heightPx) show()
    }
}

@Composable
private fun rememberScrollAwayHeaderState(): ScrollAwayHeaderState = remember { ScrollAwayHeaderState() }

/** Under a [ScrollAwayHeaderLayout], this column is the page: where it is moves the header. */
@Composable
internal fun ScrollAwayHeaderPage(state: ScrollState) {
    val header = LocalScrollAwayHeaderState.current ?: return
    DisposableEffect(header, state) {
        val stop = header.follow { state.value }
        onDispose { stop() }
    }
}

/** Under a [ScrollAwayHeaderLayout], this list is the page: where it is moves the header. */
@Composable
internal fun ScrollAwayHeaderPage(state: LazyListState) {
    val header = LocalScrollAwayHeaderState.current ?: return
    DisposableEffect(header, state) {
        val stop = header.follow { state.distanceFromTop() }
        onDispose { stop() }
    }
}

/** How far the list is from its top, in px; [Int.MAX_VALUE] once its first item is out of view. */
private fun LazyListState.distanceFromTop(): Int {
    val info = layoutInfo
    val first = info.visibleItemsInfo.firstOrNull() ?: return 0
    if (first.index != 0) return Int.MAX_VALUE
    return (info.beforeContentPadding - (first.offset - info.viewportStartOffset)).coerceAtLeast(0)
}

private enum class ScrollAwaySlot { Header, Pinned, Content }

/**
 * [header] over the full-size [content], whose page pads its top by the `top` it is handed so its first line starts
 * below the header and runs under it. While the page scrolls down the header slides up out of view and the page fills
 * its room without moving (founder request 2026-11-07; iOS `scrollAwayHeader`). Where headers stay (TalkBack, a wide
 * window, a dialog, previews) `top` is 0 and the page is laid out below the header, exactly as before. [pinned] sits
 * under the header and stays in view, moving up into the header's place (a list's filter strip, as on iPhone). The page
 * says where it is with [ScrollAwayHeaderPage]. [headerBackground] and [pinnedBackground] fill behind the header and
 * [pinned] so the page never shows through, and a touch on them stays there, as when they sat above the page. With
 * [slides] off the header stays in place (a profile preview's banner).
 */
@Composable
internal fun ScrollAwayHeaderLayout(
    header: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    headerBackground: Color = PantopusColors.appBg,
    pinned: (@Composable () -> Unit)? = null,
    pinnedBackground: Color = headerBackground,
    slides: Boolean = true,
    content: @Composable (top: Dp) -> Unit,
) {
    val state = rememberScrollAwayHeaderState()
    val headers = LocalScrollAwayHeaders.current
    val canHide = slides && headers.enabled && headers.rootView === LocalView.current
    SideEffect { state.canHide = canHide }
    val reduceMotion = rememberReduceMotion()
    val away = state.isAway
    val progress =
        animateFloatAsState(
            targetValue = if (away) 1f else 0f,
            animationSpec = tween(durationMillis = PULSE_HEADER_MS, easing = EaseOut),
            label = "scrollAwayHeader",
        )
    val connection = rememberScrollAwayConnection(state)
    // Back near the top of the page, however it got there (a tab tapped again scrolls it up): the header comes back.
    LaunchedEffect(state, canHide) {
        if (canHide) snapshotFlow { state.pageFromTop() }.collect { state.onPageMoved(it) }
    }
    val headerSlot: @Composable () -> Unit = {
        OverPage(
            background = headerBackground,
            motion = { headerMotion(progress.value, reduceMotion) },
            // Away, it isn't there for accessibility services either.
            modifier =
                Modifier
                    .onSizeChanged { state.heightPx = it.height }
                    .then(if (away) Modifier.clearAndSetSemantics { } else Modifier),
            content = header,
        )
    }
    val pinnedSlot: (@Composable () -> Unit)? =
        pinned?.let { strip ->
            @Composable {
                OverPage(
                    background = pinnedBackground,
                    motion = { translationY = -pinnedShift(progress.value, reduceMotion) * state.heightPx },
                    content = strip,
                )
            }
        }
    SubcomposeLayout(modifier = modifier.clipToBounds().nestedScroll(connection)) { constraints ->
        placeOverPage(constraints, pageRunsUnder = canHide, headerSlot, pinnedSlot) { top ->
            CompositionLocalProvider(LocalScrollAwayHeaderState provides state) { content(top) }
        }
    }
}

/** Hands the page's scrolling to [state]; it never takes any of it, so the tab bar and pull to refresh get theirs. */
@Composable
private fun rememberScrollAwayConnection(state: ScrollAwayHeaderState): NestedScrollConnection {
    val density = LocalDensity.current
    val stepPx = with(density) { PULSE_HEADER_HYSTERESIS.toPx() }
    val hideOffsetPx = with(density) { HEADER_HIDE_OFFSET.roundToPx() }
    return remember(state, stepPx, hideOffsetPx) {
        object : NestedScrollConnection {
            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource,
            ): Offset {
                state.onScrolled(consumed.y, available.y, stepPx, hideOffsetPx)
                return Offset.Zero
            }
        }
    }
}

/**
 * A piece drawn over the page (the header, or the strip pinned under it): its [background], its [motion], and touches
 * on its own space that stay there. A column, as the header sat in above the page, so a header of several pieces (a bar
 * and its rule) stacks.
 */
@Composable
private fun OverPage(
    background: Color,
    motion: GraphicsLayerScope.() -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .graphicsLayer(motion)
                .background(background)
                .blocksTouchesBelow(),
    ) { content() }
}

/**
 * Measures and places [header], the [pinned] strip under it, and the [page]. While the header may slide away
 * ([pageRunsUnder]) the page runs under them and pads its own top by the `top` it is handed; otherwise it sits below
 * them, as it always did, so nothing on it is ever behind them.
 */
private fun SubcomposeMeasureScope.placeOverPage(
    constraints: Constraints,
    pageRunsUnder: Boolean,
    header: @Composable () -> Unit,
    pinned: (@Composable () -> Unit)?,
    page: @Composable (top: Dp) -> Unit,
): MeasureResult {
    val width = constraints.maxWidth
    val chrome = Constraints(minWidth = width, maxWidth = width, maxHeight = constraints.maxHeight)
    val headerPlaceables = subcompose(ScrollAwaySlot.Header, header).map { it.measure(chrome) }
    val headerHeight = headerPlaceables.maxOfOrNull { it.height } ?: 0
    val pinnedPlaceables = pinned?.let { strip -> subcompose(ScrollAwaySlot.Pinned, strip).map { it.measure(chrome) } }.orEmpty()
    val chromeHeight = headerHeight + (pinnedPlaceables.maxOfOrNull { it.height } ?: 0)
    val top = if (pageRunsUnder) chromeHeight.toDp() else 0.dp
    val pageY = if (pageRunsUnder) 0 else chromeHeight
    val pagePlaceables = subcompose(ScrollAwaySlot.Content) { page(top) }.map { it.measure(constraints.offset(vertical = -pageY)) }
    val height = if (constraints.hasBoundedHeight) constraints.maxHeight else pageY + (pagePlaceables.maxOfOrNull { it.height } ?: 0)
    return layout(width, height) {
        // The header reads first and draws over the page; the pinned strip under it, over the page too.
        headerPlaceables.forEach { it.place(0, 0, zIndex = 2f) }
        pinnedPlaceables.forEach { it.place(0, headerHeight, zIndex = 1f) }
        pagePlaceables.forEach { it.place(0, pageY) }
    }
}

/** Away, the header slides up out of view; with Reduce motion it fades where it is, then moves out of the way. */
private fun GraphicsLayerScope.headerMotion(
    progress: Float,
    reduceMotion: Boolean,
) {
    if (reduceMotion) {
        alpha = 1f - progress
        translationY = if (progress >= 1f) -size.height else 0f
    } else {
        translationY = -progress * size.height
    }
}

/** How much of the header's height the pinned strip has moved up: with it, or (Reduce motion) once it has faded. */
private fun pinnedShift(
    progress: Float,
    reduceMotion: Boolean,
): Float =
    when {
        !reduceMotion -> progress
        progress >= 1f -> 1f
        else -> 0f
    }

/** A touch on the header's own space stays there instead of reaching the page under it; its controls get theirs. */
private fun Modifier.blocksTouchesBelow(): Modifier = pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } }

/** A [PullToRefreshBox] whose indicator comes down from under the header and strips drawn over the page's top [top]. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PullToRefreshUnderHeader(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    top: Dp,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val state = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = modifier,
        state = state,
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = state,
                isRefreshing = isRefreshing,
                modifier = Modifier.align(Alignment.TopCenter).padding(top = top),
            )
        },
        content = content,
    )
}
