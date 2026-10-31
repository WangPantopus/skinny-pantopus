@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.SentCard
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.cards.CardButton
import app.pantopus.android.ui.screens.mailbox.cards.CardButtonKind
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.screens.mailbox.cards.TiltedThumb
import app.pantopus.android.ui.screens.mailbox.components.MailKind
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceCard
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.MailSender
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject

/** A card the person sent, as Sent draws it: the envelope as they got it, who it went to, and where it is. */
data class MailSentRow(
    val card: SentCard,
    val envelope: MailPieceModel,
    /** "To Maya O. · Christmas card", "To d***@example.com · by email". */
    val title: String,
    /** "Arrives with their 7 a.m. mail on Fri, Dec 11", "In their mailbox since Thu, Dec 10" … */
    val line: String,
    /** The day it was sent, by the sender's clock. */
    val day: LocalDate?,
)

/** The cards sent on one day, under its heading: Today, Yesterday, a weekday this week, else the date. */
data class MailSentDay(
    val id: String,
    val title: String,
    val rows: List<MailSentRow>,
)

/** What Sent shows. */
sealed interface MailSentState {
    data object Loading : MailSentState

    data class Loaded(
        /** Cards to a person still waiting for the carrier's 7 a.m. pickup (the flag's cards), at the top. */
        val waiting: List<MailSentRow>,
        val days: List<MailSentDay>,
        val hasMore: Boolean,
        /** Why the next page failed; the cards stay and the end of the list offers Try again. */
        val loadMoreError: String? = null,
    ) : MailSentState

    data object Empty : MailSentState

    data class Error(
        val message: String,
    ) : MailSentState
}

/**
 * Sent, in the Mailbox (launch key `mailbox`; drawing `M2-Sent`): what the person sent, newest first, 25 at a time.
 * Cards still waiting for the 7 a.m. pickup sit at the top; the rest go by the day they were sent. Shows only how each
 * one is doing, never what the other person did with it. Take it back works from here until the pickup (by email: until
 * they open it). Reads `GET /api/mailbox/sent`; takes back `POST /api/mailbox/cards/:id/take-back`.
 */
