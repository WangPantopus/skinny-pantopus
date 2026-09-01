@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.issues

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors

/**
 * Per-home **issue tracker** (`HomeIssue`). Wired to
 * `GET/POST /api/homes/:id/issues` and
 * `PUT /api/homes/:id/issues/:issueId`.
 *
 * Deliberately separate from `MaintenanceListScreen` (the maintenance
 * task log at `/api/homes/:id/maintenance`) — different collections,
 * both surfaces ship.
 */
@Composable
fun HomeIssuesListScreen(
    onBack: (() -> Unit)? = null,
    viewModel: HomeIssuesListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    var reporting by remember { mutableStateOf(false) }
    var dismissTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            HomeIssuesEvent.OpenReport -> {
                reporting = true
                viewModel.acknowledgeEvent()
            }
            is HomeIssuesEvent.ConfirmDismiss -> {
                dismissTarget = event.issueId to event.title
                viewModel.acknowledgeEvent()
            }
            null -> Unit
        }
    }

    if (reporting) {
        ReportIssueSheet(
            submit = { title, description -> viewModel.createIssue(title, description) },
            onClose = { reporting = false },
        )
        return
    }

    Box(modifier = Modifier.fillMaxSize().testTag("homeIssuesList")) {
        ListOfRowsScreen(
            title = "Issues",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = viewModel::selectTab,
            fab = viewModel.fab(),
            onBack = onBack,
            banner = banner,
        )
    }

    dismissTarget?.let { (issueId, title) ->
        AlertDialog(
            onDismissRequest = { dismissTarget = null },
            title = { Text("Dismiss issue?") },
            text = { Text("“$title” will be moved to History. You can still see it there.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.dismissIssue(issueId)
                        dismissTarget = null
                    },
                    modifier = Modifier.testTag("homeIssues_dismissConfirm"),
                ) {
                    Text("Dismiss", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { dismissTarget = null }) { Text("Cancel") }
            },
        )
    }

    toast?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.acknowledgeToast() },
            title = { Text("Something went wrong") },
            text = { Text(message, modifier = Modifier.testTag("homeIssues_toast")) },
            confirmButton = {
                TextButton(onClick = { viewModel.acknowledgeToast() }) { Text("OK") }
            },
        )
    }
}
