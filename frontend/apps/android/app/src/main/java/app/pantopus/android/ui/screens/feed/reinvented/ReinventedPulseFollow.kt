@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import android.graphics.Point
import android.os.SystemClock
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.reinvented.ReinventedListItemDto
import app.pantopus.android.data.api.models.reinvented.ReinventedListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.data.pulse.ReinventedFilterQuery
import app.pantopus.android.data.pulse.ReinventedRepository
import app.pantopus.android.ui.screens.profile.ProfilePostCards
import app.pantopus.android.ui.theme.PantopusColors
import com.google.maps.android.compose.CameraPositionState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/*
 * PHASE-6 B (the founder's point 8): at peek and half the list shows what is on the map now, the part of the map not
 * under the top line or the sheet, nearest the map's middle first (CONTRACT 11a). When the map comes to rest (250 ms
 * without a move) the list is asked again for the new area; one read at a time: a read in flight is dropped and its
 * answer thrown away. The old rows stay, dimmed to 60%, until the new ones are there, with no spinner and no empty flash;
 * after 2 seconds without an answer, or on a failure, they stop being dimmed and the sheet's header offers "Couldn't
 * refresh · Try again" (PHASE-6 H). The last answer for each of the last 20 areas is kept for the visit: an area seen
 * before shows its kept rows at once and refreshes quietly behind them. At full the list is the reach's whole list, as
 * before. "No place" adds what has no location (11b).
 */

/** What the following list shows: the rows as the list draws them, how many the map holds there, and whether it is old. */
data class ReinventedFollowState(
    val list: ReinventedPulseState = ReinventedPulseState(),
    /** "23 here": the box's count on its first page; null until one came. */
    val count: Int? = null,
    /** The map's cap was reached: "200+ here". */
    val countMore: Boolean = false,
    /** A read for a new area is out: the rows on screen are the last area's (drawn at 60%, the count dimmed too). */
    val stale: Boolean = false,
    /** The last read failed or took over 2 seconds: the last rows stay, and the header offers to try again. */
    val failed: Boolean = false,
)

