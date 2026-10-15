package app.pantopus.android.ui.screens.pulse

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.feed.FeedMuteEntityType
import app.pantopus.android.data.api.models.pulse.PulseFeedResponse
import app.pantopus.android.data.api.models.pulse.PulsePostDto
import app.pantopus.android.ui.screens.feed.pulse.PostStatus
import app.pantopus.android.ui.screens.feed.pulse.PulsePostActions
import app.pantopus.android.ui.screens.feed.pulse.PulseTopic
import app.pantopus.android.ui.screens.feed.pulse.spokenSentences
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

// What the Pulse page shows, mapped from the contract's shapes (docs/product/pulse-build/02-contract.md). Copy is the
// build spec's appendix. An enum value this build doesn't know reads as a generic card or no word at all, never a crash.

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
    val goingCount: Int?,
    /** "✓ Answered", "Gone", "Reunited", "Happened · 14 went", or null while the post is open. */
    val status: PostStatus?,
    val isCurator: Boolean,
    val actions: PulsePostActions,
    val areaId: String?,
    val canShare: Boolean,
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
    val areaChoices: List<PulseAreaChoice>,
    val groups: List<PulseGroupUi>,
    val end: PulseEndUi,
    val quiet: PulseQuietUi?,
    /** Server snapshot time for count/seen; absent on older cached pages. */
    val readAt: String?,
) {
    /** Each appended page moves the end; an old visible end must never acknowledge rows inserted below it. */
    val endKey: String
        get() = "end:$readAt:${end.earlierCursor}:${end.caughtUp}:${groups.sumOf { it.cards.size }}"
}

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
    return when {
        minutes < 1 -> "Just now"
        minutes < MINUTES_PER_HOUR -> "${minutes}m"
        minutes < MINUTES_PER_DAY -> "${minutes / MINUTES_PER_HOUR}h"
        else -> olderPostDate(then, now, zone)
    }
}

private fun olderPostDate(
    then: Instant,
    now: Instant,
    zone: ZoneId,
): String {
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

/** A feed item as one card; null for an item with nothing to show (no id, or held or removed ones that never reach others). */
internal fun PulsePostDto.toCard(
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): PulseCardUi {
    val name = author?.displayName?.takeIf { it.isNotBlank() } ?: "A neighbor"
    val label = labelFor(author?.label)
    val topic = PulseTopic.fromKey(topic)?.label
    val about = listOfNotNull(about?.label?.takeIf { it.isNotBlank() }, topic).joinToString(" · ").ifEmpty { null }
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
    val status =
        PostStatus.of(
            postType = type,
            state = status?.state,
            resolution = status?.resolution,
            expiresAt = status?.endsAt,
            goingCount = counts?.going?.coerceAtLeast(0) ?: 0,
            now = now,
            zone = zone,
        )
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
        goingCount = counts?.going?.coerceAtLeast(0)?.takeIf { type == "event" },
        status = status,
        isCurator = author?.isCurator == true || author?.label == "pantopus",
        actions = overflowActions(),
        areaId = this.about?.areaId,
        canShare = readScope == "public" && viewer?.canShare == true,
        description =
            spokenSentences(
                listOfNotNull(
                    listOfNotNull(name, label?.first, meta.ifEmpty { null }).joinToString(", "),
                    typeName.lowercase().replaceFirstChar { it.uppercase() },
                    body,
                    about,
                ),
            ),
    )
}

private fun PulsePostDto.isOpenAsk(): Boolean {
    val marker = status ?: return false
    if (type != "ask_local" || marker.state != "open" || marker.resolution != null) return false
    return PostStatus.askWindowIsOpen(createdAt.orEmpty(), marker.endsAt)
}

private fun PulsePostDto.overflowActions(): PulsePostActions {
    val owner = viewer?.isAuthor == true
    val openAsk = owner && isOpenAsk()

    return PulsePostActions(
        isOwner = owner,
        isSaved = viewer?.saved == true,
        muteEntityType = author?.id?.let { FeedMuteEntityType.User },
        muteEntityId = author?.id,
        muteEntityName = author?.displayName?.takeIf { it.isNotBlank() } ?: "this author",
        pulseTopic = PulseTopic.fromKey(topic),
        canKeepOpen = openAsk && viewer?.canKeepOpen == true,
        canCloseAsk = openAsk,
    )
}

/** The response as the page: groups with headers only as the response has them, the end card and the quiet-state card. */
internal fun PulseFeedResponse.toPage(
    readAt: String?,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): PulsePageContent {
    val town = area?.name?.takeIf { it.isNotBlank() } ?: "your area"
    val seenIds = mutableSetOf<String>()
    val groups =
        groups.orEmpty().mapIndexedNotNull { index, group ->
            val cards =
                group.items.filter { it.id.isNotBlank() && it.moderation?.state !in listOf("held", "removed") && seenIds.add(it.id) }
                    .map { post -> post.toCard(now, zone).copy(areaId = group.areaId) }
            if (cards.isEmpty()) null else PulseGroupUi(key = "${group.key.orEmpty()}:$index", title = group.title.orEmpty(), cards = cards)
        }
    val homeTown = areasAvailable.orEmpty().firstOrNull { it.kind == "town" }?.id
    val choices =
        areasAvailable.orEmpty().mapNotNull { area ->
            val name = area.title?.takeIf(String::isNotBlank) ?: area.name?.takeIf(String::isNotBlank)
            if (name == null || area.id.isNullOrBlank()) null else PulseAreaChoice(area.id.takeUnless { it == homeTown }, name)
        }.distinctBy { it.id }
    return PulsePageContent(
        areaName = town,
        areaChoices = choices,
        groups = groups,
        end =
            PulseEndUi(
                caughtUp = groups.isNotEmpty() && end?.caughtUp == true,
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
private const val NOON = 12

/** The existing post options sheet, followed by an explicit confirmation for a destructive action. */
data class PulsePageMenu(val card: PulseCardUi, val action: PulsePageMenuAction? = null)

enum class PulsePageMenuAction { Close, Delete, MuteAuthor, Report }
