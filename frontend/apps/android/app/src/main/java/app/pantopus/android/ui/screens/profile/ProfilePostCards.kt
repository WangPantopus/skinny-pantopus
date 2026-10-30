package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.ui.screens.feed.pulse.PulseCardLiveValues
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.feed.pulse.pulseCardContent
import app.pantopus.android.ui.screens.feed.pulseReportReasons
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * A person's posts on their profile, drawn with the Pulse card (`PulsePostCard`): photos and
 * videos, event times, tappable links, Helpful, Save, Repost and the post menu (share, report).
 * The rows come from `GET /api/posts/user/:id` (the feed's serializer) and each tap calls the
 * endpoint the Pulse feed calls for it (`PulseFeedViewModel`). Owned by [PublicProfileViewModel].
 */
class ProfilePostCards internal constructor(
    private val scope: CoroutineScope,
    private val posts: PostsRepository,
    private val viewerId: () -> String?,
    private val onToast: (String) -> Unit,
) {
    private val _cards = MutableStateFlow<List<PulsePostCardContent>>(emptyList())

    /** One card per post, in the order the server listed them. */
    val cards: StateFlow<List<PulsePostCardContent>> = _cards.asStateFlow()

    private val _optionsPostId = MutableStateFlow<String?>(null)

    /** The post whose "Post options" menu is open. */
    val optionsPostId: StateFlow<String?> = _optionsPostId.asStateFlow()

    private val _reportingPostId = MutableStateFlow<String?>(null)

    /** The post being reported: the reason picker is open. */
    val reportingPostId: StateFlow<String?> = _reportingPostId.asStateFlow()

    /** Bumped by every tap, so a read that started before one can't undo it. */
    var actionRevision = 0
        private set

    private var rows: List<FeedPost> = emptyList()
    private var overrides: Map<String, Override> = emptyMap()
    private val liking = mutableSetOf<String>()
    private val saving = mutableSetOf<String>()
    private val reposting = mutableSetOf<String>()
    private val sharing = mutableSetOf<String>()

    /** A tap's value until a later read confirms it. */
    private data class Override(
        val hasReacted: Boolean? = null,
        val likeCount: Int? = null,
        val isSaved: Boolean? = null,
        val isReposted: Boolean? = null,
        val shareCount: Int? = null,
    )

    /**
     * Rows from a read. A tap still waiting for the server keeps its value; a settled one gives
     * way to a read that started after the last tap.
     */
    fun show(
        newRows: List<FeedPost>,
        readRevision: Int,
    ) {
        rows = newRows
        if (readRevision == actionRevision) {
            overrides = overrides.filterKeys { it in liking || it in saving || it in reposting }
        }
        rebuild()
    }

    /** Whether the card's "Post options" menu has anything in it. */
    fun hasOptions(card: PulsePostCardContent): Boolean = card.actions.canShareExternally || card.actions.canReport

    fun openOptions(postId: String) {
        _optionsPostId.value = postId
    }

    fun dismissOptions() {
        _optionsPostId.value = null
    }

    fun beginReport(postId: String) {
        _optionsPostId.value = null
        _reportingPostId.value = postId
    }

    fun cancelReport() {
        _reportingPostId.value = null
    }

    /** Helpful (or Going on an Event): `POST /api/posts/:id/like`, shown at once and rolled back on failure. */
    fun tapReaction(postId: String) {
        val post = rows.firstOrNull { it.id == postId } ?: return
        if (!liking.add(postId)) return
        actionRevision++
        val original = overrides[postId]?.hasReacted ?: post.userHasLiked
        val originalCount = overrides[postId]?.likeCount ?: post.likeCount
        val toggled = !original
        put(postId) { it.copy(hasReacted = toggled, likeCount = (originalCount + if (toggled) 1 else -1).coerceAtLeast(0)) }
        scope.launch {
            try {
                when (val result = posts.toggleLike(postId, liked = toggled)) {
                    is NetworkResult.Success ->
                        put(postId) { it.copy(hasReacted = result.data.liked, likeCount = result.data.likeCount) }
                    is NetworkResult.Failure -> {
                        put(postId) { it.copy(hasReacted = original, likeCount = originalCount) }
                        onToast("Couldn't update your reaction. Try again.")
                    }
                }
            } finally {
                liking.remove(postId)
                actionRevision++
                rebuild()
            }
        }
    }

    /** `POST /api/posts/:id/save`, shown at once and rolled back on failure. */
    fun toggleSave(postId: String) {
        val post = rows.firstOrNull { it.id == postId } ?: return
        if (!saving.add(postId)) return
        actionRevision++
        val original = overrides[postId]?.isSaved ?: post.userHasSaved
        put(postId) { it.copy(isSaved = !original) }
        scope.launch {
            try {
                when (val result = posts.toggleSave(postId, saved = !original)) {
                    is NetworkResult.Success -> {
                        put(postId) { it.copy(isSaved = result.data.saved) }
                        onToast(if (result.data.saved) "Saved to your bookmarks." else "Removed from bookmarks.")
                    }
                    is NetworkResult.Failure -> {
                        put(postId) { it.copy(isSaved = original) }
                        onToast("Couldn't update your bookmark.")
                    }
                }
            } finally {
                saving.remove(postId)
                actionRevision++
                rebuild()
            }
        }
    }

    /** `POST /api/posts/:id/share` as a repost, shown at once and rolled back on failure. */
    fun toggleRepost(postId: String) {
        val post = rows.firstOrNull { it.id == postId } ?: return
        if (!reposting.add(postId)) return
        actionRevision++
        val original = overrides[postId]?.isReposted ?: post.userHasReposted
        val originalCount = overrides[postId]?.shareCount ?: post.shareCount
        put(postId) {
            it.copy(isReposted = !original, shareCount = (originalCount + if (original) -1 else 1).coerceAtLeast(0))
        }
        scope.launch {
            try {
                when (val result = posts.share(postId, shareType = "repost", reposted = !original)) {
                    is NetworkResult.Success -> {
                        val reposted = result.data.reposted ?: !original
                        put(postId) { it.copy(isReposted = reposted, shareCount = result.data.shareCount ?: originalCount) }
                        onToast(if (reposted) "Reposted to your network." else "Repost removed.")
                    }
                    is NetworkResult.Failure -> {
                        put(postId) { it.copy(isReposted = original, shareCount = originalCount) }
                        onToast("Could not update repost.")
                    }
                }
            } finally {
                reposting.remove(postId)
                actionRevision++
                rebuild()
            }
        }
    }

    /**
     * The list may predate an audience change, so the server confirms the post can still be
     * shared before its link leaves the app; [onReady] opens the share sheet with the link.
     */
    fun shareExternally(
        postId: String,
        onReady: (String, () -> Unit) -> Boolean,
    ) {
        val actor = viewerId() ?: return
        if (rows.firstOrNull { it.id == postId }?.canShareExternally != true || !sharing.add(postId)) return
        scope.launch {
            try {
                when (val result = posts.share(postId, shareType = "external", checkOnly = true)) {
                    is NetworkResult.Success ->
                        if (viewerId() == actor) {
                            val opened =
                                result.data.canShare == true &&
                                    onReady("https://www.pantopus.com/posts/$postId") { recordShare(postId, actor) }
                            if (!opened) onToast("Couldn't share this post. Try again.")
                        }
                    is NetworkResult.Failure -> onToast(result.error.displayMessage("Couldn't share this post. Try again."))
                }
            } finally {
                sharing.remove(postId)
            }
        }
    }

    /** `POST /api/posts/:id/report` with one of Pulse's report reasons. */
    fun report(
        postId: String,
        reason: String,
    ) {
        _reportingPostId.value = null
        scope.launch {
            when (posts.report(postId, reason)) {
                is NetworkResult.Success -> onToast("Report sent. We'll review it shortly.")
                is NetworkResult.Failure -> onToast("Couldn't send that report.")
            }
        }
    }

    private fun recordShare(
        postId: String,
        actor: String,
    ) {
        if (viewerId() != actor) return
        scope.launch {
            if (posts.share(postId, shareType = "external") is NetworkResult.Failure && viewerId() == actor) {
                onToast("Couldn't update the share count.")
            }
        }
    }

    private fun put(
        postId: String,
        transform: (Override) -> Override,
    ) {
        overrides = overrides + (postId to transform(overrides[postId] ?: Override()))
        rebuild()
    }

    private fun rebuild() {
        val viewer = viewerId()
        _cards.value =
            rows.map { post ->
                val value = overrides[post.id]
                val base = PulseCardLiveValues.of(post)
                pulseCardContent(
                    post = post,
                    viewerId = viewer,
                    surface = null,
                    live =
                        base.copy(
                            hasReacted = value?.hasReacted ?: base.hasReacted,
                            likeCount = value?.likeCount ?: base.likeCount,
                            isSaved = value?.isSaved ?: base.isSaved,
                            isReposted = value?.isReposted ?: base.isReposted,
                            shareCount = value?.shareCount ?: base.shareCount,
                            likePending = post.id in liking,
                            savePending = post.id in saving,
                        ),
                )
            }
    }
}

/** What each control on a profile's Pulse card does; every callback takes the post's id. */
data class ProfilePostCardActions(
    val onOpen: (String) -> Unit = {},
    val onReact: (String) -> Unit = {},
    val onOptions: (String) -> Unit = {},
    val onToggleSave: (String) -> Unit = {},
    val onToggleRepost: (String) -> Unit = {},
)

/** The card's "Post options": Share… and Report post, worded as in Pulse. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProfilePostOptionsSheet(
    card: PulsePostCardContent,
    onShare: () -> Unit,
    onReport: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("profilePostOptionsSheet"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(text = "Post options", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (card.actions.canShareExternally) {
                OptionRow(label = "Share…", testTag = "profilePostOptionsShare", onClick = onShare)
            }
            if (card.actions.canReport) {
                OptionRow(label = "Report post", testTag = "profilePostOptionsReport", isDestructive = true, onClick = onReport)
            }
            OptionRow(label = "Cancel", testTag = "profilePostOptionsCancel", onClick = onDismiss)
        }
    }
}

/** Pulse's report-reason picker for a post on a profile. */
@Composable
internal fun ProfilePostReportDialog(
    onReport: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Report this post?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = "Reports are reviewed by the Pantopus team. The author isn't told who reported.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
                pulseReportReasons.forEach { (key, label) ->
                    TextButton(
                        onClick = { onReport(key) },
                        modifier = Modifier.fillMaxWidth().testTag("profilePostReportReason_$key"),
                    ) {
                        Text(label, color = PantopusColors.appText)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun OptionRow(
    label: String,
    testTag: String,
    isDestructive: Boolean = false,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth().testTag(testTag)) {
        Text(
            text = label,
            color = if (isDestructive) PantopusColors.error else PantopusColors.appText,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
