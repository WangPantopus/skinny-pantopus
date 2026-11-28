@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.ui.screens.mailbox.cards.table.CardOnTable
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableDialog
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableSendBack
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableSendingCalls
import app.pantopus.android.ui.screens.mailbox.cards.table.SealAnswer
import app.pantopus.android.ui.screens.mailbox.cards.table.copyLink
import app.pantopus.android.ui.screens.mailbox.cards.table.shareLink
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.tableCard

/**
 * Seal it by hand (Part 2 of the Mail and card design plan): after Look it over, the screen becomes the table on the
 * card's cloth, with the card lying note side up and its open envelope behind it, exactly as the other person will find
 * it. The sender puts it in, shuts the flap and holds to seal it; the seal is the send (the draft's own request id, so a
 * second press sends nothing more). A refusal lifts the seal and says why. Once it's gone, "Done" shows the card sent
 * underneath, with every word and rule it had before.
 */
@Suppress("LongParameterList")
@Composable
internal fun SealByHand(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    fromName: String,
    onSeal: () -> Unit,
    /** ✕ or Back before it's sent: Look it over again. */
    onBack: () -> Unit,
    /** Done (or ✕) once it's sent: back to the Mailbox. */
    onFinished: () -> Unit,
    onTakeBack: () -> Unit,
    /** "Send this card to someone else" once it's sent, while another card can go (plan Part 6). */
    onSendAgain: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    // Read once, from the look: sending clears it.
    var card by remember { mutableStateOf<CardOnTable?>(null) }
    if (card == null) card = sealingCard(cards, form, fromName)
    val onTable = card ?: return
    // "Quick seal" once this phone has sealed a card by hand, with the card improvements (Wave 3.5).
    val quickSeal = remember { cards.improved && CardSealedOnce.read(context) }
    // Each refusal is told once: the seal lifts and the screen's own words say why.
    var asked by remember { mutableStateOf(false) }
    var refusals by remember { mutableIntStateOf(0) }
    val calls =
        remember(onTable.id) {
            sendingCalls(cards, form, quickSeal, onRitualEnded = { CardSealedOnce.mark(context) }) {
                asked = true
                onSeal()
            }
        }
    // A refusal is the send ending without the card sent (and not a look at the form before the send began).
    var sawSending by remember { mutableStateOf(false) }
    LaunchedEffect(asked, form.sending, form.step) {
        when {
            !asked -> Unit
            form.sending -> sawSending = true
            form.step == SendCardStep.Sent -> asked = false
            sawSending -> {
                asked = false
                sawSending = false
                refusals += 1
            }
        }
    }
    val answer =
        when {
            form.step == SendCardStep.Sent -> goneWords(cards, form)
            refusals > 0 -> SealAnswer.Refused(form.sendError ?: form.sealError, refusals)
            else -> null
        }
    val again =
        onSendAgain?.takeIf { form.step == SendCardStep.Sent }?.let { listOf(CardTableSendBack(SEND_THIS_CARD_AGAIN, onClick = it)) }
    val goneActions =
        goneActions(form, onTable.fromFirst, onTakeBack) { link, copy ->
            if (copy) copyLink(context, link) else shareLink(context, link, onTable.fromFirst)
        } + again.orEmpty()
    val isSent = form.step == SendCardStep.Sent
    CardTableDialog(
        card = onTable,
        firstOpen = false,
        onClose = if (isSent) onFinished else onBack,
        mine = true,
        canShare = false,
        sending = calls,
        sealAnswer = answer,
        goneActions = goneActions,
    )
}

/**
 * Who the table's sending moment is for ("For Hazel.", or with the card improvements a link's name on its envelope, Wave
 * 3.2), how many cards go, and what Quick seal and the seal do.
 */
private fun sendingCalls(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    quickSeal: Boolean,
    onRitualEnded: () -> Unit,
    onSeal: () -> Unit,
): CardTableSendingCalls {
    val to = form.to
    val linkName = envelopeName(form.linkName).takeIf { cards.improved && to is CardRecipient.Link }
    return CardTableSendingCalls(
        toFirst = linkName ?: to?.let(::firstOf),
        several = (to as? CardRecipient.Several)?.entries?.size ?: 1,
        quickSeal = quickSeal,
        onRitualEnded = onRitualEnded,
        onSeal = onSeal,
    )
}

