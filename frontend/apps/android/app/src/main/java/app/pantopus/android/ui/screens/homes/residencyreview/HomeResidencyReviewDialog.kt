package app.pantopus.android.ui.screens.homes.residencyreview

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskResumeEffect
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

private const val REVIEW_DIALOG_HEIGHT = 0.94f
private const val REVIEW_PLACEHOLDER_ROWS = 6

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun HomeResidencyReviewDialog(
    viewModel: HomeResidencyReviewViewModel,
    onClosed: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val focus = LocalFocusManager.current
    HomeTaskResumeEffect(viewModel::resume) {
        focus.clearFocus()
        viewModel.pause()
    }
    DisposableEffect(viewModel) { onDispose { viewModel.pause() } }
    Dialog(
        onDismissRequest = onClosed,
        properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn),
    ) {
        Surface(
            Modifier.fillMaxWidth().fillMaxHeight(REVIEW_DIALOG_HEIGHT).testTag("homeResidencyReview")
                .semantics { testTagsAsResourceId = true },
            color = PantopusColors.appSurface,
        ) {
            OfflineBannerHost(isOffline = !online) {
                Column(Modifier.padding(Spacing.s4).imePadding(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextButton(onClick = onClosed, modifier = Modifier.testTag("homeResidencyReview.close")) { Text("Close") }
                        Text("Residency review", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                        TextButton(
                            onClick = viewModel::resume,
                            enabled = !state.working,
                            modifier =
                                Modifier.testTag(
                                    "homeResidencyReview.reload",
                                ).semantics { contentDescription = "Reload current access" },
                        ) { Text("Reload") }
                    }
                    Column(
                        Modifier.weight(1f).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        Text("Review the current claim and membership before approving or rejecting residency.")
                        state.error?.let { Text(it, Modifier.testTag("homeResidencyReview.error"), color = PantopusColors.error) }
                        HomeResidencyReviewBody(state, viewModel)
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeResidencyReviewBody(
    state: HomeResidencyReviewUiState,
    viewModel: HomeResidencyReviewViewModel,
) {
    if (state.working) {
        Column(
            Modifier.testTag("homeResidencyReview.loading").semantics { contentDescription = "Checking residency review" },
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            repeat(REVIEW_PLACEHOLDER_ROWS) { Shimmer(height = Spacing.s10, modifier = Modifier.fillMaxWidth()) }
        }
        return
    }
    val review = state.review
    if (review != null) {
        HomeResidencyReviewCurrent(review, state.claimant, state.pending != null)
        if (state.pending != null) {
            HomeResidencyReviewRecovery(state, viewModel)
        } else if (review.canDecide(review.actorId)) {
            HomeResidencyReviewInputs(state, viewModel)
        } else {
            Text(
                if (review.applicantId == review.actorId) {
                    "You cannot approve or reject your own membership."
                } else {
                    "This claim is no longer pending. Review its current membership and any saved original decision."
                },
                Modifier.testTag("homeResidencyReview.noPendingClaim"),
            )
        }
    } else if (state.opened && state.error == null) {
        Text(
            "No residency decision needs recovery on this device. Choose a claim to review.",
            Modifier.testTag("homeResidencyReview.empty"),
        )
    }
}
