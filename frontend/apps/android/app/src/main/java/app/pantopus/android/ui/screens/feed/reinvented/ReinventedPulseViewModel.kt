package app.pantopus.android.ui.screens.feed.reinvented

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentBriefDto
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.models.reinvented.ReinventedBandDto
import app.pantopus.android.data.api.models.reinvented.ReinventedListItemDto
import app.pantopus.android.data.api.models.reinvented.ReinventedListResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedStripResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.PASSIVE_LOCATION_TIMEOUT_MILLIS
import app.pantopus.android.data.moments.MomentsPlayback
import app.pantopus.android.data.moments.MomentsRepository
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.pulse.ReinventedFilterQuery
import app.pantopus.android.data.pulse.ReinventedPoint
import app.pantopus.android.data.pulse.ReinventedRepository
import app.pantopus.android.ui.screens.profile.ProfilePostCards
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * "Pulse, reinvented" phase 1 (PHASE-1 §2 pieces 2 to 5; CONTRACT 6a): the one Pulse tab's list. One request draws the
 * first screen (`GET /api/reinvented/list`): the Moments that fade and the posts that stay, ordered by reach, with the
 * distance bands and the chips this place has. Only while `pulse_reinvented` is on for the person: a refusal
 * (`403 PULSE_REINVENTED_OFF`) turns the switch off and today's Pulse shows, and an older server (404) puts today's
 * Pulse back until it is asked again a minute later ([app.pantopus.android.data.pulse.ReinventedServer]). The strip and
 * the map's marks wait for the first page ([firstPage]), so nothing new competes with what opens the tab.
 *
 * Posts are today's Pulse cards with today's taps (reactions, Save, Repost, the post menu) through [cards], as on
 * Today's Around you; a Moment plays in today's viewer ([watch]).
 */
