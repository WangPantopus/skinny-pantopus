@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.posts.PostReactionKind
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Classification for Pulse posts, including a read-only generic fallback. Drives the chip-row filter,
 * the per-card colored chip and the compose FAB's pre-fill (a post's reaction follows its type:
 * `PostReactionKind.fromPostType`). `All` is a chip-row-only sentinel; `Generic` renders types this client cannot
 * classify.
 *
 * The chip set mirrors RN's `PLACE_POST_TYPES`
 * (`src/constants/feed.ts:18-28`) 1:1 — `Alert` / `Deal` /
 * `NeighborhoodWin` / `VisitorGuide` were previously collapsed into
 * `Announce`, which made those four lanes unreachable from the filter row.
 */
enum class PulseIntent(
    val key: String,
    val label: String,
    val cardChipLabel: String,
) {
    All(key = "all", label = "All", cardChipLabel = ""),
    Generic(key = "generic", label = "Post", cardChipLabel = "Post"),
    Ask(key = "ask", label = "Ask", cardChipLabel = "Ask"),
    Recommend(key = "recommend", label = "Recommend", cardChipLabel = "Rec"),
    Event(key = "event", label = "Event", cardChipLabel = "Event"),
    Lost(key = "lost", label = "Lost & Found", cardChipLabel = "Lost"),
    Alert(key = "alert", label = "Alerts", cardChipLabel = "Alert"),
    Deal(key = "deal", label = "Deals", cardChipLabel = "Deal"),
    Announce(key = "announce", label = "Announce", cardChipLabel = "Announce"),
    NeighborhoodWin(key = "neighborhoodWin", label = "Wins", cardChipLabel = "Win"),
    VisitorGuide(key = "visitorGuide", label = "Guide", cardChipLabel = "Guide"),
    ;

    /** Backend `post_type` filter for `/api/posts/feed`. `All` is `null`. */
    val postType: String?
        get() =
            when (this) {
                All, Generic -> null
                Ask -> "ask_local"
                Recommend -> "recommendation"
                Event -> "event"
                Lost -> "lost_found"
                Alert -> "alert"
                Deal -> "deal"
                Announce -> "local_update"
                NeighborhoodWin -> "neighborhood_win"
                VisitorGuide -> "visitor_guide"
            }

    /** Icon used inside the per-card intent chip. */
    val icon: PantopusIcon
        get() =
            when (this) {
                All, Generic -> PantopusIcon.Info
                Ask -> PantopusIcon.HelpCircle
                Recommend -> PantopusIcon.ThumbsUp
                Event -> PantopusIcon.Calendar
                Lost -> PantopusIcon.Search
                Alert -> PantopusIcon.AlertTriangle
                Deal -> PantopusIcon.Tag
                Announce -> PantopusIcon.Megaphone
                NeighborhoodWin -> PantopusIcon.PartyPopper
                VisitorGuide -> PantopusIcon.Compass
            }

    /** The card chip's word for one post: a found Lost & Found post says "Found", not "Lost". */
    fun chipLabelFor(lostFoundType: String?): String = if (this == Lost && lostFoundType == "found") "Found" else cardChipLabel

    companion object {
        /** The generic fallback is readable, never a filter or compose choice. */
        val filterEntries: List<PulseIntent> = entries.filter { it != Generic }

        fun fromKey(key: String): PulseIntent = entries.firstOrNull { it.key == key } ?: All

        /**
         * Resolve a backend `post_type` to a UI intent. Unknown values
         * fall through to `Generic` so the card reads "Post" without inventing its type.
         */
        fun fromPostType(postType: String?): PulseIntent =
            when (postType ?: "") {
                "ask_local", "ask" -> Ask
                "recommendation", "recommend" -> Recommend
                "event" -> Event
                "lost_found" -> Lost
                "alert", "safety_alert" -> Alert
                "deal" -> Deal
                "neighborhood_win" -> NeighborhoodWin
                "visitor_guide" -> VisitorGuide
                "local_update", "announcement", "heads_up" -> Announce
                else -> Generic
            }
    }
}

/**
 * The post's one reaction on its card: its kind's button (Helpful, Going, Celebrate) and how many people tapped it
 * (`POST /api/posts/:id/like`).
 */
@Immutable
data class PulseReaction(
    val kind: PostReactionKind,
    val likeCount: Int,
) {
    /** What TalkBack reads: "Helpful, 3", or "Helpful" before anyone tapped it. */
    val accessibilityLabel: String
        get() = if (likeCount == 0) kind.label else "${kind.label}, $likeCount"

    companion object {
        fun forPost(
            postType: String?,
            likeCount: Int,
        ): PulseReaction = PulseReaction(PostReactionKind.fromPostType(postType), likeCount)
    }
}

/** The reaction button's icon: a light bulb, a calendar check, a party popper. */
val PostReactionKind.icon: PantopusIcon
    get() =
        when (this) {
            PostReactionKind.Helpful -> PantopusIcon.Lightbulb
            PostReactionKind.Going -> PantopusIcon.CalendarCheck
            PostReactionKind.Celebrate -> PantopusIcon.PartyPopper
        }
