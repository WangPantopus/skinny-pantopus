package app.pantopus.android.ui.screens.homes.residencyqueue

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.homes.HomeResidencyDecision
import app.pantopus.android.data.homes.HomeResidencyQueueFailureKind
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimResidencyCard
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskResumeEffect
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

@Composable
fun HomeResidencyQueueView(
    homeId: String,
    model: HomeResidencyQueueViewModel,
    onReview: (String, HomeResidencyDecision) -> Unit,
) {
    val value by model.state.collectAsStateWithLifecycle()
    val state = model.displayState(value)
    HomeTaskResumeEffect(onResume = { model.resume(homeId) }, onPause = model::pause)
    val empty = state.failure == null && !state.working && state.confirmed && state.claims.isEmpty()
    Column(
        modifier =
            Modifier.fillMaxSize().then(
                if (empty) Modifier else Modifier.verticalScroll(rememberScrollState()).padding(Spacing.s4),
            ).testTag("homeResidencyQueue"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        when {
            state.failure != null ->
                Text(
                    state.failure.message,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("homeResidencyQueue.error"),
                )
            state.working || !state.confirmed -> CircularProgressIndicator(Modifier.testTag("homeResidencyQueue.loading"))
            state.claims.isEmpty() ->
                EmptyState(
                    icon = PantopusIcon.CheckCheck,
                    headline = "No pending residency claims",
                    subcopy =
                        "Neighbors asking to join this household will show up here " +
                            "with the role they requested.",
                    modifier = Modifier.weight(1f).testTag("homeClaimReview_residencyEmpty"),
                    tint = PantopusColors.successBg,
                    accent = PantopusColors.success,
                )
            else -> {
                state.claims.forEach { claim ->
                    HomeClaimResidencyCard(
                        item = claim,
                        isBusy = false,
                        onApprove = { if (model.beginReview(claim.id)) onReview(claim.id, HomeResidencyDecision.Approve) },
                        onReject = { if (model.beginReview(claim.id)) onReview(claim.id, HomeResidencyDecision.Reject) },
                    )
                }
            }
        }
        if (state.failure != HomeResidencyQueueFailureKind.SessionChanged) {
            TextButton(
                onClick = model::reload,
                modifier = Modifier.testTag("homeResidencyQueue.reload"),
            ) { Text("Reload current requests") }
        }
    }
}