@HiltViewModel
class MailSentViewModel
    @Inject
    constructor(
        private val cards: HolidayCardsRepository,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MailSentState>(MailSentState.Loading)
        val state: StateFlow<MailSentState> = _state.asStateFlow()

        private val _takingBack = MutableStateFlow<String?>(null)

        /** The card being taken back, while it is. */
        val takingBack: StateFlow<String?> = _takingBack.asStateFlow()

        private val _takeBackError = MutableStateFlow<Pair<String, String>?>(null)

        /** A card that couldn't be taken back, and why (the server's sentence). */
        val takeBackError: StateFlow<Pair<String, String>?> = _takeBackError.asStateFlow()

        private val loaded = mutableListOf<SentCard>()
        private var next: String? = null
        private var zone: ZoneId = ZoneId.systemDefault()
        private var lastReadAt: Instant? = null
        private var loadMoreError: String? = null
        private var loadingMore = false

        /** Bumped on every read from the top, so a late page from an earlier read is dropped. */
        private var generation = 0

        init {
            // Taken back here, on its own page or from the card screens: it leaves Sent.
            viewModelScope.launch { HolidayCardsRepository.takenBack.collect { drop(it) } }
            // Sent from the card screens: once Sent has been read, it reads again with the new card.
            viewModelScope.launch { HolidayCardsRepository.cardSent.collect { if (lastReadAt != null) refresh() } }
        }

        /** Sent opened: read it the first time, after a while, or on a new day ([zone]: the sender's own clock). */
        fun show(zone: ZoneId) {
            this.zone = zone
            val read = lastReadAt
            val now = Instant.now()
            val stale =
                read == null ||
                    _state.value is MailSentState.Error ||
                    read.atZone(zone).toLocalDate() != now.atZone(zone).toLocalDate() ||
                    Duration.between(read, now) > STALE_AFTER
            if (stale) refresh() else publish()
        }

        /** Pull to refresh and Try again: read from the top; what's shown stays until the answer comes. */
        fun refresh() {
            val gen = ++generation
            lastReadAt = Instant.now()
            if (loaded.isEmpty()) _state.value = MailSentState.Loading
            viewModelScope.launch {
                val result = cards.sent(before = null)
                if (gen != generation) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        loaded.clear()
                        loaded.addAll(result.data.items)
                        next = result.data.next
                        loadMoreError = null
                        publish()
                    }
                    is NetworkResult.Failure -> {
                        loaded.clear()
                        next = null
                        val message = result.error.mailMessage(online = network.isOnline.value, doing = "load what you sent")
                        _state.value = MailSentState.Error(message)
                    }
                }
            }
        }

        /** Near the end of the list: the next 25, unless the last page failed (then only [retryLoadMore] asks). */
        fun loadMore() {
            val before = next ?: return
            if (loadingMore || loadMoreError != null) return
            loadingMore = true
            val gen = generation
            viewModelScope.launch {
                val result = cards.sent(before = before)
                loadingMore = false
                if (gen != generation) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        val known = loaded.map { it.id }.toSet()
                        loaded.addAll(result.data.items.filterNot { it.id in known })
                        next = result.data.next
                    }
                    is NetworkResult.Failure ->
                        loadMoreError = result.error.mailMessage(online = network.isOnline.value, doing = "load more of your cards")
                }
                publish()
            }
        }

        fun retryLoadMore() {
            if (loadMoreError == null) return
            loadMoreError = null
            publish()
            loadMore()
        }

        /** Take it back (confirmed by the screen): until the pickup, or by email until they open it. */
        fun takeBack(id: String) {
            if (_takingBack.value != null) return
            _takingBack.value = id
            _takeBackError.value = null
            viewModelScope.launch {
                when (val result = cards.takeBack(id)) {
                    // The repository says it was taken back; [drop] takes it out of the list.
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        _takeBackError.value = id to takeBackMessage(result.error)
                        // Too late: it was picked up (or opened) meanwhile, so its row says so now.
                        refresh()
                    }
                }
                _takingBack.value = null
            }
        }

        private fun drop(id: String) {
            if (loaded.removeAll { it.id == id }) publish()
        }

        private fun publish() {
            if (loaded.isEmpty()) {
                _state.value = MailSentState.Empty
                return
            }
            val today = Instant.now().atZone(zone).toLocalDate()
            val rows = loaded.map { MailSentWords.row(it, zone) }
            val days =
                rows
                    .filterNot { it.card.status == "waiting" }
                    .groupBy { it.day }
                    .map { (day, dayRows) ->
                        MailSentDay(id = day?.toString() ?: "earlier", title = MailSentWords.dayTitle(day, today), rows = dayRows)
                    }
            _state.value =
                MailSentState.Loaded(
                    waiting = rows.filter { it.card.status == "waiting" },
                    days = days,
                    hasMore = next != null,
                    loadMoreError = loadMoreError,
                )
        }

        private fun takeBackMessage(error: NetworkError): String =
            when (error) {
                is NetworkError.NotFound -> "This card isn’t here any more."
                else -> error.mailMessage(online = network.isOnline.value, doing = "take your card back")
            }

        private companion object {
            /** Sent reads again when it shows after this long: a card's pickup or arrival may have come. */
            val STALE_AFTER: Duration = Duration.ofMinutes(5)
        }
    }

