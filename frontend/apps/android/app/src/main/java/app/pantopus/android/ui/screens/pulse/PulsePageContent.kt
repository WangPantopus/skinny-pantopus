package app.pantopus.android.ui.screens.pulse

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.pulse.PulseFeedResponse
import app.pantopus.android.data.api.models.pulse.PulsePostDto
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

// What the Pulse page shows, mapped from the contract's shapes (docs/product/pulse-build/02-contract.md). Copy is the
// build spec's appendix. An enum value this build doesn't know reads as a generic card or no word at all, never a crash.

/** One of the 12 topics (build spec section 4): the id the API speaks and the words people read. */
@Immutable
data class PulseTopic(
    val id: String,
    val label: String,
)

object PulseTopics {
    val all: List<PulseTopic> =
        listOf(
            PulseTopic("around_here", "Around here"),
            PulseTopic("outdoors", "Outdoors"),
            PulseTopic("gardening", "Gardening"),
            PulseTopic("home_repairs", "Home and repairs"),
            PulseTopic("food", "Food"),
            PulseTopic("kids_schools", "Kids and schools"),
            PulseTopic("pets", "Pets"),
            PulseTopic("arts_culture", "Arts and culture"),
            PulseTopic("sports", "Sports and fitness"),
            PulseTopic("getting_around", "Getting around"),
            PulseTopic("local_government", "Local government"),
            PulseTopic("volunteering", "Volunteering"),
        )

    /** The words for a topic id; null for no topic or one this build doesn't know. */
    fun label(id: String?): String? = all.firstOrNull { it.id == id }?.label
}

/** How a label chip is tinted. The chip always carries the label as words: color never says it alone. */
enum class PulseLabelTone { Resident, NewHere, Nearby, Visitor, Official, Business, Pantopus }

/** One card, ready to draw. */
@Immutable
data class PulseCardUi(
    val id: String,
    val authorName: String,
    /** "Resident", "New here", ... ; null when the label is missing or unknown. */
    val labelText: String?,
    val labelTone: PulseLabelTone?,
    /** "0.1 mi · 1h": the distance (when the reader has one) and the time. */
    val meta: String,
    /** "OFFER", "SHARE", "ASK", "HEADS-UP", "EVENT", "LOST", "FOUND"; "POST" for a type this build doesn't know. */
    val typeName: String,
    val text: String,
    val photoUrl: String?,
    val photoCount: Int,
    /** "NW 23rd Ave · Gardening", with "Ends Wed 4pm" for a heads-up that names a time. */
    val aboutLine: String?,
    /** The type's one action (`answer`, `reply`, `claim`, `seen_it`, `going`, `its_mine`), or null. */
    val actionKind: String?,
    val actionLabel: String?,
    val actionDone: Boolean,
    val repliesText: String?,
    /** "14 going" on an event. */
    val goingText: String?,
    /** "✓ Answered", "Gone", "Reunited", "Happened · 14 went", or null while the post is open. */
    val statusText: String?,
    val isCurator: Boolean,
    /** The whole card for TalkBack. */
    val description: String,
)

@Immutable
data class PulseGroupUi(
    val key: String,
    /** The header as it reads: "AROUND CAMAS". */
    val title: String,
    val cards: List<PulseCardUi>,
)

/** The page's end: what "You're caught up" says, and whether "Show earlier" is offered. */
@Immutable
data class PulseEndUi(
    val caughtUp: Boolean,
    /** "That's everything new around Camas since this morning." */
    val sentence: String,
    val canShowEarlier: Boolean,
    val earlierCursor: String?,
)

@Immutable
data class PulseQuietUi(
    /** `meter` or `set_up_home`; null draws no card (a quiet day still says so in the list's empty state). */
    val card: String?,
    val reason: String?,
)

/** The page as the server returned it, drawn. */
@Immutable
data class PulsePageContent(
    val areaName: String,
    val groups: List<PulseGroupUi>,
    val end: PulseEndUi,
    val quiet: PulseQuietUi?,
    /** When this read was made (the `after` of the "↑ N new conversations" poll), as an ISO time. */
    val readAt: String,
)

