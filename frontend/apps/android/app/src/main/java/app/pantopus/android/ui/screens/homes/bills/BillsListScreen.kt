@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.bills

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/**
 * Concrete Bills list screen wired to
 * `GET /api/homes/:id/bills` — `backend/routes/home.js:4506`.
 *
 * @param onOpenBill Invoked when a bill row is tapped.
 * @param onAddBill Invoked when the FAB or empty-state CTA fires.
 * @param onBack Optional back handler.
 */
@Composable
fun BillsListScreen(
    onOpenBill: (String) -> Unit,
    onAddBill: () -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: BillsListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenBill = onOpenBill, onAddBill = onAddBill)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenBillsViewed)
    }

    Box(modifier = Modifier.fillMaxSize().testTag("billsList")) {
        ListOfRowsScreen(
            title = "Bills",
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
        )
    }
}
