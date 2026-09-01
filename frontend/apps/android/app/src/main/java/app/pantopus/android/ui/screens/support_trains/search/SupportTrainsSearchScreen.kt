@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.support_trains.search

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.support_trains.SupportTrainListItemDto
import app.pantopus.android.ui.screens.shared.list_of_rows.RowView
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Support Trains search screen root container. */
const val SUPPORT_TRAINS_SEARCH_TAG = "supportTrainsSearch"

/**
 * P4.6 — Support Trains search. Thin wrapper around the shared
 * [SearchListShell]: the shell owns the field, debounce, and the recent /
 * typing / results / empty phases; this screen supplies the filtered
 * results and the per-row template (the same [RowView] the Support Trains
 * list renders).
 */
@Composable
fun SupportTrainsSearchScreen(
    onOpenTrain: (String) -> Unit,
    onCancel: () -> Unit,
    viewModel: SupportTrainsSearchViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onOpenTrain = onOpenTrain
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(SUPPORT_TRAINS_SEARCH_TAG)) {
        SearchListShell<SupportTrainListItemDto>(
            placeholder = "Search support trains",
            query = query,
            onQueryChange = viewModel::setQuery,
            results = results,
            isLoading = isLoading,
            emptyState =
                EmptyStateContent(
                    icon = PantopusIcon.Search,
                    headline = "No matching trains",
                    subcopy = "Try a different name or train type, or check the spelling.",
                ),
            row = { train ->
                Box(
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .padding(top = Spacing.s3),
                ) {
                    RowView(row = viewModel.rowFor(train))
                }
            },
            onCancel = onCancel,
        )
    }
}