private val LABEL_TEXT =
    mapOf(
        "resident" to ("Resident" to PulseLabelTone.Resident),
        "new_here" to ("New here" to PulseLabelTone.NewHere),
        "nearby" to ("Nearby" to PulseLabelTone.Nearby),
        "visitor" to ("Visitor" to PulseLabelTone.Visitor),
        "official" to ("Official" to PulseLabelTone.Official),
        "business" to ("Business" to PulseLabelTone.Business),
        "pantopus" to ("Pantopus" to PulseLabelTone.Pantopus),
    )

/** What the page shows for an author's label: the words and the tint; both null for a label this build doesn't know. */
internal fun labelFor(raw: String?): Pair<String, PulseLabelTone>? = raw?.let(LABEL_TEXT::get)

/** The type's name on the right of the card header. A type this build doesn't know reads "POST". */
internal fun typeNameFor(post: PulsePostDto): String =
    when (post.type) {
        "ask_local" -> "ASK"
        "share" -> "SHARE"
        "offer" -> "OFFER"
        "alert" -> "HEADS-UP"
        "event" -> "EVENT"
        "lost_found" ->
            when (post.lostFound?.kind) {
                "lost" -> "LOST"
                "found" -> "FOUND"
                else -> "LOST & FOUND"
            }
        else -> "POST"
    }

/** The words for the action when the server sent none. */
private fun defaultActionLabel(kind: String?): String? =
    when (kind) {
        "answer" -> "Answer"
        "reply" -> "Reply"
        "claim" -> "I'd like it"
        "seen_it" -> "Seen it"
        "going" -> "Going"
        "its_mine" -> "It's mine"
        else -> null
    }

/** "1h", "Yesterday", "Tue", "Sep 26": the post's age as people say it, in the viewer's time zone. */
internal fun relativeTime(
    iso: String?,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): String {
    val then = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
    val minutes = Duration.between(then, now).toMinutes()
    if (minutes < 1) return "Just now"
    if (minutes < MINUTES_PER_HOUR) return "${minutes}m"
    if (minutes < MINUTES_PER_DAY) return "${minutes / MINUTES_PER_HOUR}h"
    val day = then.atZone(zone).toLocalDate()
    val today = now.atZone(zone).toLocalDate()
    val days = Duration.between(day.atStartOfDay(), today.atStartOfDay()).toDays()
    return when {
        days <= 1 -> "Yesterday"
        days < DAYS_PER_WEEK -> day.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
        day.year == today.year -> DateTimeFormatter.ofPattern("MMM d", Locale.getDefault()).format(day)
        else -> DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault()).format(day)
    }
}

/** "Wed 4pm": a time the way the page writes it, in the viewer's time zone. */
internal fun dayAndHour(
    iso: String?,
    zone: ZoneId = ZoneId.systemDefault(),
): String? {
    val at = runCatching { ZonedDateTime.ofInstant(Instant.parse(iso), zone) }.getOrNull() ?: return null
    val day = at.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
    val hour = at.hour % HOURS_ON_CLOCK
    val clockHour = if (hour == 0) HOURS_ON_CLOCK else hour
    val minute = if (at.minute == 0) "" else ":%02d".format(at.minute)
    return "$day $clockHour$minute${if (at.hour < HOURS_ON_CLOCK) "am" else "pm"}"
}

/** "This morning", "yesterday", "Tuesday": how long the page has had nothing newer, in the viewer's time zone. */
internal fun sinceWords(
    iso: String?,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): String {
    val then = runCatching { Instant.parse(iso) }.getOrNull() ?: return "this morning"
    val day: LocalDate = then.atZone(zone).toLocalDate()
    val today: LocalDate = now.atZone(zone).toLocalDate()
    val days = Duration.between(day.atStartOfDay(), today.atStartOfDay()).toDays()
    return when {
        days <= 0 -> if (then.atZone(zone).hour < NOON) "this morning" else "earlier today"
        days == 1L -> "yesterday"
        days < DAYS_PER_WEEK -> day.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())
        else -> DateTimeFormatter.ofPattern("MMM d", Locale.getDefault()).format(day)
    }
}

