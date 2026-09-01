@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.notifications

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen

@Composable
fun HomeNotificationsScreen(
    onBack: () -> Unit,
    viewModel: HomeNotificationsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    Box(modifier = Modifier.fillMaxSize().testTag("homeNotifications")) {
        GroupedListScreen(
            title = viewModel.title,
            state = state,
            callbacks =
                GroupedListCallbacks(
                    onBack = onBack,
                    onToggleRow = viewModel::onToggle,
                    onRetry = viewModel::load,
                ),
            footerCaption = HomeNotificationsViewModel.UNAVAILABLE_CAPTION,
        )
    }
}
