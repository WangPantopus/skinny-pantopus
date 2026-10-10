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
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.screens.homes.HomeOfflineContent
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HouseholdTaskDetailScreen(
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onOpenGig: (String) -> Unit,
    viewModel: HouseholdTaskDetailViewModel = hiltViewModel(),
    mediaViewModel: HomeTaskMediaViewModel = hiltViewModel(),
    recurrenceViewModel: HomeTaskRecurrenceViewModel = hiltViewModel(),
    gigViewModel: HomeTaskGigViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContentShown("home_task", state.task != null)
    val mediaState by mediaViewModel.controller.state.collectAsStateWithLifecycle()
    val recurrenceState by recurrenceViewModel.controller.state.collectAsStateWithLifecycle()
    val gigState by gigViewModel.controller.state.collectAsStateWithLifecycle()
    var confirmDelete by remember { mutableStateOf(false) }
    HomeTaskResumeEffect(viewModel::resume, viewModel::pause)
    DisposableEffect(viewModel) { onDispose { viewModel.finishArrival() } }
    LaunchedEffect(state.deleted) { if (state.deleted) onBack() }
    LaunchedEffect(state.task) { if (state.task == null) confirmDelete = false }
    HomeOfflineContent {
        Scaffold(
            topBar = {
                TopAppBar(title = { Text("Task") }, navigationIcon = { TextButton(onClick = onBack) { Text("Back") } })
            },
        ) { padding ->
            PullToRefreshBox(
                isRefreshing = state.refreshing,
                onRefresh = viewModel::reload,
                modifier = Modifier.fillMaxSize().padding(padding),
            ) {
                Column(
                    Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()).testTag("homeTaskDetail"),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (state.loading) CircularProgressIndicator()
                    state.refreshNotice?.let { RefreshFailedLine(it) }
                    state.error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = viewModel::reload, enabled = !state.busy) { Text("Reload task") }
                    }
                    state.task?.let { task ->
                        HouseholdTaskReadOnlyContent(task, state.assignee)
                        if (state.pendingCompletion) Text("Pending", style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = recurrenceViewModel.controller::show, enabled = !state.busy) { Text("Repeat schedule") }
                        TextButton(onClick = mediaViewModel.controller::show, enabled = !state.busy) { Text("Private attachments") }
                        // Launch cut #4 (Open Gigs): publishing a household task as an open Gig is hidden.
                        if (task.capabilities?.canEdit == true && LaunchFeatures.openGigs) {
                            TextButton(onClick = gigViewModel.controller::show, enabled = !state.busy) { Text("Review Gig publication") }
                        }
                        TaskDetailActions(state, { viewModel.edit(onEdit) }, viewModel::complete) { confirmDelete = true }
                    }
                }
            }
        }
    }
    if (mediaState.visible) HomeTaskMediaDialog(mediaViewModel.controller)
    if (recurrenceState.visible) HomeTaskRecurrenceDialog(recurrenceViewModel.controller, viewModel::reload)
    if (gigState.visible) HomeTaskGigDialog(gigViewModel.controller, viewModel::reload, onOpenGig)
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
internal fun HouseholdTaskReadOnlyContent(
    task: HomeTaskDto,
    assignee: String?,
) {
    Text(task.title, style = MaterialTheme.typography.headlineSmall)
    task.description?.takeIf(String::isNotBlank)?.let { Text(it) }
    Text("Status: ${task.status.taskLabel()}")
    task.priority?.let { Text("Priority: ${it.taskLabel()}") }
    task.dueAt?.let { Text("Due: ${taskDueLabel(it)}") }
    assignee?.let { Text("Assigned to $it") }
    if (task.automaticRecurrence != null) {
        Text(task.automaticRecurrence.label())
    } else {
        HouseholdTasksListViewModel.humanRecurrence(
            task.recurrenceRule,
        )?.let { Text("Saved repeat preference: $it. Automatic repeats are off.") }
    }
}

private fun String.taskLabel(): String = replace('_', ' ').replaceFirstChar { it.titlecase(Locale.getDefault()) }

/** The due time in this device's zone, as iOS shows it ("Oct 20, 2026, 9:00 AM"). */
private fun taskDueLabel(value: String): String =
    runCatching {
        OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
    }.getOrDefault("Date unavailable")

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
