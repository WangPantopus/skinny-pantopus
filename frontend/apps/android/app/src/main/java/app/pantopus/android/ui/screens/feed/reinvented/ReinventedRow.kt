package app.pantopus.android.ui.screens.feed.reinvented

import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.models.reinvented.PulseTravelDto
import app.pantopus.android.data.api.models.reinvented.ReinventedBandDto
import app.pantopus.android.data.api.models.reinvented.ReinventedListItemDto
import app.pantopus.android.data.api.models.reinvented.shownConvergence
import app.pantopus.android.data.api.models.reinvented.shownPinboard
import app.pantopus.android.data.api.models.reinvented.shownRetake
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.data.pulse.ReinventedPoint
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.profile.ProfilePostCardActions
import java.time.Instant

/** One row of the new Pulse's list: a band's line, a Moment that fades, a kept Moment, or a post that stays. */
sealed interface ReinventedRow {
    val key: String

    data class Band(
        val band: ReinventedBandDto,
    ) : ReinventedRow {
        override val key: String get() = "band-${band.band}"
    }

    /** A Moment that fades; [kept] draws it as a post that stays ("Keep this?"). */
    data class Moment(
        val moment: MomentDto,
        val kept: Boolean,
    ) : ReinventedRow {
        override val key: String get() = "moment-${moment.id}"
    }

    /** A post that stays, with its phase 3 keys (who carried it, an Eyes-on window; CONTRACT 8f). */
    data class Post(
        val card: PulsePostCardContent,
        val travel: PulseTravelDto? = null,
    ) : ReinventedRow {
        override val key: String get() = "post-${card.id}"
    }

    /** Explore's "Today, elsewhere" and "New elsewhere". */
    data class Heading(
        val words: String,
    ) : ReinventedRow {
        override val key: String get() = "heading-$words"
    }

    /** "Why am I seeing this?", answered in one line under an Explore item. */
    data class Why(
        val itemKey: String,
        val words: String,
    ) : ReinventedRow {
        override val key: String get() = "why-$itemKey"
    }
}

/** The list as drawn: each band's line where the band changes, then its items; a post shows once its card is made. */
internal fun ReinventedPulseState.rows(cards: List<PulsePostCardContent>): List<ReinventedRow> {
    val byId = cards.associateBy { it.id }
    val rows = mutableListOf<ReinventedRow>()
    var lastBand: String? = null
    val explore = reach == ReinventedPulseViewModel.EXPLORE
    val pieces = mutableSetOf<String>()
    for ((index, item) in items.withIndex()) {
        if (item.repeatsPiece(pieces)) continue
        if (explore && pickedCount > 0 && index == 0) rows += ReinventedRow.Heading("Today, elsewhere")
        if (explore && pickedCount > 0 && index == pickedCount) rows += ReinventedRow.Heading("New elsewhere")
        val before = rows.size
        val line = item.band?.takeIf { it != lastBand }?.let { band -> bands.firstOrNull { it.band == band } }
        if (line != null) {
            rows += ReinventedRow.Band(line)
            lastBand = line.band
        }
        item.row(byId)?.let { rows += it }
        val why = item.why
        if (explore && why != null && rows.size > before) rows += ReinventedRow.Why(item.type + item.id, why)
    }
    return rows
}

/** What an item draws as: a Moment (kept or fading), or a post once its card is made. */
private fun ReinventedListItemDto.row(byId: Map<String, PulsePostCardContent>): ReinventedRow? {
    val moment = moment
    val post = post
    return when {
        type == ReinventedPulseViewModel.MOMENT && moment != null -> ReinventedRow.Moment(moment, kept)
        post != null -> byId[post.id]?.let { ReinventedRow.Post(it, travel) }
        else -> null
    }
}

/**
 * A Retake (CONTRACT 8e), a convergence's piece (8h) and a pinboard (8i) are one row each: the first of their Moments in
 * the list stands for the whole and opens it.
 */
private fun ReinventedListItemDto.repeatsPiece(seen: MutableSet<String>): Boolean {
    val moment = moment ?: return false
    val key =
        moment.shownRetake?.let { "retake-${it.startId}" }
            ?: moment.shownConvergence?.let { "sky-${it.id}" }
            ?: moment.shownPinboard?.let { "board-${it.startId}" }
            ?: return false
    return !seen.add(key)
}

