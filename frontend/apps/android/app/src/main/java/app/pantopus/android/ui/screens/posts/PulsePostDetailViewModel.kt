@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "TooGenericExceptionCaught", "TooManyFunctions", "LargeClass")

package app.pantopus.android.ui.screens.posts

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.PostCommentDto
import app.pantopus.android.data.api.models.posts.PostCommentRequest
import app.pantopus.android.data.api.models.posts.PostDetailDto
import app.pantopus.android.data.api.models.posts.PostReactionKind
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.posts.MatchedBusinessesRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.content_detail.bodies.PostCommentRow
import app.pantopus.android.ui.screens.shared.content_detail.bodies.PostReactionCounts
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostIntent
import app.pantopus.android.ui.screens.shared.media.PostMediaItem
import app.pantopus.android.ui.screens.shared.media.buildPostMediaItems
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Nav-arg key for the Pulse post ID. */
const val PULSE_POST_DETAIL_ID_KEY = "postId"

/** Emoji choices surfaced by the heart pill's long-press popover. */
val pulseReactionEmojis = listOf("👍", "❤️", "🔥", "😂", "💯", "🎉")

/** The comment a reply is being drafted against. */
data class PulseReplyTarget(
    val commentId: String,
    val authorName: String,
)

/** Render-ready payload for the Pulse post detail screen. */
data class PulsePostDetailContent(
    val post: PostDetailDto,
    val authorDisplayName: String,
    val authorAvatarUrl: String?,
    val authorIdentity: IdentityPillar,
    val authorVerified: Boolean,
    val timeAndLocality: String,
    val intent: PostIntent,
    val media: List<PostMediaItem>,
    val reactions: PostReactionCounts,
    val comments: List<PostCommentRow>,
    val hiddenReplyCount: Int,
)

/** Observed UI state for the Pulse post detail screen. */
sealed interface PulsePostDetailUiState {
    data object Loading : PulsePostDetailUiState

    data class Loaded(val content: PulsePostDetailContent) : PulsePostDetailUiState

    data class Error(val message: String) : PulsePostDetailUiState
}

