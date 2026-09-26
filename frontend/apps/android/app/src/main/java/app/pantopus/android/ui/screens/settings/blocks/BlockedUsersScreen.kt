@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.blocks

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
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
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val toastController = remember { ToastController() }

    DisposableEffect(viewModel) { onDispose { viewModel.retire() } }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ListOfRowsScreen(
            title = viewModel.title,
            state = state,
            onRefresh = viewModel::refresh,
            onEndReached = {},
            onBack = onBack,
            monoFooter = viewModel.monoFooter,
        )
        ToastHost(controller = toastController)
    }
}