/** How Sent says where a card is (the list and the card's own page say it the same way). */
object MailSentWords {
    private val weekday = DateTimeFormatter.ofPattern("EEEE", Locale.US)
    private val longDay = DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.US)
    private val postmark = DateTimeFormatter.ofPattern("MMM d", Locale.US)

    fun row(
        card: SentCard,
        zone: ZoneId,
    ): MailSentRow =
        MailSentRow(
            card = card,
            envelope = envelope(card),
            title = title(card),
            line = line(card, zone),
            day = HolidayCardTimes.parse(card.sentAt)?.atZone(zone)?.toLocalDate(),
        )

    /** Sent today by the sender's clock: taking it back frees today's card. */
    fun sentToday(
        card: SentCard,
        zone: ZoneId,
    ): Boolean = HolidayCardTimes.parse(card.sentAt)?.atZone(zone)?.toLocalDate() == Instant.now().atZone(zone).toLocalDate()

    /** "To Maya O. · Christmas card"; by email "To d***@example.com · by email". */
    fun title(card: SentCard): String {
        val to = card.toName?.takeIf { it.isNotBlank() } ?: "them"
        return if (card.byEmail) "To $to · by email" else "To $to · Christmas card"
    }

    /** Where it is, in a line: their 7 a.m. mail by their day, never turned into the sender's hours. */
    fun line(
        card: SentCard,
        zone: ZoneId,
    ): String {
        val day = HolidayCardTimes.shortDay(card.arrivesOn ?: card.arrivesAt, zone)
        return when (card.status) {
            "waiting" ->
                when {
                    card.arrival == "christmas_morning" -> "Arrives on Christmas morning"
                    card.sealed -> "Arrives with their 7 a.m. mail on $day, sealed until Christmas"
                    else -> "Arrives with their 7 a.m. mail on $day"
                }
            "picked_up" -> "Arrives on Christmas morning"
            "delivered" -> if (card.sealed) "In their mailbox, sealed until Christmas" else "In their mailbox since $day"
            "email_waiting" -> "Waiting for them to open the email"
            "claimed" -> "They joined Pantopus and have it"
            "expired" -> "They didn’t open the email in 90 days"
            else -> ""
        }
    }

    /** A day's heading, by the sender's clock: Today, Yesterday, a weekday within the week, else "Wednesday, December 2". */
    fun dayTitle(
        day: LocalDate?,
        today: LocalDate,
    ): String =
        when {
            day == null -> "Earlier"
            day == today -> "Today"
            day == today.minusDays(1) -> "Yesterday"
            ChronoUnit.DAYS.between(day, today) in 2..6 -> day.format(weekday)
            else -> day.format(longDay)
        }

    /**
     * The envelope as they got it: their name only (never an address), whole (never torn or opened), postmarked by
     * their clock once the carrier has it (none while it waits for the pickup), and sealed while it's sealed.
     */
    fun envelope(card: SentCard): MailPieceModel {
        val design = card.card?.design.orEmpty()
        val posted = card.envelope?.postmarkedOn?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
        val from = card.envelope?.from?.takeIf { it.isNotBlank() } ?: "You"
        val to = card.toName?.takeIf { it.isNotBlank() } ?: "them"
        val state = if (card.sealed) "sealed until Christmas morning" else "in its envelope"
        return MailPieceModel(
            id = card.id,
            kind = MailKind.Letter,
            from = from,
            fromLine = null,
            to = to,
            toLine = null,
            sender = MailSender.Neighbor,
            opened = false,
            special = false,
            fade = 1f,
            postmarkTown = null,
            postmarkDay = posted?.format(postmark)?.uppercase(Locale.US).orEmpty(),
            postmarkYear = posted?.year?.toString().orEmpty(),
            stamp = card.card?.let { MailStamp.forCard(it.number, it.design.orEmpty()) } ?: MailStamp.forPiece(card.id),
            note = null,
            meta = "",
            accessibilityLabel = "Christmas card from ${from.removeSuffix(".")} to $to, $state.",
            card = MailPieceCard(design = design, sealed = card.sealed),
        )
    }
}

/**
 * Sent's rows in the Mailbox's list: "What you've sent, newest first.", the cards waiting for the pickup in their well,
 * then the rest by the day they were sent; empty, error (Try again) and the next page's footer as the Mailbox has them.
 */
