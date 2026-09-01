package app.pantopus.android.ui.screens.shared.wizard

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.theme.PantopusColors

/** Test tag applied to the discard-confirm dialog container. */
const val WIZARD_DISCARD_DIALOG_TAG = "wizardDiscardDialog"

/** Test tag on the optional save-draft action (P6c). */
const val WIZARD_SAVE_DRAFT_BUTTON_TAG = "wizardSaveDraftButton"

/**
 * Shared "Discard your progress?" confirmation dialog used by [WizardShell]
 * when the user taps X on a dirty step. The shell renders this; feature
 * code never imports it directly. P6c — wizards with a draft store (the
 * gig composer) surface a third "Save draft" action via [saveDraftLabel].
 */
@Composable
internal fun WizardCloseConfirm(
    visible: Boolean,
    onDiscard: () -> Unit,
    onKeepGoing: () -> Unit,
    saveDraftLabel: String? = null,
    onSaveDraft: () -> Unit = {},
) {
    if (!visible) return
    AlertDialog(
        onDismissRequest = onKeepGoing,
        modifier = Modifier.testTag(WIZARD_DISCARD_DIALOG_TAG),
        title = { Text("Discard your progress?") },
        text = { Text("You'll lose what you've entered so far.") },
        confirmButton = {
            if (saveDraftLabel != null) {
                TextButton(
                    onClick = onSaveDraft,
                    modifier = Modifier.testTag(WIZARD_SAVE_DRAFT_BUTTON_TAG),
                ) {
                    Text(saveDraftLabel, color = PantopusColors.primary600)
                }
            }
            TextButton(onClick = onDiscard) {
                Text("Discard", color = PantopusColors.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onKeepGoing) { Text("Keep going") }
        },
    )
}
