@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homes.HomeTaskDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HouseholdTaskDetailScreen(
    onBack: () -> Unit,
    onEdit: () -> Unit,
    viewModel: HouseholdTaskDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmDelete by remember { mutableStateOf(false) }
    HomeTaskResumeEffect(viewModel::resume, viewModel::pause)
    DisposableEffect(viewModel) { onDispose { viewModel.finishArrival() } }
    LaunchedEffect(state.deleted) { if (state.deleted) onBack() }
    LaunchedEffect(state.task) { if (state.task == null) confirmDelete = false }
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Task") }, navigationIcon = { TextButton(onClick = onBack) { Text("Back") } })
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(20.dp).verticalScroll(rememberScrollState()).testTag("homeTaskDetail"),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (state.loading) CircularProgressIndicator()
            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
                TextButton(onClick = viewModel::reload, enabled = !state.busy) { Text("Reload task") }
            }
            state.task?.let { task ->
                HouseholdTaskReadOnlyContent(task)
                TaskDetailActions(state, { viewModel.edit(onEdit) }, viewModel::complete) { confirmDelete = true }
            }
        }
    }
    if (confirmDelete && state.task?.capabilities?.canDelete == true) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete task") },
            text = { Text("Delete “${state.task?.title}” and retire its task attachments?") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    viewModel.delete()
                }, enabled = !state.busy) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
internal fun HouseholdTaskReadOnlyContent(task: HomeTaskDto) {
    Text(task.title, style = MaterialTheme.typography.headlineSmall)
    task.description?.takeIf(String::isNotBlank)?.let { Text(it) }
    Text("Status: ${task.status.replace('_', ' ')}")
    Text("Type: ${task.taskType}")
    task.dueAt?.let { Text("Due: $it") }
    task.priority?.let { Text("Priority: $it") }
    HouseholdTasksListViewModel.assigneeDisplay(task.assignedTo)?.let { Text("Assigned to $it") }
    HouseholdTasksListViewModel.humanRecurrence(task.recurrenceRule)?.let { Text("Recurrence: $it") }
    task.visibility?.let { Text("Visibility: ${it.replace('_', ' ')}") }
}

@Composable
private fun TaskDetailActions(
    state: HouseholdTaskDetailState,
    onEdit: () -> Unit,
    onComplete: () -> Unit,
    onDelete: () -> Unit,
) {
    val task = state.task ?: return
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (task.capabilities?.canEdit == true) {
            TextButton(onClick = onEdit, enabled = !state.busy) { Text("Edit") }
        }
        if (task.capabilities?.canComplete == true) {
            TextButton(onClick = onComplete, enabled = !state.busy) {
                Text(if (task.status == "done") "Reopen" else "Complete")
            }
        }
        if (task.capabilities?.canDelete == true) {
            TextButton(onClick = onDelete, enabled = !state.busy) { Text("Delete") }
        }
    }
}

/** Returning from a form or from the background rechecks current record access. */
@Composable
internal fun HomeTaskResumeEffect(
    onResume: () -> Unit,
    onPause: () -> Unit,
) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val currentResume by rememberUpdatedState(onResume)
    val currentPause by rememberUpdatedState(onPause)
    DisposableEffect(lifecycle) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> currentResume()
                    Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> currentPause()
                    else -> Unit
                }
            }
        lifecycle.addObserver(observer)
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) currentResume()
        onDispose {
            lifecycle.removeObserver(observer)
            currentPause()
        }
    }
}
