@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.ui.components.toastDurationMillis
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.screens.mailbox.cards.table.CardOnTable
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplySent
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplySheet
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplyState
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplyTable
import app.pantopus.android.ui.screens.mailbox.cards.table.CardReplyViewModel
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSenderActionsViewModel
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSenderSheets
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableDialog
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableMenuItem
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableNext
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableSendBack
import app.pantopus.android.ui.screens.mailbox.cards.table.JoinedCardView
import app.pantopus.android.ui.screens.mailbox.cards.table.joined
import app.pantopus.android.ui.screens.mailbox.components.MailSender
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.delay

/**
 * A Christmas card's page with the table on (launch key `card_table`): the card opens full screen over the app, and its
 * ⋯ holds what the letter page's buttons do. Closing it goes back to the Mailbox.
 */
@Composable
internal fun HolidayCardTablePage(
    letter: MailLetter,
    card: MailLetterCard,
    actionInFlight: String?,
    message: String?,
    actions: LetterActions,
    onBack: () -> Unit,
    senderUserId: String?,
    senderActions: CardSenderActionsViewModel = hiltViewModel(),
    replies: CardReplyViewModel = hiltViewModel(),
) {
    // Under the table, in the moment before its window opens: the table's own dark, not a flash of the app.
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.tableNight).testTag("mailHolidayCard"))
    val busy = actionInFlight != null
    val said by senderActions.said.collectAsStateWithLifecycle()
    LaunchedEffect(said) {
        if (said != null) {
            delay(toastDurationMillis(said.orEmpty(), minimumMillis = 2_600))
            senderActions.say(null)
        }
    }
    var reporting by rememberSaveable { mutableStateOf(false) }
    var confirmBlock by rememberSaveable { mutableStateOf(false) }
    // Only a person can be reported or blocked: Pantopus and a piece with no known sender can't.
    val person = senderUserId?.takeIf { letter.sender != MailSender.Pantopus }
    // "Send Hazel a card": to the one who sent it, while sending is open and neither has blocked the other; a sealed
    // card shows it once it opens.
    val sendCard = actions.onSendCard
    LaunchedEffect(person, sendCard != null) { if (person != null && sendCard != null) senderActions.checkSendBack(person) }
    val canSendBack by senderActions.canSendBack.collectAsStateWithLifecycle()
    val sendBack = sendBackAction(person, letter.fromName, sendCard.takeIf { canSendBack && !card.sealed })
    val menu =
        buildList {
            sendBack?.let { add(CardTableMenuItem(it.title, "cardTableMenuSendBack", it.onClick)) }
            addPieceItems(letter, busy, actions)
            if (person != null) addAll(personItems(letter.fromName, onReport = { reporting = true }, onBlock = { confirmBlock = true }))
        }
    // "Open the next card" (plan Part 4): only with the Mailbox list's waiting cards in hand.
    val next =
        actions.onOpenNextCard?.let { open ->
            actions.nextCards.firstOrNull()?.let { first ->
                CardTableNext(waiting = actions.nextCards.size) { open(first, actions.nextCards.drop(1)) }
            }
        }
    // Writing back (plan Part 3): the joined card says whether this reader may, or that they already did.
    LaunchedEffect(letter.envelope.id, card.sealed) { if (!card.sealed) replies.load(letter.envelope.id) }
    val replyState by replies.state.collectAsStateWithLifecycle()
    var showsJoined by rememberSaveable { mutableStateOf(false) }
    val onTable = card.onTable(letter)
    // Once the reader blocks the sender here, the card no longer offers to write back to them.
    val blocked by senderActions.blocked.collectAsStateWithLifecycle()
    val reply =
        replyAction(replyState, onTable.fromFirst, onWrite = replies::open, onJoined = { showsJoined = true })
            .takeUnless { blocked }
    CardTableDialog(
        card = onTable,
        firstOpen = card.firstOpen,
        onClose = onBack,
        onOpened = actions.onOpenCard,
        menu = menu,
        message = message ?: said,
        sendBack = sendBack,
        next = next,
        reply = reply,
        overlay = {
            ReplyOverlay(
                card = onTable,
                myName = letter.toName.orEmpty(),
                state = replyState,
                replies = replies,
                showsJoined = showsJoined,
                onCloseJoined = { showsJoined = false },
            )
        },
    )
    if (person != null) {
        CardSenderSheets(
            userId = person,
            name = letter.fromName.trim().ifEmpty { "this person" },
            reporting = reporting,
            confirmBlock = confirmBlock,
            onCloseReport = { reporting = false },
            onCloseBlock = { confirmBlock = false },
            viewModel = senderActions,
            cardId = letter.envelope.id.takeIf { LaunchFeatures.holidayCardMemories },
        )
    }
}

