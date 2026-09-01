package app.pantopus.android.ui.screens.discoverbusinesses

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

/** Test tag on the Discover businesses screen root container. */
const val DISCOVER_BUSINESSES_TAG = "discoverBusinesses"

/**
 * T5.4.2 Discover businesses. Thin wrapper around [ListOfRowsScreen] —
 * search bar above the chip strip, horizontal category chip strip
 * above the body, and category-grouped `RowSection`s rendered as
 * cards. The VM owns the data + the search/chip filter logic.
 */
@Composable
fun DiscoverBusinessesScreen(
    onBack: () -> Unit,
    onSelect: (DiscoverBusinessesTarget) -> Unit,
    viewModel: DiscoverBusinessesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val chipStrip by viewModel.chipStrip.collectAsStateWithLifecycle()
    val searchBar by viewModel.searchBar.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val showFilterSheet by viewModel.showFilterSheet.collectAsStateWithLifecycle()
    val filters by viewModel.filters.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onSelect = onSelect
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(DISCOVER_BUSINESSES_TAG)) {
        ListOfRowsScreen(
            title = "Discover businesses",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = {},
            topBarAction = topBarAction,
            onBack = onBack,
            searchBar = searchBar,
            chipStrip = chipStrip,
        )
    }

    if (showFilterSheet) {
        BusinessFilterSheet(
            initialFilters = filters,
            onApply = { viewModel.applyFilters(it) },
            onDismiss = { viewModel.dismissFilters() },
        )
    }
}
