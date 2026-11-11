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
import app.pantopus.android.ui.components.toastDurationMillis
import app.pantopus.android.ui.screens.mailbox.cards.table.CardOnTable
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSenderActionsViewModel
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSenderSheets
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableDialog
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableMenuItem
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableSendBack
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
            add(CardTableMenuItem("Who sent it and its trail", "cardTableEnvelope", actions.onEnvelope))
            if (letter.filed || letter.archived) {
                val words = if (letter.filed) "Take out of the Vault" else "Back to Incoming"
                add(CardTableMenuItem(words, "cardTableUnfile") { if (!busy) actions.onUnfile() })
            } else {
                add(CardTableMenuItem("File in the Vault", "cardTableFile") { if (!busy) actions.onFile() })
            }
            add(CardTableMenuItem("Shred", "cardTableShred") { if (!busy) actions.onShred() })
            if (person != null) addAll(personItems(letter.fromName, onReport = { reporting = true }, onBlock = { confirmBlock = true }))
        }
    CardTableDialog(
        card = card.onTable(letter),
        firstOpen = card.firstOpen,
        onClose = onBack,
        onOpened = actions.onOpenCard,
        menu = menu,
        message = message ?: said,
        sendBack = sendBack,
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
    return CardTableSendBack("Send ${name.substringBefore(' ')} a card") { sendCard(person, name) }
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
    )
