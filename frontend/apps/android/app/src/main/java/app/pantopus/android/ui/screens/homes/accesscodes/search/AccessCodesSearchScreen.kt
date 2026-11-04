@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.accesscodes.search

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.ui.screens.homes.HomeCopyLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.RowView
import app.pantopus.android.ui.screens.shared.search_list.EmptyStateContent
import app.pantopus.android.ui.screens.shared.search_list.SearchListShell
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Access codes search screen root container. */
const val ACCESS_CODES_SEARCH_TAG = "accessCodesSearch"

/**
 * P4.6 — Access codes search. Thin wrapper around the shared
 * [SearchListShell]: the shell owns the field, debounce, and the recent /
 * typing / results / empty phases; this screen supplies the filtered
 * results and the per-row template (the Access codes list row visual with
 * a drill-in chevron).
 */
@Composable
fun AccessCodesSearchScreen(
    onOpenCode: (String) -> Unit,
    onCancel: () -> Unit,
    viewModel: AccessCodesSearchViewModel = hiltViewModel(),
) {
    val query by viewModel.query.collectAsStateWithLifecycle()
    val results by viewModel.results.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()

    HomeCopyLifecycle(load = viewModel::resume, pause = viewModel::pause)

    LaunchedEffect(Unit) {
        viewModel.onOpenCode = onOpenCode
    }

    SecureScreenEffect()

    Box(modifier = Modifier.fillMaxSize().testTag(ACCESS_CODES_SEARCH_TAG)) {
        SearchListShell<HomeAccessSecretDto>(
            placeholder = "Search access codes",
            query = query,
            onQueryChange = viewModel::setQuery,
            results = results,
            isLoading = isLoading,
            emptyState =
                EmptyStateContent(
                    icon = PantopusIcon.Search,
                    headline = "No matching codes",
                    subcopy = "Try a different label or category, or check the spelling.",
                ),
            row = { secret ->
                Box(
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .padding(top = Spacing.s3),
                ) {
                    RowView(row = viewModel.rowFor(secret))
                }
            },
            onCancel = onCancel,
            errorContent = error?.let { message ->
                {
                    Column(Modifier.padding(Spacing.s4)) {
                        Text(message)
                        TextButton(onClick = viewModel::retry) { Text("Try again") }
                    }
                }
            },
        )
    }
}
