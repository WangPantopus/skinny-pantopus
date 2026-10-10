@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.my_posts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.data.api.models.posts.SavedPostsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowBodyEmphasis
import app.pantopus.android.ui.screens.shared.list_of_rows.RowEngagement
import app.pantopus.android.ui.screens.shared.list_of_rows.RowEngagementCta
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/**
 * My posts' Saved tab: the posts the viewer bookmarked and can still open
 * (`GET /api/posts/saved`), newest save first, each with Remove. Kept apart
 * from [MyPostsViewModel] because it reads a different list — other people's
 * posts, paged by save offset — with a different row action; the rows reuse
 * that model's row helpers.
 */
@HiltViewModel
class SavedPostsViewModel
    @Inject
    constructor(
        private val postsRepo: PostsRepository,
        private val postsRefresh: PulsePostsRefreshNotifier,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()

        private var posts: List<MyPostDto> = emptyList()
        private var loading = false
        private var nextOffset: Int? = null
        private var loadedOnce = false
        private var loadingMore = false
        private var loadMoreFailed = false

        /** Bumped by every first-page load so a page that lands later can't append to its replacement. */
        private var generation = 0
        private val removing = mutableSetOf<String>()
        private var openPostHandler: (MyPostDto) -> Unit = {}

        fun bindCallbacks(onOpenPost: (MyPostDto) -> Unit) {
            openPostHandler = onOpenPost
        }

        /** A return uses the shared first-page copy while it is fresh. */
        fun load() = read(force = false)

        fun refresh() = read(force = true)

        private fun read(force: Boolean) {
            if (loading || loadingMore || removing.isNotEmpty()) return
            loading = true
            val gen = ++generation
            loadMoreFailed = false
            if (!loadedOnce) {
                postsRepo.savedPostsCopy(PAGE_SIZE).data?.let { copy ->
                    posts = copy.posts
                    nextOffset = nextOffsetAfter(copy)
                    loadedOnce = true
                    applyState()
                }
                if (!loadedOnce) _state.value = ListOfRowsUiState.Loading
            }
            val depth = (nextOffset ?: posts.size).coerceIn(PAGE_SIZE, MAX_REFRESH_DEPTH)
            viewModelScope.launch {
                val result = postsRepo.savedPosts(limit = depth, force = force)
                if (gen != generation) return@launch
                loading = false
                val copy = postsRepo.savedPostsCopy(depth)
                _refreshNotice.value = if (copy.showsRefreshFailure(StoreKind.POST)) RefreshNotice(copy.fetchedAt, ::refresh) else null
                when (result) {
                    is NetworkResult.Success -> {
                        replaceRefreshedHead(result.data)
                        loadedOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        if (result.error is NetworkError.Forbidden ||
                            result.error == NetworkError.NotFound ||
                            result.error == NetworkError.Unauthorized) {
                            posts = emptyList()
                            nextOffset = null
                            loadedOnce = false
                            _state.value = ListOfRowsUiState.Error(LOAD_FAILED)
                        } else if (loadedOnce) {
                            applyState()
                        } else {
                            _state.value = ListOfRowsUiState.Error(LOAD_FAILED)
                        }
                    }
                }
            }
        }

        /** Keep later pages below the newest bookmark returned, then resume from the server's current save offset. */
        private fun replaceRefreshedHead(response: SavedPostsResponse) {
            val boundary = response.posts.lastOrNull()?.savedAt?.let { MyPostsViewModel.parseInstant(it) }
            val refreshedIds = response.posts.mapTo(HashSet()) { it.id }
            val older = if (response.pagination?.hasMore == true && boundary != null) {
                posts.filter { row ->
                    row.id !in refreshedIds && MyPostsViewModel.parseInstant(row.savedAt)?.let { it <= boundary } == true
                }
            } else {
                emptyList()
            }
            posts = (response.posts + older).distinctBy { it.id }
            // Offsets count raw saves, including posts hidden by the visibility check. A visible-row delta cannot
            // adjust them safely; paging rechecks the retained tail and skips duplicates until it reaches new rows.
            nextOffset = nextOffsetAfter(response)
        }

        /** Footer reached: append the next page of saves. A failed page keeps the rows and offers Try again. */
        fun loadMoreIfNeeded() {
            val offset = nextOffset ?: return
            if (loading || loadingMore) return
            val gen = generation
            loadingMore = true
            loadMoreFailed = false
            viewModelScope.launch {
                val result = postsRepo.savedPosts(limit = PAGE_SIZE, offset = offset)
                if (gen != generation) return@launch
                loadingMore = false
                var addedRows = false
                when (result) {
                    is NetworkResult.Success -> {
                        val seen = posts.mapTo(HashSet()) { it.id }
                        val fresh = result.data.posts.filter { it.id !in seen }
                        addedRows = fresh.isNotEmpty()
                        posts = posts + fresh
                        nextOffset = nextOffsetAfter(result.data)
                    }
                    is NetworkResult.Failure -> loadMoreFailed = true
                }
                applyState()
                if (result is NetworkResult.Success && !addedRows && nextOffset != offset) loadMoreIfNeeded()
            }
        }

        /** Remove from saved: the request asks for "not saved" (a re-send can't re-save it); the row leaves once it confirms. */
        fun remove(postId: String) {
            if (!removing.add(postId)) return
            viewModelScope.launch {
                val result = postsRepo.toggleSave(postId, saved = false)
                removing.remove(postId)
                when {
                    result is NetworkResult.Success && !result.data.saved -> {
                        // A Pulse card still showing it saved would re-save it on its next tap: lists refetch.
                        postsRefresh.notifyPostsDidChange()
                        if (posts.any { it.id == postId }) {
                            posts = posts.filterNot { it.id == postId }
                            // The saves after it move up one, so the next page starts one earlier or it would skip one.
                            nextOffset = nextOffset?.let { maxOf(0, it - 1) }
                            applyState()
                        }
                    }
                    // The toggle saved it again (it had been unsaved elsewhere): re-read the list.
                    result is NetworkResult.Success -> load()
                    else -> _toastMessage.value = "Couldn't remove it. Try again."
                }
            }
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        private fun applyState() {
            if (posts.isEmpty() && nextOffset != null) {
                if (loadMoreFailed) {
                    // Reading on failed, which isn't "nothing saved": say so, with Try again.
                    _state.value = ListOfRowsUiState.Error(LOAD_FAILED)
                } else {
                    // A page the visibility check emptied isn't the end of the list.
                    _state.value = ListOfRowsUiState.Loading
                    loadMoreIfNeeded()
                }
                return
            }
            if (posts.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Bookmark,
                        headline = "Nothing saved yet",
                        subcopy = "Tap the bookmark on a post to keep it here.",
                    )
                return
            }
            val now = Instant.now()
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = MyPostsTab.SAVED, rows = posts.map { row(it, now) })),
                    hasMore = nextOffset != null,
                    loadMoreError = if (loadMoreFailed) LOAD_MORE_FAILED else null,
                    onRetryLoadMore = if (loadMoreFailed) ({ loadMoreIfNeeded() }) else null,
                )
        }

        private fun row(
            dto: MyPostDto,
            now: Instant,
        ): RowModel {
            val intent = PulseIntent.fromPostType(dto.postType)
            val author = dto.author?.displayName?.takeIf { it.isNotBlank() }
            val time = MyPostsViewModel.timeMetaLabel(dto, now).takeIf { it.isNotEmpty() }
            return RowModel(
                id = dto.id,
                title = "",
                template = RowTemplate.StatusChip,
                leading = RowLeading.None,
                trailing = RowTrailing.None,
                onTap = { openPostHandler(dto) },
                body = MyPostsViewModel.postBody(dto),
                bodyEmphasis = RowBodyEmphasis.Primary,
                headerChips = listOf(MyPostsViewModel.intentChip(intent, isArchived = false)),
                // Saved posts are other people's: the meta line names who wrote it.
                timeMeta = listOfNotNull(author, time).joinToString(" · "),
                engagement =
                    RowEngagement(
                        items = MyPostsViewModel.engagementItems(dto, intent),
                        cta =
                            RowEngagementCta(
                                label = "Remove",
                                icon = PantopusIcon.Bookmark,
                                accessibilityLabel = "Remove from saved",
                                onClick = { remove(dto.id) },
                            ),
                    ),
            )
        }

        companion object {
            /** Saves per page of `GET /api/posts/saved`. */
            const val PAGE_SIZE = 50
            const val MAX_REFRESH_DEPTH = 200
            const val LOAD_FAILED = "Couldn't load your saved posts."
            const val LOAD_MORE_FAILED = "Couldn't load more saved posts."

            /** Where the next page starts, or null when the server read the last saves. */
            fun nextOffsetAfter(response: SavedPostsResponse): Int? = response.pagination?.takeIf { it.hasMore == true }?.nextOffset
        }
    }
