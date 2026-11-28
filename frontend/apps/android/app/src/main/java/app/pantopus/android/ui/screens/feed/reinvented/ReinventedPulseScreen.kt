@file:Suppress("MagicNumber")
@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class, androidx.compose.foundation.ExperimentalFoundationApi::class)

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
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
import androidx.compose.runtime.MutableState
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
import app.pantopus.android.data.pulse.ReinventedFilterQuery
import app.pantopus.android.ui.screens.feed.living.LivingAtlasSearch
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentConvergenceListSheet
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentConvergenceState
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentMailItHost
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentPinboardListSheet
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentPinboardState
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
    filtersModel: ReinventedFiltersViewModel = hiltViewModel(),
    followModel: ReinventedFollowViewModel = hiltViewModel(),
) {
    // PHASE-5 B: the filters kept for this person, carried by the list's and the map's first reads.
    ReadsFiltered(filtersModel, viewModel, mapModel, followModel)
    val state by viewModel.state.collectAsStateWithLifecycle()
    val cards by viewModel.cards.cards.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    ReadsInOrder(viewModel, mapModel, state)
    var height by rememberSaveable { mutableStateOf(ReinventedHeight.Middle) }
    BackHandler(enabled = height != ReinventedHeight.Middle) { height = ReinventedHeight.Middle }
    val listState = rememberLazyListState()
    // PHASE-6 B: the list that follows the map keeps its own place; a pin tapped brings its row to the top.
    val followListState = rememberLazyListState()
    val pinPicked = remember { mutableStateOf(false) }
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
    val list: @Composable (Modifier, Boolean) -> Unit = ReinventedPulseScreenList@{ modifier, following ->
        if (atlas) {
            ReinventedAtlasList(atlasState, atlasModel::openMoment, atlasModel::loadMore, atlasModel::retry, modifier) {
                LivingAtlasSearch(onOpenOwn = atlasModel::openMoment, onOpenMoment = watch::moment, onOpenPost = actions.onOpenPost)
            }
            return@ReinventedPulseScreenList
        }
        if (following && state.reach == ReinventedPulseViewModel.AROUND) {
            ReinventedFollowPane(
                FollowPane(followModel, viewModel, mapModel, watch, actions),
                nowMs = nowMs,
                listState = followListState,
                pinPicked = pinPicked,
                modifier = modifier,
            )
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
        filtersModel = filtersModel,
        followModel = followModel,
        onPinPicked = { pinPicked.value = true },
        actions = actions,
        onPickReach = viewModel::pickReach,
        onPickCircle = viewModel::pickCircle,
        mapModel = mapModel,
        onOpenMoment = watch::moment,
        onOpenRing = watch::ring,
        atlas = atlasHook,
        list = list,
    )
    ReinventedCardSheets(viewModel.cards, cards, actions.onQuotePost)
    FollowCardSheets(followModel, actions.onQuotePost)
    ReinventedAtlasItem(atlasState, atlasModel::close, atlasModel::askDelete, atlasModel::keep, atlasModel::deleteForGood)
    // Phase 3 (CONTRACT 8e): the Retake opened from the list, and the Studio it asks for.
    MomentRetakeListSheet()
    MomentConvergenceListSheet()
    MomentPinboardListSheet()
    MomentMailItHost(viewModel.viewer)
    TogetherStudioOpener(actions.onCompose)
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        ReinventedToast(toast, onDismiss = viewModel::dismissToast)
    }
}

