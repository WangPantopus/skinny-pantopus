@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.review_signups

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/** Test tag on the Review Signups screen root container. */
const val REVIEW_SIGNUPS_TAG = "reviewSignups"

/**
 * T6.6c (P26.5) Review Signups. Single-train review queue. Thin
 * wrapper around [ListOfRowsScreen] — filter chip strip drives the
 * status segmentation; avatar-first rows render the helper identity
 * + per-reservation note + Confirm / Edit footer.
 */
@Composable
fun ReviewSignupsScreen(
    onBack: () -> Unit,
    onShareTrain: () -> Unit,
    onEditSignup: (String) -> Unit,
    onMessageHelper: (String) -> Unit,
    viewModel: ReviewSignupsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val chipStrip by viewModel.chipStrip.collectAsStateWithLifecycle()
    val pendingEditsRevision by viewModel.pendingEditsRevision.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onShareTrain = onShareTrain
        viewModel.onEditSignup = onEditSignup
        viewModel.onMessageHelper = onMessageHelper
        viewModel.load()
    }

    // Drain any pending optimistic patch dropped by the Edit Signup
    // form while we were off the stack — keeps the row in sync
    // without a re-fetch.
    LaunchedEffect(pendingEditsRevision) {
        viewModel.applyPendingEdits()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(REVIEW_SIGNUPS_TAG)) {
        ListOfRowsScreen(
            title = "Review signups",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = {},
            topBarAction = topBarAction,
            onBack = onBack,
            chipStrip = chipStrip,
        )
    }
}
