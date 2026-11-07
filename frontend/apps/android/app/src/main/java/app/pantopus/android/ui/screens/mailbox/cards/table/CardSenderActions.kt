@file:Suppress("PackageNaming")

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
import app.pantopus.android.ui.screens.profile.ReportUserSheet
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
    ) : ViewModel() {
        private val _said = MutableStateFlow<String?>(null)

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
                _said.value =
                    when (blocks.block(userId)) {
                        is NetworkResult.Success -> "You blocked $name. You won't get mail from them. You can unblock them in Settings."
                        is NetworkResult.Failure -> "Couldn't block $name. Check your connection and try again."
                    }
            }
        }
    }

/** The report sheet and the "Block?" question, over the table. The card stays where it was. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CardSenderSheets(
    userId: String,
    name: String,
    reporting: Boolean,
    confirmBlock: Boolean,
    onCloseReport: () -> Unit,
    onCloseBlock: () -> Unit,
    viewModel: CardSenderActionsViewModel,
) {
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
        )
    }
    if (confirmBlock) {
        AlertDialog(
            onDismissRequest = onCloseBlock,
            title = { Text("Block $name?") },
            text = { Text("You won't get mail from them, and you won't be able to message each other. You can unblock them later.") },
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