/** The following list's posts have their own cards (PHASE-6 B): their menus, Repost sheets and toast. */
@Composable
private fun FollowCardSheets(
    followModel: ReinventedFollowViewModel,
    onQuotePost: ((String) -> Unit)?,
) {
    val cards by followModel.cards.cards.collectAsStateWithLifecycle()
    val toast by followModel.toast.collectAsStateWithLifecycle()
    ReinventedCardSheets(followModel.cards, cards, onQuotePost)
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        ReinventedToast(toast, onDismiss = followModel::dismissToast)
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

/**
 * The filters into the reads (PHASE-5 B): the kept time is the map's before anything is read, and each change of the
 * filters or the time sends the list and the map their CONTRACT 10a fields (none while nothing is on).
 */
@Composable
private fun ReadsFiltered(
    filtersModel: ReinventedFiltersViewModel,
    viewModel: ReinventedPulseViewModel,
    mapModel: ReinventedMapViewModel,
    followModel: ReinventedFollowViewModel,
) {
    // The kept time goes to the map once; until the map has it, the list's first read already carries it.
    val kept = filtersModel.keptTime
    var taken by remember(kept) { mutableStateOf(kept == null) }
    LaunchedEffect(kept) { kept?.let(mapModel::pickTime) }
    val mapState by mapModel.state.collectAsStateWithLifecycle()
    val mapTime = mapState.time
    LaunchedEffect(mapTime) { if (mapTime == kept) taken = true }
    val time = if (taken || kept == null) mapTime else kept
    val filters by filtersModel.filters.collectAsStateWithLifecycle()
    val noPlace by filtersModel.noPlace.collectAsStateWithLifecycle()
    val filtered = filters.query(time, filtersModel.since, list = true)
    // "No place" (PHASE-6 B, CONTRACT 11b) rides with the list's filters only.
    val listQuery = if (noPlace) (filtered ?: ReinventedFilterQuery()).copy(noPlace = true) else filtered
    val mapQuery = filters.query(time, filtersModel.since, list = false)
    val chip = filters.chip() ?: ReinventedPulseViewModel.ALL
    LaunchedEffect(listQuery, chip) {
        viewModel.filter(listQuery, chip)
        followModel.filter(listQuery, chip)
    }
    LaunchedEffect(mapQuery) { mapModel.filter(mapQuery) }
    LaunchedEffect(time) { filtersModel.keep(time) }
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
        // And a pinboard's Moment opens the board (8i).
        if (MomentPinboardState.opens(moment)) return
        viewModel.watch(moment)
        onWatch()
    }

    fun ring(ring: MomentRingDto) {
        viewModel.watch(ring)
        onWatch()
    }

    /** "Tonight in <town>" (8k): the film's Moments, oldest first, as one run. */
    fun run(moments: List<MomentDto>) {
        if (moments.isEmpty()) return
        viewModel.watchRun(moments)
        onWatch()
    }
}

/** What the following list (PHASE-6 B) reads and where its taps go. */
private class FollowPane(
    val follow: ReinventedFollowViewModel,
    val viewModel: ReinventedPulseViewModel,
    val mapModel: ReinventedMapViewModel,
    val watch: ReinventedWatch,
    val actions: ReinventedPulseActions,
)

/**
 * The list while it follows the map: what is on the map now, Alive right now first, pulled down to read again. A first
 * tap on a row lights its pin and the map glides there; a second opens it, as a row of the whole list does. A pin tapped
 * on the map ([pinPicked]) brings the list back to its top once the new area's rows are there (that pin's row first).
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
private fun ReinventedFollowPane(
    pane: FollowPane,
    nowMs: Long,
    listState: LazyListState,
    pinPicked: MutableState<Boolean>,
    modifier: Modifier = Modifier,
) {
    val strip by pane.viewModel.strip.collectAsStateWithLifecycle()
    val follow by pane.follow.state.collectAsStateWithLifecycle()
    LaunchedEffect(follow.list.items) {
        if (pinPicked.value && !follow.stale) {
            pinPicked.value = false
            listState.animateScrollToItem(0)
        }
    }
    val mapModel = pane.mapModel
    val select = { pin: ReinventedMapItem?, open: () -> Unit ->
        if (pin == null || mapModel.state.value.focused == pin.id) open() else mapModel.focus(pin)
    }
    val listActions =
        ReinventedListActions(
            cards =
                reinventedCardActions(pane.follow.cards) { id ->
                    select(mapModel.state.value.pinForPost(id)) { pane.actions.onOpenPost(id) }
                },
            onOpenMoment = { moment -> select(mapModel.state.value.pinForMoment(moment.id)) { pane.watch.moment(moment) } },
            onRefresh = pane.follow::refresh,
            onLoadMore = pane.follow::loadMore,
            onShowCircle = { pane.viewModel.pickReach(ReinventedPulseViewModel.CLOSE, pane.viewModel.state.value.miles) },
            onShowOnMap = mapModel::flyTo,
            viewer = pane.viewModel.viewer,
        )
    val stripActions =
        ReinventedStripActions(onOpenMoment = pane.watch::moment, onOpenPlan = pane.actions.onOpenPlan, onOpenRing = pane.watch::ring)
    val pull =
        rememberPullRefreshState(refreshing = false, onRefresh = {
            pane.follow.refresh()
            mapModel.refresh()
            pane.viewModel.readStrip()
        })
    Box(modifier.pullRefresh(pull)) {
        ReinventedFollowList(
            pane.follow,
            nowMs,
            listState,
            listActions,
            top = strip?.takeIf { !it.isEmpty }?.let { alive -> { ReinventedAliveStrip(alive, stripActions) } },
        )
        PullRefreshIndicator(false, pull, Modifier.align(Alignment.TopCenter))
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
            onOpenRun = watch::run,
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
 * The map and the list: on a phone the map behind and the list a sheet over it ([ReinventedOverMap]); on a window 700 dp
 * wide or more (a tablet, an open foldable) the list a floating panel at the left over the whole map ([ReinventedPanelLayout]).
 */
