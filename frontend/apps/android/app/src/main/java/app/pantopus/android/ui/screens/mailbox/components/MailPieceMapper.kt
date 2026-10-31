@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.components

import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailCard
import app.pantopus.android.data.api.models.mailbox.v2.MailDelivery
import app.pantopus.android.data.api.models.mailbox.v2.MailHome
import app.pantopus.android.data.api.net.NetworkError
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/** Who the person's mail is addressed to: their name, and their Homes' addresses. */
data class MailAddressBook(
    val personName: String?,
    val homes: List<MailHome> = emptyList(),
) {
    /** The address the person's own mail goes to: the first Home whose mail opens for them. */
    val ownAddress: String? get() = homes.firstOrNull { it.mailAccess == "open" }?.addressLine?.takeIf { it.isNotBlank() }

    fun homeAddress(homeId: String?): String? = homes.firstOrNull { it.homeId == homeId }?.addressLine?.takeIf { it.isNotBlank() }
}

/** A row drawn once: its piece and the day it came, so a growing list is grouped again without reading it again. */
data class MappedMail(
    val row: DrawerMail,
    val piece: MailPieceModel,
    /** The day it came, in the mailbox's zone. */
    val day: LocalDate?,
)

/** A day's pieces under its heading: Today, Yesterday, Earlier this week, Earlier. */
data class MailSection(
    val id: String,
    val title: String,
    val pieces: List<MailPieceModel>,
)

/**
 * Turns the server's rows into drawn pieces (Mail build contract v1). The mailbox's own [zone] decides what "today"
 * is, so the sections and times match the morning round.
 */
object MailPieceMapper {
    private val dayFormat = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    private val shortDate = DateTimeFormatter.ofPattern("MMM d", Locale.US)
    private val longDate = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
    private val weekday = DateTimeFormatter.ofPattern("EEE", Locale.US)

    fun zoneOf(delivery: MailDelivery?): ZoneId =
        delivery?.timeZone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()

    /** When a piece went into the box: `delivered_at`, or `created_at` from a server without it. */
    fun deliveredAt(row: DrawerMail): Instant? = parseInstant(row.deliveredAt) ?: parseInstant(row.createdAt)

    fun piece(
        row: DrawerMail,
        book: MailAddressBook,
        zone: ZoneId,
        now: Instant = Instant.now(),
    ): MailPieceModel = draw(row, book, zone, now, deliveredAt(row)?.atZone(zone))

    /** [piece], with the day it came for grouping; the delivery time is read once for both. */
    fun map(
        row: DrawerMail,
        book: MailAddressBook,
        zone: ZoneId,
        now: Instant = Instant.now(),
    ): MappedMail {
        val delivered = deliveredAt(row)?.atZone(zone)
        return MappedMail(row, draw(row, book, zone, now, delivered), delivered?.toLocalDate())
    }

    private fun draw(
        row: DrawerMail,
        book: MailAddressBook,
        zone: ZoneId,
        now: Instant,
        delivered: ZonedDateTime?,
    ): MailPieceModel {
        val kind = MailKind.fromWire(row.kind)
        val sender = MailSender.from(row.senderTrust, row.fromPantopus, fromBusiness = !row.senderBusinessName.isNullOrBlank())
        val from = row.senderDisplay.ifBlank { row.senderBusinessName ?: "Unknown sender" }
        val today = now.atZone(zone).toLocalDate()
        val title = row.displayTitle?.takeIf { it.isNotBlank() } ?: row.subject?.takeIf { it.isNotBlank() }
        val postmarkDate = parseDay(row.postmark?.date) ?: delivered?.toLocalDate()
        val dueWords = owedWords(row, today)
        val whenWords = delivered?.let { whenWords(it, today) }
        val ageDays = delivered?.let { ChronoUnit.DAYS.between(it.toLocalDate(), today) } ?: 0
        // A Christmas card sealed until Christmas morning stays shut, whatever an older app marked.
        val opened = row.viewed && row.card?.sealed != true
        val cameToday = delivered?.toLocalDate() == today
        return MailPieceModel(
            id = row.id,
            kind = kind,
            from = from,
            fromLine = row.senderAddress?.takeIf { it.isNotBlank() },
            to = row.recipientName?.takeIf { it.isNotBlank() } ?: book.personName?.takeIf { it.isNotBlank() },
            toLine = if (row.recipientHomeId != null) book.homeAddress(row.recipientHomeId) else book.ownAddress,
            sender = sender,
            opened = opened,
            special = row.specialDelivery,
            fade = if (opened) fade(ageDays) else 1f,
            postmarkTown = row.postmark?.town?.takeIf { it.isNotBlank() },
            postmarkDay = postmarkDate?.format(shortDate)?.uppercase(Locale.US) ?: "",
            postmarkYear = postmarkDate?.year?.toString() ?: "",
            stamp = stamp(row),
            note = note(kind, row, title),
            meta = meta(row, kind, whenWords, dueWords),
            accessibilityLabel =
                row.card?.let { cardLabel(it, from, row.viewed, whenWords, cameToday) }
                    ?: spokenLabel(row, kind, from, sender, dueWords, whenWords, cameToday),
            bundleCount = row.bundleItemCount,
            pageCount = row.pageCount,
            card = row.card?.let { MailPieceCard(design = it.design, sealed = it.sealed) },
        )
    }

