package app.pantopus.android.ui.screens.pulse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.pulse.PulseFeedResponse
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
        private val toggled = mutableMapOf<String, Boolean>()
        private var reading: Job? = null
        private var seenFor: String? = null
        private var lastResponse: PulseFeedResponse? = null

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
            _query.value = next
            _newCount.value = 0
            _earlier.value = PulseEarlierState.Idle
            seenFor = null
            lastResponse = null
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
                        _refreshing.value = false
                    }
                }
        }

        private fun apply(stored: Stored<PulseFeedResponse>) {
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

        private fun show(response: PulseFeedResponse) {
            lastResponse = response
            val now = Instant.now()
            val page = response.toPage(readAt = now.toString(), now = now)
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
                                    toggled[card.id]?.let { done -> card.copy(actionDone = done) } ?: card
                                },
                        )
                    },
            )
        }

        /** Once a minute while the page is on screen: how many conversations arrived since the page was read. */
        fun pollNew() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val q = _query.value
            viewModelScope.launch {
                val result = repository.newCount(q, after = loaded.content.readAt)
                if (result is NetworkResult.Success && q == _query.value) _newCount.value = result.data.count ?: 0
            }
        }

        /** The end card has been on screen: advance the last-seen marker (once per read of the page, only when nothing newer was left). */
        fun endShown() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            if (!loaded.content.end.caughtUp || seenFor == loaded.content.readAt) return
            seenFor = loaded.content.readAt
            viewModelScope.launch { repository.markSeen(_query.value.view, through = loaded.content.readAt) }
        }

        /** "Show earlier": the next older items once, below the end card. */
        fun showEarlier() {
            val loaded = _state.value as? PulsePageUiState.Loaded ?: return
            val cursor = loaded.content.end.earlierCursor ?: return
            if (_earlier.value is PulseEarlierState.Loading) return
            _earlier.value = PulseEarlierState.Loading
            val q = _query.value
            viewModelScope.launch {
                when (val result = repository.earlier(q, before = cursor)) {
                    is NetworkResult.Success -> {
                        if (q != _query.value) return@launch
                        val page = result.data.toPage(readAt = loaded.content.readAt)
                        val group = page.groups.firstOrNull()
                        _earlier.value = if (group == null) PulseEarlierState.NothingEarlier else PulseEarlierState.Loaded(group)
                    }
                    is NetworkResult.Failure -> {
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
            val done = !(toggled[card.id] ?: card.actionDone)
            toggled[card.id] = done
            (_state.value as? PulsePageUiState.Loaded)?.let { _state.value = PulsePageUiState.Loaded(it.content.applyToggle(card.id, done)) }
            viewModelScope.launch {
                when (posts.toggleLike(card.id, done)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        toggled[card.id] = !done
                        (_state.value as? PulsePageUiState.Loaded)?.let {
                            _state.value = PulsePageUiState.Loaded(it.content.applyToggle(card.id, !done))
                        }
                        _toast.value = "Couldn't save that. Try again."
                    }
                }
            }
            return true
        }

        private fun PulsePageContent.applyToggle(
            id: String,
            done: Boolean,
        ): PulsePageContent =
            copy(
                groups =
                    groups.map { group ->
                        group.copy(cards = group.cards.map { if (it.id == id) it.copy(actionDone = done) else it })
                    },
            )

        fun dismissToast() {
            _toast.value = null
        }

        private companion object {
            const val ERROR_FALLBACK = "We couldn't load Pulse."
        }
    }