/** What the letter page's buttons do, in a card's (or a reply's) ⋯: who sent it and its trail, the Vault, Shred. */
private fun MutableList<CardTableMenuItem>.addPieceItems(
    letter: MailLetter,
    busy: Boolean,
    actions: LetterActions,
) {
    add(CardTableMenuItem("Who sent it and its trail", "cardTableEnvelope", actions.onEnvelope))
    if (letter.filed || letter.archived) {
        val words = if (letter.filed) "Take out of the Vault" else "Back to Incoming"
        add(CardTableMenuItem(words, "cardTableUnfile") { if (!busy) actions.onUnfile() })
    } else {
        add(CardTableMenuItem("File in the Vault", "cardTableFile") { if (!busy) actions.onFile() })
    }
    add(CardTableMenuItem("Shred", "cardTableShred") { if (!busy) actions.onShred() })
}

/**
 * The reply's quiet button (plan Part 3): "Write back to Hazel" ("Write back" when the row is short of room) while this
 * reader may, or "You wrote back" (opening the joined card, which shows the day) once they have; null otherwise, and
 * while the joined card hasn't been read.
 */
private fun replyAction(
    state: CardReplyState,
    first: String,
    onWrite: () -> Unit,
    onJoined: () -> Unit,
): CardTableSendBack? {
    val exchange = state.exchange ?: return null
    val mine = exchange.reply
    return when {
        mine != null -> CardTableSendBack("You wrote back", onClick = onJoined)
        exchange.canReply -> CardTableSendBack("Write back to $first", short = "Write back", onClick = onWrite)
        else -> null
    }
}

/** Over the card's table: the reply's sheet while it's written and sent, or the joined card. */
@Composable
private fun ReplyOverlay(
    card: CardOnTable,
    myName: String,
    state: CardReplyState,
    replies: CardReplyViewModel,
    showsJoined: Boolean,
    onCloseJoined: () -> Unit,
) {
    val zone = HolidayCardTimes.zone(null)
    // The saved signature, drawn at FROM and sent with the reply.
    val cards by HolidayCardsRepository.latest.collectAsStateWithLifecycle()
    if (state.writing) {
        val sent =
            state.sent?.let { summary ->
                val day = HolidayCardTimes.longDay(summary.arrivesOn ?: summary.arrivesAt, zone)
                CardReplySent(
                    arrives = "${card.fromFirst} gets it with their 7 a.m. mail on $day.",
                    canTakeBack = summary.canTakeBack,
                )
            }
        CardReplySheet(
            card = card,
            myName = myName,
            signature = cards?.signature?.saved?.takeIf { it.drawable },
            message = state.message,
            limit = 300,
            onMessage = replies::onMessage,
            busy = state.sending || state.takingBack,
            problem = state.problem,
            sent = sent,
            onSend = replies::send,
            onTakeBack = replies::takeBack,
            onClose = replies::close,
        )
        return
    }
    if (!showsJoined) return
    val joined = state.exchange?.joined(viewerWrote = true) ?: return
    JoinedCardView(joined, onClose = onCloseJoined, closeLabel = "Close")
}

