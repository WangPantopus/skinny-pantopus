@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.my_tasks

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.gigs.MyGigDto
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.activity_filter_sheet.ActivityFilterSheet
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/** Test tag on the My tasks V2 root container. */
const val MY_TASKS_TAG = "my-tasks"

/**
 * T5.3.2 — My tasks V2 (poster side). Thin wrapper around
 * [ListOfRowsScreen]. Four tabs (Open / Active / Done / Closed),
 * 56dp canonical-create FAB, filter icon in the top-bar trailing slot,
 * and an open-tab banner summarising new bids + closing-soon counts.
 * All bespoke logic lives in [MyTasksViewModel].
 */
@Composable
@Suppress("LongParameterList")
fun MyTasksScreen(
    onBack: () -> Unit,
    onOpenTask: (MyGigDto) -> Unit,
    onOpenBids: (MyGigDto) -> Unit = {},
    onEditTask: (MyGigDto) -> Unit = {},
    onMessageWorker: (MyGigDto) -> Unit = {},
    onLeaveReview: (MyGigDto) -> Unit = {},
    onPostTask: () -> Unit = {},
    onRepost: (MyGigDto) -> Unit = {},
    onRebook: (String) -> Unit = {},
    viewModel: MyTasksViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val fab by viewModel.fab.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val showFilterSheet by viewModel.showFilterSheet.collectAsStateWithLifecycle()
    val activityFilter by viewModel.activityFilter.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.bindCallbacks(
            onOpenTask = onOpenTask,
            onOpenBids = onOpenBids,
            onEditTask = onEditTask,
            onMessageWorker = onMessageWorker,
            onLeaveReview = onLeaveReview,
            onPostTask = onPostTask,
            onRepost = onRepost,
        )
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(MY_TASKS_TAG)) {
        ListOfRowsScreen(
            title = "My tasks",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            fab = fab,
            banner = banner,
            onBack = onBack,
            // "Rebook a favorite helper" — collapses to nothing when the
            // server has no rebookable tasks, so it costs a new poster no
            // vertical space. Mirrors iOS MyTasksView's customHeader.
            customHeader = {
                RebookRail(
                    onRebook = { gig ->
                        onRebook(GigsCategory.fromBackendKey(gig.category).key)
                    },
                )
            },
        )
    }

    if (showFilterSheet) {
        ActivityFilterSheet(
            statusTitle = viewModel.statusFilterTitle,
            statusOptions = viewModel.statusFilterOptions,
            sortOptions = viewModel.sortFilterOptions,
            filter = activityFilter,
            onApply = { viewModel.applyFilter(it) },
            onDismiss = { viewModel.dismissFilterSheet() },
        )
    }
}
