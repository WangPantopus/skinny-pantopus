package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.runtime.mutableStateOf
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.screens.compose.pulse.PulseSafetyAlertKind
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * "+ Ask / Kind" in the Studio ("Pulse, reinvented" phase 1, one camera; CONTRACT 6d): the photo or the words become one
 * of today's Pulse posts, the October 13 kinds, instead of a Moment. Nothing here is a new kind: each is a post type
 * today's composer already makes (`postType`, `purpose`), posted with today's `POST /api/posts` plus the Studio's
 * `studio` field. In the order the web and iPhone offer them; "Local win" only under a made-up name, which takes four.
 */
enum class StudioPostKind(
    val wire: String,
    val title: String,
    val hint: String,
    val purpose: String,
) {
    ASK("ask_local", "Question", "Answers will show under it", "ask"),
    ALERT("alert", "Heads-up", "Shows first, in red, on the map", "heads_up"),
    LOST_FOUND("lost_found", "Lost and found", "Stays until it's claimed", "lost_found"),
    SPOT("recommendation", "Spot", "Stays on the map and in your Atlas", "recommend"),
    LEARNING("local_update", "Learning", "Stays on the map and in your Atlas", "local_update"),
    EVENT("event", "Event", "Shows on the map until it happens", "event"),
    LOCAL_WIN("neighborhood_win", "Local win", "Stays on the map and in your Atlas", "neighborhood_win"),
    ;

    /** A Spot, Learning or Event may also go to Explore (CONTRACT 6d, 6f); the others stay tied to the place. */
    val mayGoToExplore: Boolean get() = this == SPOT || this == LEARNING || this == EVENT

    companion object {
        val ownName = listOf(ASK, ALERT, LOST_FOUND, SPOT, LEARNING, EVENT)
        val madeUpName = listOf(ASK, SPOT, LEARNING, LOCAL_WIN)

        /**
         * Words that ask something: they end with a question mark (or one followed only by spaces or emoji). The
         * Studio then offers "Keep until answered?" (the app's own chip; yes makes the post a Question).
         */
        fun asksSomething(words: String): Boolean {
            val trimmed = words.trim()
            if (trimmed.length <= MIN_ASK) return false
            // Trailing emoji and spaces are left out (code points past the punctuation blocks that aren't letters).
            var end = trimmed.length
            while (end > 0) {
                val point = trimmed.codePointBefore(end)
                if (!Character.isWhitespace(point) && (point < EMOJI_FROM || Character.isLetterOrDigit(point))) break
                end -= Character.charCount(point)
            }
            return end > 0 && trimmed[end - 1] == '?'
        }

        private const val MIN_ASK = 3
        private const val EMOJI_FROM = 0x2100
    }
}

/** What the Studio holds for a post while a kind is picked: the words and each kind's own details (today's composer's). */
data class StudioPostDraft(
    val kind: StudioPostKind? = null,
    /** A post's words (up to 500 characters; a Moment's caption is 100); null while they are the caption. */
    val words: String? = null,
    /** "Keep until answered?" was turned down for this picture. */
    val askDeclined: Boolean = false,
    val alertKind: PulseSafetyAlertKind = PulseSafetyAlertKind.Other,
    val found: Boolean = false,
    /** How to reach the author about a lost or found thing: `dm`, `comment` or `phone`. */
    val contact: String = "dm",
    val phone: String = "",
    val eventStart: LocalDateTime? = null,
    val eventEnd: LocalDateTime? = null,
    val venue: String = "",
    /** "Also show in Explore" (CONTRACT 6f), off by default; kept by the server only where it may be. */
    val explore: Boolean = false,
    /** "Eyes on: ask people who are there now" on a Question (CONTRACT 8f), off by default. */
    val eyesOn: Boolean = false,
    /** Names this post: a second Post tap (say after the photo failed to go up) gets the same post back. */
    val requestId: String? = null,
) {
    companion object {
        const val WORDS_LIMIT = 500
    }
}

/**
 * The Studio's post choice while the composer is open, read by the bar's pill and by Post (the Studio and the composer
 * screen hold no reference to the view model that posts it). Cleared when the Studio closes.
 */
object StudioPostState {
    val draft = mutableStateOf(StudioPostDraft())