/** The status on a resolved post ("✓ Answered"), or null while it is open or for a resolution this build doesn't know. */
internal fun statusWords(post: PulsePostDto): String? {
    val resolution = post.status?.resolution ?: return null
    return when (resolution) {
        "answered" -> "✓ Answered"
        "closed", "closed_unanswered" -> "Closed"
        "claimed" -> "Gone"
        "reunited" -> "Reunited"
        "happened" -> post.counts?.going?.let { "Happened · $it went" } ?: "Happened"
        else -> null
    }
}

/** A feed item as one card; null for an item with nothing to show (no id, or held or removed ones that never reach others). */
internal fun PulsePostDto.toCard(
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): PulseCardUi {
    val name = author?.displayName?.takeIf { it.isNotBlank() } ?: "A neighbor"
    val label = labelFor(author?.label)
    val topic = PulseTopics.label(topic)
    val ends = if (type == "alert") dayAndHour(status?.endsAt, zone)?.let { "Ends $it" } else null
    val about = listOfNotNull(about?.label?.takeIf { it.isNotBlank() }, topic, ends).joinToString(" · ").ifEmpty { null }
    val time = relativeTime(createdAt, now, zone)
    val meta = listOfNotNull(author?.distanceText?.takeIf { it.isNotBlank() }, time.takeIf { it.isNotEmpty() }).joinToString(" · ")
    val kind = action?.kind
    val actionLabel = action?.label?.takeIf { it.isNotBlank() } ?: defaultActionLabel(kind)
    val replies = counts?.replies ?: 0
    val repliesText =
        when {
            replies == 1 -> "1 reply"
            replies > 1 -> "$replies replies"
            else -> null
        }
    val going = counts?.going?.takeIf { type == "event" }?.let { "$it going" }
    val status = statusWords(this)
    val body = text.orEmpty().ifBlank { title.orEmpty() }
    val typeName = typeNameFor(this)
    val photos = media.filter { it.type == "image" && !it.url.isNullOrBlank() }
    return PulseCardUi(
        id = id,
        authorName = name,
        labelText = label?.first,
        labelTone = label?.second,
        meta = meta,
        typeName = typeName,
        text = body,
        photoUrl = photos.firstOrNull()?.let { it.thumbnailUrl?.takeIf(String::isNotBlank) ?: it.url },
        photoCount = photos.size,
        aboutLine = about,
        actionKind = kind,
        actionLabel = actionLabel,
        actionDone = action?.done == true,
        repliesText = repliesText,
        goingText = going,
        statusText = status,
        isCurator = author?.isCurator == true || author?.label == "pantopus",
        description =
            listOfNotNull(
                listOfNotNull(name, label?.first, meta.ifEmpty { null }).joinToString(", "),
                typeName.lowercase().replaceFirstChar { it.uppercase() },
                body,
                about,
                actionLabel?.let { if (action?.done == true) "$it, done" else it },
                repliesText,
                going,
                status,
            ).joinToString(". "),
    )
}

/** The response as the page: groups with headers only as the response has them, the end card and the quiet-state card. */
internal fun PulseFeedResponse.toPage(
    readAt: String,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): PulsePageContent {
    val town = area?.name?.takeIf { it.isNotBlank() } ?: "your area"
    val groups =
        groups.orEmpty().mapNotNull { group ->
            val cards = group.items.map { it.toCard(now, zone) }
            if (cards.isEmpty()) null else PulseGroupUi(key = group.key.orEmpty(), title = group.title.orEmpty(), cards = cards)
        }
    return PulsePageContent(
        areaName = town,
        groups = groups,
        end =
            PulseEndUi(
                caughtUp = end?.caughtUp != false,
                sentence = "That's everything new around $town since ${sinceWords(end?.since, now, zone)}.",
                canShowEarlier = end?.canShowEarlier == true && !end?.earlierCursor.isNullOrBlank(),
                earlierCursor = end?.earlierCursor,
            ),
        quiet = quiet?.let { PulseQuietUi(card = it.card, reason = it.reason) },
        readAt = readAt,
    )
}

private const val MINUTES_PER_HOUR = 60L
private const val MINUTES_PER_DAY = 24 * 60L
private const val DAYS_PER_WEEK = 7
private const val HOURS_ON_CLOCK = 12
private const val NOON = 12
