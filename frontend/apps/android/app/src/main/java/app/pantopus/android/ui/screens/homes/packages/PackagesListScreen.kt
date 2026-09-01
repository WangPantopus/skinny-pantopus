@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.packages

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
 * Concrete Packages list screen wired to
 * `GET /api/homes/:id/packages` — `backend/routes/home.js:4673`.
 *
 * @param currentUserId Signed-in user id; used to suppress the "For X"
 *  body line when the package was picked up by the viewer.
 * @param memberLookup Resolves a household-member user id into a
 *  display name; production passes the household membership cache,
 *  tests pass a stub.
 * @param onOpenPackage Invoked when a package row is tapped.
 * @param onLogPackage Invoked when the FAB or empty-state CTA fires.
 * @param onBack Optional back handler.
 */
@Composable
fun PackagesListScreen(
    currentUserId: String?,
    memberLookup: (String) -> String?,
    onOpenPackage: (String) -> Unit,
    onLogPackage: () -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: PackagesListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            currentUserId = currentUserId,
            memberLookup = memberLookup,
            onOpenPackage = onOpenPackage,
            onLogPackage = onLogPackage,
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenPackagesViewed)
    }

    Box(modifier = Modifier.fillMaxSize().testTag("packagesList")) {
        ListOfRowsScreen(
            title = "Packages",
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
