package app.pantopus.android.ui.screens.posts

import app.pantopus.android.data.api.models.posts.PostCreatorDto
import app.pantopus.android.data.api.models.posts.PostDetailDto
import app.pantopus.android.data.api.models.posts.PostReactionKind
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.content_detail.bodies.PostCommentRow
import app.pantopus.android.ui.screens.shared.content_detail.bodies.PostReactionCounts
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostIntent

/** Deterministic A10.4 post detail fixtures for previews and snapshot tests. */
object PulsePostDetailSampleData {
    val populated: PulsePostDetailContent =
        content(
            intent = PostIntent.LostFound,
            comments =
                listOf(
                    PostCommentRow(
                        id = "c-lena",
                        authorName = "Lena P.",
                        authorAvatarUrl = null,
                        authorIdentity = IdentityPillar.Home,
                        body =
                            "I think I saw her under the Subaru parked across from 514 Elm — small + scared, " +
                                "ran when I got close. Going to try again with treats.",
                        timestamp = "18m",
                        reactionCount = 4,
                        indentLevel = 0,
                        authorUserId = "u-lena",
                    ),
                    PostCommentRow(
                        id = "c-nadia-1",
                        authorName = "Nadia Velez",
                        authorAvatarUrl = null,
                        authorIdentity = IdentityPillar.Personal,
                        body = "Oh thank you — heading there now with her favorite churu pouch.",
                        timestamp = "15m",
                        reactionCount = 2,
                        userReacted = true,
                        indentLevel = 1,
                        authorUserId = "u-nadia",
                    ),
                    PostCommentRow(
                        id = "c-ravi",
                        authorName = "Ravi D.",
                        authorAvatarUrl = null,
                        authorIdentity = IdentityPillar.Personal,
                        body = "Posted to the building chat at 510 + 514. Doorman says he'll keep an eye out tonight.",
                        timestamp = "11m",
                        reactionCount = 1,
                        indentLevel = 0,
                        authorUserId = "u-ravi",
                    ),
                    PostCommentRow(
                        id = "c-marco",
                        authorName = "Marco K.",
                        authorAvatarUrl = null,
                        authorIdentity = IdentityPillar.Business,
                        body = "If you need a humane trap I have one in the basement — text me, 555-0193.",
                        timestamp = "6m",
                        indentLevel = 0,
                        authorUserId = "u-marco",
                    ),
                    PostCommentRow(
                        id = "c-nadia-2",
                        authorName = "Nadia Velez",
                        authorAvatarUrl = null,
                        authorIdentity = IdentityPillar.Personal,
                        body =
                            "UPDATE: GOT HER. She was under the Subaru after all. Thank you Lena, Ravi, " +
                                "Marco, this block.",
                        timestamp = "2m",
                        reactionCount = 6,
                        userReacted = true,
                        indentLevel = 1,
                        authorUserId = "u-nadia",
                    ),
                ),
            reactions =
                PostReactionCounts(
                    helpful = 18,
                    heart = 7,
                    going = 2,
                    userReaction = PostReactionKind.Helpful,
                ),
        )

    fun empty(intent: PostIntent = PostIntent.Ask): PulsePostDetailContent =
        content(
            intent = intent,
            comments = emptyList(),
            reactions = PostReactionCounts(),
        )

    fun content(
        intent: PostIntent,
        comments: List<PostCommentRow>,
        reactions: PostReactionCounts,
    ): PulsePostDetailContent {
        val post = post(intent = intent, commentCount = comments.size, likeCount = reactions.helpful)
        return PulsePostDetailContent(
            post = post,
            authorDisplayName = "Nadia Velez",
            authorAvatarUrl = null,
            authorIdentity = IdentityPillar.Personal,
            authorVerified = true,
            timeAndLocality = "22m · Elm Park · 5th & Elm",
            intent = intent,
            media = emptyList(),
            reactions = reactions,
            comments = comments,
            hiddenReplyCount = 0,
        )
    }

    private fun post(
        intent: PostIntent,
        commentCount: Int,
        likeCount: Int,
    ): PostDetailDto =
        PostDetailDto(
            id = "post-a10-4-${intent.name.lowercase()}",
            userId = "u-nadia",
            title = null,
            content =
                "Has anyone seen a tortoise-shell cat near 5th & Elm tonight? She slipped out of a " +
                    "window around 9pm. Her name is Mochi, she's about 8 lb, no collar but she's chipped. " +
                    "Very friendly — will come if you crouch and click your tongue. Please DM if you spot " +
                    "her. Will be out walking the block until midnight.",
            postType = if (intent == PostIntent.LostFound) "lost_found" else "general",
            postFormat = "standard",
            purpose = purpose(intent),
            mediaUrls = emptyList(),
            mediaTypes = emptyList(),
            mediaLiveUrls = emptyList(),
            createdAt = "2026-05-22T04:19:00.000Z",
            updatedAt = null,
            isEdited = false,
            likeCount = likeCount,
            commentCount = commentCount,
            shareCount = 0,
            viewCount = 34,
            creator =
                PostCreatorDto(
                    id = "u-nadia",
                    username = "nadiav",
                    name = "Nadia Velez",
                    firstName = "Nadia",
                    lastName = "Velez",
                    profilePictureUrl = null,
                    city = "Elm Park",
                    state = null,
                    accountType = "personal",
                ),
            home = null,
            userHasLiked = likeCount > 0,
            userHasSaved = false,
            userHasReposted = false,
            comments = emptyList(),
        )

    private fun purpose(intent: PostIntent): String =
        when (intent) {
            PostIntent.LostFound -> "lost_found"
            PostIntent.Ask -> "ask"
            PostIntent.Offer -> "offer"
            PostIntent.Event -> "event"
            PostIntent.Share -> "share"
            PostIntent.Alert -> "alert"
        }
}
