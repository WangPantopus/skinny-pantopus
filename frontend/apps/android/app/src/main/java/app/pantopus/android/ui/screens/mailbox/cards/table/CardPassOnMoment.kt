@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.data.api.models.mailbox.SentHolidayCard
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.ui.screens.mailbox.cards.CardRecipient
import app.pantopus.android.ui.screens.mailbox.cards.CardTownSheet
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardTimes
import app.pantopus.android.ui.screens.mailbox.cards.arrivalLine
import app.pantopus.android.ui.screens.mailbox.cards.takeBackLine

/**
 * Over a travelling card's table (travelling card plan Part 4): the "Pass it on" sheet, "Where does it start?" for
 * someone with no town yet, and once the checks pass, the sealing moment exactly as it is for a card, ending "On its
 * way to Ivy.".
 */
@Composable
internal fun PassOnOverlay(
    card: CardOnTable,
    /** The reader's own name: FROM on the card they pass on. */
    myName: String,
    model: CardPassOnViewModel,
) {
    val state by model.state.collectAsStateWithLifecycle()
    val cards by HolidayCardsRepository.latest.collectAsStateWithLifecycle()
    val signature = cards?.signature?.saved?.takeIf { it.drawable }
    if (state.open && !state.sealing) CardPassOnSheet(card, myName, signature, cards?.travel?.town, state, model)
    if (state.askTown) CardTownSheet(onKept = { model.townKept() }, onDismiss = model::townDismissed)
    if (state.sealing) PassOnSealing(card, myName, signature, state, model)
}

/** The sealing moment for the pass-on: the same card with the reader's note, in an envelope to who gets it next. */
@Composable
private fun PassOnSealing(
    card: CardOnTable,
    myName: String,
    signature: CardSignature?,
    state: CardPassOnState,
    model: CardPassOnViewModel,
) {
    val context = LocalContext.current
    val to = state.to ?: return
    // Read once, as the seal starts: sending clears nothing of it.
    val onTable =
        remember(to) {
            card.copy(
                id = "pass-on-${card.id}",
                note = state.message.trim(),
                from = myName.trim().ifEmpty { "You" },
                to = (to as? CardRecipient.Person)?.name ?: (to as? CardRecipient.Email)?.email,
                signature = signature,
                sealed = false,
                photo = null,
                voice = null,
                // Its envelope carries the journey's postmarks; the passer's own is struck as it's sealed (Part 3).
                travel =
                    state.postmark?.let { newest ->
                        card.travel?.let { it.copy(journey = null, postmarks = it.postmarks + newest) }
                            ?: CardTravel(journey = null, postmarks = listOf(newest), miles = 0, towns = 1)
                    },
            )
        }
    val calls = remember(onTable.id) { CardTableSendingCalls(toFirst = firstOf(to), several = 1) { model.seal() } }
    val sent = state.sent
    val answer =
        when {
            sent != null -> goneWords(to, sent)
            state.refusals > 0 -> SealAnswer.Refused(state.refusal, state.refusals)
            else -> null
        }
    val actions =
        when {
            sent == null -> emptyList()
            sent.byLink && sent.link != null -> {
                val link = sent.link
                listOf(
                    CardTableSendBack("Copy link") { copyLink(context, link) },
                    CardTableSendBack("Share") { shareLink(context, link, onTable.fromFirst) },
                )
            }
            sent.canTakeBack -> listOf(CardTableSendBack("Take it back", onClick = model::takeBack))
            else -> emptyList()
        }
    CardTableDialog(
        card = onTable,
        firstOpen = false,
        onClose = if (sent != null) model::finish else model::backFromSeal,
        mine = true,
        canShare = false,
        sending = calls,
        sealAnswer = answer,
        goneActions = actions,
    )
}

/** "Ivy", an address as it is, or null by link: who the sealing moment says it's for. */
private fun firstOf(to: CardRecipient): String? =
    when (to) {
        is CardRecipient.Person -> to.firstName
        is CardRecipient.Email -> to.email
        else -> null
    }

/** "On its way to Ivy.", and under it when it arrives and until when it can be taken back. */
private fun goneWords(
    to: CardRecipient,
    sent: SentHolidayCard,
): SealAnswer.Took {
    val zone = HolidayCardTimes.zone(null)
    val lines = listOfNotNull(arrivalLine(sent, zone), takeBackLine(sent, zone)).joinToString("\n")
    return when (to) {
        is CardRecipient.Person -> SealAnswer.Took("On its way to ${to.firstName}.", lines)
        is CardRecipient.Email -> SealAnswer.Took("On its way to ${to.email}.", lines)
        else -> SealAnswer.Took("Your card is ready.", lines)
    }
}
