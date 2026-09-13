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
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimResidencyCard
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskResumeEffect
import app.pantopus.android.ui.theme.PantopusColors
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
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4).testTag("homeResidencyQueue"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text("Current pending requests")
        Text(
            "These are request references. Open a review to check the applicant, current authority, " +
                "and requested relationship before deciding.",
        )
        when {
            state.failure != null ->
                Text(
                    state.failure.message,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("homeResidencyQueue.error"),
                )
            state.working || !state.confirmed -> CircularProgressIndicator(Modifier.testTag("homeResidencyQueue.loading"))
            state.claims.isEmpty() -> Text("No pending residency claims.", modifier = Modifier.testTag("homeClaimReview_residencyEmpty"))
            else -> {
                Text("${state.claims.size} pending requests", modifier = Modifier.testTag("homeResidencyQueue.count"))
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
