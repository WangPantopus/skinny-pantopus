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
import app.pantopus.android.ui.components.toastDurationMillis
import app.pantopus.android.ui.screens.mailbox.cards.table.CardOnTable
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSenderActionsViewModel
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSenderSheets
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableDialog
import app.pantopus.android.ui.screens.mailbox.cards.table.CardTableMenuItem
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
    val menu =
        buildList {
            add(CardTableMenuItem("Who sent it and its trail", "cardTableEnvelope", actions.onEnvelope))
            if (letter.filed || letter.archived) {
                val words = if (letter.filed) "Take out of the Vault" else "Back to Incoming"
                add(CardTableMenuItem(words, "cardTableUnfile") { if (!busy) actions.onUnfile() })
            } else {
                add(CardTableMenuItem("File in the Vault", "cardTableFile") { if (!busy) actions.onFile() })
            }
            add(CardTableMenuItem("Shred", "cardTableShred") { if (!busy) actions.onShred() })
            if (person != null) {
                add(CardTableMenuItem("Report", "cardTableReport") { reporting = true })
                add(CardTableMenuItem("Block", "cardTableBlock") { confirmBlock = true })
            }
        }
    CardTableDialog(
        card = card.onTable(letter),
        firstOpen = card.firstOpen,
        onClose = onBack,
        onOpened = actions.onOpenCard,
        menu = menu,
        message = message ?: said,
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
        )
    }
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
    )
