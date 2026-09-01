@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.polls

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
 * Concrete Polls list screen wired to
 * `GET /api/homes/:id/polls` — `backend/routes/home.js:6984`.
 *
 * @param onOpenPoll Invoked when a poll row is tapped.
 * @param onStartPoll Invoked when the FAB or empty-state CTA fires.
 * @param onBack Optional back handler.
 */
@Composable
fun PollsListScreen(
    onOpenPoll: (String) -> Unit,
    onStartPoll: () -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: PollsListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()

    var confirmTarget by remember { mutableStateOf<PollConfirmTarget?>(null) }

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onOpenPoll = onOpenPoll, onStartPoll = onStartPoll)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenPollsViewed)
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            is PollsListEvent.ConfirmClose -> {
                confirmTarget = PollConfirmTarget(event.pollId, event.title, destructive = false)
                viewModel.acknowledgeEvent()
            }
            is PollsListEvent.ConfirmDelete -> {
                confirmTarget = PollConfirmTarget(event.pollId, event.title, destructive = true)
                viewModel.acknowledgeEvent()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag("pollsList")) {
        ListOfRowsScreen(
            title = "Polls",
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

    confirmTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { confirmTarget = null },
            title = { Text(if (target.destructive) "Delete poll" else "Close poll") },
            text = {
                Text(
                    if (target.destructive) {
                        "Delete “${target.title}”? This removes it from the household."
                    } else {
                        "Close “${target.title}” to new votes?"
                    },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (target.destructive) {
                            viewModel.deletePoll(target.pollId)
                        } else {
                            viewModel.closePoll(target.pollId)
                        }
                        confirmTarget = null
                    },
                    modifier =
                        Modifier.testTag(
                            if (target.destructive) "pollsList_deleteConfirm" else "pollsList_closeConfirm",
                        ),
                ) { Text(if (target.destructive) "Delete" else "Close") }
            },
            dismissButton = {
                TextButton(onClick = { confirmTarget = null }) { Text("Cancel") }
            },
        )
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.clearActionError() },
            title = { Text("Something went wrong") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearActionError() }) { Text("OK") }
            },
        )
    }
}

/** Which poll the open confirm dialog applies to, and in which tone. */
private data class PollConfirmTarget(
    val pollId: String,
    val title: String,
    val destructive: Boolean,
)
