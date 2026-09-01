@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.recent_activity

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

/** Test tag on the recent activity root container. Mirrors iOS. */
const val RECENT_ACTIVITY_TAG = "recentActivity"

/**
 * P1.5 — Standalone Recent Activity log reached from Hub's
 * `HubRecentActivity` "See all" CTA. Thin wrapper around
 * [ListOfRowsScreen].
 */
@Composable
fun RecentActivityScreen(
    onBack: () -> Unit,
    onOpen: (RecentActivityDestination) -> Unit,
    viewModel: RecentActivityViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.onOpen = onOpen
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(RECENT_ACTIVITY_TAG)) {
        ListOfRowsScreen(
            title = "Recent activity",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            onBack = onBack,
        )
    }
}
