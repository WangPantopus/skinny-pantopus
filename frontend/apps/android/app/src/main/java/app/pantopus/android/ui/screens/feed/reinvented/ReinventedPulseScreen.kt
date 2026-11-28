@file:Suppress("MagicNumber")
@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class, androidx.compose.foundation.ExperimentalFoundationApi::class)

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.FloatingActionButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.ui.screens.feed.living.LivingAskBar
import app.pantopus.android.ui.screens.feed.living.LivingAtlasSearch
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentConvergenceListSheet
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentConvergenceState
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentRetakeListSheet
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentRetakeState
import app.pantopus.android.ui.screens.feed.reinvented.after.TogetherStudio
import app.pantopus.android.ui.screens.feed.reinvented.after.TogetherStudioOpener
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow

/**
 * The three rests of the list over the map (PHASE-1 §2 piece 2; on a phone the sheet's rests since PHASE-6 A3). On a
 * wide window: both side by side, the list alone, the map alone.
 */
enum class ReinventedHeight {
    /** The sheet at half, the map above it: how Pulse opens. */
    Middle,

    /** The sheet full, up to under the top line, for reading. */
    List,

    /** The sheet at peek (its header only): the map. */
    Map,
}

/** Where the new Pulse's taps go. */
data class ReinventedPulseActions(
    val onOpenMenu: () -> Unit,
    val onOpenPost: (String) -> Unit,
    /** The viewer, once a Moment or a ring is queued in it. */
    val onWatch: () -> Unit,
    /** + : the Studio, as the Moments tab's + opens it. */
    val onCompose: () -> Unit,
    /** A plan's own screen in Plans. */
    val onOpenPlan: (String) -> Unit,
    /** "Repost with your words": the composer with the post quoted; null leaves it out. */
    val onQuotePost: ((String) -> Unit)? = null,
)

/**
 * "Pulse, reinvented" phase 1 (PHASE-1 §2 pieces 2 to 5; board B1): Pulse as it opens while `pulse_reinvented` is on.
 * The top row (the side menu, the scope pill with the town's name, the chat button), the List | Map switch, the chips
 * the place has, and the list resting over the live map at three heights: the middle (the map across the top third,
 * the list below: how it opens), List (full screen) and Map (full screen). Pull the handle up or down, or tap the
 * switch. Built beside today's feed (`FeedScreen`), which shows whenever the switch is off.
 */
@Composable
fun ReinventedPulseScreen(
    actions: ReinventedPulseActions,
    scrollToTop: Flow<Unit>? = null,
    viewModel: ReinventedPulseViewModel = hiltViewModel(),
    mapModel: ReinventedMapViewModel = hiltViewModel(),
    atlasModel: ReinventedAtlasViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val cards by viewModel.cards.cards.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    ReadsInOrder(viewModel, mapModel, state)
    var height by rememberSaveable { mutableStateOf(ReinventedHeight.Middle) }
    BackHandler(enabled = height != ReinventedHeight.Middle) { height = ReinventedHeight.Middle }
    val listState = rememberLazyListState()
    LaunchedEffect(scrollToTop) {
        scrollToTop?.collect {
            listState.scrollToItem(0)
            height = ReinventedHeight.Middle
        }
    }
    val nowMs = rememberMinuteClock()
    val watch = remember(viewModel, actions) { ReinventedWatch(viewModel, actions.onWatch) }
    var atlas by rememberSaveable { mutableStateOf(false) }
    val atlasState by atlasModel.state.collectAsStateWithLifecycle()
    val atlasHook = rememberAtlasHook(atlas, atlasState, atlasModel) { atlas = it }
    val list: @Composable (Modifier) -> Unit = ReinventedPulseScreenList@{ modifier ->
        if (atlas) {
            ReinventedAtlasList(atlasState, atlasModel::openMoment, atlasModel::loadMore, atlasModel::retry, modifier) {
                LivingAtlasSearch(onOpenOwn = atlasModel::openMoment, onOpenMoment = watch::moment, onOpenPost = actions.onOpenPost)
            }
            return@ReinventedPulseScreenList
        }
        ReinventedListPane(
            pane = ReinventedPane(state, cards, nowMs, listState),
            viewModel = viewModel,
            mapModel = mapModel,
            watch = watch,
            actions = actions,
            onToMiddle = { if (height == ReinventedHeight.List) height = ReinventedHeight.Middle },
            modifier = modifier,
        )
    }
    ReinventedPulseLayout(
        height = height,
        onHeight = { height = it },
        state = state,
        actions = actions,
        onPickChip = viewModel::pickChip,
        onPickReach = viewModel::pickReach,
        onPickCircle = viewModel::pickCircle,
        mapModel = mapModel,
        onOpenMoment = watch::moment,
        onOpenRing = watch::ring,
        atlas = atlasHook,
        list = list,
    )
    ReinventedCardSheets(viewModel.cards, cards, actions.onQuotePost)
    ReinventedAtlasItem(atlasState, atlasModel::close, atlasModel::askDelete, atlasModel::keep, atlasModel::deleteForGood)
    // Phase 3 (CONTRACT 8e): the Retake opened from the list, and the Studio it asks for.
    MomentRetakeListSheet()
    MomentConvergenceListSheet()
    TogetherStudioOpener(actions.onCompose)
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        ReinventedToast(toast, onDismiss = viewModel::dismissToast)
    }
}

