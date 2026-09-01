@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.locations

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

/**
 * Locations & Hours list MVP — thin [ListOfRowsScreen] wrapper. Add/edit
 * forms are a follow-up; this screen lists active locations from
 * `GET /api/businesses/:id/locations`.
 */
@Composable
fun BusinessLocationsScreen(
    onBack: () -> Unit = {},
    viewModel: BusinessLocationsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("businessLocations"),
    ) {
        ListOfRowsScreen(
            title = viewModel.title,
            state = state,
            onRefresh = viewModel::refresh,
            onEndReached = {},
            onBack = onBack,
        )
    }
}
