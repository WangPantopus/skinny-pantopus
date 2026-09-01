@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Ten-way classification for Pulse posts. Drives the chip-row filter,
 * the per-card colored chip, the reaction-verb set, and the compose
 * FAB's pre-fill. `All` is a chip-row-only sentinel; real posts always
 * resolve to one of the other nine.
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
                All -> null
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
                All -> PantopusIcon.Info
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

    companion object {
        fun fromKey(key: String): PulseIntent = entries.firstOrNull { it.key == key } ?: All

        /**
         * Resolve a backend `post_type` to a UI intent. Unknown values
         * fall through to `Announce` (most generic) so the card still
         * renders a meaningful indicator.
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
                else -> Announce
            }
    }
}

/**
 * One reaction kind shown in the bottom strip of a post card. The
 * backend only persists `like` (helpful); the other counts are
 * display-only and intent-shaped to match the design.
 */
@Immutable
data class PulseReaction(
    val kind: Kind,
    val icon: PantopusIcon,
    val label: String,
    val count: Int,
    val isInteractive: Boolean,
) {
    enum class Kind(val key: String) {
        Helpful("helpful"),
        Heart("heart"),
        Going("going"),
        Seen("seen"),
        Shared("shared"),
    }
}

/**
 * Returns the reaction strip the design specifies for this intent.
 * The first kind is wired to `POST /:id/like`; the rest are
 * display-only counts.
 */
fun PulseIntent.reactionTemplate(
    helpfulCount: Int,
    secondaryCount: Int = 0,
): List<PulseReaction> =
    when (this) {
        PulseIntent.Ask ->
            listOf(
                PulseReaction(PulseReaction.Kind.Helpful, PantopusIcon.Lightbulb, "helpful", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Heart, PantopusIcon.Heart, "", secondaryCount, false),
            )
        PulseIntent.Recommend ->
            listOf(
                PulseReaction(PulseReaction.Kind.Helpful, PantopusIcon.Heart, "", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Heart, PantopusIcon.Lightbulb, "helpful", secondaryCount, false),
            )
        PulseIntent.Event ->
            listOf(
                PulseReaction(PulseReaction.Kind.Going, PantopusIcon.CalendarCheck, "going", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Heart, PantopusIcon.Heart, "", secondaryCount, false),
            )
        PulseIntent.Lost ->
            listOf(
                PulseReaction(PulseReaction.Kind.Seen, PantopusIcon.Eye, "seen", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Shared, PantopusIcon.Share, "shared", secondaryCount, false),
            )
        PulseIntent.NeighborhoodWin ->
            listOf(
                PulseReaction(PulseReaction.Kind.Helpful, PantopusIcon.Heart, "", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Seen, PantopusIcon.Eye, "seen", secondaryCount, false),
            )
        PulseIntent.Deal, PulseIntent.VisitorGuide ->
            listOf(
                PulseReaction(PulseReaction.Kind.Helpful, PantopusIcon.Lightbulb, "helpful", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Shared, PantopusIcon.Share, "shared", secondaryCount, false),
            )
        PulseIntent.Announce, PulseIntent.Alert, PulseIntent.All ->
            // A03: announce cards lead with the "seen" eye verb.
            listOf(
                PulseReaction(PulseReaction.Kind.Seen, PantopusIcon.Eye, "seen", helpfulCount, true),
                PulseReaction(PulseReaction.Kind.Heart, PantopusIcon.Heart, "", secondaryCount, false),
            )
    }
