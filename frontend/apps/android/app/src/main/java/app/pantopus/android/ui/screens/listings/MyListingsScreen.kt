package app.pantopus.android.ui.screens.listings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * `GET /api/listings/me` wrapped in the List-of-Rows archetype
 * (T6.3f / P14). Three tabs (Active / Sold / Drafts), 64dp thumbnails,
 * chip-meta line (views · offers · status), sky-tinted canonical-create
 * FAB labelled "List something".
 */
@Composable
fun MyListingsScreen(
    onOpenListing: (String) -> Unit,
    onCompose: () -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: MyListingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenListing = onOpenListing, onCompose = onCompose)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMyListingsViewed)
    }
    ListOfRowsScreen(
        title = "My listings",
        state = state,
        onRefresh = { viewModel.refresh() },
        onEndReached = { /* single page covers typical seller inventories */ },
        tabs = tabs,
        selectedTab = selectedTab,
        onSelectTab = { viewModel.selectTab(it) },
        fab =
            FabAction(
                icon = PantopusIcon.PlusCircle,
                contentDescription = "List something",
                variant = FabVariant.CanonicalCreate,
                onClick = onCompose,
            ),
        onBack = onBack,
    )
}
