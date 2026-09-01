@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "TooManyFunctions",
    "LargeClass",
    "LongMethod",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.feed.pulse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.feed.FeedMuteEntityType
import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.models.sports.ActiveSportsEventDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.feed.FeedActionsRepository
import app.pantopus.android.data.feed.FeedModerationStore
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.data.sports.SportsRepository
import app.pantopus.android.ui.screens.feed.FeedEmptyContent
import app.pantopus.android.ui.screens.feed.FeedRadiusSuggestion
import app.pantopus.android.ui.screens.feed.FeedSurface
import app.pantopus.android.ui.screens.shared.feed.FeedAvatarTint
import app.pantopus.android.ui.screens.shared.media.buildPostMediaItems
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/** Render state for the Pulse feed screen. */
sealed interface PulseFeedUiState {
    data object Loading : PulseFeedUiState

    data class Empty(
        val content: FeedEmptyContent,
    ) : PulseFeedUiState

    data class Loaded(
        val rows: List<PulsePostCardContent>,
    ) : PulseFeedUiState

    data class Error(
        val message: String,
    ) : PulseFeedUiState
}

/**
 * Per-post client-side overrides applied on top of the last server page.
 * Keeps optimistic save / repost / solve state without re-fetching.
 */
private data class PulsePostOverride(
    val isSaved: Boolean? = null,
    val isReposted: Boolean? = null,
    val shareCount: Int? = null,
    val isSolved: Boolean? = null,
    val hasReacted: Boolean? = null,
    val likeCount: Int? = null,
)

