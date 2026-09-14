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
            Text("Your original code attempt is saved securely. Its code is hidden here.", style = PantopusTextStyle.body)
        }
        Text(HomePostalMessages.explanation(draft.kind, state.outcome), style = PantopusTextStyle.body)
        if (state.working) CircularProgressIndicator()
        when {
            viewModel.canAcknowledge ->
                HomePostalButton(
                    if (state.outcome?.state == "completed") "Check current status" else "Edit after recorded result",
                    "homePostalAcknowledge",
                    onClick = viewModel::acknowledge,
                )
            state.outcome?.isTerminal == true ->
                HomePostalButton(
                    "Retry saving the result",
                    "homePostalSaveProof",
                    enabled = !state.working,
                ) { viewModel.recover(HomePostalAction.Check) }
            else -> {
                HomePostalButton("Check original result", "homePostalCheckOriginal", !state.working) {
                    viewModel.recover(HomePostalAction.Check)
                }
                HomePostalButton("Retry the same request", "homePostalRetryOriginal", !state.working) {
                    viewModel.recover(HomePostalAction.Submit)
                }
                HomePostalButton("Cancel request", "homePostalCancel", !state.working, viewModel::reviewCancellation)
            }
        }
    }
}
