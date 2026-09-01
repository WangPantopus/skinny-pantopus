@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "TooManyFunctions", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.posts

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.screens.shared.content_detail.bodies.BodyReactionsBody
import app.pantopus.android.ui.screens.shared.content_detail.bodies.PostCommentRow
import app.pantopus.android.ui.screens.shared.content_detail.ctas.InlineReplyCta
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostAuthorHeader
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Report reasons mirrored from the iOS reasons dialog. */
private val reportReasons =
    listOf(
        "spam" to "Spam",
        "harassment" to "Harassment",
        "inappropriate" to "Inappropriate content",
        "misinformation" to "Misinformation",
        "safety" to "Safety concern",
        "other" to "Other",
    )

/**
 * Pulse post detail screen. ViewModel reads the post id via the
 * nav-backstack [androidx.lifecycle.SavedStateHandle].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PulsePostDetailScreen(
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit = {},
    onEdit: (String) -> Unit = {},
    /** "Nearby Providers" tap-through. Carries the business *username*. */
    onOpenBusiness: (String) -> Unit = {},
    viewModel: PulsePostDetailViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    val composer by viewModel.composerText.collectAsStateWithLifecycle()
    val isSending by viewModel.isSendingComment.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val showsOverflow by viewModel.showsOverflowMenu.collectAsStateWithLifecycle()
    val didDelete by viewModel.didDeletePost.collectAsStateWithLifecycle()
    val isSaved by viewModel.isSaved.collectAsStateWithLifecycle()
    val isReposted by viewModel.isReposted.collectAsStateWithLifecycle()
    val selectedEmoji by viewModel.selectedReactionEmoji.collectAsStateWithLifecycle()
    val replyTarget by viewModel.replyTarget.collectAsStateWithLifecycle()
    val nearbyProviders by viewModel.nearbyProviders.collectAsStateWithLifecycle()

    var showsReportReasons by remember { mutableStateOf(false) }
    var showsDeleteConfirm by remember { mutableStateOf(false) }
    var commentPendingDelete by remember { mutableStateOf<PostCommentRow?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) { viewModel.loadNearbyProviders() }

    LaunchedEffect(didDelete) {
        if (didDelete) onBack()
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }

    fun launchShareSheet() {
        val send =
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, viewModel.shareUrl)
            }
        context.startActivity(Intent.createChooser(send, "Share post"))
        viewModel.recordShare()
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        when (val s = state) {
            PulsePostDetailUiState.Loading -> LoadingLayout(onBack = onBack)
            is PulsePostDetailUiState.Error -> ErrorLayout(message = s.message, onRetry = { viewModel.refresh() })
            is PulsePostDetailUiState.Loaded -> {
                val content = s.content
                PulsePostDetailLoadedContent(
                    content = content,
                    composerText = composer,
                    onComposerTextChange = { viewModel.setComposerText(it) },
                    isSending = isSending,
                    topBarAction =
                        ContentDetailTopBarAction(
                            icon = PantopusIcon.MoreHorizontal,
                            contentDescription = "Post options",
                            onClick = { viewModel.openOverflowMenu() },
                        ),
                    topBarSecondaryAction =
                        ContentDetailTopBarAction(
                            icon = PantopusIcon.Share,
                            contentDescription = "Share post",
                            onClick = { launchShareSheet() },
                        ),
                    onBack = onBack,
                    onOpenProfile = onOpenProfile,
                    nearbyProviders = nearbyProviders,
                    onOpenBusiness = onOpenBusiness,
                    onReactionTap = { kind -> viewModel.tapReaction(kind) },
                    onSendTap = { viewModel.sendComment() },
                    onShowMoreReplies = { viewModel.showMoreReplies() },
                    selectedReactionEmoji = selectedEmoji,
                    onEmojiSelected = { viewModel.pickReactionEmoji(it) },
                    replyingToName = replyTarget?.authorName,
                    onCancelReply = { viewModel.cancelReply() },
                    onCommentReply = { row -> viewModel.beginReply(row.id, row.authorName) },
                    onCommentLike = { row -> viewModel.toggleCommentLike(row.id) },
                    onCommentDelete = { row -> commentPendingDelete = row },
                )
            }
        }
        toast?.let { message ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 100.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.error)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(message, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
            }
        }
    }

    if (showsOverflow) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissOverflowMenu() },
            sheetState = sheetState,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = "Post options",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                OverflowAction(
                    label = if (isSaved) "Remove bookmark" else "Save post",
                    testTag = "pulsePostDetail-save",
                ) {
                    viewModel.dismissOverflowMenu()
                    viewModel.toggleSave()
                }
                OverflowAction(
                    label = if (isReposted) "Undo repost" else "Repost",
                    testTag = "pulsePostDetail-repost",
                ) {
                    viewModel.dismissOverflowMenu()
                    viewModel.toggleRepost()
                }
                if (viewModel.isOwner) {
                    OverflowAction(label = "Edit post", testTag = "pulsePostDetail-edit") {
                        viewModel.dismissOverflowMenu()
                        (state as? PulsePostDetailUiState.Loaded)?.let { onEdit(it.content.post.id) }
                    }
                    OverflowAction(
                        label = "Delete post",
                        testTag = "pulsePostDetail-delete",
                        isDestructive = true,
                    ) {
                        viewModel.dismissOverflowMenu()
                        showsDeleteConfirm = true
                    }
                } else {
                    OverflowAction(
                        label = "Report post",
                        testTag = "pulsePostDetail-report",
                        isDestructive = true,
                    ) {
                        viewModel.dismissOverflowMenu()
                        showsReportReasons = true
                    }
                }
                OverflowAction(label = "Cancel", testTag = "pulsePostDetail-overflowCancel") {
                    viewModel.dismissOverflowMenu()
                }
            }
        }
    }

    if (showsReportReasons) {
        AlertDialog(
            onDismissRequest = { showsReportReasons = false },
            title = { Text("Report this post?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    reportReasons.forEach { (key, label) ->
                        TextButton(
                            onClick = {
                                showsReportReasons = false
                                viewModel.reportPost(key)
                            },
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .testTag("pulsePostDetail-reportReason-$key"),
                        ) {
                            Text(label, color = PantopusColors.appText)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showsReportReasons = false }) { Text("Cancel") }
            },
        )
    }

    if (showsDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showsDeleteConfirm = false },
            title = { Text("Delete this post?") },
            text = { Text("This can't be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showsDeleteConfirm = false
                        viewModel.deletePost()
                    },
                    modifier = Modifier.testTag("pulsePostDetail-deleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showsDeleteConfirm = false }) { Text("Cancel") }
            },
        )
    }

    commentPendingDelete?.let { pending ->
        AlertDialog(
            onDismissRequest = { commentPendingDelete = null },
            title = { Text("Delete this reply?") },
            text = { Text("This can't be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteComment(pending.id)
                        commentPendingDelete = null
                    },
                    modifier = Modifier.testTag("pulsePostDetail-commentDeleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { commentPendingDelete = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun OverflowAction(
    label: String,
    testTag: String,
    isDestructive: Boolean = false,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag(testTag),
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = if (isDestructive) PantopusColors.error else PantopusColors.appText,
        )
    }
}

@Composable
fun PulsePostDetailLoadedContent(
    content: PulsePostDetailContent,
    composerText: String,
    onComposerTextChange: (String) -> Unit,
    isSending: Boolean,
    topBarAction: ContentDetailTopBarAction? = null,
    topBarSecondaryAction: ContentDetailTopBarAction? = null,
    onBack: () -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    /** Organically matched local businesses — empty hides the card. */
    nearbyProviders: List<NearbyProviderRow> = emptyList(),
    onOpenBusiness: (String) -> Unit = {},
    onReactionTap: (app.pantopus.android.data.api.models.posts.PostReactionKind) -> Unit = {},
    onSendTap: () -> Unit = {},
    onShowMoreReplies: () -> Unit = {},
    selectedReactionEmoji: String? = null,
    onEmojiSelected: ((String) -> Unit)? = null,
    replyingToName: String? = null,
    onCancelReply: () -> Unit = {},
    onCommentReply: ((PostCommentRow) -> Unit)? = null,
    onCommentLike: ((PostCommentRow) -> Unit)? = null,
    onCommentDelete: ((PostCommentRow) -> Unit)? = null,
) {
    ContentDetailShell(
        title = "Post",
        onBack = onBack,
        topBarAction = topBarAction,
        topBarSecondaryAction = topBarSecondaryAction,
        cta = { InlineReplyCta() },
        header = {
            PostAuthorHeader(
                displayName = content.authorDisplayName,
                avatarUrl = content.authorAvatarUrl,
                isVerified = content.authorVerified,
                identity = content.authorIdentity,
                timeAndLocality = content.timeAndLocality,
                intent = content.intent,
                onAvatarTap = { onOpenProfile(content.post.userId) },
            )
        },
        body = {
            BodyReactionsBody(
                body = content.post.content,
                media = content.media,
                intent = content.intent,
                reactions = content.reactions,
                onReactionTap = onReactionTap,
                composerAvatarUrl = null,
                composerAvatarName = "You",
                composerText = composerText,
                onComposerTextChange = onComposerTextChange,
                isSending = isSending,
                onSendTap = onSendTap,
                comments = content.comments,
                hiddenReplyCount = content.hiddenReplyCount,
                onShowMoreReplies = onShowMoreReplies,
                onCommentAvatarTap = onOpenProfile,
                mediaLocationBadge = content.post.locationName,
                selectedReactionEmoji = selectedReactionEmoji,
                onEmojiSelected = onEmojiSelected,
                reactionEmojis = pulseReactionEmojis,
                replyingToName = replyingToName,
                onCancelReply = onCancelReply,
                onCommentReply = onCommentReply,
                onCommentLike = onCommentLike,
                onCommentDelete = onCommentDelete,
                belowReactions =
                    if (nearbyProviders.isEmpty()) {
                        null
                    } else {
                        {
                            NearbyProvidersCard(
                                rows = nearbyProviders,
                                onOpenBusiness = onOpenBusiness,
                            )
                        }
                    },
            )
        },
    )
}

@Composable
private fun LoadingLayout(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        ContentDetailTopBar(title = "Post", onBack = onBack, action = null)
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 220.dp, height = 22.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 16.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 16.dp, cornerRadius = Radii.sm)
            Shimmer(width = 320.dp, height = 160.dp, cornerRadius = Radii.lg)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Shimmer(width = 80.dp, height = 32.dp, cornerRadius = Radii.pill)
                Shimmer(width = 80.dp, height = 32.dp, cornerRadius = Radii.pill)
                Shimmer(width = 80.dp, height = 32.dp, cornerRadius = Radii.pill)
            }
        }
    }
}

@Composable
private fun ErrorLayout(
    message: String,
    onRetry: () -> Unit,
) {
    EmptyState(
        icon = PantopusIcon.AlertCircle,
        headline = "Couldn't load this post",
        subcopy = message,
        ctaTitle = "Try again",
        onCta = onRetry,
    )
}