@HiltViewModel
class ReinventedPulseViewModel
    @Inject
    constructor(
        private val repository: ReinventedRepository,
        private val location: LocationProvider,
        private val moments: MomentsRepository,
        posts: PostsRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(ReinventedPulseState())
        val state: StateFlow<ReinventedPulseState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)

        /** What a card's tap left to say ("Saved."), for a few seconds. */
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _strip = MutableStateFlow<ReinventedStripResponse?>(null)

        /** Alive right now, over the list; read only after the list's first page ([readStrip]). */
        val strip: StateFlow<ReinventedStripResponse?> = _strip.asStateFlow()

        private val _firstPage = MutableStateFlow(false)

        /** The list's first page has arrived: the strip and the map's marks may be read now. */
        val firstPage: StateFlow<Boolean> = _firstPage.asStateFlow()

        private val viewerId: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        /** The signed-in person, for what is offered only under others' posts (CONTRACT 8f). */
        val viewer: String? get() = viewerId

        /** The posts' cards and what the viewer's taps did to them. */
        val cards: ProfilePostCards =
            ProfilePostCards(
                scope = viewModelScope,
                posts = posts,
                viewerId = { viewerId },
                onToast = { _toast.value = it },
                profileColors = false,
            )

        private var reading: Job? = null

        /** Where the phone is, when it already knows: the list asks around it, else around the person's home. */
        private var here: ReinventedPoint? = null

        fun dismissToast() {
            _toast.value = null
        }

        /** The list from its first page (opening the tab, pulling down, Try again). */
        fun refresh() {
            _state.update { it.copy(refreshing = it.items.isNotEmpty()) }
            reading?.cancel()
            reading = viewModelScope.launch { read(cursor = null) }
        }

        /** The next page, as the end of what shows nears (in Explore, only when "Keep exploring?" is tapped). */
        fun loadMore() {
            val now = _state.value
            if (now.reach == EXPLORE && now.pause != null) return
            loadNext()
        }

        /** "Keep exploring?": Explore's next page. */
        fun keepExploring() = loadNext()

        private fun loadNext() {
            val now = _state.value
            val cursor = now.cursor ?: return
            if (now.loadingMore || now.load != ReinventedPulseState.Load.Loaded || reading?.isActive == true) return
            _state.update { it.copy(loadingMore = true) }
            reading = viewModelScope.launch { read(cursor) }
        }

        /** PHASE-5 B, the filters while any is on (CONTRACT 10a); null reads the list exactly as before. */
        private var filters: ReinventedFilterQuery? = null

        /**
         * The filters changed: the list reads again from its first page (the first read already carries them). One kind
         * alone and nothing else is today's chip ([chip]), so what a chip shows (Eyes on near you under Ask) still shows.
         */
        fun filter(
            query: ReinventedFilterQuery?,
            chip: String = ALL,
        ) {
            if (query == filters && chip == _state.value.chip) return
            filters = query
            _state.update { it.copy(chip = chip) }
            // Before the list's first read nothing is asked again: that read carries them.
            if (reading != null) refresh()
        }

        fun pickChip(chip: String) {
            if (chip == _state.value.chip) return
            _state.update { it.copy(chip = chip) }
            refresh()
        }

        /** The reach dial's choice: Close circle, or Around me within [miles]. Chips start again from All. */
        fun pickReach(
            reach: String,
            miles: Int,
        ) {
            val now = _state.value
            if (reach == now.reach && miles == now.miles && now.circleId == null) return
            // Another reach is another list: it starts empty, so nothing of the last one shows under the new pill.
            _state.update {
                it.copy(
                    reach = reach,
                    miles = miles,
                    circleId = null,
                    circleName = null,
                    chip = ALL,
                    items = emptyList(),
                    cursor = null,
                    end = null,
                    pause = null,
                )
            }
            refresh()
        }

        /** Close circle, only one of the reader's circles (CONTRACT 8d): its people who are in. */
        fun pickCircle(
            id: String,
            name: String,
        ) {
            val now = _state.value
            if (now.reach == CLOSE && now.circleId == id) return
            _state.update {
                it.copy(
                    reach = CLOSE,
                    circleId = id,
                    circleName = name,
                    chip = ALL,
                    items = emptyList(),
                    cursor = null,
                    end = null,
                    pause = null,
                )
            }
            refresh()
        }

        /** Alive right now (CONTRACT 6c), around the same place as the list; an answer that fails keeps the last one. */
        fun readStrip() {
            viewModelScope.launch {
                val answer = repository.strip(here) as? NetworkResult.Success ?: return@launch
                _strip.value = answer.data
            }
        }

        /** A Moment of the list or the strip plays in today's viewer; the screen then opens the viewer's route. */
        fun watch(moment: MomentDto) {
            moments.playback = MomentsPlayback(rings = listOf(moment.asRing(viewerId)), startIndex = 0, newOnly = false)
        }

        /** A ring (a person's Moments, a ring on the map) plays in today's viewer. */
        fun watch(ring: MomentRingDto) {
            moments.playback = MomentsPlayback(rings = listOf(ring), startIndex = 0, newOnly = false)
        }

        private suspend fun read(cursor: String?) {
            val start = _state.value
            if (cursor == null && start.items.isEmpty()) _state.update { it.copy(load = ReinventedPulseState.Load.Loading) }
            // A tap made while this read is out keeps its value over what the read brings.
            val revision = cards.actionRevision
            if (here == null) here = place()
            if (start.reach == EXPLORE) return readExplore(cursor, revision)
            val answer =
                repository.list(
                    reach = start.reach,
                    miles = start.miles.takeIf { start.reach == AROUND },
                    chip = start.chip,
                    at = here.takeIf { start.reach == AROUND },
                    cursor = cursor,
                    circle = start.circleId.takeIf { start.reach == CLOSE },
                    filters = filters,
                )
            if (answer is NetworkResult.Failure && start.circleId != null && answer.error.circleGone) {
                // No longer in that circle (it ended, or they left): all their connections again.
                _state.update { it.copy(circleId = null, circleName = null, items = emptyList(), cursor = null) }
                return read(cursor = null)
            }
            when (answer) {
                is NetworkResult.Success -> show(answer.data, appending = cursor != null, revision = revision)
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            loadingMore = false,
                            refreshing = false,
                            load = if (it.items.isEmpty()) ReinventedPulseState.Load.Failed(FAILED) else it.load,
                        )
                    }
            }
        }

        /** Explore (CONTRACT 6f): the picked ten on the first page, then newest with variety, pausing at "Keep exploring?". */
        private suspend fun readExplore(
            cursor: String?,
            revision: Int,
        ) {
            when (val answer = repository.explore(here, cursor)) {
                is NetworkResult.Success -> {
                    val page = answer.data
                    val keep = { item: ReinventedListItemDto ->
                        (item.type == MOMENT && item.moment != null) || (item.type == POST && item.post != null)
                    }
                    val picked = page.picked.filter(keep)
                    val fresh = picked + page.items.filter(keep)
                    val appending = cursor != null
                    val items = if (appending) (_state.value.items + fresh).distinctBy { it.type + it.id } else fresh
                    _state.update { now ->
                        now.copy(
                            items = items,
                            bands = emptyList(),
                            chips = listOf(ALL),
                            pickedCount = if (appending) now.pickedCount else picked.size,
                            cursor = page.nextCursor,
                            end = if (page.nextCursor == null) EXPLORE_END else null,
                            pause = page.pause,
                            followed = if (appending) now.followed else page.followed.filter(keep),
                            loadingMore = false,
                            refreshing = false,
                            load = ReinventedPulseState.Load.Loaded,
                        )
                    }
                    cards.show(items.mapNotNull { it.post }, readRevision = revision)
                    _firstPage.value = true
                }
                is NetworkResult.Failure ->
                    _state.update {
                        it.copy(
                            loadingMore = false,
                            refreshing = false,
                            load = if (it.items.isEmpty()) ReinventedPulseState.Load.Failed(FAILED) else it.load,
                        )
                    }
            }
        }

        private fun show(
            page: ReinventedListResponse,
            appending: Boolean,
            revision: Int,
        ) {
            // Only the two kinds this app draws: a Moment, or a post.
            val fresh = page.items.filter { (it.type == MOMENT && it.moment != null) || (it.type == POST && it.post != null) }
            val items = if (appending) (_state.value.items + fresh).distinctBy { it.type + it.id } else fresh
            _state.update { now ->
                now.copy(
                    items = items,
                    bands = if (appending) now.bands else page.bands,
                    chips = if (appending) now.chips else page.chips?.takeIf { it.isNotEmpty() } ?: listOf(ALL),
                    placeLabel = if (appending) now.placeLabel else page.place?.label,
                    cursor = page.nextCursor,
                    end = page.end,
                    pause = null,
                    pickedCount = 0,
                    loadingMore = false,
                    refreshing = false,
                    load =
                        if (page.needsPlace && items.isEmpty()) {
                            ReinventedPulseState.Load.NeedsPlace
                        } else {
                            ReinventedPulseState.Load.Loaded
                        },
                )
            }
            cards.show(items.mapNotNull { it.post }, readRevision = revision)
            _firstPage.value = true
        }

        /** The phone's own place, when location is allowed and a fix comes at once; else none (the server uses the home). */
        private suspend fun place(): ReinventedPoint? {
            val fix = location.cachedCoordinate() ?: location.requestCurrent(PASSIVE_LOCATION_TIMEOUT_MILLIS) ?: return null
            return ReinventedPoint(fix.latitude, fix.longitude)
        }

        companion object {
            const val AROUND = "around"
            const val CLOSE = "close"
            const val EXPLORE = "explore"

            private const val EXPLORE_END = "That's everything for now."
            const val ALL = "all"
            const val MOMENT = "moment"
            const val POST = "post"
            private const val FAILED = "Couldn't load Pulse. Check your connection and try again."
        }
    }

