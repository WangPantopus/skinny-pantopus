@file:OptIn(
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
    androidx.compose.foundation.ExperimentalFoundationApi::class,
)
@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "LongMethod", "TooManyFunctions", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.shared.content_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.posts.PostReactionEmoji
import app.pantopus.android.data.api.models.posts.PostReactionKind
import app.pantopus.android.data.api.models.posts.PostReactionSummary
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.feed.pulse.PulseEventDetailRows
import app.pantopus.android.ui.screens.feed.pulse.PulseEventDetails
import app.pantopus.android.ui.screens.feed.pulse.PulseReactionPicker
import app.pantopus.android.ui.screens.feed.pulse.icon
import app.pantopus.android.ui.screens.moments.components.momentsRing
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostIntent
import app.pantopus.android.ui.screens.shared.media.PostMediaGridStyle
import app.pantopus.android.ui.screens.shared.media.PostMediaGridWithViewer
import app.pantopus.android.ui.screens.shared.media.PostMediaItem
import app.pantopus.android.ui.screens.shared.media.postLinkedText
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

/**
 * The post's reaction under it: an Event's Going, or every other post's emoji ([emoji]: each emoji's count and the
 * signed-in person's own). [likeCount] is how many people reacted (are going) and [isOn] whether the signed-in person
 * did (is).
 */
data class PostReactionCounts(
    val kind: PostReactionKind = PostReactionKind.Emoji,
    val likeCount: Int = 0,
    val isOn: Boolean = false,
    val emoji: PostReactionSummary = PostReactionSummary(),
) {
    companion object {
        /** An emoji post's reactions, counted from its [summary]. */
        fun emoji(summary: PostReactionSummary): PostReactionCounts =
            PostReactionCounts(kind = PostReactionKind.Emoji, likeCount = summary.total, isOn = summary.mine != null, emoji = summary)
    }
}

