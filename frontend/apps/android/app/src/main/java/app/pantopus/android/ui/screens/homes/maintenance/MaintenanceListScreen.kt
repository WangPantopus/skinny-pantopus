@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.homes.showsContent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/**
 * Per-home Maintenance list (T6.3b / P10). Wired to
 * `GET /api/homes/:id/maintenance` — `backend/routes/home.js`.
 */
@Composable
fun MaintenanceListScreen(
    onOpenTask: (String) -> Unit,
    onAddTask: () -> Unit,
    onBack: (() -> Unit)? = null,
    /** Routes to the per-home issue tracker (a different collection). */
    onOpenIssues: (() -> Unit)? = null,
    viewModel: MaintenanceListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContentShown("home_maintenance", state.showsContent())
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()

    // Ahead of the load effect, so the first rows already have the large-text layout.
    val largeText = LocalDensity.current.fontScale >= LARGE_TEXT_FONT_SCALE
    LaunchedEffect(largeText) { viewModel.setLargeText(largeText) }
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenTask = onOpenTask,
            onAddTask = onAddTask,
            onOpenIssues = onOpenIssues,
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenHomeMaintenanceViewed)
    }

    Box(modifier = Modifier.fillMaxSize().testTag("maintenanceList")) {
        ListOfRowsScreen(
            title = "Maintenance",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = viewModel::selectTab,
            topBarAction = viewModel.topBarAction,
            fab = viewModel.fab(),
            onBack = onBack,
            banner = banner,
            refreshing = refreshing,
            refreshNotice = refreshNotice,
        )
    }
}

/** The list shell's large-text step (`LARGE_FONT_SCALE` in ListOfRowsScreen). */
private const val LARGE_TEXT_FONT_SCALE = 1.3f