/** What the new Pulse's list shows. */
data class ReinventedPulseState(
    val load: Load = Load.Loading,
    /** Close circle (`close`) or Around me (`around`). */
    val reach: String = ReinventedPulseViewModel.AROUND,
    val miles: Int = DEFAULT_MILES,
    /** Close circle narrowed to one of the reader's circles (CONTRACT 8d); null is all their connections. */
    val circleId: String? = null,
    val circleName: String? = null,
    val chip: String = ReinventedPulseViewModel.ALL,
    val chips: List<String> = listOf(ReinventedPulseViewModel.ALL),
    /** The town's name, to the reader only. */
    val placeLabel: String? = null,
    val items: List<ReinventedListItemDto> = emptyList(),
    val bands: List<ReinventedBandDto> = emptyList(),
    val cursor: String? = null,
    /** "Caught up around you. Keep exploring?" on the last page. */
    val end: String? = null,
    val loadingMore: Boolean = false,
    /** Pulled down to read again, with the list still on screen. */
    val refreshing: Boolean = false,
    /** Explore: how many of the first items are "Today, elsewhere". */
    val pickedCount: Int = 0,
    /** Explore pauses here ("Keep exploring?") until the person asks for more. */
    val pause: String? = null,
    /** Explore's first page: items from the places the reader follows (phase 4, `feed/living/LivingPlaces.kt`). */
    val followed: List<ReinventedListItemDto> = emptyList(),
) {
    /** Explore has more and waits for "Keep exploring?". */
    val pausedForMore: Boolean
        get() = inExplorePause && cursor != null && !loadingMore

    private val inExplorePause: Boolean get() = reach == ReinventedPulseViewModel.EXPLORE && pause != null

    sealed interface Load {
        data object Loading : Load

        data object Loaded : Load

        /** Around me with no place at all: ask for one, as today's Pulse does. */
        data object NeedsPlace : Load

        data class Failed(
            val message: String,
        ) : Load
    }

    companion object {
        const val DEFAULT_MILES = 25
    }
}

/** One Moment as a ring of its own, to play it in today's viewer without reading it again. */
internal fun MomentDto.asRing(viewerId: String?): MomentRingDto =
    MomentRingDto(
        id = "single_$id",
        author = author,
        latitude = latitude ?: 0.0,
        longitude = longitude ?: 0.0,
        placeLabel = placeLabel,
        moments = listOf(MomentBriefDto(id, kind, createdAt, expiresAt, seen)),
        unseenCount = if (seen) 0 else 1,
        newestAt = createdAt,
        mine = viewerId != null && author.id == viewerId,
    )

/**
 * CONTRACT 8d: the list for a circle answered `404 CIRCLE_NOT_FOUND` (the reader is no longer in it). A 404 reaches the
 * app without its body, so any 404 for a circle's list means that.
 */
private val NetworkError.circleGone: Boolean
    get() = this == NetworkError.NotFound || serverCode == "CIRCLE_NOT_FOUND"
