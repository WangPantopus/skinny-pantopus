@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen

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
    LaunchedEffect(Unit) { viewModel.load() }
    GroupedListScreen(
        title = viewModel.title,
        state = state,
        footerCaption = viewModel.footerCaption,
        callbacks =
            GroupedListCallbacks(
                onBack = onBack,
                onToggleRow = viewModel::onToggle,
                onRetry = viewModel::load,
            ),
    )
}
