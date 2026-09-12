@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Suppress("LongMethod") // Declarative screen layout keeps state and actions together.
@Composable
fun HomeCreationRecoveryContent(
    state: AddHomeUiState,
    viewModel: AddHomeWizardViewModel,
) {
    var confirmsCancellation by remember { mutableStateOf(false) }
    LaunchedEffect(state.creationOutcome?.isTerminal) {
        if (state.creationOutcome?.isTerminal == true) confirmsCancellation = false
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4), modifier = Modifier.testTag("addHomeCreationRecovery")) {
        HeadlineBlock(creationHeadline(state))
        SubcopyBlock(creationExplanation(state))
        state.pendingCreation?.let { draft ->
            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier =
                    Modifier.fillMaxWidth().clip(
                        RoundedCornerShape(Radii.lg),
                    ).background(PantopusColors.appSurface).padding(Spacing.s4),
            ) {
                Text(
                    if (draft.residencyHomeId != null) {
                        "Your residency request"
                    } else {
                        draft.form["nickname"]?.takeIf { it.isNotBlank() } ?: "Your Home request"
                    },
                    style = PantopusTextStyle.body,
                )
                Text(
                    listOf("street", "unit", "city", "state", "zip").mapNotNull {
                        draft.form[it]?.takeIf(String::isNotBlank)
                    }.joinToString(", "),
                    style = PantopusTextStyle.body,
                )
                AddHomeRole.entries.firstOrNull { it.claimedRole == draft.form["role"] }?.let {
                    Text(
                        it.label,
                        style = PantopusTextStyle.caption,
                    )
                }
            }
        }
        if (state.creationOutcome?.isTerminal != true && state.pendingCreation != null) {
            TextButton(
                onClick = viewModel::resumeCreation,
                enabled = !state.isSubmitting,
                modifier = Modifier.heightIn(min = 48.dp).testTag("addHomeRecoveryCheck"),
            ) {
                Text("Check status")
            }
            TextButton(onClick = {
                confirmsCancellation = true
            }, enabled = !state.isSubmitting, modifier = Modifier.heightIn(min = 48.dp).testTag("addHomeRecoveryCancel")) {
                Text("Cancel request", color = PantopusColors.error)
            }
        }
        Text(
            if (state.creationStorageUnavailable) {
                "Keep this screen open and retry recovery before starting another request."
            } else {
                "The original details are saved securely on this device. You can close this screen and return to Add Home."
            },
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
    if (confirmsCancellation) {
        AlertDialog(
            onDismissRequest = { confirmsCancellation = false },
            title = { Text("Cancel this Home request?") },
            text = {
                Text(
                    "We’ll check whether it has finished. Cancellation cannot undo a saved Home or residency request.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmsCancellation = false
                    viewModel.cancelCreation()
                }, modifier = Modifier.testTag("addHomeRecoveryCancelConfirm")) { Text("Cancel request") }
            },
            dismissButton = { TextButton(onClick = { confirmsCancellation = false }) { Text("Keep request") } },
        )
    }
}

private fun creationHeadline(state: AddHomeUiState): String =
    when {
        state.creationStorageUnavailable -> "Recover your saved request"
        state.creationOutcome?.state == "completed" ->
            if (state.pendingCreation?.residencyHomeId != null) "Residency request saved" else "Home saved"
        state.creationOutcome?.state == "cancelled" -> "Request cancelled"
        state.creationOutcome?.state == "rejected" ->
            if (state.pendingCreation?.residencyHomeId != null) "Review your residency request" else "Review your Home details"
        else -> if (state.pendingCreation?.residencyHomeId != null) "Recover your residency request" else "Finish adding your Home"
    }

private fun creationExplanation(state: AddHomeUiState): String =
    when {
        state.creationStorageUnavailable -> "Recovery storage is unavailable. Retry recovery before making another Home request."
        state.creationOutcome?.state == "completed" && state.pendingCreation?.residencyHomeId != null ->
            "Your residency request is recorded. Open My Homes to check its current status, household access and verification steps."
        state.creationOutcome?.state == "completed" ->
            "Open My Homes to see your current setup and verification options. " +
                "Saving a Home does not verify residency or ownership."
        state.creationOutcome?.state == "cancelled" && state.pendingCreation?.residencyHomeId != null ->
            "This request cannot submit a residency claim. Check the street, apartment and relationship before starting again."
        state.creationOutcome?.state == "cancelled" ->
            "This request can no longer create a Home. " +
                "You can edit its details and start again."
        state.creationOutcome?.state == "rejected" ->
            state.creationOutcome.error
                ?: "The server rejected this request. Review its details before trying again."
        else ->
            "The save has not been confirmed. Check its status, try saving the same details again, " +
                "or cancel the request before editing."
    }
