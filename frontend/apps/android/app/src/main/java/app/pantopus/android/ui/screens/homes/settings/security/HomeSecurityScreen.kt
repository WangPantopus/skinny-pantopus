@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.ui.screens.homes.HomeCopyLifecycle
import app.pantopus.android.ui.screens.homes.HomeOfflineContent
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState

/**
 * P5.1 / A14.2 — Per-home Security toggles. Thin wrapper around
 * [GroupedListScreen]; the view-model owns the toggle state and the
 * helper-line projection.
 */
@Composable
fun HomeSecurityScreen(
    onBack: () -> Unit = {},
    viewModel: HomeSecurityViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContentShown("home_privacy", state is GroupedListUiState.Loaded)
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    HomeCopyLifecycle(viewModel::load, viewModel::suspendContent, observeStoreChanges = true)
    HomeOfflineContent {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            footerCaption = viewModel.footerCaption,
            refreshNotice = refreshNotice,
            refreshing = refreshing,
            onRefresh = viewModel::refresh,
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onToggleRow = viewModel::onToggle,
                    onRetry = viewModel::refresh,
                ),
        )
    }
}