/** The optional line under the post text; selectable, so a phone number can be copied. */
@Composable
private fun BodyDetailLine(line: String?) {
    if (line == null) return
    SelectionContainer {
        Text(
            text = line,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .testTag("pulsePostDetail-detailLine"),
        )
    }
}

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
    /** An Event's Going. */
    onReactionTap: () -> Unit,
    /** An emoji tapped (a chip, or the picker's): sets the signed-in person's reaction, or takes theirs away. */
    onChooseReaction: (PostReactionEmoji) -> Unit = {},
    composerAvatarUrl: String?,
    composerAvatarName: String,
    composerText: String,
    onComposerTextChange: (String) -> Unit,
    isSending: Boolean,
    onSendTap: () -> Unit,
    comments: List<PostCommentRow>,
    /** The post is under an hour old, so an empty thread reads "just posted". */
    postedRecently: Boolean = false,
    hiddenReplyCount: Int = 0,
    onShowMoreReplies: (() -> Unit)? = null,
    onCommentAvatarTap: (String) -> Unit = {},
    mediaLocationBadge: String? = null,
    /** One line of details under the text, such as a Lost & Found post's contact; null for none. */
    detailLine: String? = null,
    /** An Event's when and where, under the text; null on other posts. */
    eventDetails: PulseEventDetails? = null,
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
    /**
     * Shown in place of the composer when nobody can reply (a post a
     * moderator removed); null keeps the composer and the empty-thread prompts.
     */
    repliesClosedNote: String? = null,
    /**
     * Instant Screens: the post shows from its feed card while its comments load. The bar counts the card's
     * [loadingCommentCount], and placeholder rows stand where the comments will be.
     */
    commentsLoading: Boolean = false,
    loadingCommentCount: Int = 0,
) {
    val placeholders = commentsLoading && comments.isEmpty() && loadingCommentCount > 0
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (body.isNotEmpty()) {
            Text(
                text = postLinkedText(body),
                fontSize = 15.sp,
                color = PantopusColors.appText,
                lineHeight = 22.sp,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
        eventDetails?.let { event ->
            PulseEventDetailRows(
                details = event,
                page = true,
                whenTag = "pulsePostDetail-eventWhen",
                placeTag = "pulsePostDetail-eventPlace",
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
        BodyDetailLine(detailLine)
        if (media.isNotEmpty()) {
            PostMediaGridWithViewer(
                items = media,
                style = PostMediaGridStyle.Regular,
                testTag = "pulsePostDetail-media",
                usesSharpPreviews = true,
                edgeToEdge = true,
                locationBadge = mediaLocationBadge,
            )
        }
        ReactionsBar(
            counts = reactions,
            commentCount = if (placeholders) loadingCommentCount else comments.size + hiddenReplyCount,
            commentsAreFresh = comments.isEmpty() && !placeholders,
            postedRecently = postedRecently,
            onTap = onReactionTap,
            onChoose = onChooseReaction,
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
        if (repliesClosedNote == null && replyingToName != null) {
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
        if (repliesClosedNote != null) {
            Text(
                text = repliesClosedNote,
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .testTag("pulsePostDetail-repliesClosed"),
            )
        } else {
            CommentComposer(
                avatarName = composerAvatarName,
                avatarUrl = composerAvatarUrl,
                text = composerText,
                onTextChange = onComposerTextChange,
                placeholder =
                    when {
                        replyingToName != null -> "Reply to $replyingToName..."
                        comments.isEmpty() && !placeholders -> "Be the first to reply..."
                        else -> "Add a comment"
                    },
                isFocusedPresentation = comments.isEmpty() && !placeholders,
                isSending = isSending,
                onSend = onSendTap,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
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
        } else if (placeholders) {
            CommentPlaceholders(count = loadingCommentCount, modifier = Modifier.padding(horizontal = Spacing.s4))
        } else if (repliesClosedNote == null) {
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
    postedRecently: Boolean,
    onTap: () -> Unit,
    onChoose: (PostReactionEmoji) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        when (counts.kind) {
            // An Event keeps its Going pill ("Going 3").
            PostReactionKind.Going -> {
                ReactionPill(
                    testTag = "pulsePostDetail-reaction-${counts.kind.key}",
                    isSelected = counts.isOn,
                    onTap = onTap,
                    accessibilityLabel = if (counts.likeCount == 0) counts.kind.label else "${counts.kind.label}, ${counts.likeCount}",
                ) { foreground ->
                    PantopusIconImage(icon = counts.kind.icon, contentDescription = null, size = 14.dp, tint = foreground)
                    Text(
                        text = counts.kind.label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = foreground,
                    )
                    if (counts.likeCount != 0) {
                        Text(
                            text = "${counts.likeCount}",
                            fontSize = 12.sp,
                            color = foreground.copy(alpha = 0.85f),
                        )
                    }
                }
                Spacer(Modifier.weight(1f))
            }
            PostReactionKind.Emoji -> EmojiReactionChips(summary = counts.emoji, onChoose = onChoose, modifier = Modifier.weight(1f))
        }
        // Level with the first line of reactions, which wrap below it.
        Box(modifier = Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.Center) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier = Modifier.semantics { contentDescription = commentSummary(commentCount, commentsAreFresh, postedRecently) },
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageCircle,
                    contentDescription = null,
                    size = 13.dp,
                    tint = if (commentsAreFresh) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
                )
                Text(
                    text = commentSummary(commentCount, commentsAreFresh, postedRecently),
                    fontSize = 11.sp,
                    color = if (commentsAreFresh) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/**
 * An emoji post's reactions: a chip per emoji someone used ("👍 3", the most used first, the signed-in person's
 * selected), wrapping onto more lines as needed, then the add-reaction button (the smile, with "React" while nobody has
 * reacted), which opens the emoji picker. A chip sets its emoji, or takes the signed-in person's reaction away when it's
 * theirs.
 */
@Composable
private fun EmojiReactionChips(
    summary: PostReactionSummary,
    onChoose: (PostReactionEmoji) -> Unit,
    modifier: Modifier = Modifier,
) {
    var picking by remember { mutableStateOf(false) }
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        summary.counts.forEach { (emoji, count) ->
            ReactionPill(
                testTag = "pulsePostDetail-reaction-${emoji.key}",
                isSelected = emoji == summary.mine,
                onTap = { onChoose(emoji) },
                accessibilityLabel = "${emoji.label}, $count",
            ) { foreground ->
                Text(text = emoji.emoji, fontSize = 14.sp)
                Text(text = "$count", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = foreground)
            }
        }
        Box {
            val nobodyReacted = summary.counts.isEmpty()
            ReactionPill(
                testTag = "pulsePostDetail-reactionAdd",
                isSelected = false,
                onTap = { picking = true },
                accessibilityLabel = if (nobodyReacted) PostReactionKind.Emoji.label else "Add a reaction",
            ) { foreground ->
                PantopusIconImage(icon = PostReactionKind.Emoji.icon, contentDescription = null, size = 14.dp, tint = foreground)
                if (nobodyReacted) {
                    Text(
                        text = PostReactionKind.Emoji.label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = foreground,
                    )
                }
            }
            if (picking) {
                PulseReactionPicker(
                    selected = summary.mine,
                    onPick = { emoji ->
                        picking = false
                        onChoose(emoji)
                    },
                    onDismiss = { picking = false },
                )
            }
        }
    }
}

/** One pill under the post: the selected one (the signed-in person's) tinted and outlined in the primary colour. */
@Composable
private fun ReactionPill(
    testTag: String,
    isSelected: Boolean,
    onTap: () -> Unit,
    accessibilityLabel: String,
    selectedForeground: Color = PantopusColors.primary700,
    selectedBackground: Color = PantopusColors.primary50,
    content: @Composable RowScope.(foreground: Color) -> Unit,
) {
    val background = if (isSelected) selectedBackground else PantopusColors.appSurface
    val foreground = if (isSelected) selectedForeground else PantopusColors.appTextSecondary
    val border = if (isSelected) selectedForeground.copy(alpha = 0.25f) else PantopusColors.appBorder
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .drawBehind {
                    drawRoundRect(
                        color = border,
                        style = Stroke(width = 1.dp.toPx()),
                        cornerRadius = CornerRadius(Radii.pill.toPx(), Radii.pill.toPx()),
                    )
                }.sizeIn(minHeight = 44.dp)
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .testTag(testTag)
                .semantics {
                    contentDescription = accessibilityLabel
                    selected = isSelected
                },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            content(foreground)
        }
    }
}

/** "just posted" follows "0 comments" only while the post is under an hour old. */
private fun commentSummary(
    commentCount: Int,
    commentsAreFresh: Boolean,
    postedRecently: Boolean,
): String =
    if (commentsAreFresh) {
        if (postedRecently) "0 comments · just posted" else "0 comments"
    } else {
        "$commentCount ${if (commentCount == 1) "comment" else "comments"}"
    }

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
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
    // Send is used while typing, as in chat: a tap on it never puts the keyboard away by itself.
    Row(
        modifier = modifier.fillMaxWidth().keepsKeyboard(),
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
        val interactionSource = remember { MutableInteractionSource() }
        val fieldColors =
            OutlinedTextFieldDefaults.colors(
                focusedBorderColor = if (isFocusedPresentation) PantopusColors.primary500 else PantopusColors.appBorder,
                unfocusedBorderColor = if (isFocusedPresentation) PantopusColors.primary500 else PantopusColors.appBorder,
                focusedContainerColor = PantopusColors.appSurface,
                unfocusedContainerColor = PantopusColors.appSurface,
                focusedPlaceholderColor = PantopusColors.appTextSecondary,
                unfocusedPlaceholderColor = PantopusColors.appTextSecondary,
            )
        BasicTextField(
            value = text,
            onValueChange = onTextChange,
            singleLine = true,
            textStyle = TextStyle(fontSize = 14.sp, color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            interactionSource = interactionSource,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (canSend) onSend() }),
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 44.dp)
                    .testTag("pulsePostDetail-composer")
                    .semantics { contentDescription = placeholder },
            decorationBox = { innerTextField ->
                OutlinedTextFieldDefaults.DecorationBox(
                    value = text,
                    innerTextField = innerTextField,
                    enabled = true,
                    singleLine = true,
                    visualTransformation = VisualTransformation.None,
                    interactionSource = interactionSource,
                    placeholder = { Text(placeholder, fontSize = 14.sp) },
                    colors = fieldColors,
                    // Keep the existing compact pill without clipping the input's line box.
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                    container = {
                        OutlinedTextFieldDefaults.Container(
                            enabled = true,
                            isError = false,
                            interactionSource = interactionSource,
                            colors = fieldColors,
                            shape = RoundedCornerShape(Radii.pill),
                        )
                    },
                )
            },
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
                // The commenter's Moments ring: a tap on a ringed photo plays them.
                modifier = Modifier.momentsRing(row.authorUserId, stroke = 1.5.dp, gap = 1.5.dp),
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
        PostIntent.Share, PostIntent.Deal -> "Add context, say thanks, or help other neighbors spot why it matters."
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
            PostIntent.Share, PostIntent.Deal ->
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

private const val MAX_COMMENT_PLACEHOLDERS = 3

/** Rows standing where a post's comments will be while they load (at most three). */
@Composable
private fun CommentPlaceholders(
    count: Int,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .testTag("pulsePostDetail-commentPlaceholders")
                .clearAndSetSemantics { contentDescription = "Loading comments" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(count.coerceIn(1, MAX_COMMENT_PLACEHOLDERS)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Shimmer(width = 28.dp, height = 28.dp, cornerRadius = Radii.pill)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 120.dp, height = 12.dp, cornerRadius = Radii.sm)
                    Shimmer(width = 220.dp, height = 14.dp, cornerRadius = Radii.sm)
                }
            }
        }
    }
}
