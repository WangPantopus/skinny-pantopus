package app.pantopus.android.ui.screens.homes.postal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
internal fun HomePostalRecovery(
    state: HomePostalUiState,
    viewModel: HomePostalViewModel,
) {
    val draft = state.pending ?: return
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurface).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            HomePostalMessages.headline(draft.kind, state.outcome),
            style = PantopusTextStyle.h3,
            modifier = Modifier.testTag("homePostalRecoveryHeading"),
        )
        val address = viewModel.originalMailAddress
        if (address != null) {
            Text(HomePostalMessages.address(address), style = PantopusTextStyle.body, modifier = Modifier.testTag("homePostalSavedAddress"))
        } else {
            Text("For your security, the code you entered isn't shown.", style = PantopusTextStyle.body)
        }
        Text(HomePostalMessages.explanation(draft.kind, state.outcome), style = PantopusTextStyle.body)
        if (state.working) CircularProgressIndicator()
        when {
            viewModel.canAcknowledge ->
                HomePostalButton(
                    if (state.outcome?.state == "completed") "Done" else "Start over",
                    "homePostalAcknowledge",
                    onClick = viewModel::acknowledge,
                )
            state.outcome?.isTerminal == true ->
                HomePostalButton(
                    "Try again",
                    "homePostalSaveProof",
                    enabled = !state.working,
                ) { viewModel.recover(HomePostalAction.Check) }
            else -> {
                HomePostalButton("Check again", "homePostalCheckOriginal", !state.working) {
                    viewModel.recover(HomePostalAction.Check)
                }
                HomePostalButton("Try again", "homePostalRetryOriginal", !state.working) {
                    viewModel.recover(HomePostalAction.Submit)
                }
                HomePostalButton("Discard attempt", "homePostalCancel", !state.working, viewModel::reviewCancellation)
            }
        }
    }
}