    /** A Christmas card's stamp goes with its picture, so the one its sender looked over is the one that comes. */
    private fun stamp(row: DrawerMail): MailStamp = row.card?.let { MailStamp.forCard(it.number, it.design) } ?: MailStamp.forPiece(row.id)

    /** What's due: a bill still owed says how much ("$184.00 due today"); else the due day, if any. */
    private fun owedWords(
        row: DrawerMail,
        today: LocalDate,
    ): String? {
        // Filed in the Vault, it's done with: no due words.
        if (row.lifecycle == "filed") return null
        val owed = row.invoice?.takeIf { it.owed }
        val amount = owed?.totalCents?.let { money(it, owed.currency) }
        val due = dueWords(parseDay(owed?.dueDate ?: row.dueDate), today)
        return when {
            amount == null -> due
            due == null -> "$amount due"
            else -> "$amount $due"
        }
    }

    /** "overdue since Mon, Oct 26", "due today" or "due Fri, Nov 7"; null when nothing is due. */
    private fun dueWords(
        due: LocalDate?,
        today: LocalDate,
    ): String? =
        when {
            due == null -> null
            due.isBefore(today) -> "overdue since ${due.format(dayFormat)}"
            due == today -> "due today"
            else -> "due ${due.format(dayFormat)}"
        }

    /** When it came: the time today, the weekday this week, else the date. */
    private fun whenWords(
        delivered: ZonedDateTime,
        today: LocalDate,
    ): String {
        val day = delivered.toLocalDate()
        return when {
            day == today -> clock(delivered)
            ChronoUnit.DAYS.between(day, today) in 1..6 -> delivered.format(weekday)
            day.year == today.year -> delivered.format(shortDate)
            else -> delivered.format(longDate)
        }
    }

    /** The words the paper carries besides the addresses. */
    private fun note(
        kind: MailKind,
        row: DrawerMail,
        title: String?,
    ): String? =
        when (kind) {
            // A sealed letter shows only who sent it.
            MailKind.Letter -> null
            // A postcard reads without opening.
            MailKind.Postcard -> row.previewText?.takeIf { it.isNotBlank() } ?: title
            MailKind.Bundle -> row.bundleLabel?.takeIf { it.isNotBlank() } ?: title
            else -> title
        }

    /** The line under the piece: "7:00 a.m. · Opened · Due Fri, Nov 7"; a card's "7:00 a.m. · Christmas card · Opened". */
    private fun meta(
        row: DrawerMail,
        kind: MailKind,
        whenWords: String?,
        dueWords: String?,
    ): String {
        val card = row.card
        if (card != null) {
            val state = if (card.sealed) "Opens Christmas morning" else "Opened".takeIf { row.viewed }
            return listOfNotNull(whenWords, "Christmas card", state).joinToString(" · ")
        }
        return listOfNotNull(
            whenWords,
            "Opened".takeIf { row.viewed },
            "Paid".takeIf { row.invoice?.status == "paid" },
            "Special delivery".takeIf { row.specialDelivery },
            dueWords?.replaceFirstChar { it.uppercase() },
            "On the Counter".takeIf { row.onCounter && dueWords == null },
            row.pageCount?.takeIf { kind == MailKind.Booklet && it > 0 }?.let { if (it == 1) "1 page" else "$it pages" },
            row.bundleItemCount?.takeIf { kind == MailKind.Bundle && it > 0 }?.let { if (it == 1) "1 piece" else "$it pieces" },
        ).joinToString(" · ")
    }