internal fun LazyListScope.sentItems(
    state: MailSentState,
    takingBack: String?,
    takeBackError: Pair<String, String>?,
    onOpen: (SentCard) -> Unit,
    onTakeBack: (SentCard) -> Unit,
    onRetry: () -> Unit,
    onRetryMore: () -> Unit,
) {
    item(key = "sentIntro") {
        Text(
            "What you’ve sent, newest first.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2).testTag("mailSent"),
        )
    }
    when (state) {
        MailSentState.Loading -> items(SENT_SKELETONS, key = { "sentSkeleton-$it" }) { MailPieceSkeleton() }
        is MailSentState.Error -> item(key = "sentError") { MailboxErrorCard(state.message, onRetry) }
        MailSentState.Empty ->
            item(key = "sentEmpty") { MailboxEmptyCard("Nothing sent yet.", "Cards you send show up here, with when they arrive.") }
        is MailSentState.Loaded -> {
            if (state.waiting.isNotEmpty()) {
                item(key = "sentWaitingTitle") { MailSectionHeader("Waiting for pickup") }
                item(key = "sentWaiting") {
                    SentWaitingWell(state.waiting, takingBack, takeBackError, onOpen, onTakeBack)
                }
            }
            state.days.forEach { day ->
                item(key = "sentDay-${day.id}", contentType = "heading") { MailSectionHeader(day.title) }
                items(day.rows, key = { "sent-${it.card.id}" }, contentType = { "sent" }) { row ->
                    SentRow(
                        row = row,
                        takingBack = takingBack == row.card.id,
                        error = takeBackError?.takeIf { it.first == row.card.id }?.second,
                        onOpen = { onOpen(row.card) },
                        onTakeBack = { onTakeBack(row.card) },
                        modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                    )
                }
            }
            if (state.hasMore || state.loadMoreError != null) {
                item(key = "sentFooter") { MailboxListFooter(state.loadMoreError, onRetryMore) }
            }
        }
    }
}

/** The cards waiting for the 7 a.m. pickup, in a sunken well like the outgoing slot: envelopes not postmarked yet. */
@Composable
private fun SentWaitingWell(
    rows: List<MailSentRow>,
    takingBack: String?,
    takeBackError: Pair<String, String>?,
    onOpen: (SentCard) -> Unit,
    onTakeBack: (SentCard) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(PantopusColors.mailCounter)
                .padding(Spacing.s3)
                .testTag("mailSentWaiting"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        rows.forEach { row ->
            SentRow(
                row = row,
                takingBack = takingBack == row.card.id,
                error = takeBackError?.takeIf { it.first == row.card.id }?.second,
                onOpen = { onOpen(row.card) },
                onTakeBack = { onTakeBack(row.card) },
            )
        }
    }
}

/** One sent card: its envelope, its picture small beside who it went to and where it is, and Take it back while it can. */
@Composable
private fun SentRow(
    row: MailSentRow,
    takingBack: Boolean,
    error: String?,
    onOpen: () -> Unit,
    onTakeBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val spoken = "${row.title.replace(" · ", ", ")}. ${row.line}."
    Column(modifier = modifier.fillMaxWidth().testTag("mailSentRow.${row.card.id}")) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClickLabel = "Open the card", onClick = onOpen)
                    .clearAndSetSemantics {
                        contentDescription = spoken
                        role = Role.Button
                    },
        ) {
            MailPiece(row.envelope)
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                row.card.card
                    ?.design
                    ?.let { TiltedThumb(it, width = 30.dp, tilt = -3f) }
                Column(modifier = Modifier.weight(1f)) {
                    Text(row.title, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
                    if (row.line.isNotEmpty()) {
                        Text(row.line, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
                    }
                }
            }
        }
        if (row.card.canTakeBack) {
            CardButton(
                "Take it back",
                onClick = onTakeBack,
                kind = CardButtonKind.Paper,
                fill = false,
                busy = takingBack,
                modifier = Modifier.align(Alignment.End).padding(top = Spacing.s2).testTag("mailSentTakeBack.${row.card.id}"),
            )
        }
        error?.let {
            Text(
                it,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.error,
                modifier = Modifier.padding(top = Spacing.s2).semantics { liveRegion = LiveRegionMode.Assertive },
            )
        }
    }
}

/** Card-shaped placeholders while Sent is read. */
private const val SENT_SKELETONS = 3