/** Loads + mutates a single Pulse post. */
@HiltViewModel
class PulsePostDetailViewModel
    @Inject
    constructor(
        private val repo: PostsRepository,
        private val authRepo: AuthRepository,
        private val postsRefresh: PulsePostsRefreshNotifier,
        private val matchedBusinessesRepo: MatchedBusinessesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val postId: String =
            requireNotNull(savedStateHandle[PULSE_POST_DETAIL_ID_KEY]) {
                "PulsePostDetailViewModel requires a '$PULSE_POST_DETAIL_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<PulsePostDetailUiState>(PulsePostDetailUiState.Loading)
        val state: StateFlow<PulsePostDetailUiState> = _state.asStateFlow()

        /**
         * "Nearby Providers" — organically matched local businesses for this
         * post's `service_category`. Empty when the post has no category, is
         * older than the 30-day window, or nothing matched; the card is hidden
         * in all three cases, exactly like RN.
         */
        private val _nearbyProviders = MutableStateFlow<List<NearbyProviderRow>>(emptyList())
        val nearbyProviders: StateFlow<List<NearbyProviderRow>> = _nearbyProviders.asStateFlow()

        private val _composerText = MutableStateFlow("")
        val composerText: StateFlow<String> = _composerText.asStateFlow()

        private val _isSendingComment = MutableStateFlow(false)
        val isSendingComment: StateFlow<Boolean> = _isSendingComment.asStateFlow()

        private val _toastMessage = MutableStateFlow<String?>(null)
        val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

        private val _showsOverflowMenu = MutableStateFlow(false)

        /**
         * Bound to the screen's overflow modal — Save / Repost / Edit /
         * Delete / Report per ownership.
         */
        val showsOverflowMenu: StateFlow<Boolean> = _showsOverflowMenu.asStateFlow()

        /** True once the post is deleted — the screen pops back. */
        private val _didDeletePost = MutableStateFlow(false)
        val didDeletePost: StateFlow<Boolean> = _didDeletePost.asStateFlow()

        /** Bookmark state — seeded from the wire, toggled optimistically. */
        private val _isSaved = MutableStateFlow(false)
        val isSaved: StateFlow<Boolean> = _isSaved.asStateFlow()

        /** Repost state — seeded from the wire, toggled optimistically. */
        private val _isReposted = MutableStateFlow(false)
        val isReposted: StateFlow<Boolean> = _isReposted.asStateFlow()

        /** Emoji chosen from the long-press popover (session-local). */
        private val _selectedReactionEmoji = MutableStateFlow<String?>(null)
        val selectedReactionEmoji: StateFlow<String?> = _selectedReactionEmoji.asStateFlow()

        /** Comment being replied to — drives the composer banner. */
        private val _replyTarget = MutableStateFlow<PulseReplyTarget?>(null)
        val replyTarget: StateFlow<PulseReplyTarget?> = _replyTarget.asStateFlow()

        private val showingAllReplies = MutableStateFlow(false)

        private val maxInitialReplies = 3

        /** Share URL for the system share sheet. */
        val shareUrl: String
            get() = "https://www.pantopus.com/posts/$postId"

        /**
         * True when the signed-in user authored the post on screen. The
         * screen uses this to gate the Edit / Delete overflow actions.
         */
        val isOwner: Boolean
            get() {
                val loaded = _state.value as? PulsePostDetailUiState.Loaded ?: return false
                val signedIn = authRepo.state.value as? AuthRepository.State.SignedIn ?: return false
                return loaded.content.post.userId == signedIn.user.id
            }

        private val signedInUserId: String?
            get() = (authRepo.state.value as? AuthRepository.State.SignedIn)?.user?.id

        fun openOverflowMenu() {
            _showsOverflowMenu.value = true
        }

        fun dismissOverflowMenu() {
            _showsOverflowMenu.value = false
        }

        /** First-load entry. */
        fun load() {
            if (_state.value is PulsePostDetailUiState.Loaded) return
            refresh()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() {
            _state.value = PulsePostDetailUiState.Loading
            viewModelScope.launch { fetch() }
        }

        /** Refetch without dropping to the loading state (pull-to-refresh). */
        suspend fun refetchInPlace() {
            fetch()
        }

        fun setComposerText(text: String) {
            _composerText.value = text
        }

        fun dismissToast() {
            _toastMessage.value = null
        }

        fun showMoreReplies() {
            val loaded = _state.value as? PulsePostDetailUiState.Loaded ?: return
            showingAllReplies.value = true
            _state.value = PulsePostDetailUiState.Loaded(rebuildContent(loaded.content.post))
        }

        /** Start drafting a reply to [commentId]. */
        fun beginReply(
            commentId: String,
            authorName: String,
        ) {
            _replyTarget.value = PulseReplyTarget(commentId = commentId, authorName = authorName)
        }

        /** Clear the reply banner without losing typed text. */
        fun cancelReply() {
            _replyTarget.value = null
        }

        /**
         * Tap one of the reaction pills. Only `.Helpful` is wired to a
         * backend route today; unliking also clears the chosen emoji.
         */
        fun tapReaction(kind: PostReactionKind) {
            val loaded = _state.value as? PulsePostDetailUiState.Loaded ?: return
            if (!kind.isBackendWired) return
            val initialReactions = loaded.content.reactions
            val wasOn = initialReactions.userReaction == PostReactionKind.Helpful
            if (wasOn) _selectedReactionEmoji.value = null
            val optimistic =
                initialReactions.copy(
                    helpful = if (wasOn) (initialReactions.helpful - 1).coerceAtLeast(0) else initialReactions.helpful + 1,
                    userReaction = if (wasOn) null else PostReactionKind.Helpful,
                )
            _state.value = PulsePostDetailUiState.Loaded(loaded.content.copy(reactions = optimistic))

            viewModelScope.launch {
                when (val result = repo.toggleLike(postId)) {
                    is NetworkResult.Success -> {
                        val reconciled =
                            optimistic.copy(
                                helpful = result.data.likeCount,
                                userReaction = if (result.data.liked) PostReactionKind.Helpful else null,
                            )
                        _state.update { current ->
                            (current as? PulsePostDetailUiState.Loaded)?.let {
                                PulsePostDetailUiState.Loaded(it.content.copy(reactions = reconciled))
                            } ?: current
                        }
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = "Couldn't update your reaction"
                        _state.update { current ->
                            (current as? PulsePostDetailUiState.Loaded)?.let {
                                PulsePostDetailUiState.Loaded(
                                    it.content.copy(reactions = initialReactions),
                                )
                            } ?: current
                        }
                    }
                }
            }
        }

        /** Choose an emoji from the popover — records a like when needed. */
        fun pickReactionEmoji(emoji: String) {
            _selectedReactionEmoji.value = emoji
            val loaded = _state.value as? PulsePostDetailUiState.Loaded ?: return
            if (loaded.content.reactions.userReaction != PostReactionKind.Helpful) {
                tapReaction(PostReactionKind.Helpful)
            }
        }

        /** Toggle the heart on one comment — optimistic with rollback. */
        fun toggleCommentLike(commentId: String) {
            val loaded = _state.value as? PulsePostDetailUiState.Loaded ?: return
            val index = loaded.content.comments.indexOfFirst { it.id == commentId }
            if (index < 0) return
            val original = loaded.content.comments[index]
            val toggled = !original.userReacted
            val optimisticRow =
                original.copy(
                    userReacted = toggled,
                    reactionCount = (original.reactionCount + if (toggled) 1 else -1).coerceAtLeast(0),
                )
            applyCommentRow(index, optimisticRow)

            viewModelScope.launch {
                when (val result = repo.toggleCommentLike(postId, commentId)) {
                    is NetworkResult.Success -> {
                        val current = _state.value as? PulsePostDetailUiState.Loaded ?: return@launch
                        val rIndex = current.content.comments.indexOfFirst { it.id == commentId }
                        if (rIndex >= 0) {
                            applyCommentRow(
                                rIndex,
                                current.content.comments[rIndex].copy(
                                    userReacted = result.data.liked,
                                    reactionCount = result.data.likeCount,
                                ),
                            )
                        }
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = "Couldn't update the comment"
                        val current = _state.value as? PulsePostDetailUiState.Loaded ?: return@launch
                        val rIndex = current.content.comments.indexOfFirst { it.id == commentId }
                        if (rIndex >= 0) applyCommentRow(rIndex, original)
                    }
                }
            }
        }

        /** Delete the signed-in user's own comment, then refetch. */
        fun deleteComment(commentId: String) {
            viewModelScope.launch {
                when (repo.deleteComment(postId, commentId)) {
                    is NetworkResult.Success -> fetch()
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't delete the comment"
                }
            }
        }

        /** Author-only post delete — flips [didDeletePost] on success. */
        fun deletePost() {
            viewModelScope.launch {
                when (repo.deletePost(postId)) {
                    is NetworkResult.Success -> {
                        postsRefresh.notifyPostsDidChange()
                        _didDeletePost.value = true
                    }
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't delete the post"
                }
            }
        }

        /** Flag the post with one of the report reasons. */
        fun reportPost(reason: String) {
            viewModelScope.launch {
                when (repo.report(postId, reason)) {
                    is NetworkResult.Success -> _toastMessage.value = "Report submitted"
                    is NetworkResult.Failure -> _toastMessage.value = "Couldn't submit the report"
                }
            }
        }

        /** Toggle the bookmark — optimistic with reconcile/rollback. */
        fun toggleSave() {
            val before = _isSaved.value
            _isSaved.value = !before
            viewModelScope.launch {
                when (val result = repo.toggleSave(postId)) {
                    is NetworkResult.Success -> _isSaved.value = result.data.saved
                    is NetworkResult.Failure -> {
                        _isSaved.value = before
                        _toastMessage.value = "Couldn't update the bookmark"
                    }
                }
            }
        }

        /** Toggle the repost — optimistic with reconcile/rollback. */
        fun toggleRepost() {
            val before = _isReposted.value
            _isReposted.value = !before
            viewModelScope.launch {
                when (val result = repo.share(postId, shareType = "repost")) {
                    is NetworkResult.Success -> {
                        _isReposted.value = result.data.reposted ?: !before
                        postsRefresh.notifyPostsDidChange()
                    }
                    is NetworkResult.Failure -> {
                        _isReposted.value = before
                        _toastMessage.value = "Couldn't update the repost"
                    }
                }
            }
        }

        /** Fire-and-forget external-share telemetry after the share sheet. */
        fun recordShare() {
            viewModelScope.launch { repo.share(postId, shareType = "external") }
        }

        /** Submit the composer's current text — threaded under the reply target when set. */
        fun sendComment() {
            val body = _composerText.value.trim()
            if (body.isEmpty() || _isSendingComment.value) return
            _isSendingComment.value = true
            viewModelScope.launch {
                val req = PostCommentRequest(comment = body, parentCommentId = _replyTarget.value?.commentId)
                when (repo.createComment(postId, req)) {
                    is NetworkResult.Success -> {
                        _composerText.value = ""
                        _replyTarget.value = null
                        fetch()
                    }
                    is NetworkResult.Failure -> {
                        _toastMessage.value = "Couldn't post your comment"
                    }
                }
                _isSendingComment.value = false
            }
        }

        // MARK: - Internal helpers

        private fun applyCommentRow(
            index: Int,
            row: PostCommentRow,
        ) {
            _state.update { current ->
                val loaded = current as? PulsePostDetailUiState.Loaded ?: return@update current
                val rows = loaded.content.comments.toMutableList().also { it[index] = row }
                PulsePostDetailUiState.Loaded(loaded.content.copy(comments = rows))
            }
        }

        private suspend fun fetch() {
            when (val result = repo.detail(postId)) {
                is NetworkResult.Success -> {
                    _isSaved.value = result.data.post.userHasSaved
                    _isReposted.value = result.data.post.userHasReposted
                    _state.value = PulsePostDetailUiState.Loaded(rebuildContent(result.data.post))
                }
                is NetworkResult.Failure -> {
                    _state.value = PulsePostDetailUiState.Error(friendlyMessage(result.error))
                }
            }
        }

        /**
         * `GET /api/posts/:id/matched-businesses?cached=true`
         * (`backend/routes/posts.js:2550`). Best-effort — a failure just hides
         * the card rather than failing the post. Kicked from its own
         * `LaunchedEffect` so the card never blocks (or fails) the post itself.
         */
        fun loadNearbyProviders() {
            viewModelScope.launch { fetchNearbyProviders() }
        }

        private suspend fun fetchNearbyProviders() {
            _nearbyProviders.value =
                when (val result = matchedBusinessesRepo.matchedBusinesses(postId)) {
                    is NetworkResult.Success ->
                        result.data.businesses.mapNotNull { NearbyProviderFormat.row(it) }
                    is NetworkResult.Failure -> emptyList()
                }
        }

        private fun rebuildContent(post: PostDetailDto): PulsePostDetailContent {
            val (rows, hidden) = buildCommentRows(post.comments)
            val identity = mapAccountType(post.creator?.accountType)
            return PulsePostDetailContent(
                post = post,
                authorDisplayName = post.creator?.displayName ?: "Pantopus user",
                authorAvatarUrl = post.creator?.profilePictureUrl,
                authorIdentity = identity,
                // TODO(backend): backend `CREATOR_SELECT` for posts does
                // not include the `verified` column today, so the post
                // header can never show a verified badge. Wire this up
                // once feedService.js#CREATOR_SELECT joins `verified`.
                authorVerified = false,
                timeAndLocality =
                    formatTimeAndLocality(
                        createdAt = post.createdAt,
                        locality = post.locationName ?: post.creator?.locality ?: post.home?.city,
                    ),
                intent = PostIntent.from(post.purpose, post.postType),
                media =
                    buildPostMediaItems(
                        urls = post.mediaUrls,
                        types = post.mediaTypes,
                        thumbnails = post.mediaThumbnails,
                        liveUrls = post.mediaLiveUrls,
                    ),
                reactions =
                    PostReactionCounts(
                        helpful = post.likeCount,
                        heart = 0,
                        going = 0,
                        userReaction = if (post.userHasLiked) PostReactionKind.Helpful else null,
                    ),
                comments = rows,
                hiddenReplyCount = hidden,
            )
        }

        private fun mapAccountType(type: String?): IdentityPillar =
            when (type) {
                "business" -> IdentityPillar.Business
                "home" -> IdentityPillar.Home
                else -> IdentityPillar.Personal
            }

        private fun buildCommentRows(comments: List<PostCommentDto>): Pair<List<PostCommentRow>, Int> {
            val visible = comments.filter { !it.isDeleted }
            val topLevel = visible.filter { it.parentCommentId == null }
            val repliesByParent =
                visible.filter { it.parentCommentId != null }
                    .groupBy { it.parentCommentId ?: "" }
                    .mapValues { (_, list) -> list.sortedBy { it.createdAt } }

            val rows = mutableListOf<PostCommentRow>()
            var visibleReplyCount = 0
            var totalReplyCount = 0

            for (parent in topLevel) {
                rows += rowFrom(parent, indent = 0)
                val replies = repliesByParent[parent.id].orEmpty()
                totalReplyCount += replies.size
                val cap =
                    if (showingAllReplies.value) {
                        replies.size
                    } else {
                        minOf(maxInitialReplies, replies.size)
                    }
                for (reply in replies.take(cap)) {
                    rows += rowFrom(reply, indent = 1)
                    visibleReplyCount++
                }
            }
            val hidden =
                if (showingAllReplies.value) {
                    0
                } else {
                    (totalReplyCount - visibleReplyCount).coerceAtLeast(0)
                }
            return rows to hidden
        }

        private fun rowFrom(
            comment: PostCommentDto,
            indent: Int,
        ): PostCommentRow =
            PostCommentRow(
                id = comment.id,
                authorName = comment.author?.displayName ?: "Pantopus user",
                authorAvatarUrl = comment.author?.profilePictureUrl,
                authorIdentity = mapAccountType(comment.author?.accountType),
                body = comment.comment,
                timestamp = relativeTimestamp(comment.createdAt),
                reactionCount = comment.likeCount ?: 0,
                userReacted = comment.userHasLiked ?: false,
                indentLevel = indent,
                authorUserId = comment.author?.id,
                isOwn = comment.userId == signedInUserId,
            )

        private fun formatTimeAndLocality(
            createdAt: String,
            locality: String?,
        ): String {
            val ts = relativeTimestamp(createdAt)
            return if (!locality.isNullOrEmpty()) "$ts · $locality" else ts
        }

        private fun relativeTimestamp(iso: String?): String {
            if (iso.isNullOrEmpty()) return ""
            val instant =
                try {
                    Instant.parse(iso)
                } catch (_: Throwable) {
                    return ""
                }
            val elapsed = Duration.between(instant, Instant.now())
            val seconds = elapsed.seconds
            return when {
                seconds < 60 -> "Just now"
                seconds < 3_600 -> "${seconds / 60}m ago"
                seconds < 86_400 -> "${seconds / 3_600}h ago"
                seconds < 604_800 -> "${seconds / 86_400}d ago"
                else ->
                    DateTimeFormatter.ISO_LOCAL_DATE.format(
                        instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate(),
                    )
            }
        }

        private fun friendlyMessage(error: NetworkError): String =
            when (error) {
                NetworkError.NotFound -> "We couldn't find this post."
                NetworkError.Forbidden -> "You don't have access to this post."
                is NetworkError.Transport -> "Check your connection and try again."
                else -> "Something went wrong. Try again."
            }
    }