    /** One sentence for a screen reader: what it is, from whom, sealed or opened, special, due, and when it came. */
    private fun spokenLabel(
        row: DrawerMail,
        kind: MailKind,
        from: String,
        sender: MailSender,
        dueWords: String?,
        whenWords: String?,
        cameToday: Boolean,
    ): String {
        // Said in words: no "·" for a screen reader to read out, and Pantopus's own letters already say who they're from.
        // A Christmas card's sender needs no proven home, so it claims none.
        val spokenSender =
            when (sender) {
                MailSender.Pantopus -> null
                MailSender.Neighbor -> if (row.card != null) "a Pantopus neighbor" else "a Pantopus neighbor at a verified address"
                MailSender.PantopusBusiness -> "a business on Pantopus"
                else -> sender.line.lowercase(Locale.US)
            }
        return buildString {
            append("${kind.word} from $from")
            spokenSender?.let { append(", $it") }
            append(if (row.viewed) ", opened" else ", sealed")
            if (row.invoice?.status == "paid") append(", paid")
            if (row.specialDelivery) append(", special delivery")
            dueWords?.let { append(", $it") }
            if (row.onCounter && dueWords == null) append(", on the counter")
            whenWords?.let { append(if (cameToday) ", came today at $it" else ", came $it") }
            // "7:00 a.m." already ends the sentence.
            if (!endsWith(".")) append('.')
        }
    }

    /** A Christmas card, for a screen reader: from whom, sealed until Christmas morning, opened or in its envelope. */
    private fun cardLabel(
        card: MailCard,
        from: String,
        viewed: Boolean,
        whenWords: String?,
        cameToday: Boolean,
    ): String {
        val state =
            when {
                card.sealed -> ", sealed until Christmas morning"
                viewed -> ", opened"
                else -> ", in its envelope"
            }
        val came = whenWords?.let { if (cameToday) ", came today at $it" else ", came $it" }.orEmpty()
        // "7:00 a.m." already ends the sentence.
        return "Christmas card from $from$state$came".let { if (it.endsWith(".")) it else "$it." }
    }

    /** "$184.00" (a bill's dollars and cents); another currency keeps its code ("12.50 CAD"). */
    fun money(
        cents: Long,
        currency: String?,
    ): String {
        val units = cents / 100.0
        return if (currency.isNullOrBlank() || currency.equals("usd", ignoreCase = true)) {
            String.format(Locale.US, "$%,.2f", units)
        } else {
            String.format(Locale.US, "%,.2f %s", units, currency.uppercase(Locale.US))
        }
    }

    /** "2026-10-27" (or a timestamp starting with it) as a day; null when missing or unreadable. */
    private fun parseDay(value: String?): LocalDate? = value?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

    /**
     * Pieces grouped by the day they came, newest first ([byDay]), or in the server's order under no heading. A bundle's
     * own pieces stay inside it: they're left out while the bundle is in the list, and open from it.
     */
    fun sections(
        mapped: List<MappedMail>,
        zone: ZoneId,
        now: Instant = Instant.now(),
        byDay: Boolean = true,
    ): List<MailSection> {
        val bundles = mapped.filter { it.piece.kind == MailKind.Bundle }.map { it.row.id }.toSet()
        val today = now.atZone(zone).toLocalDate()
        val shown = mapped.filterNot { it.row.bundleId != null && it.row.bundleId in bundles && it.row.id != it.row.bundleId }
        // Without day headings: one untitled section, in the order the server gave.
        if (!byDay) return listOf(MailSection("all", "", shown.map { it.piece }))
        return shown
            .groupBy { mail ->
                val day = mail.day
                when {
                    day == null -> Heading.Earlier
                    day == today -> Heading.Today
                    day == today.minusDays(1) -> Heading.Yesterday
                    ChronoUnit.DAYS.between(day, today) in 2..6 -> Heading.ThisWeek
                    else -> Heading.Earlier
                }
            }.toSortedMap(compareBy { it.ordinal })
            .map { (heading, group) -> MailSection(heading.name, heading.title, group.map { it.piece }) }
    }

    private enum class Heading(
        val title: String,
    ) {
        Today("Today"),
        Yesterday("Yesterday"),
        ThisWeek("Earlier this week"),
        Earlier("Earlier"),
    }