/**
 * A reply's own page (plan Part 3): the joined card, the card its reader sent with the reply sheet on it. Its ⋯ holds
 * Report and Block for whoever wrote back.
 */
@Composable
internal fun HolidayCardReplyPage(
    letter: MailLetter,
    actionInFlight: String?,
    message: String?,
    actions: LetterActions,
    onBack: () -> Unit,
    senderUserId: String?,
    replies: CardReplyViewModel = hiltViewModel(),
    senderActions: CardSenderActionsViewModel = hiltViewModel(),
) {
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.tableNight).testTag("mailCardReply"))
    LaunchedEffect(letter.envelope.id) { replies.load(letter.envelope.id) }
    val state by replies.state.collectAsStateWithLifecycle()
    var reporting by rememberSaveable { mutableStateOf(false) }
    var confirmBlock by rememberSaveable { mutableStateOf(false) }
    val person = senderUserId?.takeIf { letter.sender != MailSender.Pantopus }
    // Its ⋯ holds what a card's does: the trail, the Vault, Shred, and Report and Block for whoever wrote back.
    val menu =
        buildList<CardTableMenuItem> {
            addPieceItems(letter, actionInFlight != null, actions)
            person?.let { addAll(personItems(letter.fromName, onReport = { reporting = true }, onBlock = { confirmBlock = true })) }
        }
    state.exchange?.joined(viewerWrote = false)?.let { joined ->
        CardReplyTable(joined, onClose = onBack, menu = menu, message = message)
    }
    if (person != null) {
        CardSenderSheets(
            userId = person,
            name = letter.fromName.trim().ifEmpty { "this person" },
            reporting = reporting,
            confirmBlock = confirmBlock,
            onCloseReport = { reporting = false },
            onCloseBlock = { confirmBlock = false },
            viewModel = senderActions,
            cardId = letter.envelope.id,
        )
    }
}

/** Report and Block for whoever sent it; with card memories (wave 4 drawing 6), "Report this card" and "Block {first name}". */
private fun personItems(
    fromName: String,
    onReport: () -> Unit,
    onBlock: () -> Unit,
): List<CardTableMenuItem> {
    val memories = LaunchFeatures.holidayCardMemories
    val first = fromName.trim().substringBefore(' ').removeSuffix(".")
    val block = if (memories && first.isNotEmpty()) "Block $first" else "Block"
    return listOf(
        CardTableMenuItem(if (memories) "Report this card" else "Report", "cardTableReport", onReport),
        CardTableMenuItem(block, "cardTableBlock", onBlock),
    )
}

/** "Send Hazel a card", when there's a person to send one to and a way to; null otherwise. */
private fun sendBackAction(
    person: String?,
    fromName: String,
    sendCard: ((userId: String, name: String) -> Unit)?,
): CardTableSendBack? {
    val name = fromName.trim()
    if (person == null || sendCard == null || name.isEmpty()) return null
    return CardTableSendBack("Send ${name.substringBefore(' ')} a card", short = "Send a card") { sendCard(person, name) }
}

/** The card as the table draws it, with the names on its envelope. */
internal fun MailLetterCard.onTable(letter: MailLetter): CardOnTable =
    tableCard(id = letter.envelope.id, from = letter.fromName.trim().ifEmpty { "Someone" }, to = letter.toName)

/** The card as the table draws it, for any place that plays the moment: the Mailbox, Look it over and Sent. */
internal fun MailLetterCard.tableCard(
    id: String,
    from: String,
    to: String?,
): CardOnTable =
    CardOnTable(
        id = id,
        design = design,
        number = number,
        slug = slug,
        table = table,
        caption = caption.orEmpty(),
        paper = paper,
        year = year,
        mailedOn = mailedOn,
        note = note,
        from = from,
        to = to,
        sealed = sealed,
        opensIn = opensIn,
        daysUntilOpen = daysUntilOpen,
        verse = verse,
        signature = signature,
        photo = photo,
        voice = voice,
        travel = travel,
    )
