@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.tasks

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
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/**
 * Concrete Household tasks list screen wired to
 * `GET /api/homes/:id/tasks` — `backend/routes/home.js:4170`.
 *
 * Distinct from `MyTasksScreen` (T5.3.2) which lists the user's
 * posted-to-neighbours gigs reached via `me.gigs`.
 *
 * @param onOpenTask Invoked when a task row is tapped.
 * @param onAddTask Invoked when the FAB or empty-state CTA fires.
 * @param onEditRecurring Invoked when the kebab on a Recurring row
 *     fires.
 * @param onBack Optional back handler.
 */
@Composable
fun HouseholdTasksListScreen(
    onOpenTask: (String) -> Unit,
    onAddTask: () -> Unit,
    onEditRecurring: (String) -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: HouseholdTasksListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()

    var deleteTarget by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenTask = onOpenTask,
            onAddTask = onAddTask,
            onEditRecurring = onEditRecurring,
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenHouseholdTasksViewed)
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            is HouseholdTasksListEvent.ConfirmDelete -> {
                deleteTarget = event.taskId to event.title
                viewModel.acknowledgeEvent()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag("householdTasksList")) {
        ListOfRowsScreen(
            title = "Tasks",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = viewModel::selectTab,
            topBarAction = viewModel.topBarAction,
            fab = viewModel.fab(),
            onBack = onBack,
            banner = banner,
        )
    }

    deleteTarget?.let { (taskId, title) ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete task") },
            text = { Text("Delete “$title”? This can’t be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteTask(taskId)
                        deleteTarget = null
                    },
                    modifier = Modifier.testTag("householdTasksList_deleteConfirm"),
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
            },
        )
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.clearActionError() },
            title = { Text("Couldn’t delete task") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearActionError() }) { Text("OK") }
            },
        )
    }
}