/** Step 5's quiet buttons: by link, Copy link and Share ([onLink]); else Take it back while it can be. */
private fun goneActions(
    form: SendCardForm,
    fromFirst: String,
    onTakeBack: () -> Unit,
    onLink: (link: String, copy: Boolean) -> Unit,
): List<CardTableSendBack> {
    val sent = form.sent ?: return emptyList()
    val link = sent.link
    return when {
        sent.byLink && link != null && fromFirst.isNotEmpty() ->
            listOf(CardTableSendBack("Copy link") { onLink(link, true) }, CardTableSendBack("Share") { onLink(link, false) })
        sent.canTakeBack && form.to !is CardRecipient.Several -> listOf(CardTableSendBack("Take it back", onClick = onTakeBack))
        else -> emptyList()
    }
}

/** The card as it will arrive, from the look: its picture, note, postmark and cloth, and who it's for on the envelope. */
private fun sealingCard(
    cards: HolidayCardsResponse,
    form: SendCardForm,
    fromName: String,
): CardOnTable? {
    val design = cards.designOf(form.design) ?: return null
    val to = form.to ?: return null
    val preview = (if (to is CardRecipient.Several) form.listPreview?.look else form.preview) ?: return null
    val envelopeTo =
        when (to) {
            is CardRecipient.Person -> to.name
            is CardRecipient.Email -> to.email
            // The name on its envelope, with the card improvements (Wave 3.2).
            CardRecipient.Link -> envelopeName(form.linkName).takeIf { cards.improved }
            is CardRecipient.Several -> to.entries.firstOrNull()?.label
        }
    val from = preview.piece.senderDisplay.trim().ifEmpty { fromName }
    return lookCard(preview, design, cards.year)
        .tableCard(id = "seal-${form.requestId ?: design.id}", from = from, to = envelopeTo)
        .copy(sealed = preview.sealed, note = form.message.trim(), signature = form.signature)
}

/** "Hazel", an address as it is, or "Hazel and 2 more" for a list; null by link. */
private fun firstOf(to: CardRecipient): String? =
    when (to) {
        is CardRecipient.Person -> to.firstName
        is CardRecipient.Email -> to.email
        CardRecipient.Link -> null
        is CardRecipient.Several -> {
            val first = to.entries.firstOrNull()?.let(::firstOf) ?: "them"
            if (to.entries.size > 1) "$first and ${to.entries.size - 1} more" else first
        }
    }

/** Step 5's words: today's, with when it arrives. */
private fun goneWords(
    cards: HolidayCardsResponse,
    form: SendCardForm,
): SealAnswer.Took {
    val results = form.listResults
    if (results != null) {
        val went = results.count { it.status != "not_sent" }
        return SealAnswer.Took(if (went == 1) "1 card on its way." else "$went cards on their way.", "")
    }
    val sent = form.sent ?: return SealAnswer.Took("On its way.", "")
    val zone = HolidayCardTimes.zone(cards.timeZone)
    // Today's words under it: when it arrives, and until when it can be taken back; a travelling card says so too.
    val lines =
        listOfNotNull(
            arrivalLine(sent, zone, cards.improved),
            takeBackLine(sent, zone),
            CAN_TRAVEL.takeIf { sent.travel != null },
        ).joinToString("\n")
    // With the card improvements the line itself starts "We emailed them.": it isn't said twice.
    val saysEmailed = cards.improved && lines.startsWith(EMAILED)
    return when (val to = form.to) {
        CardRecipient.Link -> SealAnswer.Took("Your card is ready.", lines)
        // Set for later, nothing is emailed yet: the line under it says when.
        is CardRecipient.Email ->
            SealAnswer.Took(
                "On its way to ${to.email}.",
                listOfNotNull(EMAILED.takeIf { sent.emailSendAt == null && !saysEmailed }, lines).joinToString("\n"),
            )
        is CardRecipient.Person -> SealAnswer.Took("On its way to ${to.firstName}.", lines)
        else -> SealAnswer.Took("On its way.", lines)
    }
}

/** Said once a card by email went; with the card improvements the line under it may say it already. */
private const val EMAILED = "We emailed them."

/** Under "On its way to Maya." for a card that travels (travelling card plan Part 2). */
internal const val CAN_TRAVEL = "It can travel. You’ll hear when it reaches a town."
