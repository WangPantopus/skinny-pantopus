@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.ui.screens.profile.ReportUserSheet
import app.pantopus.android.ui.screens.profile.ReportedCard
import app.pantopus.android.ui.theme.PantopusColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Blocking whoever sent a card, from the table's ⋯; what happened goes to the table's own toast. */
@HiltViewModel
class CardSenderActionsViewModel
    @Inject
    constructor(
        private val blocks: BlocksRepository,
        private val cards: HolidayCardsRepository,
    ) : ViewModel() {
        private val _said = MutableStateFlow<String?>(null)

        private val _canSendBack = MutableStateFlow(false)

        /**
         * A card can go back to the one who sent this: sending is open for the season (`GET /api/mailbox/cards`), and
         * the same checks as choosing them pass (`GET /api/mailbox/cards/arrivals?to=`): neither has blocked the other
         * and their account is still there. False until both answer.
         */
        val canSendBack: StateFlow<Boolean> = _canSendBack.asStateFlow()

        private var checked: String? = null

        fun checkSendBack(userId: String) {
            if (checked == userId) return
            checked = userId
            viewModelScope.launch {
                val open = (cards.load() as? NetworkResult.Success)?.data?.open == true
                _canSendBack.value = open && cards.arrivalsFor(userId) is NetworkResult.Success
            }
        }

        /** What to tell the person, until the next action. */
        val said: StateFlow<String?> = _said.asStateFlow()

        fun say(words: String?) {
            _said.value = words
        }

        fun block(
            userId: String,
            name: String,
        ) {
            viewModelScope.launch {
                // A name can end in its own period ("Theo B.").
                val who = name.trimEnd('.')
                _said.value =
                    when (blocks.block(userId)) {
                        is NetworkResult.Success -> {
                            _canSendBack.value = false
                            "You blocked $who. You won't get mail from them. You can unblock them in Settings."
                        }
                        is NetworkResult.Failure -> "Couldn't block $who. Check your connection and try again."
                    }
            }
        }
    }

/** The report sheet and the "Block?" question, over the table. The card stays where it was. */
@OptIn(ExperimentalMaterial3Api::class)
@Suppress("LongParameterList") // The two sheets' open state and closes, the person, and the card a report shares.
@Composable
internal fun CardSenderSheets(
    userId: String,
    name: String,
    reporting: Boolean,
    confirmBlock: Boolean,
    onCloseReport: () -> Unit,
    onCloseBlock: () -> Unit,
    viewModel: CardSenderActionsViewModel,
    /**
     * "Report this card" and "Block {first name}" (memories plan, launch key `holiday_card_memories`; wave 4 drawings
     * 6-8): the card the report shares with Pantopus admins, that one only. Null: the person is reported, as before.
     */
    cardId: String? = null,
) {
    val first = name.trim().substringBefore(' ').removeSuffix(".").ifEmpty { name }
    if (reporting) {
        ReportUserSheet(
            userId = userId,
            handle = null,
            displayName = name,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            onDismiss = onCloseReport,
            onSubmitted = {
                onCloseReport()
                viewModel.say("Report received. Thanks for telling us.")
            },
            card = cardId?.let { ReportedCard(it, first) },
        )
    }
    if (confirmBlock) {
        // A block withdraws the cards (and later the replies) on their way between the two of them (contract section 8).
        val withdrawn = if (cardId != null) " Cards and replies on their way between you are withdrawn." else ""
        AlertDialog(
            onDismissRequest = onCloseBlock,
            title = { Text(if (cardId != null) "Block $first?" else "Block $name?") },
            text = {
                Text(
                    "You won't get mail from them, and you won't be able to message each other.$withdrawn " +
                        "You can unblock them later.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onCloseBlock()
                        viewModel.block(userId, name)
                    },
                    modifier = Modifier.testTag("cardTableBlockConfirm"),
                ) { Text("Block", color = PantopusColors.error) }
            },
            dismissButton = {
                TextButton(onClick = onCloseBlock, modifier = Modifier.testTag("cardTableBlockCancel")) { Text("Cancel") }
            },
        )
    }
}