@HiltViewModel
class ReinventedFollowViewModel
    @Inject
    constructor(
        private val repository: ReinventedRepository,
        posts: PostsRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(ReinventedFollowState())
        val state: StateFlow<ReinventedFollowState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val viewerId: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        /** The posts' cards (today's Pulse cards and taps), as the whole list has its own. */
        val cards: ProfilePostCards =
            ProfilePostCards(
                scope = viewModelScope,
                posts = posts,
                viewerId = { viewerId },
                onToast = { _toast.value = it },
                profileColors = false,
            )

        private var box: ReinventedBox? = null
        private var chip: String = ReinventedPulseViewModel.ALL
        private var filters: ReinventedFilterQuery? = null
        private var on = false
        private var reading: Job? = null

        /** Which read is the newest: an answer to any other is thrown away. */
        private var serial = 0

        /** When the map came to rest (or the list was asked again), for the timing line. */
        private var restedAt = 0L

        /** The first page of each area read in this visit, by area, chip and filters. */
        private val kept = LinkedHashMap<String, ReinventedListResponse>()

        fun dismissToast() {
            _toast.value = null
        }

        /** Following starts (peek or half, Around me) or stops (full, Close circle, Explore, My Atlas). */
        fun follow(now: Boolean) {
            if (now == on) return
            on = now
            if (on) readSoon(waitMs = 0L)
        }

        /** The map came to rest on [next], its part not under the top line or the sheet. */
        fun moved(next: ReinventedBox) {
            if (next == box) return
            box = next
            restedAt = SystemClock.elapsedRealtime()
            readSoon(waitMs = SETTLE_MS)
        }

        /** The chip or the filters changed (PHASE-5 B, with "No place"). */
        fun filter(
            query: ReinventedFilterQuery?,
            chip: String,
        ) {
            if (query == filters && chip == this.chip) return
            filters = query
            this.chip = chip
            readSoon(waitMs = 0L)
        }

        /** Read the area again (a pull on the list, "Try again"). */
        fun refresh() {
            restedAt = SystemClock.elapsedRealtime()
            readSoon(waitMs = 0L)
        }

        /** The next page of the same area. */
        fun loadMore() {
            val now = _state.value
            val area = box ?: return
            val cursor = now.list.cursor ?: return
            if (now.list.loadingMore || reading?.isActive == true) return
            _state.update { it.copy(list = it.list.copy(loadingMore = true)) }
            val revision = cards.actionRevision
            reading =
                viewModelScope.launch {
                    when (val answer = repository.listInBox(area, chip, filters, cursor)) {
                        is NetworkResult.Success -> show(answer.data, appending = true, revision = revision)
                        is NetworkResult.Failure -> _state.update { it.copy(list = it.list.copy(loadingMore = false)) }
                    }
                }
        }

        private fun readSoon(waitMs: Long) {
            if (!on) return
            val area = box ?: return
            reading?.cancel()
            val mine = ++serial
            val id = key(area)
            val seen = kept[id]
            if (seen != null) {
                // Seen before in this visit: its rows at once, refreshed quietly behind them.
                show(seen, appending = false, revision = cards.actionRevision)
            } else if (_state.value.list.items.isNotEmpty()) {
                _state.update { it.copy(stale = true, failed = false) }
            }
            reading =
                viewModelScope.launch {
                    if (waitMs > 0) delay(waitMs)
                    val revision = cards.actionRevision
                    // After 2 seconds without an answer the last rows stop being dimmed and the header offers to try again.
                    val slow =
                        launch {
                            delay(SLOW_MS)
                            if (serial == mine) _state.update { it.copy(stale = false, failed = it.list.items.isNotEmpty()) }
                        }
                    val answer = repository.listInBox(area, chip, filters, cursor = null)
                    slow.cancel()
                    if (serial != mine) return@launch
                    when (answer) {
                        is NetworkResult.Success -> {
                            kept.remove(id)
                            kept[id] = answer.data
                            while (kept.size > KEPT_AREAS) kept.remove(kept.keys.first())
                            show(answer.data, appending = false, revision = revision)
                            Timber.tag(TIMING).d("follow rows sinceRest=%d", SystemClock.elapsedRealtime() - restedAt)
                        }
                        is NetworkResult.Failure ->
                            _state.update {
                                if (it.list.items.isEmpty()) {
                                    it.copy(stale = false, list = it.list.copy(load = ReinventedPulseState.Load.Failed(FAILED)))
                                } else {
                                    it.copy(stale = false, failed = true)
                                }
                            }
                    }
                }
        }

        private fun show(
            page: ReinventedListResponse,
            appending: Boolean,
            revision: Int,
        ) {
            val fresh = page.items.filter { it.drawable }
            _state.update { now ->
                val items = if (appending) (now.list.items + fresh).distinctBy { it.type + it.id } else fresh
                now.copy(
                    count = if (appending) now.count else page.count,
                    countMore = if (appending) now.countMore else page.countMore,
                    stale = false,
                    failed = false,
                    list =
                        now.list.copy(
                            load = ReinventedPulseState.Load.Loaded,
                            reach = ReinventedPulseViewModel.AROUND,
                            chip = chip,
                            items = items,
                            bands = if (appending) now.list.bands else page.bands,
                            cursor = page.nextCursor,
                            end = page.end,
                            loadingMore = false,
                            refreshing = false,
                        ),
                )
            }
            cards.show(_state.value.list.items.mapNotNull { it.post }, readRevision = revision)
        }

        /** An area to the map's own precision (five places), with what was asked of it. */
        private fun key(area: ReinventedBox): String =
            listOf(area.south, area.west, area.north, area.east).joinToString(",") { (it * PLACES).roundToLong().toString() } +
                "|$chip|$filters"

        private companion object {
            const val SETTLE_MS = 250L
            const val SLOW_MS = 2_000L
            const val KEPT_AREAS = 20
            const val TIMING = "ISPerf"
            const val PLACES = 100_000.0
            const val FAILED = "Couldn't load what's on the map. Check your connection and try again."
        }
    }

/** A Moment or a post the list can draw. */
private val ReinventedListItemDto.drawable: Boolean
    get() =
        (type == ReinventedPulseViewModel.MOMENT && moment != null) || (type == ReinventedPulseViewModel.POST && post != null)

/** The peek line's count: "23 here", "200+ here". */
internal fun reinventedFollowLine(
    state: ReinventedFollowState,
    time: String,
): String? {
    val count = state.count ?: return null
    val title = reinventedWhenWords(time)
    return when {
        count == 0 -> "Nothing here yet · $title"
        state.countMore -> "$count+ here · $title"
        else -> "$count here · $title"
    }
}

/** The list over the map while it follows the map: the rows as the whole list draws them, at 60% while they are old. */
@Composable
internal fun ReinventedFollowList(
    model: ReinventedFollowViewModel,
    nowMs: Long,
    listState: LazyListState,
    actions: ReinventedListActions,
    modifier: Modifier = Modifier,
    top: (@Composable () -> Unit)? = null,
) {
    val state by model.state.collectAsStateWithLifecycle()
    val cards by model.cards.cards.collectAsStateWithLifecycle()
    val dim by animateFloatAsState(if (state.stale) 0.6f else 1f, label = "follow")
    ReinventedPulseList(
        state.list,
        cards,
        nowMs,
        listState,
        actions,
        modifier = modifier.alpha(dim).testTag("reinventedPulse.follow"),
        top = top,
    )
}

