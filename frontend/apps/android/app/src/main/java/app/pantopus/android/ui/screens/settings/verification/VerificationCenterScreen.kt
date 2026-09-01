@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.verification

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen

/** P8 / T6.2c — Settings → Verification (status grid). */
@Composable
fun VerificationCenterScreen(
    onBack: () -> Unit = {},
    viewModel: VerificationCenterViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    GroupedListScreen(
        title = viewModel.title,
        state = state,
        footerCaption = viewModel.footerCaption,
        callbacks =
            GroupedListCallbacks(
                onBack = onBack,
                onTapRow = viewModel::onRow,
                onRetry = viewModel::load,
            ),
    )
}
