@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Gig Search surface (P4.4). Built on the shared `SearchListShell`: the
 * field lives in the shell header, the category-filter chip strip sits in
 * the shell's `filters` slot (above the results), and results reuse the
 * feed's `GigRow`. Reached from the Gigs feed search bar.
 */
@Composable
fun GigSearchScreen(
    onOpenGig: (String) -> Unit = {},
    onBack: () -> Unit = {},
    viewModel: GigSearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val activeCategory by viewModel.activeCategory.collectAsStateWithLifecycle()

    GigSearchContent(
        state = state,
        query = query,
        activeCategory = activeCategory,
        onQueryChange = viewModel::onQueryChange,
        onSelectCategory = viewModel::selectCategory,
        onOpenGig = onOpenGig,
        onBack = onBack,
    )
}

/** State-driven body — split out so Paparazzi can render each phase. */
@Composable
internal fun GigSearchContent(
    state: GigSearchUiState,
    query: String,
    activeCategory: GigsCategory,
    onQueryChange: (String) -> Unit,
    onSelectCategory: (GigsCategory) -> Unit,
    onOpenGig: (String) -> Unit,
    onBack: () -> Unit,
) {
    val isLoading = state is GigSearchUiState.Loading
    val results = (state as? GigSearchUiState.Loaded)?.rows ?: emptyList()
    val emptyState =
        when (state) {
            is GigSearchUiState.Error ->
                EmptyStateContent(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't search",
                    subcopy = state.message,
                )
            else ->
                EmptyStateContent(
                    icon = PantopusIcon.Search,
                    headline = "No matches",
                    subcopy = "Try a different keyword or category.",
                )
        }

    Box(modifier = Modifier.fillMaxSize().testTag("gigSearch")) {
        SearchListShell(
            placeholder = "Search gigs, skills, neighborhoods…",
            query = query,
            onQueryChange = onQueryChange,
            results = results,
            isLoading = isLoading,
            emptyState = emptyState,
            filters = {
                GigsCategoryChipRow(active = activeCategory, onSelect = onSelectCategory)
            },
            row = { content ->
                GigRow(content = content, onTap = { onOpenGig(content.id) })
            },
            onCancel = onBack,
        )
    }
}
