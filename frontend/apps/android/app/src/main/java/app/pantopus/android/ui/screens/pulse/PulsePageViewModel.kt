package app.pantopus.android.ui.screens.pulse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.pulse.PulseFeedCopy
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.data.posts.PostsRepository
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

/** "Show earlier" below the end card: nothing yet, loading, the older items, or nothing older. */
sealed interface PulseEarlierState {
    data object Idle : PulseEarlierState

    data object Loading : PulseEarlierState

    data class Loaded(val group: PulseGroupUi) : PulseEarlierState

    data object NothingEarlier : PulseEarlierState
}

/**
 * The Pulse page (build spec section 3). It reads `GET /api/pulse/feed` through the screens' store (a saved copy shows at
 * once, then reads again when it is out of date), keeps new conversations behind a count the person taps, and tells the
 * server the page was read to its end once the end card was on screen. Nothing loads by itself: pull to refresh, the
 * "↑ N new conversations" pill and "Show earlier" are the only ways items arrive.
 */
@HiltViewModel
class PulsePageViewModel
    @Inject
    constructor(
        private val repository: PulseRepository,
        private val posts: PostsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PulsePageUiState>(PulsePageUiState.Loading)
        val state: StateFlow<PulsePageUiState> = _state.asStateFlow()

        private val _query = MutableStateFlow(PulseFeedQuery())
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
            _query.value = next
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
                data != null -> {
                    if (stored.failure == null) _newCount.value = 0
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
                completedActions.remove(id)
            }
            val page = copy.response.toPage(readAt = copy.readAt)
            _state.value = PulsePageUiState.Loaded(page.withToggles())
        }

        /** The page again with the viewer's own toggles on top (a Going tapped a moment ago shows before the server says so). */
        private fun PulsePageContent.withToggles(): PulsePageContent {
            if (toggled.isEmpty()) return this
            return copy(
                groups =
                    groups.map { group ->
                        group.copy(
                            cards =
                                group.cards.map { card ->
                                    toggled[card.id]?.let { card.withAction(it) } ?: card
                                },
                        )
                    },
            )
        }

        /** Once a minute while the page is on screen: how many conversations arrived since the page was read. */
        fun pollNew() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val q = _query.value
            // The published count endpoint has no area parameter. Never show the home town's count in another area.
            if (q.areaId != null || polling?.isActive == true) return
            polling =
                viewModelScope.launch {
                    val result = repository.newCount(q, after = loaded.content.readAt)
                    val current = _state.value as? PulsePageUiState.Loaded
                    if (result is NetworkResult.Success && q == _query.value && current?.content?.readAt == loaded.content.readAt) {
                        _newCount.value = (result.data.count ?: 0).coerceAtLeast(0)
                    }
                }
        }

        /** The end card has been on screen: advance the last-seen marker (once per read of the page, only when nothing newer was left). */
        fun endShown() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val q = _query.value
            if (q.topic != null || q.areaId != null || _newCount.value > 0 || markingSeen?.isActive == true) return
            if (!loaded.content.end.caughtUp || seenFor == loaded.content.readAt) return
            markingSeen =
                viewModelScope.launch {
                    val result = repository.markSeen(q.view, through = loaded.content.readAt)
                    if (result is NetworkResult.Success && q == _query.value) seenFor = loaded.content.readAt
                }
        }

        /** "Show earlier": the next older items once, below the end card. */
        fun showEarlier() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val cursor = loaded.content.end.earlierCursor ?: return
            if (_earlier.value is PulseEarlierState.Loading) return
            _earlier.value = PulseEarlierState.Loading
            val q = _query.value
            readingEarlier =
                viewModelScope.launch {
                    when (val result = repository.earlier(q, before = cursor)) {
                        is NetworkResult.Success -> {
                            if (q != _query.value) return@launch
                            val page = result.data.toPage(readAt = loaded.content.readAt)
                            val group = page.groups.firstOrNull()
                            _earlier.value = if (group == null) PulseEarlierState.NothingEarlier else PulseEarlierState.Loaded(group)
                        }
                        is NetworkResult.Failure -> {
                            if (q != _query.value) return@launch
                            _earlier.value = PulseEarlierState.Idle
                            _toast.value = "Couldn't load earlier conversations. Try again."
                        }
                    }
                }
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
            (_earlier.value as? PulseEarlierState.Loaded)?.let { loaded ->
                _earlier.value = PulseEarlierState.Loaded(loaded.group.applyAction(id, edit))
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

        fun dismissToast() {
            _toast.value = null
        }

        private companion object {
            const val ERROR_FALLBACK = "We couldn't load Pulse."
        }
    }