    fun reset() {
        draft.value = StudioPostDraft()
    }
}

/** "+ Ask / Kind" is offered: one photo or a text card (not a video, nor one of several picked together). */
internal val MomentsComposeUiState.offersStudioKinds: Boolean
    get() = pickedTogether <= 1 && (if (madeUp) media == null else media !is MomentMediaFile.Video)

internal val MomentsComposeUiState.studioKindChoices: List<StudioPostKind>
    get() = if (madeUp) StudioPostKind.madeUpName else StudioPostKind.ownName

/** The kind this posts as, or null: a Moment. */
internal fun MomentsComposeUiState.studioPostKind(draft: StudioPostDraft): StudioPostKind? =
    draft.kind?.takeIf { offersStudioKinds && it in studioKindChoices }

/** What the post says: the text card's words, or what was written for the picture. */
internal fun MomentsComposeUiState.studioPostWords(draft: StudioPostDraft): String = if (media == null) text else draft.words ?: caption

/** The pill's first line for a post (CONTRACT 6d), or null for a Moment (the pill's own words stay). */
fun MomentsComposeUiState.studioPostPill(now: LocalDateTime = LocalDateTime.now()): String? {
    val draft = StudioPostState.draft.value
    return when (studioPostKind(draft) ?: return null) {
        StudioPostKind.ASK -> "Stays until answered"
        StudioPostKind.SPOT, StudioPostKind.LEARNING, StudioPostKind.LOCAL_WIN -> "Stays in Atlas"
        StudioPostKind.LOST_FOUND -> "Until claimed"
        // A Heads-up stays up two days (today's post lifetime for `alert`).
        StudioPostKind.ALERT -> "Until ${untilLabel(now.plusDays(2), now)}"
        StudioPostKind.EVENT -> (draft.eventEnd ?: draft.eventStart)?.let { "Until ${untilLabel(it, now)}" } ?: "Until it happens"
    }
}

/** "Saturday 11 am", or "today 4:30 pm" / "tomorrow 9 am" when it is that close (read after "Until"). */
internal fun untilLabel(
    at: LocalDateTime,
    now: LocalDateTime,
): String {
    val days = ChronoUnit.DAYS.between(now.toLocalDate(), at.toLocalDate())
    val day =
        when {
            days == 0L -> "today"
            days == 1L -> "tomorrow"
            days in 2..6 -> at.format(DateTimeFormatter.ofPattern("EEEE", Locale.US))
            else -> at.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        }
    val time = at.format(DateTimeFormatter.ofPattern(if (at.minute == 0) "h a" else "h:mm a", Locale.US)).lowercase(Locale.US)
    return "$day $time"
}

/** What stops Post for a post, in today's composer's words; null when it can go. */
internal fun MomentsComposeUiState.studioKindBlocker(draft: StudioPostDraft): String? {
    val kind = studioPostKind(draft) ?: return null
    val placed = !noLocationOn && (audience == "nearby" || madeUp)
    return when {
        placed && pin == null -> "Turn on location for Pantopus in Settings, or choose Friends."
        studioPostWords(draft).isBlank() -> "Write what the ${kind.title.lowercase(Locale.US)} is about."
        kind == StudioPostKind.EVENT && draft.eventStart == null -> "Add when the event starts."
        kind == StudioPostKind.EVENT && draft.eventEnd?.let { !it.isAfter(draft.eventStart) } == true ->
            "The event end time must be after its start time."
        kind == StudioPostKind.LOST_FOUND && draft.contact == "phone" && draft.phone.count(Char::isDigit) !in PHONE_DIGITS ->
            "Enter a valid phone number."
        else -> null
    }
}

/** An event's time as today's composer sends it: the phone's wall clock, `yyyy-MM-ddTHH:mm:00Z`. */
internal fun eventWire(at: LocalDateTime): String = at.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:00'Z'", Locale.US))

/** Two hours from now on the hour: where an event's start begins in its picker. */
internal fun eventStartDefault(now: LocalDateTime = LocalDateTime.now()): LocalDateTime = now.plusHours(2).truncatedTo(ChronoUnit.HOURS)

internal fun LocalDate.atSameTime(of: LocalDateTime): LocalDateTime = atTime(of.toLocalTime())

private val PHONE_DIGITS = 7..15
