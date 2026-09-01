@file:OptIn(
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
    androidx.compose.foundation.ExperimentalFoundationApi::class,
)
@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.shared.content_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostIntent
import app.pantopus.android.ui.screens.shared.media.PostMediaGridStyle
import app.pantopus.android.ui.screens.shared.media.PostMediaGridWithViewer
import app.pantopus.android.ui.screens.shared.media.PostMediaItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** One row in the flattened comment thread. */
data class PostCommentRow(
    val id: String,
    val authorName: String,
    val authorAvatarUrl: String?,
    val authorIdentity: IdentityPillar,
    val body: String,
    val timestamp: String,
    val reactionCount: Int = 0,
    val userReacted: Boolean = false,
    /** 0 for top-level, 1 for nested. Deeper threads collapse to 1. */
    val indentLevel: Int,
    val authorUserId: String?,
    /** True when the signed-in user wrote it — gates the Delete action. */
    val isOwn: Boolean = false,
)

/** Quick-reply prompt rendered in the empty thread state. */
data class PostQuickReplyPrompt(
    val label: String,
    val icon: PantopusIcon,
)

/** Reaction-bar counts + the user's currently-selected reaction (if any). */
data class PostReactionCounts(
    val helpful: Int = 0,
    val heart: Int = 0,
    val going: Int = 0,
    val userReaction: app.pantopus.android.data.api.models.posts.PostReactionKind? = null,
)

/**
 * Pulse post body — text + media + reactions + comment composer + flat
 * thread. Pure render surface; all state lives in the host VM.
 */
