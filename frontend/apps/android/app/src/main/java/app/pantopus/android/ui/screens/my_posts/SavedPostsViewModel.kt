@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.my_posts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.MyPostDto
import app.pantopus.android.data.api.models.posts.SavedPostsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.posts.PostsRepository
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
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private var posts: List<MyPostDto> = emptyList()
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

        /** Every visit to the tab re-reads it, so posts saved elsewhere since show up. */
        fun load() {
            val gen = ++generation
            loadingMore = false
            loadMoreFailed = false
            if (!loadedOnce) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val result = postsRepo.savedPosts(limit = PAGE_SIZE, offset = 0)
                if (gen != generation) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        posts = result.data.posts
                        nextOffset = nextOffsetAfter(result.data)
                        loadedOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure ->
                        // A failed read is not an empty list: keep what's shown, or say so.
                        if (loadedOnce) applyState() else _state.value = ListOfRowsUiState.Error(LOAD_FAILED)
                }
            }
        }

        /** Footer reached: append the next page of saves. A failed page keeps the rows and offers Try again. */
        fun loadMoreIfNeeded() {
            val offset = nextOffset ?: return
            if (loadingMore) return
            val gen = generation
            loadingMore = true
            loadMoreFailed = false
            viewModelScope.launch {
                val result = postsRepo.savedPosts(limit = PAGE_SIZE, offset = offset)
                if (gen != generation) return@launch
                loadingMore = false
                when (result) {
                    is NetworkResult.Success -> {
                        val seen = posts.mapTo(HashSet()) { it.id }
                        posts = posts + result.data.posts.filter { it.id !in seen }
                        nextOffset = nextOffsetAfter(result.data)
                    }
                    is NetworkResult.Failure -> loadMoreFailed = true
                }
                applyState()
            }
        }

        /** Remove from saved: the server toggles the save, and the row leaves once it confirms. */
        fun remove(postId: String) {
            if (!removing.add(postId)) return
            viewModelScope.launch {
                val result = postsRepo.toggleSave(postId)
                removing.remove(postId)
                when {
                    result is NetworkResult.Success && !result.data.saved -> {
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
            const val LOAD_FAILED = "Couldn't load your saved posts."
            const val LOAD_MORE_FAILED = "Couldn't load more saved posts."

            /** Where the next page starts, or null when the server read the last saves. */
            fun nextOffsetAfter(response: SavedPostsResponse): Int? = response.pagination?.takeIf { it.hasMore == true }?.nextOffset
        }
    }
