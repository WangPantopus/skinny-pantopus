@file:Suppress("LongMethod", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.feed.pulse

import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.feed.FeedMuteEntityType
import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.models.feed.FeedRepostedBy
import app.pantopus.android.ui.screens.feed.FeedSurface
import app.pantopus.android.ui.screens.shared.feed.FeedAvatarTint
import app.pantopus.android.ui.screens.shared.media.buildPostMediaItems
import java.time.Duration
import java.time.Instant

/**
 * One card's values after the viewer's own taps, ahead of the next read. The Pulse feed and a
 * person's profile (`ProfilePostCards`) build the same card from a row plus these.
 */
internal data class PulseCardLiveValues(
    val hasReacted: Boolean,
    val likeCount: Int,
    val isSaved: Boolean,
    val isReposted: Boolean,
    val shareCount: Int,
    val isSolved: Boolean,
    /** The asker already used "Keep open 7 more days". */
    val keptOpen: Boolean,
    val likePending: Boolean = false,
    val savePending: Boolean = false,
) {
    companion object {
        /** The row as the server sent it, before any tap. */
        fun of(post: FeedPost): PulseCardLiveValues =
            PulseCardLiveValues(
                hasReacted = post.userHasLiked,
                likeCount = post.likeCount,
                isSaved = post.userHasSaved,
                isReposted = post.userHasReposted,
                shareCount = post.shareCount,
                isSolved = post.state == "solved",
                keptOpen = !post.lifecycleMetadata?.keptOpenAt.isNullOrBlank(),
            )
    }
}

/**
 * The Pulse card for one row. [surface] is null off the feed (a person's profile): no Beacon
 * credential badge and no "Not helpful here".
 */
internal fun pulseCardContent(
    post: FeedPost,
    viewerId: String?,
    surface: FeedSurface?,
    live: PulseCardLiveValues,
): PulsePostCardContent {
    val intent = PulseIntent.fromPostType(post.postType)
    val authorName = post.creator?.displayName() ?: "Pantopus user"
    val isBusiness = post.creator?.accountType == "business" || post.businessAuthorId != null
    val hasReacted = live.hasReacted
    val likeCount = live.likeCount
    val isOwner = post.isOwnedBy(viewerId)
    val isSolved = live.isSolved
    val openAsk = LaunchFeatures.pulseRedesign && isOwner && isOpenAsk(post, isSolved)
    val topic = PulseTopic.fromKey(post.topic)?.takeIf { LaunchFeatures.pulseRedesign }
    return PulsePostCardContent(
        id = post.id,
        likePending = live.likePending,
        savePending = live.savePending,
        authorName = authorName,
        authorInitials = initials(authorName),
        // Beacon credentials come from the public profile, never the surface.
        // Other surfaces carry no verification field, so no badge (being
        // a business isn't being verified).
        authorVerified = surface == FeedSurface.Beacons && post.creator?.credential?.status == "verified",
        avatarTint = if (isBusiness) FeedAvatarTint.Violet else FeedAvatarTint.Sky,
        meta = metaString(post, topic),
        intent = intent,
        chipLabel = intent.chipLabelFor(post.lostFoundType),
        isVisitor = post.isVisitorPost,
        origin = post.origin,
        title = post.title,
        body = post.content.orEmpty(),
        event =
            pulseEventDetails(
                postType = post.postType,
                startsAt = post.eventDate,
                endsAt = post.eventEndDate,
                venue = post.eventVenue,
            ),
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
                isSaved = live.isSaved,
                isReposted = live.isReposted,
                shareCount = live.shareCount,
                canShareExternally = post.canShareExternally,
                isSolved = isSolved,
                isOwner = isOwner,
                canMarkSolved = isOwner && post.postType == "ask_local" && !isSolved,
                canFlagNotHelpful = surface?.supportsNotHelpful == true && !isOwner && !post.isSeeded,
                muteEntityType =
                    when {
                        post.businessAuthorId != null -> FeedMuteEntityType.Business
                        post.userId != null -> FeedMuteEntityType.User
                        else -> null
                    },
                muteEntityId = post.businessAuthorId ?: post.userId,
                muteEntityName = authorName,
                postType = post.postType.takeUnless { intent == PulseIntent.Generic },
                topicLabel = intent.cardChipLabel,
                pulseTopic = topic,
                canKeepOpen = openAsk && !live.keptOpen,
                canCloseAsk = openAsk,
                // Seeded posts are never yours.
                profilePinned = post.profilePinned.takeIf { isOwner },
            ),
        status = statusFor(post, live),
        repostedBy = repostedByText(post.repostedBy),
    )
}

/** The viewer wrote this post (as themselves or as their business's writer). */
internal fun FeedPost.isOwnedBy(viewerId: String?): Boolean {
    val viewer = viewerId?.takeIf { it.isNotEmpty() } ?: return false
    return userId == viewer || creator?.id == viewer
}

/** An Ask that hasn't ended: no resolution, not solved or archived, and not past its end. */
internal fun isOpenAsk(
    post: FeedPost,
    isSolved: Boolean,
): Boolean {
    if (post.postType != "ask_local" || isSolved) return false
    if (post.resolution != null || (post.state != null && post.state != "open")) return false
    return PostStatus.askWindowIsOpen(post.createdAt, post.expiresAt)
}

/** Connections: "Ben C. reposted", "Ben C. and Eve H. reposted", "Ben C. and 2 others reposted" (as on web). */
private fun repostedByText(repostedBy: FeedRepostedBy?): String? {
    val first = repostedBy?.names?.firstOrNull()
    val second = repostedBy?.names?.getOrNull(1)
    val others = (repostedBy?.count ?: 0) - 1
    return when {
        first == null || others < 0 -> null
        others == 0 -> "$first reposted"
        others == 1 && second != null -> "$first and $second reposted"
        else -> "$first and $others ${if (others == 1) "other" else "others"} reposted"
    }
}

/** The status word (S7). The October 13 card (the Pulse redesign off) has none, only its "Solved" badge. */
private fun statusFor(
    post: FeedPost,
    live: PulseCardLiveValues,
): PostStatus? =
    if (!LaunchFeatures.pulseRedesign) {
        null
    } else {
        PostStatus.of(
            postType = post.postType,
            state = if (live.isSolved) "solved" else post.state,
            resolution = post.resolution,
            expiresAt = post.expiresAt,
            goingCount = live.likeCount,
        )
    }

private fun metaString(
    post: FeedPost,
    topic: PulseTopic?,
): String =
    listOfNotNull(
        relativeTimestamp(post.createdAt),
        // Ahead of the place so a long place name never truncates it; web draws the badge beside the time.
        "Visitor".takeIf { post.isVisitorPost },
        // The topic too, before the place, as on iOS ("2h · Gardening · Camas").
        topic?.label,
        post.locationName?.takeIf { it.isNotEmpty() },
    ).joinToString(" · ")

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