@Composable
// What the layout shows, its height, and where each part's taps go; the phone's and the wide window's parts, built once.
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod")
private fun ReinventedPulseLayout(
    height: ReinventedHeight,
    onHeight: (ReinventedHeight) -> Unit,
    state: ReinventedPulseState,
    filtersModel: ReinventedFiltersViewModel,
    followModel: ReinventedFollowViewModel,
    onPinPicked: () -> Unit,
    actions: ReinventedPulseActions,
    onPickReach: (String, Int) -> Unit,
    onPickCircle: (String, String) -> Unit,
    mapModel: ReinventedMapViewModel,
    onOpenMoment: (MomentDto) -> Unit,
    onOpenRing: (MomentRingDto) -> Unit,
    atlas: ReinventedAtlasHook,
    list: @Composable (Modifier, Boolean) -> Unit,
) {
    val pulseMap by mapModel.state.collectAsStateWithLifecycle()
    // In My Atlas the map's pins are the person's own kept Moments.
    val mapState = if (atlas.on) pulseMap.copy(items = atlas.pins, deck = atlas.pins, atlas = true) else pulseMap
    val flight by mapModel.flight.collectAsStateWithLifecycle()
    val camera = rememberReinventedCamera()
    // PHASE-6 A1, A2 and PHASE-5 B: the lens, Ask the map and Listen, the filters and the rail.
    val tools = rememberPhoneTools(ReinventedToolsInput(height, onHeight, atlas, mapState, mapModel, camera, filtersModel))
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
        val wide = reinventedPanel(maxWidth)
        // PHASE-6 B: Around me's list is what the map shows now: at peek and half on a phone, in the open panel when wide.
        val followable = !atlas.on && state.reach == ReinventedPulseViewModel.AROUND
        val followOn = followable && height != (if (wide) ReinventedHeight.Map else ReinventedHeight.List)
        LaunchedEffect(followOn) { followModel.follow(followOn) }
        val follow = rememberFollowArea(camera, followModel, followOn)
        val open = { item: ReinventedMapItem ->
            // Following, a first tap on a pin lights it and the map glides there (its row comes first); a second opens it.
            if (followOn && item !is ReinventedMapItem.Ticket && mapState.focused != item.id) {
                mapModel.focus(item)
                if (height == ReinventedHeight.Map) onHeight(ReinventedHeight.Middle)
                onPinPicked()
            } else {
                openPin(item, atlas, actions, onOpenMoment, onOpenRing)
            }
        }
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
                        onPickReach = onPickReach,
                        atlas = atlas.on,
                        onAtlas = atlas.onToggle,
                        overList = !wide && height == ReinventedHeight.List,
                        onPickCircle = onPickCircle,
                        lens = tools.lens,
                        lensActions = tools.lensActions,
                        onPullDown = { if (!atlas.on) tools.filtersOpen.value = true },
                        modifier = modifier,
                    )
                },
                map = { padding ->
                    ReinventedPulseMap(
                        state = mapState,
                        camera = camera,
                        focused = mapState.focused.takeIf { height == ReinventedHeight.Map || followOn },
                        padding = padding,
                        onMoved = { box ->
                            atlas.onMoved(box)
                            if (!atlas.on) mapModel.moved(box)
                            follow.read()
                        },
                        onOpen = open,
                    )
                },
                mapExtras = { chip -> if (!atlas.on) ReinventedGuessSpotsChip(mapState, chip) },
                add = { modifier -> AddButton(onAdd, modifier) },
                onAdd = onAdd,
                list = list,
            )
        ReinventedFiltersHost(tools, mapState.time, mapModel)
        val followState by followModel.state.collectAsStateWithLifecycle()
        val noPlace by filtersModel.noPlace.collectAsStateWithLifecycle()
        // Before the first answer for this area the line names only the time: never "Nothing here yet" before a read.
        val line =
            if (followOn) {
                reinventedFollowLine(followState, mapState.time) ?: reinventedWhenWords(mapState.time)
            } else {
                reinventedSheetLine(mapState.items.size, mapState.time, atlas.on)
            }
        val noPlaceToggle: @Composable () -> Unit = {
            // PHASE-6 H: after a failed or slow read the last rows stay and the header offers to try again.
            if (followOn && followState.failed) ReinventedFollowRetry(followModel::refresh)
            if (!atlas.on && state.reach == ReinventedPulseViewModel.AROUND) ReinventedNoPlaceToggle(noPlace, filtersModel::noPlace)
        }
        val lineDim = followOn && followState.stale
        if (wide) {
            val size = maxWidth to maxHeight
            ReinventedPanelLayout(height, onHeight, size, line, parts, { noPlaceToggle() }, follow::uncovered, lineDim) { top, left ->
                ReinventedPhoneOverMap(tools, top, left, REINVENTED_PANEL, atlas.on, camera.isMoving, mapModel)
            }
        } else {
            val sheetEnd: @Composable RowScope.(ReinventedHeight) -> Unit = { settled ->
                noPlaceToggle()
                if (settled == ReinventedHeight.List) ReinventedSheetHeaderAdd(onAdd)
            }
            val phone = maxHeight to maxWidth
            ReinventedOverMap(height, onHeight, phone, line, parts, sheetEnd, follow::uncovered, lineDim) { top ->
                ReinventedPhoneOverMap(tools, top, 0.dp, null, atlas.on, camera.isMoving, mapModel)
            }
        }
    }
}