/** Pulse feed view-model. */
@HiltViewModel
class PulseFeedViewModel
    @Inject
    constructor(
        private val repo: PostsRepository,
        private val feedActions: FeedActionsRepository,
        private val authRepo: AuthRepository,
        private val locationProvider: LocationProvider,
        private val postsRefresh: PulsePostsRefreshNotifier,
        /** `GET /api/sports/active-events` — backs the Sports lane. */
        private val sportsRepo: SportsRepository,
        /**
         * App-wide mute / hide layer shared by every feed surface, mirroring
         * RN's `PantopusProvider` (`mutedEntities` + `hiddenPostIds`).
         */
        private val moderation: FeedModerationStore,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PulseFeedUiState>(PulseFeedUiState.Loading)
        val state: StateFlow<PulseFeedUiState> = _state.asStateFlow()

        private val _activeIntent = MutableStateFlow(PulseIntent.All)
        val activeIntent: StateFlow<PulseIntent> = _activeIntent.asStateFlow()

        // Topic lane (Nearby only).

        /**
         * Active topic lane. Non-null swaps the post-type chip row for the
         * topic's own mode chips — RN `useFeedFiltering.ts:45-50`.
         */
        private val _activeTopic = MutableStateFlow<PulseTopic?>(null)
        val activeTopic: StateFlow<PulseTopic?> = _activeTopic.asStateFlow()

        /** Mode chip inside the Sports lane. */
        private val _sportsMode = MutableStateFlow(PulseSportsMode.ForYou)
        val sportsMode: StateFlow<PulseSportsMode> = _sportsMode.asStateFlow()

        /**
         * Event the `event` mode chip is scoped to. Defaults to the
         * primary active event when the user hasn't picked one.
         */
        private var eventKey: String? = null

        /** Currently-active major sports events, highest priority first. */
        private val _activeSportsEvents = MutableStateFlow<List<ActiveSportsEventDto>>(emptyList())
        val activeSportsEvents: StateFlow<List<ActiveSportsEventDto>> = _activeSportsEvents.asStateFlow()

        /**
         * Highest-priority active event — labels the `event` chip and backs
         * the active-event module.
         */
        private val _primarySportsEvent = MutableStateFlow<ActiveSportsEventDto?>(null)
        val primarySportsEvent: StateFlow<ActiveSportsEventDto?> = _primarySportsEvent.asStateFlow()

        /** Topics offered on this surface. Topic lanes are Nearby-only. */
        val availableTopics: List<PulseTopic>
            get() = if (_surface.value == FeedSurface.Pulse) PulseTopic.entries.toList() else emptyList()

        /** True while the Sports lane is showing. */
        val isInSportsLane: Boolean
            get() = _surface.value == FeedSurface.Pulse && _activeTopic.value == PulseTopic.Sports

        /**
         * Mode chips for the active lane — the `event` chip is relabelled
         * with the primary event's short label and hidden when nothing is
         * live (RN `FeedScreen.tsx:117-127`).
         */
        fun sportsModeChips(): List<Pair<PulseSportsMode, String>> {
            if (!isInSportsLane) return emptyList()
            val primaryLabel = _primarySportsEvent.value?.chipLabel
            return PulseSportsMode.entries.mapNotNull { mode ->
                when {
                    mode != PulseSportsMode.Event -> mode to mode.label
                    primaryLabel != null -> mode to primaryLabel
                    else -> null
                }
            }
        }

        // Radius suggestion.

        private val _viewingRadiusMiles = MutableStateFlow(100.0)

        /**
         * Radius of the viewer's active viewing location. Set by the
         * context bar so the suggestion ladder lines up with the server.
         */
        val viewingRadiusMiles: StateFlow<Double> = _viewingRadiusMiles.asStateFlow()

        private val _radiusSuggestion = MutableStateFlow<FeedRadiusSuggestion?>(null)

        /**
         * Proposed radius change when the lane came back nearly empty (or
         * overwhelmingly full). `null` hides the banner.
         */
        val radiusSuggestion: StateFlow<FeedRadiusSuggestion?> = _radiusSuggestion.asStateFlow()

        /**
         * Session-scoped dismissal, re-armed whenever the radius changes —
         * RN `useRadiusSuggestion.ts:117-122`.
         */
        private var radiusSuggestionDismissed = false

        /** True while a pull-to-refresh refetch is in flight (drives the spinner). */
        private val _isRefreshing = MutableStateFlow(false)
        val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

        /** True while a next-page fetch is in flight (drives the list footer). */
        private val _isLoadingMore = MutableStateFlow(false)
        val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

        /** Client-side search over the loaded pages. */
        private val _searchText = MutableStateFlow("")
        val searchText: StateFlow<String> = _searchText.asStateFlow()

        /** Which surface this feed renders (Nearby / Connections / Beacons). */
        private val _surface = MutableStateFlow(FeedSurface.Pulse)
        val surface: StateFlow<FeedSurface> = _surface.asStateFlow()

        /**
         * True when the Nearby / Connections toggle row should render. The
         * Beacon Updates route locks its surface, matching RN's
         * `hideSurfaceTabs`.
         */
        private val _showsSurfaceToggle = MutableStateFlow(true)
        val showsSurfaceToggle: StateFlow<Boolean> = _showsSurfaceToggle.asStateFlow()

        /** Transient banner text — mirrors RN's `showToast` calls. */
        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        /** The post whose overflow sheet is open, if any. */
        private val _overflowPostId = MutableStateFlow<String?>(null)
        val overflowPostId: StateFlow<String?> = _overflowPostId.asStateFlow()

        /** The post awaiting a report-reason pick, if any. */
        private val _reportingPostId = MutableStateFlow<String?>(null)
        val reportingPostId: StateFlow<String?> = _reportingPostId.asStateFlow()

        /** The post awaiting delete confirmation, if any. */
        private val _deletingPostId = MutableStateFlow<String?>(null)
        val deletingPostId: StateFlow<String?> = _deletingPostId.asStateFlow()

        /** The post whose author is awaiting mute confirmation, if any. */
        private val _mutingPostId = MutableStateFlow<String?>(null)
        val mutingPostId: StateFlow<String?> = _mutingPostId.asStateFlow()

        /** True while the Pulse preferences sheet is presented. */
        private val _showsPreferences = MutableStateFlow(false)
        val showsPreferences: StateFlow<Boolean> = _showsPreferences.asStateFlow()

        private var scopeLabel: String? = null
        private var latitude: Double? = null
        private var longitude: Double? = null
        private var resolvedLatitude: Double? = null
        private var resolvedLongitude: Double? = null
        private var loading = false

        /** All pages loaded so far — search filters project from this. */
        private var loadedPosts: List<FeedPost> = emptyList()
        private var nextCursorCreatedAt: String? = null
        private var nextCursorId: String? = null
        private var hasMore = false

        /** Optimistic per-post state layered over [loadedPosts]. */
        private var overrides: Map<String, PulsePostOverride> = emptyMap()

        /**
         * Posts removed client-side by *this* surface (deleted / dismissed).
         * Hides live in [moderation] instead — they are app-wide.
         */
        private var removedPostIds: Set<String> = emptySet()

        /**
         * Muted topics stay local: `POST /api/posts/mute/topic` is scoped to
         * a surface, so a topic muted on Nearby is not muted on Beacons.
         */
        private var mutedPostTypes: Set<String> = emptySet()

        /** Signed-in user id — gates delete / mark-solved / report per RN. */
        private val viewerId: String?
            get() = (authRepo.state.value as? AuthRepository.State.SignedIn)?.user?.id

        init {
            viewModelScope.launch {
                postsRefresh.ticks.collect {
                    refresh()
                }
            }
        }

        /** Wire location coordinates from the host before the first load. */
        fun configureLocation(
            latitude: Double?,
            longitude: Double?,
        ) {
            this.latitude = latitude
            this.longitude = longitude
        }

        /** Select the surface (Pulse vs Connections vs Beacons) before the first load. */
        fun configureSurface(surface: FeedSurface) {
            _surface.value = surface
            _showsSurfaceToggle.value = surface in FeedSurface.toggleSurfaces
        }

        fun load() {
            if (_state.value is PulseFeedUiState.Loaded) return
            fetch()
        }

        fun refresh() = fetch(isRefresh = true)

        /**
         * Nearby ↔ Connections toggle. Clears the chip filter like RN's
         * `handleSurfaceChange` (`useFeedData.ts:228-233`).
         */
        fun selectSurface(next: FeedSurface) {
            if (_surface.value == next) return
            _surface.value = next
            _showsSurfaceToggle.value = next in FeedSurface.toggleSurfaces
            _activeIntent.value = PulseIntent.All
            // Leaving Nearby clears the topic lane — topics are
            // Nearby-only (RN `useFeedFiltering.ts:24-27`).
            if (next != FeedSurface.Pulse) _activeTopic.value = null
            loadedPosts = emptyList()
            overrides = emptyMap()
            removedPostIds = emptySet()
            _state.value = PulseFeedUiState.Loading
            fetch()
        }

        fun selectIntent(intent: PulseIntent) {
            if (_activeIntent.value == intent) return
            _activeIntent.value = intent
            fetch()
        }

        /**
         * Topic-chip tap. Passing `null` (or re-tapping the active chip)
         * exits the lane. Entering or leaving resets the post-type filter
         * and the sports mode — RN `useFeedFiltering.ts:29-42`.
         */
        fun selectTopic(topic: PulseTopic?) {
            if (_activeTopic.value == topic) return
            _activeTopic.value = topic
            _activeIntent.value = PulseIntent.All
            _sportsMode.value = PulseSportsMode.ForYou
            eventKey = null
            if (topic == PulseTopic.Sports && _activeSportsEvents.value.isEmpty()) {
                loadActiveSportsEvents { fetch() }
            } else {
                fetch()
            }
        }

        /** Sports mode-chip tap. */
        fun selectSportsMode(mode: PulseSportsMode) {
            if (_sportsMode.value == mode) return
            _sportsMode.value = mode
            fetch()
        }

        /**
         * "See threads" on the active-event module — pins the lane to that
         * event and switches to the `event` mode.
         */
        fun selectSportsEvent(key: String) {
            eventKey = key
            _sportsMode.value = PulseSportsMode.Event
            fetch()
        }

        /**
         * Read `GET /api/sports/active-events`. Optional: a failure just
         * hides the event chip and the module.
         */
        fun loadActiveSportsEvents(then: () -> Unit = {}) {
            viewModelScope.launch {
                val data = (sportsRepo.activeEvents() as? NetworkResult.Success)?.data
                _activeSportsEvents.value = data?.events.orEmpty()
                _primarySportsEvent.value = data?.primaryEvent ?: data?.events?.firstOrNull()
                then()
            }
        }

        /**
         * Sync the viewing radius from the context bar. A manual change
         * re-arms the suggestion banner.
         */
        fun setViewingRadiusMiles(miles: Double) {
            if (_viewingRadiusMiles.value == miles) return
            _viewingRadiusMiles.value = miles
            radiusSuggestionDismissed = false
            recomputeRadiusSuggestion()
        }

        /** Dismiss the radius-suggestion banner for this radius. */
        fun dismissRadiusSuggestion() {
            radiusSuggestionDismissed = true
            _radiusSuggestion.value = null
        }

        private fun recomputeRadiusSuggestion() {
            if (_surface.value != FeedSurface.Pulse || radiusSuggestionDismissed) {
                _radiusSuggestion.value = null
                return
            }
            _radiusSuggestion.value =
                FeedRadiusSuggestion.compute(
                    currentRadius = _viewingRadiusMiles.value,
                    itemCount = loadedPosts.size,
                )
        }

        /**
         * `topic` param — Place-only, and only while a lane is active
         * (`backend/routes/posts.js:1481-1484` rejects it elsewhere).
         */
        private fun topicQueryValue(): String? = if (_surface.value == FeedSurface.Pulse) _activeTopic.value?.key else null

        /** `eventKey` param — the user's pick, else the primary event. */
        private fun resolvedEventKey(): String? = eventKey ?: _primarySportsEvent.value?.eventKey

        /** Update the search query — filters the loaded pages client-side. */
        fun setSearchText(text: String) {
            _searchText.value = text
            rebuildLoadedState()
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        fun openOverflow(postId: String) {
            _overflowPostId.value = postId
        }

        fun dismissOverflow() {
            _overflowPostId.value = null
        }

        fun beginReport(postId: String) {
            _overflowPostId.value = null
            _reportingPostId.value = postId
        }

        fun cancelReport() {
            _reportingPostId.value = null
        }

        fun beginDelete(postId: String) {
            _overflowPostId.value = null
            _deletingPostId.value = postId
        }

        fun cancelDelete() {
            _deletingPostId.value = null
        }

        fun beginMuteAuthor(postId: String) {
            _overflowPostId.value = null
            _mutingPostId.value = postId
        }

        fun cancelMuteAuthor() {
            _mutingPostId.value = null
        }

        fun openPreferences() {
            _showsPreferences.value = true
        }

        fun dismissPreferences() {
            _showsPreferences.value = false
        }

        /** Public web URL handed to the Android share chooser. */
        fun shareUrl(postId: String): String = "https://www.pantopus.com/posts/$postId"

        /**
         * Keyset pagination — fires when the last loaded row appears.
         * No-ops while a fetch is in flight or when the feed is exhausted.
         */
        fun loadMoreIfNeeded(rowId: String) {
            if (!hasMore || _isLoadingMore.value || loading) return
            val lastId = visiblePosts().lastOrNull()?.id ?: return
            if (rowId != lastId) return
            fetchNextPage()
        }

        /**
         * Tap on a post's primary reaction. Optimistically toggles the
         * per-post `userHasReacted` + helpful count, then hits
         * `POST /api/posts/:id/like`. Rolls back on failure.
         */
        fun tapReaction(postId: String) {
            val post = loadedPosts.firstOrNull { it.id == postId } ?: return
            val original = effectiveHasReacted(post)
            val originalCount = effectiveLikeCount(post)
            val toggled = !original
            putOverride(postId) {
                it.copy(hasReacted = toggled, likeCount = (originalCount + if (toggled) 1 else -1).coerceAtLeast(0))
            }
            rebuildLoadedState()

            viewModelScope.launch {
                when (val result = repo.toggleLike(postId)) {
                    is NetworkResult.Success ->
                        putOverride(postId) {
                            it.copy(hasReacted = result.data.liked, likeCount = result.data.likeCount)
                        }
                    is NetworkResult.Failure ->
                        putOverride(postId) { it.copy(hasReacted = original, likeCount = originalCount) }
                }
                rebuildLoadedState()
            }
        }

        // ── Overflow actions ────────────────────────────────────────────

        /**
         * `POST /api/posts/:id/save` — optimistic bookmark toggle with
         * rollback (RN `useFeedData.ts:126`).
         */
        fun toggleSave(postId: String) {
            val post = loadedPosts.firstOrNull { it.id == postId } ?: return
            val original = effectiveIsSaved(post)
            putOverride(postId) { it.copy(isSaved = !original) }
            rebuildLoadedState()
            viewModelScope.launch {
                when (val result = repo.toggleSave(postId)) {
                    is NetworkResult.Success -> {
                        putOverride(postId) { it.copy(isSaved = result.data.saved) }
                        _toastMessage.value =
                            if (result.data.saved) "Saved to your bookmarks." else "Removed from bookmarks."
                    }
                    is NetworkResult.Failure -> {
                        putOverride(postId) { it.copy(isSaved = original) }
                        _toastMessage.value = "Couldn't update your bookmark."
                    }
                }
                rebuildLoadedState()
            }
        }

        /**
         * `POST /api/posts/:id/share` with `shareType: "repost"` —
         * optimistic toggle + count, rolled back on failure
         * (RN `useFeedData.ts:140`).
         */
        fun toggleRepost(postId: String) {
            val post = loadedPosts.firstOrNull { it.id == postId } ?: return
            val original = effectiveIsReposted(post)
            val originalCount = effectiveShareCount(post)
            putOverride(postId) {
                it.copy(
                    isReposted = !original,
                    shareCount = (originalCount + if (original) -1 else 1).coerceAtLeast(0),
                )
            }
            rebuildLoadedState()
            viewModelScope.launch {
                when (val result = repo.share(postId, shareType = "repost")) {
                    is NetworkResult.Success -> {
                        val reposted = result.data.reposted ?: !original
                        putOverride(postId) {
                            it.copy(isReposted = reposted, shareCount = result.data.shareCount ?: originalCount)
                        }
                        _toastMessage.value =
                            if (reposted) "Reposted to your network." else "Repost removed."
                    }
                    is NetworkResult.Failure -> {
                        putOverride(postId) { it.copy(isReposted = original, shareCount = originalCount) }
                        _toastMessage.value = "Could not update repost."
                    }
                }
                rebuildLoadedState()
            }
        }

        /**
         * Records the external share once the chooser was used — count bump
         * only, never surfaced (RN `useFeedData.ts:173`).
         */
        fun recordShare(postId: String) {
            viewModelScope.launch { repo.share(postId, shareType = "external") }
        }

        /**
         * `POST /api/posts/hide/:id` — drops the row immediately, restores
         * it if the call fails.
         */
        fun hidePost(postId: String) {
            // The hide is recorded app-wide (RN's `addHiddenPost`), so the
            // post stays gone on every other surface too.
            moderation.addHiddenPost(postId)
            rebuildLoadedState()
            viewModelScope.launch {
                when (feedActions.hidePost(postId)) {
                    is NetworkResult.Success -> _toastMessage.value = "Post hidden from your feed."
                    is NetworkResult.Failure -> {
                        moderation.removeHiddenPost(postId)
                        _toastMessage.value = "Couldn't hide that post."
                        rebuildLoadedState()
                    }
                }
            }
        }

        /**
         * `POST /api/posts/:id/not-helpful` — ranking signal only; the row
         * stays put (RN `useFeedData.ts:187`).
         */
        fun markNotHelpful(postId: String) {
            viewModelScope.launch {
                when (feedActions.markNotHelpful(postId, _surface.value.moderationSurface)) {
                    is NetworkResult.Success ->
                        _toastMessage.value = "Thanks! We'll show fewer posts like this."
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't send that feedback."
                }
            }
        }

        /** `PATCH /api/posts/:id/solve` — author-only (RN `useFeedData.ts:202`). */
        fun markSolved(postId: String) {
            viewModelScope.launch {
                when (feedActions.markSolved(postId)) {
                    is NetworkResult.Success -> {
                        putOverride(postId) { it.copy(isSolved = true) }
                        _toastMessage.value = "Marked as solved."
                        rebuildLoadedState()
                    }
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't mark that solved."
                }
            }
        }

        /**
         * `POST /api/posts/seeded/:factId/dismiss` — optimistic removal
         * (RN `useFeedData.ts:194`).
         */
        fun dismissSeededFact(factId: String) {
            removedPostIds = removedPostIds + factId
            rebuildLoadedState()
            viewModelScope.launch {
                if (feedActions.dismissSeededFact(factId) is NetworkResult.Failure) {
                    removedPostIds = removedPostIds - factId
                    rebuildLoadedState()
                }
            }
        }

        /**
         * `POST /api/posts/mute` — mutes the post's author (user or
         * business) and strips every one of their rows from the list.
         */
        fun muteAuthor(postId: String) {
            _mutingPostId.value = null
            val post = loadedPosts.firstOrNull { it.id == postId } ?: return
            val businessId = post.businessAuthorId
            val entityType = if (businessId != null) FeedMuteEntityType.Business else FeedMuteEntityType.User
            val entityId = businessId ?: post.userId ?: return
            val name = post.creator?.displayName() ?: "this author"
            // App-wide: RN's `addMute` lives on the provider, so the author is
            // filtered on every surface, not just this one.
            moderation.addMute(entityType, entityId)
            rebuildLoadedState()
            viewModelScope.launch {
                when (feedActions.mute(entityType, entityId)) {
                    is NetworkResult.Success -> _toastMessage.value = "Muted $name."
                    is NetworkResult.Failure -> {
                        moderation.removeMute(entityType, entityId)
                        _toastMessage.value = "Couldn't mute $name."
                        rebuildLoadedState()
                    }
                }
            }
        }

        /**
         * `POST /api/posts/mute/topic` — mutes the post's type on this
         * surface and strips matching rows straight away.
         */
        fun muteTopic(postId: String) {
            val post = loadedPosts.firstOrNull { it.id == postId } ?: return
            val postType = post.postType?.takeIf { it.isNotEmpty() } ?: return
            val label = PulseIntent.fromPostType(postType).cardChipLabel
            mutedPostTypes = mutedPostTypes + postType
            rebuildLoadedState()
            viewModelScope.launch {
                when (feedActions.muteTopic(postType, _surface.value.backendSurface)) {
                    is NetworkResult.Success ->
                        _toastMessage.value = "Muted $label on ${_surface.value.toggleLabel}."
                    is NetworkResult.Failure -> {
                        mutedPostTypes = mutedPostTypes - postType
                        _toastMessage.value = "Couldn't mute $label."
                        rebuildLoadedState()
                    }
                }
            }
        }

        /**
         * `POST /api/posts/:id/report` — one of the `reportPostSchema`
         * reasons (`backend/routes/posts.js:3168`).
         */
        fun reportPost(
            postId: String,
            reason: String,
        ) {
            _reportingPostId.value = null
            viewModelScope.launch {
                when (repo.report(postId, reason)) {
                    is NetworkResult.Success ->
                        _toastMessage.value = "Report sent. We'll review it shortly."
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't send that report."
                }
            }
        }

        /**
         * `DELETE /api/posts/:id` — author-only, optimistic removal with
         * rollback (RN `useFeedData.ts:209`).
         */
        fun deletePost(postId: String) {
            _deletingPostId.value = null
            removedPostIds = removedPostIds + postId
            rebuildLoadedState()
            viewModelScope.launch {
                if (repo.deletePost(postId) is NetworkResult.Failure) {
                    removedPostIds = removedPostIds - postId
                    _toastMessage.value = "Could not delete post."
                    rebuildLoadedState()
                }
            }
        }

        // ── Fetch ───────────────────────────────────────────────────────

        private fun fetchNextPage() {
            val cursorCreatedAt = nextCursorCreatedAt ?: return
            val cursorId = nextCursorId ?: return
            _isLoadingMore.value = true
            viewModelScope.launch {
                try {
                    val (lat, lng) = resolvedCoordinates()
                    when (
                        val result =
                            repo.feed(
                                surface = _surface.value.backendSurface,
                                latitude = lat,
                                longitude = lng,
                                postType = if (isInSportsLane) null else _activeIntent.value.postType,
                                cursorCreatedAt = cursorCreatedAt,
                                cursorId = cursorId,
                                topic = topicQueryValue(),
                                sportsMode = if (isInSportsLane) _sportsMode.value.key else null,
                                eventKey = if (isInSportsLane) resolvedEventKey() else null,
                            )
                    ) {
                        is NetworkResult.Success -> {
                            val known = loadedPosts.map { it.id }.toSet()
                            loadedPosts = loadedPosts + result.data.posts.filter { it.id !in known }
                            applyPagination(result.data.pagination)
                            rebuildLoadedState()
                        }
                        is NetworkResult.Failure -> Unit // keep the loaded rows; retry on next appear
                    }
                } finally {
                    _isLoadingMore.value = false
                }
            }
        }

        private fun applyPagination(pagination: app.pantopus.android.data.api.models.feed.FeedPagination?) {
            nextCursorCreatedAt = pagination?.nextCursor?.createdAt
            nextCursorId = pagination?.nextCursor?.id
            hasMore = pagination?.hasMore == true && nextCursorCreatedAt != null
        }

        private fun visiblePosts(): List<FeedPost> =
            loadedPosts.filter { post ->
                post.id !in removedPostIds &&
                    moderation.isVisible(
                        postId = post.id,
                        userId = post.userId,
                        businessAuthorId = post.businessAuthorId,
                    ) &&
                    (post.postType == null || post.postType !in mutedPostTypes)
            }

        private fun rebuildLoadedState() {
            val visible = visiblePosts()
            if (visible.isEmpty()) {
                if (loadedPosts.isEmpty()) return
                _state.value =
                    PulseFeedUiState.Empty(
                        content = _surface.value.emptyContent(scopeLabel = scopeLabel, followCount = 0),
                    )
                return
            }
            val query = _searchText.value.trim().lowercase()
            val matched =
                if (query.isEmpty()) {
                    visible
                } else {
                    visible.filter { post ->
                        post.content.orEmpty().lowercase().contains(query) ||
                            post.title.orEmpty().lowercase().contains(query) ||
                            (post.creator?.displayName() ?: "").lowercase().contains(query)
                    }
                }
            _state.value = PulseFeedUiState.Loaded(rows = matched.map(::projectCard))
        }

        private fun fetch(isRefresh: Boolean = false) {
            if (loading) return
            loading = true
            if (isRefresh) _isRefreshing.value = true
            if (_state.value !is PulseFeedUiState.Loaded) {
                _state.value = PulseFeedUiState.Loading
            }
            viewModelScope.launch {
                try {
                    val (lat, lng) = resolvedCoordinates()
                    when (
                        val result =
                            repo.feed(
                                surface = _surface.value.backendSurface,
                                latitude = lat,
                                longitude = lng,
                                postType = if (isInSportsLane) null else _activeIntent.value.postType,
                                topic = topicQueryValue(),
                                sportsMode = if (isInSportsLane) _sportsMode.value.key else null,
                                eventKey = if (isInSportsLane) resolvedEventKey() else null,
                            )
                    ) {
                        is NetworkResult.Success -> {
                            val response = result.data
                            scopeLabel = response.posts.firstOrNull()?.locationName ?: scopeLabel
                            loadedPosts = response.posts
                            applyPagination(response.pagination)
                            recomputeRadiusSuggestion()
                            _state.value =
                                if (response.posts.isEmpty()) {
                                    PulseFeedUiState.Empty(
                                        content =
                                            _surface.value.emptyContent(
                                                scopeLabel = scopeLabel,
                                                followCount = 0,
                                            ),
                                    )
                                } else {
                                    PulseFeedUiState.Loaded(rows = emptyList())
                                }
                            if (response.posts.isNotEmpty()) rebuildLoadedState()
                        }
                        is NetworkResult.Failure -> {
                            _state.value = PulseFeedUiState.Error(result.error.displayMessage("Couldn't load Pulse."))
                        }
                    }
                } finally {
                    loading = false
                    _isRefreshing.value = false
                }
            }
        }

        private suspend fun resolvedCoordinates(): Pair<Double?, Double?> =
            explicitCoordinates()
                ?: storedCoordinates()
                ?: awaitFreshCoordinates()
                ?: (null to null)

        private fun explicitCoordinates(): Pair<Double, Double>? {
            val lat = latitude ?: return null
            val lng = longitude ?: return null
            return lat to lng
        }

        private fun storedCoordinates(): Pair<Double, Double>? {
            val lat = resolvedLatitude ?: return null
            val lng = resolvedLongitude ?: return null
            return lat to lng
        }

        private suspend fun awaitFreshCoordinates(): Pair<Double, Double>? {
            val cached = locationProvider.cachedCoordinate()
            val fresh = cached ?: locationProvider.requestCurrent(timeoutMillis = 4_000)
            val coordinate = fresh ?: return null
            resolvedLatitude = coordinate.latitude
            resolvedLongitude = coordinate.longitude
            return coordinate.latitude to coordinate.longitude
        }

        // ── Optimistic accessors ────────────────────────────────────────

        private fun putOverride(
            postId: String,
            transform: (PulsePostOverride) -> PulsePostOverride,
        ) {
            overrides = overrides + (postId to transform(overrides[postId] ?: PulsePostOverride()))
        }

        private fun effectiveIsSaved(post: FeedPost): Boolean = overrides[post.id]?.isSaved ?: post.userHasSaved

        private fun effectiveIsReposted(post: FeedPost): Boolean = overrides[post.id]?.isReposted ?: post.userHasReposted

        private fun effectiveShareCount(post: FeedPost): Int = overrides[post.id]?.shareCount ?: post.shareCount

        private fun effectiveIsSolved(post: FeedPost): Boolean = overrides[post.id]?.isSolved ?: (post.state == "solved")

        private fun effectiveHasReacted(post: FeedPost): Boolean = overrides[post.id]?.hasReacted ?: post.userHasLiked

        private fun effectiveLikeCount(post: FeedPost): Int = overrides[post.id]?.likeCount ?: post.likeCount

        // ── Projection ──────────────────────────────────────────────────

        private fun projectCard(post: FeedPost): PulsePostCardContent {
            val intent = PulseIntent.fromPostType(post.postType)
            val authorName = post.creator?.displayName() ?: "Pantopus user"
            val isBusiness = post.creator?.accountType == "business" || post.businessAuthorId != null
            val surfaceValue = _surface.value
            val hasReacted = effectiveHasReacted(post)
            val likeCount = effectiveLikeCount(post)
            val isOwner = isOwner(post)
            val isSolved = effectiveIsSolved(post)
            return PulsePostCardContent(
                id = post.id,
                authorName = authorName,
                authorInitials = initials(authorName),
                // Beacons authors are all verified by definition; on Pulse, fall
                // back to account-type until the backend surfaces creator.verified.
                authorVerified = surfaceValue.authorsAlwaysVerified || isBusiness,
                avatarTint = if (isBusiness) FeedAvatarTint.Violet else FeedAvatarTint.Sky,
                meta = metaString(post),
                intent = intent,
                title = if (intent == PulseIntent.Event) post.title else null,
                body = post.content.orEmpty(),
                reactions =
                    intent.reactionTemplate(
                        helpfulCount = likeCount,
                        secondaryCount = 0,
                    ),
                attendees =
                    if (intent == PulseIntent.Event) {
                        PulseAttendeeStrip(
                            avatars = emptyList(),
                            goingCount = likeCount,
                            userIsGoing = hasReacted,
                        )
                    } else {
                        null
                    },
                userHasReacted = hasReacted,
                commentCount = post.commentCount,
                media =
                    buildPostMediaItems(
                        urls = post.mediaUrls,
                        types = post.mediaTypes,
                        thumbnails = post.mediaThumbnails,
                        liveUrls = post.mediaLiveUrls,
                    ),
                actions =
                    PulsePostActions(
                        isSeeded = post.isSeeded,
                        isSaved = effectiveIsSaved(post),
                        isReposted = effectiveIsReposted(post),
                        shareCount = effectiveShareCount(post),
                        isSolved = isSolved,
                        isOwner = isOwner,
                        canMarkSolved = isOwner && post.postType == "ask_local" && !isSolved,
                        canFlagNotHelpful = surfaceValue.supportsNotHelpful && !isOwner && !post.isSeeded,
                        muteEntityType =
                            when {
                                post.businessAuthorId != null -> FeedMuteEntityType.Business
                                post.userId != null -> FeedMuteEntityType.User
                                else -> null
                            },
                        muteEntityId = post.businessAuthorId ?: post.userId,
                        muteEntityName = authorName,
                        postType = post.postType,
                        topicLabel = intent.cardChipLabel,
                    ),
            )
        }

        private fun isOwner(post: FeedPost): Boolean {
            val viewer = viewerId?.takeIf { it.isNotEmpty() } ?: return false
            return post.userId == viewer || post.creator?.id == viewer
        }

        private fun metaString(post: FeedPost): String {
            val relative = relativeTimestamp(post.createdAt)
            val locality = post.locationName?.takeIf { it.isNotEmpty() }
            return if (locality != null) "$relative · $locality" else relative
        }

        private fun relativeTimestamp(iso: String): String =
            runCatching {
                val instant = Instant.parse(iso)
                val seconds = Duration.between(instant, Instant.now()).seconds
                when {
                    seconds < 60 -> "Just now"
                    seconds < 3_600 -> "${seconds / 60}m"
                    seconds < 86_400 -> "${seconds / 3_600}h"
                    seconds < 604_800 -> "${seconds / 86_400}d"
                    else -> "${seconds / 604_800}w"
                }
            }.getOrDefault(iso)

        private fun initials(name: String): String {
            val parts = name.split(" ").take(2)
            return parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
        }
    }