    /** "7:00 a.m." */
    fun clock(time: ZonedDateTime): String {
        val hour = (time.hour % 12).let { if (it == 0) 12 else it }
        return "$hour:${"%02d".format(time.minute)} ${if (time.hour < 12) "a.m." else "p.m."}"
    }

    /** Opened mail fades slowly after two weeks, to 0.6 at about four months. */
    private fun fade(ageDays: Long): Float = (1f - (ageDays - 14).coerceAtLeast(0) / 110f * 0.4f).coerceIn(0.6f, 1f)

    private fun parseInstant(value: String?): Instant? =
        value?.let { raw ->
            runCatching { Instant.parse(raw) }.getOrNull() ?: runCatching { java.time.OffsetDateTime.parse(raw).toInstant() }.getOrNull()
        }
}

/**
 * The Mailbox's top card (drawings `Main`, `R1-Before`, `R4-NoMail`): the morning round in the person's own words.
 * Before today's round: "Your mail comes this morning". After a round that brought mail: "Today's mail came at
 * 7:00 a.m." with how many came and how many are still sealed. After an empty round: "No mail today".
 */
data class MailboxHeroState(
    val title: String,
    val detail: String,
    /** "5067 Example Verify Lane · verified home", or null when the person has no Home whose mail opens. */
    val address: String?,
    /** The house number for the mailbox's plate. */
    val number: String?,
) {
    companion object {
        fun from(
            delivery: MailDelivery?,
            book: MailAddressBook,
            now: Instant = Instant.now(),
        ): MailboxHeroState {
            val zone = MailPieceMapper.zoneOf(delivery)
            val today = now.atZone(zone).toLocalDate()
            val last = delivery?.lastAt?.let { runCatching { Instant.parse(it) }.getOrNull() }?.atZone(zone)
            val next = delivery?.nextAt?.let { runCatching { Instant.parse(it) }.getOrNull() }?.atZone(zone)
            val address = book.ownAddress
            val number = address?.substringBefore(' ')?.takeIf { it.any(Char::isDigit) && it.length <= 6 }
            val nextWords = next?.let { "${it.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US))}, usually by 8 a.m." }
            val (title, detail) =
                when {
                    last != null && last.toLocalDate() == today -> todaysRound(last, delivery?.lastCount ?: 0, delivery?.lastUnopened ?: 0)
                    next != null && next.toLocalDate() == today ->
                        "Your mail comes this morning" to "Usually by 8 a.m. You'll get one notification."
                    last == null && next != null -> "Your mail comes each morning" to "The next delivery is ${nextWords.orEmpty()}"
                    else -> "No mail today" to "Your next delivery is tomorrow morning, usually by 8 a.m."
                }
            return MailboxHeroState(title, detail, address?.let { "$it · verified home" }, number)
        }

        /** "Today's mail came at 7:00 a.m." with how many came and how many are still sealed. */
        private fun todaysRound(
            last: ZonedDateTime,
            count: Int,
            unopened: Int,
        ): Pair<String, String> {
            val pieces = if (count == 1) "1 piece" else "$count pieces"
            val sealed =
                when (unopened) {
                    0 -> "all opened"
                    count -> if (count == 1) "unopened" else "all unopened"
                    else -> "$unopened unopened"
                }
            return "Today's mail came at ${MailPieceMapper.clock(last)}" to "$pieces · $sealed"
        }
    }
}

/**
 * What a failed mail read says, where it failed (Mail build README, "Errors people can understand"): offline, the
 * server unreachable or in trouble, not allowed, and gone are told apart, each with what to do.
 */
fun NetworkError.mailMessage(
    online: Boolean,
    doing: String = "load your mail",
): String =
    when {
        !online -> "You're offline. Connect to the internet and try again."
        this is NetworkError.Transport -> "Couldn't reach Pantopus to $doing. Check your connection and try again."
        this is NetworkError.Unauthorized -> "Your session has ended. Sign in again to see your mail."
        this is NetworkError.Forbidden -> reason ?: "You can't open this mail."
        this is NetworkError.NotFound -> "This mail isn't in your mailbox. It may have been removed."
        this is NetworkError.ClientError -> message
        this is NetworkError.Server ->
            NetworkError.ClientError.friendlyClientMessage(body) ?: "Couldn't $doing. Pantopus is having trouble; try again in a moment."
        else -> "Couldn't $doing. Pantopus is having trouble; try again in a moment."
    }