@Composable
fun BodyReactionsBody(
    body: String,
    media: List<PostMediaItem>,
    intent: PostIntent = PostIntent.Share,
    reactions: PostReactionCounts,
    onReactionTap: (app.pantopus.android.data.api.models.posts.PostReactionKind) -> Unit,
    composerAvatarUrl: String?,
    composerAvatarName: String,
    composerText: String,
    onComposerTextChange: (String) -> Unit,
    isSending: Boolean,
    onSendTap: () -> Unit,
    comments: List<PostCommentRow>,
    hiddenReplyCount: Int = 0,
    onShowMoreReplies: (() -> Unit)? = null,
    onCommentAvatarTap: (String) -> Unit = {},
    mediaLocationBadge: String? = null,
    selectedReactionEmoji: String? = null,
    onEmojiSelected: ((String) -> Unit)? = null,
    reactionEmojis: List<String> = emptyList(),
    replyingToName: String? = null,
    onCancelReply: () -> Unit = {},
    onCommentReply: ((PostCommentRow) -> Unit)? = null,
    onCommentLike: ((PostCommentRow) -> Unit)? = null,
    onCommentDelete: ((PostCommentRow) -> Unit)? = null,
    /**
     * Optional card rendered between the reaction bar and the comment
     * composer. Pulse post detail passes the "Nearby Providers" card here;
     * every other caller leaves it null.
     */
    belowReactions: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (body.isNotEmpty()) {
            Text(
                text = body,
                fontSize = 15.sp,
                color = PantopusColors.appText,
                lineHeight = 22.sp,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
        if (media.isNotEmpty()) {
            PostMediaGridWithViewer(
                items = media,
                style = PostMediaGridStyle.Regular,
                testTag = "pulsePostDetail-media",
                locationBadge = mediaLocationBadge,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
        ReactionsBar(
            counts = reactions,
            commentCount = comments.size + hiddenReplyCount,
            commentsAreFresh = comments.isEmpty(),
            onTap = onReactionTap,
            selectedEmoji = selectedReactionEmoji,
            onEmojiSelected = onEmojiSelected,
            reactionEmojis = reactionEmojis,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        HorizontalDivider(
            color = PantopusColors.appBorder,
            thickness = 1.dp,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        belowReactions?.let { slot ->
            Box(modifier = Modifier.padding(horizontal = Spacing.s4)) { slot() }
        }
        if (replyingToName != null) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = "Replying to $replyingToName",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurfaceSunken)
                            .clickable(onClick = onCancelReply)
                            .testTag("pulsePostDetail-cancelReply")
                            .semantics { contentDescription = "Cancel reply" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = 12.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        CommentComposer(
            avatarName = composerAvatarName,
            avatarUrl = composerAvatarUrl,
            text = composerText,
            onTextChange = onComposerTextChange,
            placeholder =
                when {
                    replyingToName != null -> "Reply to $replyingToName..."
                    comments.isEmpty() -> "Be the first to reply..."
                    else -> "Add a comment"
                },
            isFocusedPresentation = comments.isEmpty(),
            isSending = isSending,
            onSend = onSendTap,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        if (comments.isNotEmpty()) {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                comments.forEach { row ->
                    CommentRow(
                        row = row,
                        onAvatarTap = {
                            row.authorUserId?.let(onCommentAvatarTap)
                        },
                        onReply = onCommentReply?.let { handler -> { handler(row) } },
                        onToggleLike = onCommentLike?.let { handler -> { handler(row) } },
                        onDelete = if (row.isOwn) onCommentDelete?.let { handler -> { handler(row) } } else null,
                    )
                }
                if (hiddenReplyCount > 0 && onShowMoreReplies != null) {
                    Text(
                        text =
                            "View $hiddenReplyCount more " +
                                if (hiddenReplyCount == 1) "reply" else "replies",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                        modifier =
                            Modifier
                                .padding(start = (28 + 12).dp)
                                .heightIn(min = 44.dp)
                                .clickable(onClick = onShowMoreReplies)
                                .semantics { contentDescription = "View $hiddenReplyCount more replies" },
                    )
                }
            }
        } else {
            EmptyThreadState(
                intent = intent,
                prompts = intent.quickReplyPrompts,
                onPromptTap = { onComposerTextChange(it.label) },
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
    }
}

@Composable
private fun ReactionsBar(
    counts: PostReactionCounts,
    commentCount: Int,
    commentsAreFresh: Boolean,
    onTap: (app.pantopus.android.data.api.models.posts.PostReactionKind) -> Unit,
    modifier: Modifier = Modifier,
    selectedEmoji: String? = null,
    onEmojiSelected: ((String) -> Unit)? = null,
    reactionEmojis: List<String> = emptyList(),
) {
    var showsEmojiPicker by remember { mutableStateOf(false) }
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            ReactionPill(
                id = "heart",
                icon = PantopusIcon.Heart,
                count = counts.helpful,
                isSelected = counts.userReaction == app.pantopus.android.data.api.models.posts.PostReactionKind.Helpful,
                selectedForeground = PantopusColors.error,
                selectedBackground = PantopusColors.errorBg,
                onTap = { onTap(app.pantopus.android.data.api.models.posts.PostReactionKind.Helpful) },
                onLongPress =
                    if (onEmojiSelected != null && reactionEmojis.isNotEmpty()) {
                        { showsEmojiPicker = true }
                    } else {
                        null
                    },
                emojiGlyph =
                    selectedEmoji?.takeIf {
                        counts.userReaction == app.pantopus.android.data.api.models.posts.PostReactionKind.Helpful
                    },
                accessibilityLabel = "Heart reaction, ${counts.helpful}",
            )
            DropdownMenu(
                expanded = showsEmojiPicker,
                onDismissRequest = { showsEmojiPicker = false },
            ) {
                Row(
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s2)
                            .testTag("pulsePostDetail-emojiPicker"),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    reactionEmojis.forEach { emoji ->
                        Text(
                            text = emoji,
                            fontSize = 24.sp,
                            modifier =
                                Modifier
                                    .clip(CircleShape)
                                    .clickable {
                                        showsEmojiPicker = false
                                        onEmojiSelected?.invoke(emoji)
                                    }
                                    .padding(Spacing.s1)
                                    .semantics { contentDescription = "React with $emoji" },
                        )
                    }
                }
            }
        }
        ReactionPill(
            id = "hand",
            icon = PantopusIcon.Hand,
            count = counts.heart,
            isSelected = counts.userReaction == app.pantopus.android.data.api.models.posts.PostReactionKind.Heart,
            onTap = null,
            accessibilityLabel = "Raised hand reaction, ${counts.heart}",
        )
        ReactionPill(
            id = "eye",
            icon = PantopusIcon.Eye,
            count = counts.going,
            isSelected = counts.userReaction == app.pantopus.android.data.api.models.posts.PostReactionKind.Going,
            onTap = null,
            accessibilityLabel = "Watching reaction, ${counts.going}",
        )
        Spacer(Modifier.weight(1f))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            modifier = Modifier.semantics { contentDescription = commentSummary(commentCount, commentsAreFresh) },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MessageCircle,
                contentDescription = null,
                size = 13.dp,
                tint = if (commentsAreFresh) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
            )
            Text(
                text = commentSummary(commentCount, commentsAreFresh),
                fontSize = 11.sp,
                color = if (commentsAreFresh) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun ReactionPill(
    id: String,
    icon: PantopusIcon,
    count: Int,
    isSelected: Boolean,
    selectedForeground: Color = PantopusColors.primary700,
    selectedBackground: Color = PantopusColors.primary50,
    /** `null` renders the pill as display-only (no click handler). */
    onTap: (() -> Unit)?,
    onLongPress: (() -> Unit)? = null,
    /** Renders the chosen emoji instead of the icon glyph when set. */
    emojiGlyph: String? = null,
    accessibilityLabel: String,
) {
    val background = if (isSelected) selectedBackground else PantopusColors.appSurface
    val foreground = if (isSelected) selectedForeground else PantopusColors.appTextSecondary
    val border = if (isSelected) selectedForeground.copy(alpha = 0.25f) else PantopusColors.appBorder
    val baseModifier =
        Modifier
            .clip(RoundedCornerShape(Radii.pill))
            .background(background)
            .drawBehind {
                drawRoundRect(
                    color = border,
                    style = Stroke(width = 1.dp.toPx()),
                    cornerRadius = CornerRadius(Radii.pill.toPx(), Radii.pill.toPx()),
                )
            }
            .sizeIn(minHeight = 44.dp)
    val withClick =
        when {
            onTap != null && onLongPress != null ->
                baseModifier.combinedClickable(onClick = onTap, onLongClick = onLongPress)
            onTap != null -> baseModifier.clickable(onClick = onTap)
            else -> baseModifier
        }
    Box(
        modifier =
            withClick
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .testTag("pulsePostDetail-reaction-$id")
                .semantics { contentDescription = accessibilityLabel },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            if (emojiGlyph != null) {
                Text(text = emojiGlyph, fontSize = 14.sp)
            } else {
                PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = foreground)
            }
            Text(
                text = "$count",
                fontSize = 12.sp,
                color = foreground.copy(alpha = 0.85f),
            )
        }
    }
}

private fun commentSummary(
    commentCount: Int,
    commentsAreFresh: Boolean,
): String =
    if (commentsAreFresh) {
        "0 comments · just posted"
    } else {
        "$commentCount ${if (commentCount == 1) "comment" else "comments"}"
    }

@Composable
private fun CommentComposer(
    avatarName: String,
    avatarUrl: String?,
    text: String,
    onTextChange: (String) -> Unit,
    placeholder: String,
    isFocusedPresentation: Boolean,
    isSending: Boolean,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        AvatarWithIdentityRing(
            name = avatarName,
            imageUrl = avatarUrl,
            identity = IdentityPillar.Personal,
            ringProgress = 1f,
            size = 28.dp,
        )
        val canSend = text.trim().isNotEmpty() && !isSending
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            placeholder = { Text(placeholder, fontSize = 14.sp) },
            singleLine = true,
            shape = RoundedCornerShape(Radii.pill),
            textStyle = TextStyle(fontSize = 14.sp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (canSend) onSend() }),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = if (isFocusedPresentation) PantopusColors.primary500 else PantopusColors.appBorder,
                    unfocusedBorderColor = if (isFocusedPresentation) PantopusColors.primary500 else PantopusColors.appBorder,
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                ),
            modifier =
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .testTag("pulsePostDetail-composer")
                    .semantics { contentDescription = placeholder },
        )
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(if (canSend || isFocusedPresentation) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                    .clickable(enabled = canSend, onClick = onSend)
                    .testTag("pulsePostDetail-sendComment")
                    .semantics { contentDescription = "Send comment" },
            contentAlignment = Alignment.Center,
        ) {
            if (isSending) {
                CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                PantopusIconImage(
                    icon = PantopusIcon.Send,
                    contentDescription = null,
                    size = 18.dp,
                    tint = if (canSend || isFocusedPresentation) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun CommentRow(
    row: PostCommentRow,
    onAvatarTap: () -> Unit,
    onReply: (() -> Unit)? = null,
    onToggleLike: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (row.indentLevel > 0) {
            Spacer(Modifier.width((row.indentLevel * 36).dp))
        }
        Box(
            modifier =
                Modifier
                    .sizeIn(minWidth = 28.dp, minHeight = 28.dp)
                    .testTag("pulsePostDetail-commentAvatar-${row.id}")
                    .clickable(onClick = onAvatarTap)
                    .semantics { contentDescription = "Open ${row.authorName}'s profile" },
        ) {
            AvatarWithIdentityRing(
                name = row.authorName,
                imageUrl = row.authorAvatarUrl,
                identity = row.authorIdentity,
                ringProgress = 1f,
                size = if (row.indentLevel > 0) 24.dp else 28.dp,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Column(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .drawBehind {
                            drawRoundRect(
                                color = PantopusColors.appBorder,
                                style = Stroke(width = 1.dp.toPx()),
                                cornerRadius = CornerRadius(Radii.lg.toPx(), Radii.lg.toPx()),
                            )
                        }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = row.authorName,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Text("·", fontSize = 10.sp, color = PantopusColors.appTextMuted)
                    Text(
                        text = row.timestamp,
                        fontSize = 10.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
                Text(
                    text = row.body,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextStrong,
                    lineHeight = 16.sp,
                )
            }
            Row(
                modifier = Modifier.padding(start = Spacing.s1),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 48.dp)
                            .testTag("pulsePostDetail-reply-${row.id}")
                            .clickable(onClick = onReply ?: {})
                            .semantics { contentDescription = "Reply to ${row.authorName}" },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Reply",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 48.dp)
                            .testTag("pulsePostDetail-commentHeart-${row.id}")
                            .clickable(onClick = onToggleLike ?: {})
                            .semantics { contentDescription = "Heart ${row.authorName}'s reply, ${row.reactionCount}" },
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Heart,
                            contentDescription = null,
                            size = 11.dp,
                            tint = if (row.userReacted) PantopusColors.error else PantopusColors.appTextSecondary,
                        )
                        Text(
                            text = "${row.reactionCount}",
                            fontSize = 10.5.sp,
                            color = if (row.userReacted) PantopusColors.error else PantopusColors.appTextSecondary,
                        )
                    }
                }
                if (onDelete != null) {
                    Box(
                        modifier =
                            Modifier
                                .heightIn(min = 48.dp)
                                .testTag("pulsePostDetail-commentDelete-${row.id}")
                                .clickable(onClick = onDelete)
                                .semantics { contentDescription = "Delete your reply" },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Delete",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.error,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyThreadState(
    intent: PostIntent,
    prompts: List<PostQuickReplyPrompt>,
    onPromptTap: (PostQuickReplyPrompt) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .drawBehind {
                    drawRoundRect(
                        color = PantopusColors.appBorder,
                        style =
                            Stroke(
                                width = 1.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())),
                            ),
                        cornerRadius = CornerRadius(Radii.lg.toPx(), Radii.lg.toPx()),
                    )
                }
                .padding(horizontal = Spacing.s4, vertical = Spacing.s6)
                .testTag("pulsePostDetail-emptyThread"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MessageSquarePlus,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.primary600,
            )
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "Be the first to reply",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = emptySubcopy(intent),
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.width(250.dp),
            )
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            prompts.forEach { prompt ->
                QuickReplyChip(prompt = prompt, onClick = { onPromptTap(prompt) })
            }
        }
    }
}

@Composable
private fun QuickReplyChip(
    prompt: PostQuickReplyPrompt,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .drawBehind {
                    drawRoundRect(
                        color = PantopusColors.appBorder,
                        style = Stroke(width = 1.dp.toPx()),
                        cornerRadius = CornerRadius(Radii.pill.toPx(), Radii.pill.toPx()),
                    )
                }
                .heightIn(min = 48.dp)
                .clickable(onClick = onClick)
                .testTag("pulsePostDetail-quickReply-${prompt.label}")
                .semantics { contentDescription = prompt.label }
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = prompt.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = prompt.label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

private fun emptySubcopy(intent: PostIntent): String =
    when (intent) {
        PostIntent.LostFound -> "A neighbor sighting, a tip, or even a \"looking\" matters in the first hour."
        PostIntent.Ask -> "A question, tip, or resource can get the thread moving."
        PostIntent.Offer -> "Ask a detail, claim interest, or help the offer find the right neighbor."
        PostIntent.Event -> "A quick RSVP or offer to bring something helps the host plan."
        PostIntent.Share -> "Add context, say thanks, or help other neighbors spot why it matters."
        PostIntent.Alert -> "Confirm what you are seeing nearby or share a useful next step."
    }

val PostIntent.quickReplyPrompts: List<PostQuickReplyPrompt>
    get() =
        when (this) {
            PostIntent.Ask ->
                listOf(
                    PostQuickReplyPrompt("Try a question reply", PantopusIcon.HelpCircle),
                    PostQuickReplyPrompt("Share a tip", PantopusIcon.Lightbulb),
                    PostQuickReplyPrompt("Suggest a resource", PantopusIcon.Share),
                )
            PostIntent.LostFound ->
                listOf(
                    PostQuickReplyPrompt("I've seen it", PantopusIcon.Eye),
                    PostQuickReplyPrompt("Have you checked X?", PantopusIcon.MapPin),
                    PostQuickReplyPrompt("DM me about details", PantopusIcon.MessageCircle),
                )
            PostIntent.Offer ->
                listOf(
                    PostQuickReplyPrompt("I'm interested", PantopusIcon.Hand),
                    PostQuickReplyPrompt("Can pick up today", PantopusIcon.Check),
                    PostQuickReplyPrompt("Any details?", PantopusIcon.HelpCircle),
                )
            PostIntent.Event ->
                listOf(
                    PostQuickReplyPrompt("I'm going", PantopusIcon.CheckCircle),
                    PostQuickReplyPrompt("Can bring supplies", PantopusIcon.ShoppingBag),
                    PostQuickReplyPrompt("What time?", PantopusIcon.Clock),
                )
            PostIntent.Share ->
                listOf(
                    PostQuickReplyPrompt("Thanks for sharing", PantopusIcon.Heart),
                    PostQuickReplyPrompt("I can add context", PantopusIcon.MessageCircle),
                    PostQuickReplyPrompt("Saving this", PantopusIcon.Bookmark),
                )
            PostIntent.Alert ->
                listOf(
                    PostQuickReplyPrompt("Thanks for the heads up", PantopusIcon.AlertCircle),
                    PostQuickReplyPrompt("I can confirm", PantopusIcon.Check),
                    PostQuickReplyPrompt("Need help?", PantopusIcon.HelpCircle),
                )
        }