/**
 * The reads in their order: the list's first page when the tab first opens (it stays while the person visits other
 * tabs), and only once it has arrived the map's marks and Alive right now. Also the timing line today's Pulse writes
 * ("pulse"), so the two open times can be laid side by side.
 */
@Composable
private fun ReadsInOrder(
    viewModel: ReinventedPulseViewModel,
    mapModel: ReinventedMapViewModel,
    state: ReinventedPulseState,
) {
    val firstPage by viewModel.firstPage.collectAsStateWithLifecycle()
    app.pantopus.android.core.perf.ReportContentShown(
        "pulse",
        state.load == ReinventedPulseState.Load.Loaded || state.load == ReinventedPulseState.Load.NeedsPlace,
    )
    LaunchedEffect(Unit) { if (state.items.isEmpty()) viewModel.refresh() }
    LaunchedEffect(firstPage) {
        if (firstPage) {
            mapModel.allow()
            viewModel.readStrip()
        }
    }
}

/** My Atlas's hook: entering it reads its first page and the kept Moments in the box the map already shows. */
@Composable
private fun rememberAtlasHook(
    on: Boolean,
    state: ReinventedAtlasState,
    model: ReinventedAtlasViewModel,
    onToggle: (Boolean) -> Unit,
): ReinventedAtlasHook {
    var lastBox by remember { mutableStateOf<ReinventedBox?>(null) }
    val pins = remember(state.onMap) { state.onMap.mapNotNull { it.asKeptPin() } }
    return ReinventedAtlasHook(
        on = on,
        pins = pins,
        onToggle = { now ->
            onToggle(now)
            if (now) {
                model.open()
                lastBox?.let(model::moved)
            }
        },
        onMoved = { box ->
            lastBox = box
            if (on) model.moved(box)
        },
        onOpen = model::openMoment,
    )
}

/** The time now, a minute at a time, for each Moment's time left. */
@Composable
private fun rememberMinuteClock(): Long {
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(MINUTE_MS)
            nowMs = System.currentTimeMillis()
        }
    }
    return nowMs
}

/** Plays a Moment, or a person's ring, in today's viewer. */
private class ReinventedWatch(
    private val viewModel: ReinventedPulseViewModel,
    private val onWatch: () -> Unit,
) {
    fun moment(moment: MomentDto) {
        // A Moment of a Retake opens the Retake (CONTRACT 8e), not the viewer.
        if (MomentRetakeState.opens(moment)) return
        // So does a Moment of a convergence's piece (8h).
        if (MomentConvergenceState.opens(moment)) return
        viewModel.watch(moment)
        onWatch()
    }

    fun ring(ring: MomentRingDto) {
        viewModel.watch(ring)
        onWatch()
    }
}

/** What the list pane draws. */
private data class ReinventedPane(
    val state: ReinventedPulseState,
    val cards: List<PulsePostCardContent>,
    val nowMs: Long,
    val listState: LazyListState,
)