/** The status line over a post that stays, from the kinds today's Pulse has; null for the rest. */
internal fun reinventedStatus(card: PulsePostCardContent): String? =
    when (card.intent) {
        PulseIntent.Ask ->
            when {
                card.actions.isSolved -> "Solved"
                card.commentCount == 1 -> "Question, 1 answer"
                else -> "Question, ${card.commentCount} answers"
            }
        PulseIntent.Recommend -> "Spot"
        PulseIntent.Event -> card.reaction.likeCount.let { going -> if (going > 0) "Plan, $going going" else "Plan" }
        PulseIntent.Lost -> "Lost and found"
        PulseIntent.Alert -> "Heads-up"
        else -> null
    }

/** "5h left", "40m left": a Moment's time left, from its end; empty when it can't be read. */
internal fun momentTimeLeft(
    expiresAt: String?,
    nowMs: Long,
): String {
    val end = expiresAt?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() } ?: return ""
    val minutes = ((end - nowMs) / MINUTE_MS).coerceAtLeast(0)
    return if (minutes >= MINUTES_IN_HOUR) "${minutes / MINUTES_IN_HOUR}h left" else "${minutes}m left"
}

/** The words a chip shows. */
internal fun reinventedChipTitle(chip: String): String =
    when (chip) {
        "all" -> "All"
        "live" -> "Live"
        "learn" -> "Learn"
        "spots" -> "Spots"
        "ask" -> "Ask"
        "plans" -> "Plans"
        "sports" -> "Sports"
        else -> chip.replaceFirstChar { it.titlecase() }
    }

/** Nothing here: what there is to do. */
internal fun reinventedEmptyTitle(reach: String): String =
    when (reach) {
        ReinventedPulseViewModel.CLOSE -> "Nothing from your circle right now"
        ReinventedPulseViewModel.EXPLORE -> "Nothing from elsewhere yet today"
        else -> "Quiet around here right now"
    }

internal fun reinventedEmptyLine(reach: String): String =
    if (reach == ReinventedPulseViewModel.EXPLORE) {
        "Explore shows only what people chose to share with everyone. Check back later today."
    } else {
        "Post a Moment with + and it shows here first. Or widen what Pulse shows from the pill at the top."
    }

private const val MINUTE_MS = 60_000L
private const val MINUTES_IN_HOUR = 60L

/** What the list's rows do when tapped. */
data class ReinventedListActions(
    val cards: ProfilePostCardActions,
    val onOpenMoment: (MomentDto) -> Unit,
    val onRefresh: () -> Unit,
    val onLoadMore: () -> Unit,
    /** "Show my circle instead", where Around me has no place. */
    val onShowCircle: () -> Unit,
    /** The end line's "Keep exploring?": Explore. */
    val onExplore: () -> Unit = {},
    /** Explore's pause: its next page. */
    val onKeepExploring: () -> Unit = {},
    /** A row's place: the map glides there. */
    val onShowOnMap: (ReinventedPoint) -> Unit = {},
    /** The signed-in person ("Pass it on" is offered only under others' posts). */
    val viewer: String? = null,
    /** "Tonight in <town>" (8k): the film's Moments, played as one run in the viewer. */
    val onOpenRun: (List<MomentDto>) -> Unit = {},
)

/** What a tile of the strip opens. */
data class ReinventedStripActions(
    val onOpenMoment: (MomentDto) -> Unit,
    val onOpenPlan: (String) -> Unit,
    val onOpenRing: (MomentRingDto) -> Unit,
)

/** My Atlas in the new Pulse: whether it shows, the person's kept Moments in view as pins, and what its taps do. */
data class ReinventedAtlasHook(
    val on: Boolean = false,
    val pins: List<ReinventedMapItem> = emptyList(),
    val onToggle: (Boolean) -> Unit = {},
    val onMoved: (ReinventedBox) -> Unit = {},
    val onOpen: (MomentDto) -> Unit = {},
)
