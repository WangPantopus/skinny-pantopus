@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.feed.FeedMuteEntityType
import app.pantopus.android.ui.screens.shared.feed.FeedAvatar
import app.pantopus.android.ui.screens.shared.feed.FeedAvatarTint
import app.pantopus.android.ui.screens.shared.media.PostMediaGridStyle
import app.pantopus.android.ui.screens.shared.media.PostMediaGridWithViewer
import app.pantopus.android.ui.screens.shared.media.PostMediaItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Which overflow actions a single Pulse card offers this viewer, and which
 * of them are already applied. Mirrors RN's per-card gating in
 * `src/components/feed/PostCard.tsx:97-101, 382-397, 445-470`.
 */
@Immutable
data class PulsePostActions(
    /** Cold-start neighborhood fact — dismissable, never reportable. */
    val isSeeded: Boolean = false,
    val isSaved: Boolean = false,
    val isReposted: Boolean = false,
    val shareCount: Int = 0,
    /** `state == "solved"` — renders the inline Solved badge. */
    val isSolved: Boolean = false,
    /** Viewer authored this post. */
    val isOwner: Boolean = false,
    /** Author-only + Ask post + not already solved. */
    val canMarkSolved: Boolean = false,
    /** Place surface only, and never on the viewer's own post. */
    val canFlagNotHelpful: Boolean = false,
    /** Author identity to mute — `null` on seeded / system cards. */
    val muteEntityType: FeedMuteEntityType? = null,
    val muteEntityId: String? = null,
    /** Display name used in the mute row + its confirm copy. */
    val muteEntityName: String = "this author",
    /** `post_type` fed to `POST /api/posts/mute/topic`. */
    val postType: String? = null,
    /** Human label for the topic being muted ("Ask", "Event", …). */
    val topicLabel: String? = null,
) {
    /** Report is offered to everyone except the author. */
    val canReport: Boolean get() = !isOwner && !isSeeded

    /** Delete is author-only. */
    val canDelete: Boolean get() = isOwner && !isSeeded

    /** Muting needs a resolvable entity and never applies to your own post. */
    val canMuteAuthor: Boolean
        get() = !isOwner && !isSeeded && muteEntityType != null && !muteEntityId.isNullOrEmpty()

    /** Topic mute needs a concrete post type. */
    val canMuteTopic: Boolean get() = !isSeeded && !postType.isNullOrEmpty()
}

/** VM-prepared content for a single Pulse card. */
@Immutable
data class PulsePostCardContent(
    val id: String,
    val authorName: String,
    val authorInitials: String,
    val authorVerified: Boolean,
    val avatarTint: FeedAvatarTint = FeedAvatarTint.Sky,
    val meta: String,
    val intent: PulseIntent,
    val title: String?,
    val body: String,
    val reactions: List<PulseReaction>,
    val attendees: PulseAttendeeStrip?,
    val userHasReacted: Boolean,
    val commentCount: Int = 0,
    val media: List<PostMediaItem> = emptyList(),
    /** Overflow-menu capability set for this viewer. */
    val actions: PulsePostActions = PulsePostActions(),
) {
    /** Thumbnail-preferring URL projection kept for test compatibility. */
    val mediaUrls: List<String>
        get() = media.map { it.thumbnailUrl ?: it.url }
}

/** Event card attendee strip — stacked avatars + going count + RSVP CTA. */
@Immutable
data class PulseAttendeeStrip(
    val avatars: List<String>,
    val goingCount: Int,
    val userIsGoing: Boolean,
)

/**
 * Pulse post card — entirely render-only; tap dispatch is parent-controlled.
 */