/** The list with Alive right now over it, pulled down to read everything again. */
@OptIn(ExperimentalMaterialApi::class)
@Composable
@Suppress("LongParameterList") // The pane, its two view-models, and where its taps go.
private fun ReinventedListPane(
    pane: ReinventedPane,
    viewModel: ReinventedPulseViewModel,
    mapModel: ReinventedMapViewModel,
    watch: ReinventedWatch,
    actions: ReinventedPulseActions,
    onToMiddle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state = pane.state
    val strip by viewModel.strip.collectAsStateWithLifecycle()
    val pull =
        rememberPullRefreshState(refreshing = state.refreshing, onRefresh = {
            viewModel.refresh()
            mapModel.refresh()
            viewModel.readStrip()
        })
    val listActions =
        ReinventedListActions(
            cards = reinventedCardActions(viewModel.cards, actions.onOpenPost),
            onOpenMoment = watch::moment,
            onRefresh = viewModel::refresh,
            onLoadMore = viewModel::loadMore,
            onShowCircle = { viewModel.pickReach(ReinventedPulseViewModel.CLOSE, state.miles) },
            onShowOnMap = { point ->
                mapModel.flyTo(point)
                onToMiddle()
            },
            onExplore = { viewModel.pickReach(ReinventedPulseViewModel.EXPLORE, state.miles) },
            onKeepExploring = viewModel::keepExploring,
            viewer = viewModel.viewer,
        )
    val stripActions = ReinventedStripActions(onOpenMoment = watch::moment, onOpenPlan = actions.onOpenPlan, onOpenRing = watch::ring)
    Box(modifier.pullRefresh(pull)) {
        ReinventedPulseList(
            state,
            pane.cards,
            pane.nowMs,
            pane.listState,
            listActions,
            // Alive right now is local: Explore has none.
            top =
                strip?.takeIf { !it.isEmpty && state.reach != ReinventedPulseViewModel.EXPLORE }?.let { alive ->
                    { ReinventedAliveStrip(alive, stripActions) }
                },
        )
        PullRefreshIndicator(state.refreshing, pull, Modifier.align(Alignment.TopCenter))
    }
}

/**
 * The map and the list: on a phone the map behind and the list over it at its height, the header over both, and +; on a
 * wide window (a tablet, an open foldable) the list beside the map ([ReinventedSideBySide]).
 */
@Composable
// What the layout shows, its height, and where each part's taps go; the phone's and the wide window's parts, built once.
@Suppress("LongParameterList", "LongMethod")
private fun ReinventedPulseLayout(
    height: ReinventedHeight,
    onHeight: (ReinventedHeight) -> Unit,
    state: ReinventedPulseState,
    actions: ReinventedPulseActions,
    onPickChip: (String) -> Unit,
    onPickReach: (String, Int) -> Unit,
    onPickCircle: (String, String) -> Unit,
    mapModel: ReinventedMapViewModel,
    onOpenMoment: (MomentDto) -> Unit,
    onOpenRing: (MomentRingDto) -> Unit,
    atlas: ReinventedAtlasHook,
    list: @Composable (Modifier) -> Unit,
) {
    val pulseMap by mapModel.state.collectAsStateWithLifecycle()
    // In My Atlas the map's pins are the person's own kept Moments.
    val mapState = if (atlas.on) pulseMap.copy(items = atlas.pins, deck = atlas.pins, atlas = true) else pulseMap
    val flight by mapModel.flight.collectAsStateWithLifecycle()
    val camera = rememberReinventedCamera()
    // A card swiped to, or a place tapped in the list: the map glides there.
    LaunchedEffect(flight) {
        val to = flight?.point ?: return@LaunchedEffect
        camera.animate(CameraUpdateFactory.newLatLng(LatLng(to.latitude, to.longitude)), FLY_MS)
    }
    BoxWithConstraints(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).semantics { testTagsAsResourceId = true }.testTag("reinventedPulse"),
    ) {
        val wide = reinventedSideBySide(maxWidth)
        val open = { item: ReinventedMapItem -> openPin(item, atlas, actions, onOpenMoment, onOpenRing) }
        // + opens a Studio with nothing of phase 3 chosen (a Retake's frame opens it through TogetherStudioOpener).
        val onAdd = {
            TogetherStudio.reset()
            actions.onCompose()
        }
        val parts =
            ReinventedLayoutParts(
                header = { modifier ->
                    ReinventedPulseHeader(
                        height = height,
                        state = state,
                        onOpenMenu = actions.onOpenMenu,
                        onHeight = onHeight,
                        onPickChip = onPickChip,
                        onPickReach = onPickReach,
                        time = mapState.time,
                        onPickTime = mapModel::pickTime,
                        atlas = atlas.on,
                        onAtlas = atlas.onToggle,
                        sideBySide = wide,
                        onPickCircle = onPickCircle,
                        modifier = modifier,
                    )
                },
                map = { bottomPadding ->
                    ReinventedPulseMap(
                        state = mapState,
                        camera = camera,
                        focused = mapState.focused.takeIf { height == ReinventedHeight.Map },
                        bottomPadding = bottomPadding,
                        onMoved = { box ->
                            atlas.onMoved(box)
                            if (!atlas.on) mapModel.moved(box)
                        },
                        onOpen = open,
                    )
                },
                timeRow =
                    if (atlas.on) {
                        null
                    } else {
                        { modifier ->
                            Column(modifier) {
                                ReinventedTimeRow(mapState.time, mapModel::pickTime)
                                LivingAskBar()
                            }
                        }
                    },
                mapExtras = { guessTop, deck ->
                    if (!atlas.on) {
                        val at = Modifier.align(Alignment.TopStart).padding(top = guessTop + Spacing.s2, start = Spacing.s4)
                        ReinventedGuessSpotsChip(mapState, at)
                    }
                    // On a phone the sheet's peek line stands where the deck was (PHASE-6 A): the deck is the wide map's.
                    deck?.let { ReinventedPeekDeck(deck = mapState.deck, onFocus = mapModel::focus, onOpen = open, modifier = it) }
                },
                add = { modifier -> AddButton(onAdd, modifier) },
                onAdd = onAdd,
                list = list,
            )
        if (wide) {
            ReinventedSideBySide(height, parts)
        } else {
            ReinventedOverMap(height, onHeight, maxHeight, reinventedSheetLine(mapState.items.size, mapState.time, atlas.on), parts)
        }
    }
}

