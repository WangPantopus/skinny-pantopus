@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.blocks

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/**
 * P8 / T6.2c — Settings → Blocked users.
 *
 * Thin wrapper around [ListOfRowsScreen] backed by
 * [BlockedUsersViewModel]. Unblock is handled by the row's kebab,
 * which fires `onSecondary` on the [RowModel].
 */
@Composable
fun BlockedUsersScreen(
    onBack: () -> Unit = {},
    viewModel: BlockedUsersViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    ListOfRowsScreen(
        title = viewModel.title,
        state = state,
        onRefresh = viewModel::refresh,
        onEndReached = {},
        onBack = onBack,
        monoFooter = viewModel.monoFooter,
    )
}
