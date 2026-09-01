package app.pantopus.android.ui.screens.connections

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors

/** Test tag on the Connections screen root container. */
const val CONNECTIONS_TAG = "connections"

/**
 * T5.2.3 Connections + S5 RN parity. Thin wrapper around
 * [ListOfRowsScreen] — five tabs (All / Neighbors / Pending / Sent /
 * Blocked), search bar, per-row message-CTA on accepted rows,
 * Accept / Ignore on pending rows, "Pending" status on sent rows, and an
 * "Unblock" pill on blocked rows. Long-pressing an accepted row opens
 * the "Remove" action, confirmed by the dialog below.
 */
@Composable
fun ConnectionsScreen(
    onBack: () -> Unit,
    onOpenChat: (ConnectionsChatTarget) -> Unit,
    onFindPeople: () -> Unit,
    viewModel: ConnectionsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val fab by viewModel.fab.collectAsStateWithLifecycle()
    val searchBar by viewModel.searchBar.collectAsStateWithLifecycle()
    val pendingRemoval by viewModel.pendingRemoval.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onMessage = onOpenChat
        viewModel.onFindPeople = onFindPeople
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(CONNECTIONS_TAG)) {
        ListOfRowsScreen(
            title = "Connections",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = {},
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            fab = fab,
            onBack = onBack,
            searchBar = searchBar,
        )
    }

    pendingRemoval?.let { request ->
        AlertDialog(
            onDismissRequest = { viewModel.cancelRemoval() },
            title = { Text("Remove connection?") },
            text = {
                Text(
                    "${request.displayName} will be removed from your connections. " +
                        "You can send a new request later.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.confirmRemoval() },
                    modifier = Modifier.testTag("connections.removeConfirm"),
                ) {
                    Text("Remove", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { viewModel.cancelRemoval() },
                    modifier = Modifier.testTag("connections.removeCancel"),
                ) {
                    Text("Cancel")
                }
            },
        )
    }
}