/**
 * On a phone (PHASE-6 A): the map is the screen, the header over it, and the list a sheet over the map at three rests
 * ([ReinventedSheet]), moved only by its header. + rides over the sheet up to half and sits in its header at full.
 */
@Composable
private fun BoxScope.ReinventedOverMap(
    height: ReinventedHeight,
    onHeight: (ReinventedHeight) -> Unit,
    full: Dp,
    line: String,
    parts: ReinventedLayoutParts,
) {
    val density = LocalDensity.current
    var headerPx by remember { mutableIntStateOf(0) }
    val header = with(density) { headerPx.toDp() }
    // PHASE-6 A3: the half rest against the window, so today's tab bar sliding away never moves the sheet.
    val (half, placed) = rememberReinventedHalf()
    Box(Modifier.matchParentSize().then(placed))
    val sheet = rememberReinventedSheet(height, onHeight, header, full, half)
    val settled = sheet.settledValue
    // The map keeps its middle above the part the sheet covers once it rests (never re-laid while it moves).
    val covered =
        with(density) { full - reinventedSheetTop(settled, header.toPx(), full.toPx(), REINVENTED_SHEET_PEEK.toPx(), half).toDp() }
    parts.map(covered)
    ReinventedSheet(
        sheet = sheet,
        top = header,
        full = full,
        line = line,
        headerEnd = { if (settled == ReinventedHeight.List) ReinventedSheetHeaderAdd(parts.onAdd) },
        list = parts.list,
        half = half,
    )
    parts.header(Modifier.onSizeChanged { headerPx = it.height })
    if (settled == ReinventedHeight.Map) parts.mapExtras(this, header, null)
    // + is ADD_SIZE high, with its own bottom padding under it: its edge stands 12 dp over the sheet's.
    ReinventedSheetAdd(sheet, header, full, ADD_SIZE, parts.add, half)
}

/** + : the Studio, as the Moments tab's + opens it. */
@Composable
private fun AddButton(
    onCompose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FloatingActionButton(
        onClick = onCompose,
        containerColor = PantopusColors.primary600,
        shape = CircleShape,
        modifier =
            modifier
                .padding(end = Spacing.s4, bottom = Spacing.s4)
                .size(ADD_SIZE)
                .testTag("reinventedPulse.add")
                .semantics { contentDescription = "Add a Moment" },
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 26.dp, strokeWidth = 2.6f, tint = Color.White)
    }
}

/** A pin in My Atlas opens its kept Moment there; elsewhere as [openMapItem]. */
private fun openPin(
    item: ReinventedMapItem,
    atlas: ReinventedAtlasHook,
    actions: ReinventedPulseActions,
    onOpenMoment: (MomentDto) -> Unit,
    onOpenRing: (MomentRingDto) -> Unit,
) {
    if (atlas.on && item is ReinventedMapItem.Kept) atlas.onOpen(item.kept.moment) else openMapItem(item, actions, onOpenMoment, onOpenRing)
}

/** A pin on the map: a ring plays its Moments, a mark opens its post, a kept Moment plays, a ticket opens its plan. */
private fun openMapItem(
    item: ReinventedMapItem,
    actions: ReinventedPulseActions,
    onOpenMoment: (MomentDto) -> Unit,
    onOpenRing: (MomentRingDto) -> Unit,
) {
    when (item) {
        is ReinventedMapItem.Ring -> onOpenRing(item.ring)
        is ReinventedMapItem.Mark -> actions.onOpenPost(item.mark.post.id)
        is ReinventedMapItem.Kept -> onOpenMoment(item.kept.moment)
        is ReinventedMapItem.Ticket -> actions.onOpenPlan(item.ticket.id)
    }
}

private val ADD_SIZE = 58.dp
private const val MINUTE_MS = 60_000L
private const val FLY_MS = 600
