package app.pantopus.android.ui.screens.pulse

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.pulse.PulseFeedCopy
import app.pantopus.android.data.api.models.pulse.PulseFeedResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.feed.FeedActionsRepository
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.data.pulse.PulseFeedQuery
import app.pantopus.android.data.pulse.PulseRepository
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** What the page is doing. The skeleton shows only when there is nothing to show; a saved copy shows at once. */
sealed interface PulsePageUiState {
    data object Loading : PulsePageUiState

    data class Loaded(val content: PulsePageContent) : PulsePageUiState

    data class Error(val message: String) : PulsePageUiState
}

/** "Show earlier" request state; loaded rows stay in the page during later requests and failures. */
sealed interface PulseEarlierState {
    data object Idle : PulseEarlierState

    data object Loading : PulseEarlierState

    data object NothingEarlier : PulseEarlierState
}

/**
 * The Pulse page (build spec section 3). It reads `GET /api/pulse/feed` through the screens' store (a saved copy shows at
 * once, then reads again when it is out of date), keeps new conversations behind a count the person taps, and tells the
 * server the page was read to its end once the end card was on screen. Nothing loads by itself: pull to refresh, the
 * "↑ N new conversations" pill and "Show earlier" are the only ways items arrive.
 */
@HiltViewModel
// Named menu actions share the page's pending-write guards and overlays, including earlier rows.
@Suppress("TooManyFunctions")
class PulsePageViewModel
    @Inject
    constructor(
        private val repository: PulseRepository,
        private val posts: PostsRepository,
        private val feedActions: FeedActionsRepository,
        private val moderation: FeedModerationStore,
        private val savedState: SavedStateHandle,
        /** Posts ended or restored on other screens (an Ask closed on its page, a post archived in My posts). */
        private val postsRefresh: PulsePostsRefreshNotifier,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PulsePageUiState>(PulsePageUiState.Loading)
        val state: StateFlow<PulsePageUiState> = _state.asStateFlow()

        private val _query =
            MutableStateFlow(
                PulseFeedQuery(
                    view = savedState.get<String>(VIEW_KEY)?.takeIf { it == PulseFeedQuery.VIEW_FOLLOWING } ?: PulseFeedQuery.VIEW_NEARBY,
                    topic = savedState[TOPIC_KEY],
                    areaId = savedState[AREA_KEY],
                ),
            )
        val query: StateFlow<PulseFeedQuery> = _query.asStateFlow()

        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        private val _newCount = MutableStateFlow(0)

        /** How many conversations wait behind the "↑ N new conversations" pill. */
        val newCount: StateFlow<Int> = _newCount.asStateFlow()

        private val _earlier = MutableStateFlow<PulseEarlierState>(PulseEarlierState.Idle)
        val earlier: StateFlow<PulseEarlierState> = _earlier.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        /** Posts the viewer toggled before the server answers: id to the action's new done state. */
        private data class ActionOverride(val done: Boolean, val goingCount: Int?)

        private val savedPosts = mutableMapOf<String, Boolean>()
        private val keptOpen = mutableSetOf<String>()
        private val removedPosts = mutableSetOf<String>()
        private val mutedTopics = mutableSetOf<Pair<String, String?>>()
        private val _menu = MutableStateFlow<PulsePageMenu?>(null)
        val menu: StateFlow<PulsePageMenu?> = _menu.asStateFlow()

        private val toggled = mutableMapOf<String, ActionOverride>()
        private val completedActions = mutableMapOf<String, Instant>()
        private val pendingActions = mutableSetOf<String>()
        private var reading: Job? = null
        private var readingEarlier: Job? = null
        private var polling: Job? = null
        private var markingSeen: Job? = null
        private var seenFor: String? = null

        /** Tab entry and every return: what is on screen stays, a first entry shows the saved copy at once, and the page reads again once it is out of date. */
        fun load() {
            applyPostEventsFromElsewhere()
            val q = _query.value
            if (_state.value is PulsePageUiState.Loaded) {
                if (!repository.feedIsCurrent(q)) read(force = false)
                return
            }
            repository.feedCopy(q)?.let(::show)
            read(force = false)
        }

        /** Pull to refresh, Retry and the new-conversations pill: read now. */
        fun refresh() {
            readingEarlier?.cancel()
            _earlier.value = PulseEarlierState.Idle
            if (_state.value !is PulsePageUiState.Loaded) _state.value = PulsePageUiState.Loading
            read(force = true)
        }

        fun selectView(view: String) {
            if (_query.value.view == view) return
            switchTo(_query.value.copy(view = view))
        }

        /** A topic chip filters; `null` is "All". Picking a topic joins nothing. */
        fun selectTopic(topic: String?) {
            if (_query.value.topic == topic) return
            switchTo(_query.value.copy(topic = topic))
        }

        /** Another area from the pill (the viewer's town is `null`). */
        fun selectArea(areaId: String?) {
            if (_query.value.areaId == areaId) return
            switchTo(_query.value.copy(areaId = areaId))
        }

        private fun switchTo(next: PulseFeedQuery) {
            reading?.cancel()
            reading = null
            readingEarlier?.cancel()
            polling?.cancel()
            markingSeen?.cancel()
            _menu.value = null
            _query.value = next
            savedState[VIEW_KEY] = next.view
            savedState[TOPIC_KEY] = next.topic
            savedState[AREA_KEY] = next.areaId
            _newCount.value = 0
            _earlier.value = PulseEarlierState.Idle
            seenFor = null
            _refreshNotice.value = null
            val copy = repository.feedCopy(next)
            if (copy != null) show(copy) else _state.value = PulsePageUiState.Loading
            read(force = false)
        }

        private fun read(force: Boolean) {
            if (reading?.isActive == true) return
            val q = _query.value
            _refreshing.value = force && _state.value is PulsePageUiState.Loaded
            reading =
                viewModelScope.launch {
                    try {
                        val stored = repository.feedStored(q, force)
                        if (q != _query.value) return@launch
                        apply(stored)
                    } finally {
                        if (q == _query.value) _refreshing.value = false
                    }
                }
        }

        private fun apply(stored: Stored<PulseFeedCopy>) {
            val data = stored.data
            _refreshNotice.value = if (stored.showsRefreshFailure(StoreKind.NEARBY)) RefreshNotice(stored.fetchedAt, ::refresh) else null
            when {
                stored.failure != null && _state.value is PulsePageUiState.Loaded && !stored.failure.refusesStoredCopy -> Unit
                data != null -> {
                    if (stored.failure == null) {
                        _newCount.value = 0
                        readingEarlier?.cancel()
                        _earlier.value = PulseEarlierState.Idle
                    }
                    show(data)
                }
                else -> {
                    val failure = stored.failure
                    _state.value =
                        if (_state.value is PulsePageUiState.Loaded && failure?.refusesStoredCopy != true) {
                            _state.value
                        } else {
                            PulsePageUiState.Error(failure?.displayMessage(ERROR_FALLBACK) ?: ERROR_FALLBACK)
                        }
                }
            }
        }

        private fun show(copy: PulseFeedCopy) {
            val through = runCatching { Instant.parse(copy.readAt) }.getOrNull()
            completedActions.filterValues { through != null && !it.isAfter(through) }.keys.toList().forEach { id ->
                toggled.remove(id)
                savedPosts.remove(id)
                completedActions.remove(id)
            }
            // Action completion uses the local request clock above; count/seen use only the server boundary.
            val snapshot = copy.response.readAt?.let { runCatching { Instant.parse(it).toString() }.getOrNull() }
            val page = copy.response.toPage(readAt = snapshot)
            _state.value = PulsePageUiState.Loaded(page.withToggles())
        }

        /** The page again with the viewer's own toggles on top (a Going tapped a moment ago shows before the server says so). */
        private fun PulsePageContent.withToggles(): PulsePageContent {
            val visibleGroups =
                groups.mapNotNull { group ->
                    val cards =
                        group.cards.filter(::isVisible).map { card ->
                            val action = toggled[card.id]?.let { card.withAction(it) } ?: card
                            action.copy(
                                actions =
                                    action.actions.copy(
                                        isSaved = savedPosts[card.id] ?: action.actions.isSaved,
                                        canKeepOpen = action.actions.canKeepOpen && card.id !in keptOpen,
                                    ),
                            )
                        }
                    cards.takeIf { it.isNotEmpty() }?.let { group.copy(cards = it) }
                }
            return copy(groups = visibleGroups, end = end.copy(caughtUp = end.caughtUp && visibleGroups.isNotEmpty()))
        }

        /** Once a minute while the page is on screen: how many conversations arrived since the page was read. */
        fun pollNew() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val q = _query.value
            val after = loaded.content.readAt ?: return
            if (polling?.isActive == true) return
            polling =
                viewModelScope.launch {
                    val result = repository.newCount(q, after = after)
                    val current = _state.value as? PulsePageUiState.Loaded
                    if (result is NetworkResult.Success && q == _query.value && current?.content?.readAt == loaded.content.readAt) {
                        _newCount.value = (result.data.count ?: 0).coerceAtLeast(0)
                    }
                }
        }

        /** The end card has been on screen: advance the last-seen marker (once per read of the page, only when nothing newer was left). */
        fun endShown(endKey: String) {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val q = _query.value
            val through = loaded.content.readAt ?: return
            // Seen is per view, so a filtered or other-area page must not acknowledge unread home conversations.
            val canAcknowledge = q.topic == null && q.areaId == null && _newCount.value == 0
            if (!canAcknowledge || markingSeen?.isActive == true) return
            if (!loaded.content.end.caughtUp || seenFor == through || loaded.content.endKey != endKey) return
            markingSeen =
                viewModelScope.launch {
                    val result = repository.markSeen(q.view, through = through)
                    if (result is NetworkResult.Success && result.data.ok == true && q == _query.value) seenFor = through
                }
        }

        /** Append one older batch per tap, retaining the original snapshot and the server's opaque cursor. */
        fun showEarlier() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val cursor = loaded.content.end.earlierCursor ?: return
            if (!loaded.content.end.canShowEarlier || reading?.isActive == true || readingEarlier?.isActive == true) return
            _earlier.value = PulseEarlierState.Loading
            val q = _query.value
            readingEarlier =
                viewModelScope.launch {
                    when (val result = repository.earlier(q, before = cursor)) {
                        is NetworkResult.Success -> {
                            if (q != _query.value) return@launch
                            val current = (_state.value as? PulsePageUiState.Loaded)?.content ?: return@launch
                            if (current.readAt != loaded.content.readAt || current.end.earlierCursor != cursor) return@launch
                            appendEarlier(current, result.data)
                        }
                        is NetworkResult.Failure -> {
                            if (q != _query.value) return@launch
                            _earlier.value = PulseEarlierState.Idle
                            _toast.value = "Couldn't load earlier conversations. Try again."
                        }
                    }
                }
        }

        private fun appendEarlier(
            current: PulsePageContent,
            response: PulseFeedResponse,
        ) {
            val page = response.toPage(readAt = current.readAt)
            val ids = current.groups.flatMap { it.cards }.mapTo(mutableSetOf()) { it.id }
            val additions = page.groups.flatMap { it.cards }.filter { ids.add(it.id) }
            val groups = current.groups.toMutableList()
            val earlierIndex = groups.indexOfFirst { it.key == EARLIER_GROUP_KEY }
            if (additions.isNotEmpty()) {
                if (earlierIndex >= 0) {
                    val group = groups[earlierIndex]
                    groups[earlierIndex] = group.copy(cards = group.cards + additions)
                } else {
                    groups.add(PulseGroupUi(EARLIER_GROUP_KEY, page.groups.firstOrNull()?.title.orEmpty(), additions))
                }
            }
            val combined =
                current.copy(
                    groups = groups,
                    end = page.end.copy(caughtUp = response.end?.caughtUp == true),
                ).withToggles()
            _state.value = PulsePageUiState.Loaded(combined)
            _earlier.value = if (combined.end.canShowEarlier) PulseEarlierState.Idle else PulseEarlierState.NothingEarlier
        }

        /**
         * The card's one action. Going and Seen it are the existing like toggle; the others open the conversation, where
         * they live (the caller does that, this returns false for them).
         */
        fun toggleAction(card: PulseCardUi): Boolean {
            if (card.actionKind != "going" && card.actionKind != "seen_it") return false
            if (!pendingActions.add(card.id)) return true
            val done = !(toggled[card.id]?.done ?: card.actionDone)
            val going = card.goingCount?.let { (it + if (done) 1 else -1).coerceAtLeast(0) }
            val edit = ActionOverride(done, going)
            toggled[card.id] = edit
            applyAction(card.id, edit)
            viewModelScope.launch {
                try {
                    when (val result = posts.toggleLike(card.id, done)) {
                        is NetworkResult.Success -> {
                            val confirmed =
                                ActionOverride(
                                    result.data.liked,
                                    result.data.likeCount.coerceAtLeast(0).takeIf { card.actionKind == "going" },
                                )
                            toggled[card.id] = confirmed
                            completedActions[card.id] = Instant.now()
                            applyAction(card.id, confirmed)
                        }
                        is NetworkResult.Failure -> {
                            toggled.remove(card.id)
                            applyAction(card.id, ActionOverride(card.actionDone, card.goingCount))
                            _toast.value = result.error.displayMessage("Couldn't save that. Try again.")
                        }
                    }
                } finally {
                    pendingActions.remove(card.id)
                }
            }
            return true
        }

        private fun applyAction(
            id: String,
            edit: ActionOverride,
        ) {
            (_state.value as? PulsePageUiState.Loaded)?.let { loaded ->
                _state.value = PulsePageUiState.Loaded(loaded.content.copy(groups = loaded.content.groups.map { it.applyAction(id, edit) }))
            }
        }

        private fun PulseGroupUi.applyAction(
            id: String,
            edit: ActionOverride,
        ): PulseGroupUi = copy(cards = cards.map { if (it.id == id) it.withAction(edit) else it })

        private fun PulseCardUi.withAction(edit: ActionOverride): PulseCardUi =
            copy(
                actionDone = edit.done,
                goingCount = edit.goingCount,
                goingText = edit.goingCount?.let { "$it going" },
            )

        private fun isVisible(card: PulseCardUi): Boolean {
            if (card.id in removedPosts || moderation.isHidden(card.id)) return false
            val actions = card.actions
            val author = actions.muteEntityId
            val entity = actions.muteEntityType
            if (author != null && entity != null && moderation.isMuted(entity, author)) return false
            val topic = actions.pulseTopic?.key
            if (actions.isOwner || topic == null) return true
            return (topic to card.areaId) !in mutedTopics && (topic to null) !in mutedTopics
        }

        fun openMenu(card: PulseCardUi) {
            _menu.value = PulsePageMenu(card)
        }

        fun dismissMenu() {
            _menu.value = null
        }

        fun confirmMenu(action: PulsePageMenuAction) {
            _menu.value = _menu.value?.copy(action = action)
        }

        fun toggleSave(card: PulseCardUi) {
            val desired = !(savedPosts[card.id] ?: card.actions.isSaved)
            perform(card, "Saved.", { posts.toggleSave(card.id, desired) }) { result ->
                savedPosts[card.id] = result.saved
                completedActions[card.id] = Instant.now()
                updateCards { if (it.id == card.id) it.copy(actions = it.actions.copy(isSaved = result.saved)) else it }
                _toast.value = if (result.saved) "Post saved." else "Bookmark removed."
            }
        }

        fun hide(card: PulseCardUi) {
            perform(card, "Post hidden from your feed.", { feedActions.hidePost(card.id) }) {
                moderation.addHiddenPost(card.id)
                filterCards()
            }
        }

        fun muteAuthor(card: PulseCardUi) {
            val entity = card.actions.muteEntityType ?: return
            val author = card.actions.muteEntityId ?: return
            if (!card.actions.canMuteAuthor) return
            perform(card, "Muted ${card.authorName}.", { feedActions.mute(entity, author) }) {
                moderation.addMute(entity, author)
                filterCards()
            }
        }

        fun muteTopic(card: PulseCardUi) {
            val topic = card.actions.pulseTopic?.key ?: return
            // An absent area must never silently turn an area mute into a global mute.
            val area = card.areaId ?: return
            if (!card.actions.canMuteThisTopic) return
            perform(card, "Topic muted in this area.", { feedActions.mutePulseTopic(topic, area) }) {
                mutedTopics.add(topic to area)
                filterCards()
            }
        }

        fun topicUnmuted(topic: String) {
            mutedTopics.removeAll { it.first == topic }
            refresh()
        }

        fun keepOpen(card: PulseCardUi) {
            if (!card.actions.canKeepOpen || card.id in keptOpen) return
            perform(card, "Kept open for 7 more days.", { repository.keepOpen(card.id) }) {
                keptOpen.add(card.id)
                updateCards { if (it.id == card.id) it.copy(actions = it.actions.copy(canKeepOpen = false)) else it }
            }
        }

        fun closeAsk(card: PulseCardUi) {
            if (!card.actions.canCloseAsk) return
            perform(card, "Question closed.", { repository.close(card.id) }) {
                removedPosts.add(card.id)
                postsRefresh.notifyPostEnded(card.id)
                filterCards()
            }
        }

        fun delete(card: PulseCardUi) {
            if (!card.actions.canDelete) return
            perform(card, "Post deleted.", { posts.deletePost(card.id) }) {
                removedPosts.add(card.id)
                postsRefresh.notifyPostEnded(card.id)
                filterCards()
            }
        }

        fun report(
            card: PulseCardUi,
            reason: String,
        ) {
            if (!card.actions.canReport) return
            perform(card, "Report submitted", { posts.report(card.id, reason) }) { }
        }

        private fun <T> perform(
            card: PulseCardUi,
            success: String,
            request: suspend () -> NetworkResult<T>,
            onSuccess: (T) -> Unit,
        ) {
            if (!pendingActions.add(card.id)) return
            dismissMenu()
            viewModelScope.launch {
                try {
                    when (val result = request()) {
                        is NetworkResult.Success -> {
                            _toast.value = success
                            onSuccess(result.data)
                        }
                        is NetworkResult.Failure -> {
                            if (PulseRepository.refusalCode(result.error) == PulseRepository.ALREADY_KEPT_OPEN) keptOpen.add(card.id)
                            _toast.value = result.error.displayMessage("Couldn't save that. Try again.")
                            filterCards()
                        }
                    }
                } finally {
                    pendingActions.remove(card.id)
                }
            }
        }

        private fun updateCards(transform: (PulseCardUi) -> PulseCardUi) {
            (_state.value as? PulsePageUiState.Loaded)?.let { loaded ->
                _state.value =
                    PulsePageUiState.Loaded(
                        loaded.content.copy(
                            groups = loaded.content.groups.map { group -> group.copy(cards = group.cards.map(transform)) },
                        ),
                    )
            }
        }

        private fun filterCards() {
            (_state.value as? PulsePageUiState.Loaded)?.let { loaded ->
                _state.value = PulsePageUiState.Loaded(loaded.content.withToggles())
            }
        }

        fun dismissToast() {
            _toast.value = null
        }

        private var postEventsSeen = 0L

        /**
         * A post ended on another screen leaves this page at once, even before the next read (which may be a saved copy
         * while offline), and one restored from My posts comes back.
         */
        private fun applyPostEventsFromElsewhere() {
            val (latest, events) = postsRefresh.postEventsAfter(postEventsSeen)
            postEventsSeen = latest
            if (events.isEmpty()) return
            events.forEach { event -> if (event.ended) removedPosts.add(event.postId) else removedPosts.remove(event.postId) }
            filterCards()
        }

        private companion object {
            const val ERROR_FALLBACK = "We couldn't load Pulse."
            const val VIEW_KEY = "pulse.view"
            const val TOPIC_KEY = "pulse.topic"
            const val AREA_KEY = "pulse.area"
            const val EARLIER_GROUP_KEY = "loaded_earlier"
        }
    }