/** "No place" in the sheet's header: posts and Moments without a location follow, under "Without a place". */
@Composable
internal fun ReinventedNoPlaceToggle(
    on: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .toggleable(value = on, role = Role.Switch, onValueChange = onToggle)
                .testTag("reinventedPulse.sheet.noPlace"),
    ) {
        Text(
            "No place",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (on) Color.White else PantopusColors.appText,
            modifier =
                Modifier
                    .clip(shape)
                    .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface)
                    .border(1.dp, if (on) Color.Transparent else PantopusColors.appBorder, shape)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
        )
    }
}

/**
 * The part of the map not under the top line or the sheet, read once the map rests and whenever the sheet settles at
 * another rest; the following list is asked for it ([ReinventedFollowViewModel.moved]).
 */
@Stable
internal class ReinventedFollowArea(
    private val camera: CameraPositionState,
    private val model: ReinventedFollowViewModel,
) {
    var on: Boolean = false
    var width: Float = 0f
    private var top = 0f
    private var bottom = 0f

    /** The sheet settled: the uncovered part runs from [top] to [bottom], in the map's pixels. */
    fun uncovered(
        top: Float,
        bottom: Float,
    ) {
        this.top = top
        this.bottom = bottom
        read()
    }

    /** The map rested (or following began): ask for what it shows uncovered. */
    fun read() {
        if (!on || camera.isMoving) return
        camera.boxBetween(top, bottom, width)?.let(model::moved)
    }
}

@Composable
internal fun rememberFollowArea(
    camera: CameraPositionState,
    model: ReinventedFollowViewModel,
    on: Boolean,
    width: Float,
): ReinventedFollowArea {
    val area = remember(camera, model) { ReinventedFollowArea(camera, model) }
    SideEffect {
        area.width = width
        area.on = on
    }
    LaunchedEffect(on) { if (on) area.read() }
    return area
}

/**
 * The map's area between two heights on screen (its four corners, so a turned map is held whole); null when unknown.
 * Across the date line the box is the side holding the area's middle (as the web's), never the whole width of the world.
 */
internal fun CameraPositionState.boxBetween(
    top: Float,
    bottom: Float,
    width: Float,
): ReinventedBox? {
    val projection = projection ?: return null
    if (bottom <= top || width <= 0f) return null
    val corners =
        listOf(0f to top, width to top, 0f to bottom, width to bottom).map { (x, y) ->
            projection.fromScreenLocation(Point(x.roundToInt(), y.roundToInt()))
        }
    val middle = projection.fromScreenLocation(Point((width / 2f).roundToInt(), ((top + bottom) / 2f).roundToInt())).longitude
    // Each corner's longitude as a step east or west of the middle, so a corner past the date line stays on its own side.
    val steps = corners.map { wrapLongitude(it.longitude - middle) }
    val south = corners.minOf { it.latitude }.coerceIn(-MAX_LAT, MAX_LAT)
    val north = corners.maxOf { it.latitude }.coerceIn(-MAX_LAT, MAX_LAT)
    val west = (middle + steps.min()).coerceIn(-MAX_LNG, MAX_LNG)
    val east = (middle + steps.max()).coerceIn(-MAX_LNG, MAX_LNG)
    if (south >= north || west >= east) return null
    return ReinventedBox(south = south, west = west, north = north, east = east)
}

/** A longitude difference brought into -180..180. */
private fun wrapLongitude(degrees: Double): Double = ((degrees + MAX_LNG) % FULL_TURN + FULL_TURN) % FULL_TURN - MAX_LNG

private const val MAX_LAT = 90.0
private const val MAX_LNG = 180.0
private const val FULL_TURN = 360.0

/** The pin a Moment of the list is drawn in: its ring, or its kept mark. */
internal fun ReinventedMapState.pinForMoment(momentId: String): ReinventedMapItem? =
    items.firstOrNull {
        (it is ReinventedMapItem.Kept && it.kept.moment.id == momentId) ||
            (it is ReinventedMapItem.Ring && it.ring.moments.any { brief -> brief.id == momentId })
    }

/** The mark a post of the list is drawn as. */
internal fun ReinventedMapState.pinForPost(postId: String): ReinventedMapItem? =
    items.firstOrNull { it is ReinventedMapItem.Mark && it.mark.post.id == postId }

/** In the sheet's header after a read failed or was slow: "Couldn't refresh · Try again"; a tap asks again. */
@Composable
internal fun ReinventedFollowRetry(onRetry: () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clickable(role = Role.Button, onClick = onRetry)
                .testTag("reinventedPulse.follow.retry"),
    ) {
        Text("Couldn't refresh · Try again", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
}