/**
 * On a phone (PHASE-6 A): the map is the screen, the header over it, and the list a sheet over the map at three rests
 * ([ReinventedSheet]), moved only by its header. + rides over the sheet up to half and sits in its header at full.
 */
@Composable
@Suppress("LongParameterList") // Its rest and size, the parts, the sheet's line and end, and what goes over the map.
private fun BoxScope.ReinventedOverMap(
    height: ReinventedHeight,
    onHeight: (ReinventedHeight) -> Unit,
    size: Pair<Dp, Dp>,
    line: String,
    parts: ReinventedLayoutParts,
    sheetEnd: @Composable RowScope.(ReinventedHeight) -> Unit,
    onUncovered: (left: Float, top: Float, right: Float, bottom: Float) -> Unit,
    lineDim: Boolean,
    overMap: @Composable BoxScope.(top: Dp) -> Unit,
) {
    val (full, width) = size
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
    // The map as tall as the window under the box's top, whatever today's tab bar does: it is never resized while a list
    // scrolls, so what it shows (and the list that follows it) stays put; its bottom padding counts the extra height.
    val (below, placedBelow) = rememberReinventedBelow()
    Box(Modifier.matchParentSize().then(placedBelow))
    val mapHeight = below?.let { with(density) { it.toDp() } }?.coerceAtLeast(full) ?: full
    Box(Modifier.fillMaxWidth().wrapContentHeight(Alignment.Top, unbounded = true).height(mapHeight)) {
        parts.map(PaddingValues(bottom = covered + (mapHeight - full)))
    }
    // What the map shows uncovered, between the top line and the sheet once it rests: the list follows it there.
    LaunchedEffect(headerPx, covered, full, width) {
        with(density) { onUncovered(0f, headerPx.toFloat(), width.toPx(), (full - covered).toPx()) }
    }
    ReinventedSheet(
        sheet = sheet,
        top = header,
        full = full,
        line = line,
        headerEnd = { sheetEnd(settled) },
        list = { modifier -> parts.list(modifier, settled != ReinventedHeight.List) },
        half = half,
        lineDim = lineDim,
    )
    parts.header(Modifier.onSizeChanged { headerPx = it.height })
    // "Guess the spot" stands at the bottom left over the sheet at peek, level with +; the top is the rail's and the pill's.
    if (settled == ReinventedHeight.Map) {
        val chip = Modifier.align(Alignment.TopStart).padding(top = full - REINVENTED_SHEET_PEEK - GUESS_LIFT, start = Spacing.s4)
        parts.mapExtras(this, chip)
    }
    // + is ADD_SIZE high, with its own bottom padding under it: its edge stands 12 dp over the sheet's.
    ReinventedSheetAdd(sheet, header, full, ADD_SIZE, parts.add, half)
    // The rail, the pill and the lens's suggestions, over the map (the full sheet covers the map: none then).
    if (settled != ReinventedHeight.List || sheet.targetValue != ReinventedHeight.List) overMap(header)
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
private val GUESS_LIFT = 60.dp
private const val MINUTE_MS = 60_000L
private const val FLY_MS = 600