@Composable
@Suppress("LongParameterList")
fun PulsePostCard(
    content: PulsePostCardContent,
    onTap: () -> Unit,
    onPrimaryReaction: () -> Unit,
    onRSVP: (() -> Unit)? = null,
    /** Opens the card's overflow menu. `null` hides the affordance. */
    onOverflow: (() -> Unit)? = null,
    /** Dismisses a cold-start seeded fact. `null` hides the affordance. */
    onDismissSeeded: (() -> Unit)? = null,
    /** Bookmark toggle in the engagement strip. `null` hides it. */
    onToggleSave: (() -> Unit)? = null,
    /** Repost toggle in the engagement strip. `null` hides it. */
    onToggleRepost: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .semantics(mergeDescendants = true) {
                    contentDescription = buildA11yLabel(content)
                }
                .testTag("pulsePostCard_${content.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        CardHeader(
            content = content,
            onOverflow = onOverflow,
            onDismissSeeded = onDismissSeeded,
        )
        if (!content.title.isNullOrEmpty()) {
            Text(
                text = content.title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (content.body.isNotEmpty()) {
            Text(
                text = content.body,
                fontSize = 12.5.sp,
                color = PantopusColors.appTextStrong,
                maxLines = if (!content.title.isNullOrEmpty()) 2 else 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (content.media.isNotEmpty()) {
            PostMediaGridWithViewer(
                items = content.media,
                style = PostMediaGridStyle.Compact,
                testTag = "pulsePostMedia_${content.id}",
            )
        }
        content.attendees?.let { attendees ->
            AttendeeStrip(attendees = attendees, onRSVP = onRSVP, postId = content.id)
        }
        ReactionStrip(
            content = content,
            onPrimary = onPrimaryReaction,
            onToggleSave = onToggleSave,
            onToggleRepost = onToggleRepost,
        )
    }
}

@Composable
private fun CardHeader(
    content: PulsePostCardContent,
    onOverflow: (() -> Unit)?,
    onDismissSeeded: (() -> Unit)?,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        FeedAvatar(
            initials = content.authorInitials,
            tint = content.avatarTint,
            verified = content.authorVerified,
            size = 32.dp,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = content.authorName,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = content.meta,
                fontSize = 10.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        PulseIntentChip(intent = content.intent)
        HeaderTrailingControl(
            content = content,
            onOverflow = onOverflow,
            onDismissSeeded = onDismissSeeded,
        )
    }
}

/**
 * Seeded facts get a dismiss "x"; every other card gets the overflow menu.
 * RN splits the same way (`PostCard.tsx:85-88`).
 */
@Composable
private fun HeaderTrailingControl(
    content: PulsePostCardContent,
    onOverflow: (() -> Unit)?,
    onDismissSeeded: (() -> Unit)?,
) {
    if (content.actions.isSeeded) {
        if (onDismissSeeded != null) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clickable(onClick = onDismissSeeded)
                        .semantics { contentDescription = "Dismiss this suggestion" }
                        .testTag("pulsePostDismissSeeded_${content.id}"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    } else if (onOverflow != null) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clickable(onClick = onOverflow)
                    .semantics { contentDescription = "Post options" }
                    .testTag("pulsePostOverflow_${content.id}"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun AttendeeStrip(
    attendees: PulseAttendeeStrip,
    onRSVP: (() -> Unit)?,
    postId: String,
) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            // Stacked avatars
            Box {
                attendees.avatars.take(4).forEachIndexed { index, initials ->
                    Box(
                        modifier =
                            Modifier
                                .padding(start = (index * 14).dp)
                                .size(22.dp)
                                .clip(CircleShape)
                                .border(2.dp, PantopusColors.appSurface, CircleShape),
                    ) {
                        FeedAvatar(
                            initials = initials,
                            tint = attendeeTints[index % attendeeTints.size],
                            size = 22.dp,
                        )
                    }
                }
            }
            Text(
                text = "+ ${attendees.goingCount} going",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
            Spacer(modifier = Modifier.weight(1f))
            if (onRSVP != null) {
                Row(
                    modifier =
                        Modifier
                            .height(26.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.magicBg)
                            .clickable(onClick = onRSVP)
                            .padding(horizontal = Spacing.s3)
                            .testTag("pulseRSVP_$postId"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(
                        icon = if (attendees.userIsGoing) PantopusIcon.Check else PantopusIcon.PlusCircle,
                        contentDescription = null,
                        size = 10.dp,
                        tint = PantopusColors.magic,
                    )
                    Text(
                        text = if (attendees.userIsGoing) "Going" else "RSVP",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.magic,
                    )
                }
            }
        }
    }
}

@Composable
private fun ReactionStrip(
    content: PulsePostCardContent,
    onPrimary: () -> Unit,
    onToggleSave: (() -> Unit)? = null,
    onToggleRepost: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        content.reactions.forEach { reaction ->
            ReactionPill(
                reaction = reaction,
                active = content.userHasReacted && reaction.kind == content.reactions.firstOrNull()?.kind,
                onClick = if (reaction.isInteractive) onPrimary else null,
                postId = content.id,
            )
        }
        if (content.actions.isSolved) {
            SolvedBadge(postId = content.id)
        }
        Spacer(modifier = Modifier.weight(1f))
        if (onToggleSave != null) {
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clickable(onClick = onToggleSave)
                        .semantics {
                            contentDescription =
                                if (content.actions.isSaved) "Remove bookmark" else "Save post"
                        }
                        .testTag("pulsePostSave_${content.id}"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Bookmark,
                    contentDescription = null,
                    size = Radii.lg,
                    tint =
                        if (content.actions.isSaved) {
                            PantopusColors.primary600
                        } else {
                            PantopusColors.appTextSecondary
                        },
                )
            }
        }
        if (onToggleRepost != null) {
            val repostTint =
                if (content.actions.isReposted) PantopusColors.success else PantopusColors.appTextSecondary
            Row(
                modifier =
                    Modifier
                        .clickable(onClick = onToggleRepost)
                        .semantics {
                            contentDescription =
                                if (content.actions.isReposted) "Undo repost" else "Repost"
                        }
                        .testTag("pulsePostRepost_${content.id}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ArrowsRepeat,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = repostTint,
                )
                if (content.actions.shareCount > 0) {
                    Text(
                        text = "${content.actions.shareCount}",
                        fontSize = 11.5.sp,
                        color = repostTint,
                    )
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = PantopusIcon.MessageCircle,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = if (content.commentCount > 0) "Reply ${content.commentCount}" else "Reply",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/**
 * Inline "Solved" pill — RN renders the same badge once
 * `state === 'solved'` (`PostCard.tsx:474-479`).
 */
@Composable
private fun SolvedBadge(postId: String) {
    Row(
        modifier =
            Modifier
                .height(22.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.successLight)
                .padding(horizontal = Spacing.s2)
                .semantics { contentDescription = "Solved" }
                .testTag("pulsePostSolvedBadge_$postId"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.success,
        )
        Text(
            text = "Solved",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun ReactionPill(
    reaction: PulseReaction,
    active: Boolean,
    onClick: (() -> Unit)?,
    postId: String,
) {
    val tint = if (active) PantopusColors.primary600 else PantopusColors.appTextSecondary
    val base =
        Modifier
            .semantics {
                contentDescription = "${reaction.label.ifEmpty { "Count" }}, ${reaction.count}"
            }
    val withClick =
        if (onClick != null) {
            base.clickable(onClick = onClick).testTag("pulseReaction_${postId}_${reaction.kind.key}")
        } else {
            base
        }
    Row(
        modifier = withClick,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = reaction.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = tint,
        )
        if (reaction.label.isNotEmpty()) {
            Text(
                text = reaction.label,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = tint,
            )
        }
        Text(
            text = "${reaction.count}",
            fontSize = 11.5.sp,
            color = tint,
        )
    }
}

/**
 * Right-aligned colored chip in the post header. Resolves intent →
 * foreground/background tokens against the existing design system.
 */
@Composable
fun PulseIntentChip(intent: PulseIntent) {
    val (fg, bg) = intent.tintColors()
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp)
                .semantics { contentDescription = "${intent.label} post" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = intent.icon,
            contentDescription = null,
            size = 10.dp,
            tint = fg,
        )
        Text(
            text = intent.cardChipLabel.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
        )
    }
}

private val attendeeTints =
    listOf(FeedAvatarTint.Orange, FeedAvatarTint.Sky, FeedAvatarTint.Violet, FeedAvatarTint.Green)

private fun PulseIntent.tintColors(): Pair<Color, Color> =
    when (this) {
        PulseIntent.All -> PantopusColors.appTextSecondary to PantopusColors.appSurfaceSunken
        PulseIntent.Ask -> PantopusColors.warmAmber to PantopusColors.warmAmberBg
        PulseIntent.Recommend -> PantopusColors.success to PantopusColors.successLight
        PulseIntent.Event -> PantopusColors.magic to PantopusColors.magicBg
        PulseIntent.Lost -> PantopusColors.rose to PantopusColors.roseBg
        PulseIntent.Alert -> PantopusColors.error to PantopusColors.errorBg
        PulseIntent.Deal -> PantopusColors.success to PantopusColors.successBg
        PulseIntent.Announce -> PantopusColors.slate to PantopusColors.slateBg
        PulseIntent.NeighborhoodWin -> PantopusColors.warning to PantopusColors.warningBg
        PulseIntent.VisitorGuide -> PantopusColors.info to PantopusColors.infoBg
    }

private fun buildA11yLabel(content: PulsePostCardContent): String {
    val parts = mutableListOf<String>()
    parts.add(content.authorName)
    if (content.intent.cardChipLabel.isNotEmpty()) parts.add(content.intent.cardChipLabel)
    content.title?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    if (content.body.isNotEmpty()) parts.add(content.body)
    if (content.mediaUrls.isNotEmpty()) {
        parts.add("${content.mediaUrls.size} attached ${if (content.mediaUrls.size == 1) "photo" else "photos"}")
    }
    return parts.joinToString(". ")
}
