@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import app.pantopus.android.data.api.models.mailbox.MailDetail
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailEnclosure
import app.pantopus.android.ui.screens.mailbox.components.MailAddressBook
import app.pantopus.android.ui.screens.mailbox.components.MailKind
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.MailSender
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** One step of the envelope's trail: what happened and when; [readers] marks what the household did. */
data class MailTrailStep(
    val id: String,
    val title: String,
    val detail: String?,
    val done: Boolean,
    val readers: Boolean,
)

/** "Pantopus read this for you": the server's note and key facts, and on a bill the reminder to check the amount. */
data class MailLetterNote(
    val text: String,
    val facts: List<Pair<String, String>>,
    val checkAmount: Boolean,
)

/**
 * The letter page (Mail tab, receiving; drawings `R5-Bill`, `R6-Envelope`): the envelope it came in, Pantopus's note,
 * the letter on paper with what's enclosed, where it stands, and the envelope turned over (who sent it, how Pantopus
 * checked them, and its trail). Built from `GET /api/mailbox/:id` (Mail build contract v1).
 */
data class MailLetter(
    /** The envelope it came in, drawn opened, as in the Mailbox. */
    val envelope: MailPieceModel,
    val kind: MailKind,
    val sender: MailSender,
    val note: MailLetterNote?,
    /** Letterhead: the sender as printed, and their address. */
    val fromName: String,
    val fromLine: String?,
    /** Who it's to and where. */
    val toName: String?,
    val toLine: String?,
    /** "October 25, 2026": the day it was posted. */
    val dated: String?,
    val enclosures: List<MailEnclosure>,
    /** A bundle opens to its pieces. */
    val isBundle: Boolean,
    /** "Pay $184.00" while a business invoice bill is owed; null otherwise. */
    val payLabel: String?,
    val invoiceId: String?,
    val paid: Boolean,
    val onCounter: Boolean,
    val filed: Boolean,
    /** `personal`, `home` or `business`: which Vault folders fit it. */
    val drawer: String?,
    val homeId: String?,
    /** The sender asks for an acknowledgement (or it's certified mail), and nobody has given it yet. */
    val asksAcknowledge: Boolean,
    val acknowledged: Boolean,
    /** How Pantopus checked the sender, in a sentence. */
    val checked: String,
    val trail: List<MailTrailStep>,
) {
    companion object {
        private val dayFormat = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US)
        private val stampDay = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US)
        private val stampTime = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

        fun from(
            detail: MailDetail,
            book: MailAddressBook,
            zone: ZoneId,
            now: Instant = Instant.now(),
        ): MailLetter {
            // The page opened it, so the envelope is drawn torn open, at full strength.
            val envelope = MailPieceMapper.piece(detail.asRow().copy(viewed = true), book, zone, now).copy(fade = 1f)
            val kind = envelope.kind
            val invoice = detail.invoice
            val owed = invoice?.takeIf { it.owed }
            val delivered = MailPieceMapper.deliveredAt(detail.asRow())?.atZone(zone)
            val posted =
                detail.postmark?.date?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: delivered?.toLocalDate()
            val acknowledged = detail.acknowledgedAt != null || detail.ackStatus.equals("acknowledged", ignoreCase = true)
            return MailLetter(
                envelope = envelope,
                kind = kind,
                sender = envelope.sender,
                note = note(detail, kind),
                fromName = envelope.from,
                fromLine = envelope.fromLine,
                toName = envelope.to,
                toLine = envelope.toLine,
                dated = posted?.format(dayFormat),
                enclosures = detail.enclosures.orEmpty(),
                isBundle = kind == MailKind.Bundle,
                payLabel = owed?.totalCents?.let { "Pay ${MailPieceMapper.money(it, owed.currency)}" },
                invoiceId = owed?.id,
                paid = invoice?.status == "paid",
                onCounter = detail.onCounter,
                filed = detail.lifecycle == "filed" || detail.vaultFolderId != null,
                drawer = detail.drawer,
                homeId = detail.recipientHomeId,
                asksAcknowledge = (detail.ackRequired == true || detail.certified) && !acknowledged,
                acknowledged = acknowledged,
                checked = checkedSentence(envelope.sender),
                trail = trail(detail, posted, delivered, book, zone),
            )
        }

        /** How Pantopus checked the sender (the same words on every app). */
        fun checkedSentence(sender: MailSender): String =
            when (sender) {
                MailSender.Business -> "Pantopus verified this business before it could send mail."
                MailSender.Government -> "Pantopus verified this government office before it could send mail."
                MailSender.Utility -> "Pantopus verified this utility before it could send mail."
                MailSender.Pantopus -> "Pantopus sent this itself."
                MailSender.PantopusBusiness ->
                    "A business with a Pantopus account sent this. Pantopus hasn't verified the business yet."
                MailSender.Neighbor -> "A person with a Pantopus account sent this from it."
                MailSender.Unknown ->
                    "Pantopus couldn't check who sent this. Be careful with its links and with any request for money or " +
                        "personal details."
            }

        private fun note(
            detail: MailDetail,
            kind: MailKind,
        ): MailLetterNote? {
            val summary = detail.summary ?: return null
            val text = summary.text?.trim()?.takeIf { it.isNotEmpty() } ?: return null
            val facts =
                summary.keyFacts.mapNotNull { fact ->
                    val label = fact.label?.trim().orEmpty()
                    val value = fact.value?.trim().orEmpty()
                    if (label.isEmpty() || value.isEmpty()) null else label to value
                }
            return MailLetterNote(text, facts, checkAmount = kind == MailKind.Bill)
        }

        /** Postmarked, delivered, opened, acknowledged, and where it stands now. */
        private fun trail(
            detail: MailDetail,
            posted: LocalDate?,
            delivered: ZonedDateTime?,
            book: MailAddressBook,
            zone: ZoneId,
        ): List<MailTrailStep> =
            buildList {
                val town = detail.postmark?.town?.trim()?.takeIf { it.isNotEmpty() }?.uppercase(Locale.US)
                val postedWords = listOfNotNull(posted?.format(stampDay)?.uppercase(Locale.US), town).joinToString(" · ")
                add(MailTrailStep("postmarked", "Postmarked", postedWords.ifEmpty { null }, done = true, readers = false))
                val home = book.homes.firstOrNull { it.homeId == detail.recipientHomeId }
                val deliveredTo =
                    if (home != null) {
                        "Delivered to ${home.name?.takeIf { it.isNotBlank() } ?: "your home"}'s mailbox"
                    } else {
                        "Delivered to your mailbox"
                    }
                add(MailTrailStep("delivered", deliveredTo, delivered?.let(::stampMoment), done = true, readers = false))
                val opened =
                    listOf(detail.firstOpenedAt, detail.openedAt, detail.viewedAt)
                        .firstNotNullOfOrNull { parse(it) }
                        ?.atZone(zone)
                add(MailTrailStep("opened", "Opened", opened?.let(::stampMoment), done = true, readers = true))
                parse(detail.acknowledgedAt)?.atZone(zone)?.let {
                    add(MailTrailStep("acknowledged", "Acknowledged", stampMoment(it), done = true, readers = true))
                }
                add(standing(detail))
            }

        /** Where it stands now: paid, filed, archived, on the counter, or nothing yet. */
        private fun standing(detail: MailDetail): MailTrailStep {
            val title =
                when {
                    detail.invoice?.status == "paid" -> "Paid"
                    detail.vaultFolderId != null || detail.lifecycle == "filed" -> "Filed in the Vault"
                    detail.archived -> "Archived"
                    detail.onCounter -> "On the counter"
                    else -> null
                }
            return if (title != null) {
                MailTrailStep("standing", title, null, done = true, readers = true)
            } else {
                val what = if (detail.invoice == null) "Filed" else "Paid or filed"
                MailTrailStep("standing", "$what · not yet", null, done = false, readers = false)
            }
        }

        /** "MON OCT 27 · 7:42 AM". */
        private fun stampMoment(time: ZonedDateTime): String =
            "${time.format(stampDay).uppercase(Locale.US)} · ${time.format(stampTime).uppercase(Locale.US)}"

        private fun parse(value: String?): Instant? =
            value?.let { raw ->
                runCatching { Instant.parse(raw) }.getOrNull()
                    ?: runCatching { java.time.OffsetDateTime.parse(raw).toInstant() }.getOrNull()
            }

        /** The detail as a Mailbox row, so the envelope is drawn exactly as the Mailbox draws it. */
        private fun MailDetail.asRow(): DrawerMail =
            DrawerMail(
                id = id,
                type = type,
                mailType = mailType,
                subject = subject,
                createdAt = createdAt,
                displayTitle = displayTitle,
                previewText = previewText,
                ackRequired = ackRequired,
                ackStatus = ackStatus,
                viewed = viewed,
                archived = archived,
                sender = sender?.let { DrawerMail.SenderRef(name = it.name, username = it.username) },
                senderBusinessName = senderBusinessName,
                senderAddress = senderAddress,
                senderDisplay = printedSender ?: senderBusinessName ?: sender?.name ?: "Unknown sender",
                senderTrust = senderTrust ?: "unknown",
                `package` = null,
                dueDate = dueDate,
                kind = kind,
                deliveredAt = deliveredAt,
                specialDelivery = specialDelivery,
                fromPantopus = fromPantopus,
                postmark = postmark,
                onCounter = onCounter,
                recipientHomeId = recipientHomeId,
                recipientName = recipientName,
                bundleId = bundleId,
                bundleLabel = bundleLabel,
                bundleItemCount = bundleItemCount,
                pageCount = pageCount,
                invoice = invoice,
                lifecycle = lifecycle,
            )
    }
}
